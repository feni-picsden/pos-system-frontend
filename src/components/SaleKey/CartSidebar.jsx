import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Person as PersonIcon,
  DeleteOutline as DeleteOutlineIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  LocalBarOutlined as ProductTypeIcon,
  Close as CloseIcon,
  LockOutlined as LockIcon,
  StickyNote2Outlined as NoteIcon,
  HelpOutline as HelpOutlineIcon,
  InfoOutlined as InfoOutlinedIcon,
} from '@mui/icons-material';
import LoyaltyDisplay from '../Loyalty/LoyaltyDisplay';
import ReceiptRenderer from '../Receipt/ReceiptRenderer';
import ScaleToFit from '../Receipt/ScaleToFit';
import { lineSavings } from '../../utils/saleTotals';
import LineEditPanel, {
  KeypadPopover,
  LabelValueRow,
  BlueEditableCell,
  CancelConfirmRow,
  TypeDropdown,
} from './LineEditPanel';
import { useAppDialogs } from '../Common/AppDialogProvider';
import settingsService from '../../services/settingsService';
import { effectiveUnitCost } from '../../utils/productCost';

// SaleKeyPage imports the shared keypad from here (quantity popup)
export { KeypadPopover };

// Reference money format: dollars at full size, cents in a 70% span pushed down
// by `raise` px. The grand total carries NO '.' glyph (size/offset separate the
// cents); the 16px Savings/Discount lines keep theirs.
const Money = ({ value, dot = true, raise = 0, centsSize = '70%' }) => {
  const cents = Math.round(Math.abs(Number(value) || 0) * 100);
  return (
    <>
      {Number(value) < 0 ? '-' : ''}${Math.floor(cents / 100)}{dot ? '.' : ''}
      <Box component="span" sx={{ fontSize: centsSize, position: 'relative', top: `${raise}px` }}>
        {String(cents % 100).padStart(2, '0')}
      </Box>
    </>
  );
};

// Live profit of one cart line, on the SAME basis as the reference's product
// price table (measured 2026-08-14: price $32.99 inc, cost $27.44 inc, 16.82% —
// i.e. gross profit margin (sell - cost) / sell with both sides tax-INCLUSIVE).
// unitCost is the product's stored cost, which is tax-inclusive here, so no tax
// is stripped off either side; stripping only the revenue understated profit.
const lineProfit = (item) => {
  const totalPrice = parseFloat(item.price) || 0;
  const qty = parseFloat(item.quantity) || 1;
  const totalCost = (parseFloat(item.unitCost) || 0) * qty;
  const profit = totalPrice - totalCost;
  return { totalPrice, totalCost, profit };
};

// Gross Profit Margin ((sell - cost) / sell) or Markup ((sell - cost) / cost),
// per the Profitability Display company setting — both formulas are the
// reference's own (help article "Profitability Display").
const profitPercent = ({ totalPrice, totalCost, profit }, display) =>
  display === 'Markup'
    ? (totalCost > 0 ? (profit / totalCost) * 100 : 0)
    : (totalPrice > 0 ? (profit / totalPrice) * 100 : 0);

const CartSidebar = ({
  // Receipt complete state
  isTransactionComplete,
  receiptData,
  selectedTemplate,
  receiptTemplates,
  templatesLoading,
  onTemplateChange,
  onPrintReceipt,
  onEmailReceipt,
  onNewTransaction,
  
  // Customer state
  selectedCustomer,
  onAddCustomerClick,
  onRemoveCustomer,
  onCustomerClick,
  getEffectiveOutletId,
  
  // Cart state
  cart,
  selectedCartItem,
  onCartItemSelect,
  onRemoveItem,
  onDiscountConfirm,
  isManualDiscountBlocked,
  canDiscount = true,
  // Reference-style warning toast (page-level); replaces blocking alert()s.
  onWarn,
  onUnlockPrice,
  onEditNote,
  onQuantityKeypadClick,
  onProductDetailClick,
  showLiveProfit,
  canViewLiveProfit,
  
  // Payments
  payments,
  onReversePayment,

  // Totals
  calculateTotal,
  
  // Loyalty
  onLoyaltyCalculated,
  onRedemptionApplied,
  setCart,
  setLoyaltyRedemption,
  setLoyaltyCalculation,
  
  // Actions
  onFinalize,
  
  // Promotion view
  showPromotionView,
  selectedPromotionProduct,
}) => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  // Gross Profit Margin (default) or Markup, per Setup > General > Company.
  const profitDisplay =
    settingsService.getCachedGeneralSettings().profitabilityDisplay || 'Gross Profit Margin';
  // Inline price-override editor (reference expands it under the cart line)
  const [discountEditKey, setDiscountEditKey] = useState(null);
  // Bumped when the line price is re-clicked: toggles the panel's keypad.
  const [keypadNonce, setKeypadNonce] = useState(0);
  // Sale-level override panel (reference: pressing the sale total opens a panel
  // over the lower sidebar with Total Amount Override / Discount Percentage)
  const [saleOverrideOpen, setSaleOverrideOpen] = useState(false);
  const [saleKeypadAnchor, setSaleKeypadAnchor] = useState(null);
  const [saleDiscountMode, setSaleDiscountMode] = useState('total_amount_override');
  const [saleDiscountValue, setSaleDiscountValue] = useState('');
  const saleCellRef = useRef(null);
  // "Unlocked Price" ? modal (reference .sale-summary-unlocked-price row)
  const [unlockedInfoOpen, setUnlockedInfoOpen] = useState(false);

  // Reference: taking a payment (a $ sale key) flips the sidebar into the
  // PAYMENT view — payment rows + Total/Remaining + "Return to Sale" — until the
  // operator presses Return to Sale.
  const [paymentView, setPaymentView] = useState(false);
  const paymentCountRef = useRef(payments.length);
  const [reverseTarget, setReverseTarget] = useState(null);
  useEffect(() => {
    if (payments.length > paymentCountRef.current && !isTransactionComplete) setPaymentView(true);
    if (payments.length === 0) setPaymentView(false);
    paymentCountRef.current = payments.length;
  }, [payments.length, isTransactionComplete]);
  useEffect(() => { if (isTransactionComplete) setPaymentView(false); }, [isTransactionComplete]);

  const paidTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

  const closeDiscountEditor = () => setDiscountEditKey(null);

  const openDiscountEditor = (item, e) => {
    e.stopPropagation();
    if (!canDiscount) {
      onWarn?.('You do not have permission to discount');
      return;
    }
    if (isManualDiscountBlocked?.(item)) {
      onWarn?.(`Manual discounts are not allowed for ${item.name}.`);
      return;
    }
    const key = `${item.id}-${item.timestamp}`;
    // Re-click on the open line's price toggles the KEYPAD; the panel stays.
    if (discountEditKey === key) { setKeypadNonce((n) => n + 1); return; }
    setDiscountEditKey(key);
  };

  // Sale-level discount: both reference types re-price the LINES proportionally.
  const cartBaseTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  const openSaleDiscount = () => {
    if (!cart.length) return;
    if (!canDiscount) {
      onWarn?.('You do not have permission to discount');
      return;
    }
    setSaleDiscountMode('total_amount_override');
    setSaleDiscountValue('');
    setSaleOverrideOpen(true);
  };

  const closeSaleOverride = () => {
    setSaleOverrideOpen(false);
    setSaleKeypadAnchor(null);
  };

  // Auto-open the $ keypad on the blue New Total cell when the panel opens.
  useEffect(() => {
    if (saleOverrideOpen && saleCellRef.current) setSaleKeypadAnchor(saleCellRef.current);
  }, [saleOverrideOpen]);

  const applySaleDiscount = () => {
    const amount = parseFloat(saleDiscountValue);
    closeSaleOverride();
    // Empty cell = close with no change (reference: cell opens empty)
    if (!cartBaseTotal || saleDiscountValue === '' || isNaN(amount) || amount < 0) return;
    // A sale-level discount re-prices every line, so one protected product blocks it.
    const blocked = cart.find((item) => isManualDiscountBlocked?.(item));
    if (blocked) {
      alert(`Manual discounts are not allowed for ${blocked.name}.`);
      return;
    }
    const target = saleDiscountMode === 'discount_percentage'
      ? cartBaseTotal * (1 - Math.min(100, amount) / 100)
      : amount;
    // ponytail: per-line rounding can leave the sale total a cent off the typed
    // figure; add a remainder sweep onto the last line if that ever matters.
    const factor = target / cartBaseTotal;
    setCart(cart.map((item) => {
      const price = parseFloat(item.price) || 0;
      const newPrice = Math.round(price * factor * 100) / 100;
      return {
        ...item,
        price: newPrice,
        discountInfo: {
          type: saleDiscountMode,
          originalPrice: price,
          newPrice,
          discountAmount: price - newPrice,
        },
      };
    }));
  };

  // Reference greys the whole totals block out while the cart is empty.
  const cartEmpty = cart.length === 0;
  const totalsColor = cartEmpty ? 'rgba(189, 189, 189, 0.7)' : '#000';

  const renderCartView = () => (
    <>
      {/* Reference sell screen: 75px customer band (#sell-screen-customer).
          No customer: "+ Add Customer" row — '+' glyph 28px in, 16px plus icon
          + 18.72px/700 h3. Customer attached: name 24px + group 12px left (65%),
          Owing 32px + small-caps label right (35%), 50px instant-remove ×. */}
      {selectedCustomer ? (
        <Box
          sx={{
            height: 75,
            boxSizing: 'border-box',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'stretch',
            borderBottom: '1px solid #000',
          }}
        >
          {/* Name/details — cursor:pointer, opens the customer dialog */}
          <Box
            onClick={() => onCustomerClick?.()}
            sx={{ width: '65%', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', pl: '16px', cursor: 'pointer' }}
          >
            <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#000', lineHeight: 'normal', letterSpacing: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {`${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim()}
            </Typography>
            {(selectedCustomer.customerGroup?.name || selectedCustomer.company) && (
              <Typography sx={{ fontSize: 12, fontWeight: 400, color: '#676B72', lineHeight: 'normal', letterSpacing: 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedCustomer.customerGroup?.name || selectedCustomer.company}
              </Typography>
            )}
          </Box>
          {/* Owing — 32px amount with 70% raised cents, small-caps 16px label */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right', pr: '8px' }}>
            <Typography sx={{ fontSize: 32, fontWeight: 400, color: '#000', lineHeight: 'normal', letterSpacing: 'normal' }}>
              <Money value={parseFloat(selectedCustomer.currentOwing ?? selectedCustomer.accountBalance) || 0} dot={false} raise={9} />
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000', fontVariant: 'small-caps', textTransform: 'none', lineHeight: 'normal', letterSpacing: 'normal', m: 0 }}>
              Owing
            </Typography>
          </Box>
          {/* 50px × box — detaches the customer INSTANTLY, no confirmation */}
          <Box
            onClick={(e) => { e.stopPropagation(); onRemoveCustomer?.(); }}
            sx={{ width: 50, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '1rem 0', cursor: 'pointer' }}
          >
            <CloseIcon sx={{ fontSize: 16, color: '#000' }} />
          </Box>
        </Box>
      ) : (
        <Box
          onClick={onAddCustomerClick}
          role="button"
          sx={{
            height: 75,
            boxSizing: 'border-box',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            px: 0,
            color: '#000',
            borderBottom: '1px solid #000',
            cursor: 'pointer',
          }}
        >
          <AddIcon sx={{ fontSize: 16, color: '#000', ml: '28px' }} />
          <Typography
            component="h3"
            sx={{
              fontSize: '18.72px',
              fontWeight: 700,
              color: '#000',
              lineHeight: 'normal',
              letterSpacing: 'normal',
              m: 0,
            }}
          >
            Add Customer
          </Typography>
        </Box>
      )}

      {/* Loyalty Display — only once a customer is attached; the reference shows
          nothing (no helper line) between the Add Customer row and the list. */}
      {selectedCustomer && (
      <LoyaltyDisplay
        customer={selectedCustomer}
        items={cart.map(item => {
          const quantity = item.quantity || 1;
          const totalPrice = parseFloat(item.price) || parseFloat(item.totalPrice) || 0;
          const unitPrice = item.unitPrice || (totalPrice > 0 && quantity > 0 ? totalPrice / quantity : 0);
          
          return {
            productId: item.productId || null,
            quantity: quantity,
            unitPrice: unitPrice,
            discount: item.discount || 0,
            productName: item.productName || item.name || ''
          };
        })}
        outletId={getEffectiveOutletId()}
        onLoyaltyCalculated={onLoyaltyCalculated}
        onRedemptionApplied={onRedemptionApplied}
      />
      )}

      {/* Payment view (reference): the product list is replaced by the payments
          taken on this sale — "<method> / Approved" left, "Amount: $x.xx" right,
          trash to reverse. A reversed payment greys out, loses its trash, and a
          matching negative row is appended. */}
      {paymentView && (
        <Box sx={{ flex: '1 1 0px', minHeight: 0, overflowY: 'auto' }}>
          {payments.map((payment) => {
            const inactive = payment.reversed || payment.reversalOf;
            const color = inactive ? 'rgba(189, 189, 189, 0.9)' : '#000';
            return (
              <Box
                key={payment.id}
                sx={{ display: 'flex', alignItems: 'center', p: '16px 16px 16px 8px', borderBottom: '1px solid #000' }}
              >
                <Box sx={{ flexGrow: 1 }}>
                  <Typography component="div" sx={{ fontSize: 16, color, lineHeight: 'normal', letterSpacing: 'normal' }}>
                    {/* Method names come from sale keys as free text ('cash'); the
                        reference titles them. */}
                    {String(payment.method || payment.description || 'Cash').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Typography>
                  <Typography component="div" sx={{ fontSize: 12, color, lineHeight: 'normal', letterSpacing: 'normal' }}>
                    Approved
                  </Typography>
                </Box>
                <Typography component="span" sx={{ fontSize: 16, color, mr: '12px', lineHeight: 'normal', letterSpacing: 'normal' }}>
                  Amount:{' '}
                  <Money value={parseFloat(payment.amount) || 0} raise={4} centsSize="12px" />
                </Typography>
                {!inactive && (
                  <DeleteOutlineIcon
                    onClick={() => setReverseTarget(payment)}
                    sx={{ fontSize: 16, color: '#000', cursor: 'pointer', flexShrink: 0 }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Reverse Payment confirmation (reference: red ! badge, No / Yes) */}
      <Dialog open={!!reverseTarget} onClose={() => setReverseTarget(null)} maxWidth="xs">
        <DialogContent sx={{ textAlign: 'center', pt: 3 }}>
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: '#F44336', color: '#fff', fontSize: 44, lineHeight: '72px', mx: 'auto', mb: 1 }}>!</Box>
          <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>Reverse Payment</Typography>
          <Typography sx={{ fontSize: 16 }}>
            Revert <b>{String(reverseTarget?.method || reverseTarget?.description || 'Cash').replace(/\b\w/g, (c) => c.toUpperCase())}</b> payment of{' '}
            <b>${(parseFloat(reverseTarget?.amount) || 0).toFixed(2)}</b>?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button variant="outlined" onClick={() => setReverseTarget(null)} sx={{ color: '#000', borderColor: '#bdbdbd', minWidth: 80 }}>No</Button>
          <Button
            variant="contained"
            disableElevation
            onClick={() => { onReversePayment?.(reverseTarget); setReverseTarget(null); }}
            sx={{ bgcolor: '#F44336', minWidth: 80, '&:hover': { bgcolor: '#F44336' } }}
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cart Items — the ONLY scroll region of the panel (reference:
          #sell-screen-transaction-products, flex 1 1 0px, native scrollbar) */}
      <Box sx={{ flex: '1 1 0px', minHeight: 0, overflowY: 'auto', display: paymentView ? 'none' : 'block' }}>
        {cart.map((item) => {
          const isSelected = selectedCartItem && selectedCartItem.id === item.id && selectedCartItem.timestamp === item.timestamp;
          const lineKey = `${item.id}-${item.timestamp}`;
          return (
            <React.Fragment key={lineKey}>
              <Box
                onClick={() => onCartItemSelect(item)}
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'normal',
                  flexWrap: 'wrap',
                  m: 0,
                  p: '16px 16px 16px 8px',
                  // Reference: only the cells (qty / name / price / trash) are
                  // pointers — the row container itself is not.
                  cursor: 'auto',
                  bgcolor: 'transparent',
                  borderBottom: '1px solid #000',
                  borderRadius: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Selection fill is an underlay on the PADDING box, so it stops
                    1px short of the row and never covers the black divider. */}
                {isSelected && (
                  <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#cfebf9', pointerEvents: 'none' }} />
                )}
                {/* Family colour strip (reference .product-family-colour):
                    10px-wide full-height band at the row's left edge, behind
                    the content, only when the product's family has a colour. */}
                {item.familyColor && (
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '10px', bgcolor: item.familyColor, pointerEvents: 'none' }} />
                )}
                {/* Faint product-type watermark at the row's left edge — 80px box,
                    64px glyph bleeding out of the BOTTOM of the row, clipped by
                    the row's overflow:hidden (reference bottom:-50%). */}
                <Box sx={{ position: 'absolute', left: 0, bottom: '-50%', opacity: 0.2, width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pointerEvents: 'none' }}>
                  <ProductTypeIcon sx={{ fontSize: 64, color: '#bdbdbd', fontWeight: 300 }} />
                </Box>
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography
                    component="span"
                    onClick={(e) => onQuantityKeypadClick(item, e)}
                    sx={{ width: 36, flex: '0 1 auto', mr: '8px', textAlign: 'center', fontSize: 16, fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal', color: '#000', cursor: 'pointer' }}
                  >
                    {item.quantity || 1}
                  </Typography>
                  {/* Line-note icon — only when the line carries a note (reference
                      .product-line-note: #313439, hover #676B72, opens the editor) */}
                  {item.note && (
                    <NoteIcon
                      onClick={(e) => { e.stopPropagation(); onEditNote?.(item); }}
                      sx={{ fontSize: 16, color: '#313439', mr: '8px', cursor: 'pointer', flexShrink: 0, transition: 'color .2s', '&:hover': { color: '#676B72' } }}
                    />
                  )}
                  <Typography
                    component="span"
                    onClick={(e) => onProductDetailClick(item, e)}
                    sx={{ flex: '1 1 0px', mr: '16px', fontSize: 16, fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal', color: '#000', cursor: item.productId ? 'pointer' : 'default' }}
                  >
                    {item.name}
                  </Typography>
                  {/* Manual-price padlock — one click reverts to the automatic price
                      (reference .product-line-locked; hidden on gift-card lines) */}
                  {item.discountInfo && !item.giftCardId && (
                    <Box
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canDiscount) { onWarn?.('You do not have permission to discount'); return; }
                        onUnlockPrice?.(item);
                      }}
                      sx={{ width: 20, height: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <LockIcon sx={{ fontSize: 16, color: '#000' }} />
                    </Box>
                  )}
                  <Typography
                    component="span"
                    onClick={(e) => openDiscountEditor(item, e)}
                    sx={{ flex: '0 1 auto', mr: '16px', textAlign: 'start', fontSize: 16, fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal', color: '#000', cursor: 'pointer' }}
                  >
                    ${(() => {
                      const price = parseFloat(item.price);
                      return isNaN(price) ? '0.00' : price.toFixed(2);
                    })()}
                  </Typography>
                  <Box
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item);
                    }}
                    sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 16, color: '#000' }} />
                  </Box>
                </Box>
                {/* Per-unit price (reference .product-line-unit): a second full-width
                    row under the top row, right-aligned. Shown only on the SELECTED
                    line and only when it holds more than one unit. Line `price` is
                    the LINE TOTAL. */}
                {isSelected && (parseFloat(item.quantity) || 1) > 1 && (
                  <Typography
                    component="div"
                    sx={{ position: 'relative', mt: '0.5rem', textAlign: 'right', fontSize: 14, lineHeight: 'normal', letterSpacing: 'normal', color: '#676B72' }}
                  >
                    Item price: ${((parseFloat(item.price) || 0) / (parseFloat(item.quantity) || 1)).toFixed(2)}
                  </Typography>
                )}
                {/* Live profit of the SELECTED line, right-aligned, with the
                    whole sale's profit under it in smaller text. Shown to anyone
                    holding the live-profit permission (the View Live Profit sale
                    key is no longer required). */}
                {canViewLiveProfit && isSelected && (
                  <Box sx={{ position: 'relative', flexBasis: '100%', textAlign: 'right', mt: '0.25rem' }}>
                    <Typography component="div" sx={{ fontSize: 14, lineHeight: 'normal', color: '#313439' }}>
                      {(() => {
                        const stats = lineProfit(item);
                        const { totalCost, profit } = stats;
                        const pct = profitPercent(stats, profitDisplay);
                        // The View Live Profit sale key still does something: it
                        // adds the cost of the line next to the profit.
                        const cost = showLiveProfit ? `Cost: $${totalCost.toFixed(2)}  ` : '';
                        return `${cost}Profit: $${profit.toFixed(2)}  ${pct.toFixed(2)}%`;
                      })()}
                    </Typography>
                  </Box>
                )}
              </Box>
              {/* Inline price-override editor (reference expands under the line) */}
              {discountEditKey === lineKey && (
                <LineEditPanel
                  key={lineKey}
                  item={item}
                  keypadNonce={keypadNonce}
                  onConfirm={(updated) => {
                    if (onDiscountConfirm) onDiscountConfirm(updated);
                    closeDiscountEditor();
                  }}
                  onCancel={closeDiscountEditor}
                />
              )}
            </React.Fragment>
          );
        })}
        {/* Reference cart area is completely blank when empty — no message, no icon. */}
      </Box>

      {/* Payments are shown in the PAYMENT view only (reference): the cart view
          carries no payment rows. */}

      {/* Total and Balance */}
      {/* Reference sell screen shows no running remaining/change or Cost/Profit in
          the summary — only the completion result. Keep the complete-state block. */}
      {isTransactionComplete && (
        <Box sx={{ flexShrink: 0, mt: 2, textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#4CAF50', mb: 1 }}>
            TRANSACTION COMPLETE
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: '#FF9800' }}>
            CHANGE: ${receiptData ? (parseFloat(receiptData.change) || 0).toFixed(2) : '0.00'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Receipt Generated - Transaction ID: {receiptData?.transactionId}
          </Typography>
        </Box>
      )}

      {/* .sale-summary-unlocked-price — exists only while at least one line holds
          a locked (manual) price; shows the automatic price that would apply if
          unlocked. 36px row, transparent bg, #313439 16px, ? icon right. */}
      {cart.some((i) => i.discountInfo) && (
        <Box sx={{ flexShrink: 0, height: 36, boxSizing: 'border-box', display: 'flex', alignItems: 'center', p: '8px', bgcolor: 'transparent' }}>
          <Typography component="span" sx={{ flexGrow: 1, fontSize: 16, fontWeight: 400, color: '#313439', lineHeight: 'normal', letterSpacing: 'normal' }}>
            Unlocked Price:{' '}
            <Money
              // ponytail: single-locked-line was the measured case; multi-line =
              // sum of each locked line's automatic (pre-discount) total.
              value={cart.reduce(
                (sum, i) => i.discountInfo
                  ? sum + (parseFloat(i.price) || 0) + Math.max(0, parseFloat(i.discountInfo.discountAmount) || 0)
                  : sum,
                0
              )}
              raise={4}
              centsSize="14px"
            />
          </Typography>
          <HelpOutlineIcon
            onClick={() => setUnlockedInfoOpen(true)}
            sx={{ fontSize: 16, color: '#313439', cursor: 'pointer', flexShrink: 0 }}
          />
        </Box>
      )}
      {/* Centred info modal opened by the ? icon */}
      <Dialog open={unlockedInfoOpen} onClose={() => setUnlockedInfoOpen(false)} maxWidth="xs">
        <DialogContent sx={{ textAlign: 'center', pt: 3 }}>
          <InfoOutlinedIcon sx={{ fontSize: 40, color: '#5EBBEB', mb: 1 }} />
          <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 1 }}>Unlocked Price</Typography>
          <Typography sx={{ fontSize: 16 }}>
            The unlocked price is the price that would be used instead of the currently
            displayed price. To activate it, simply press the lock next to the product's
            current price.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
          <Button variant="contained" disableElevation onClick={() => setUnlockedInfoOpen(false)} sx={{ bgcolor: '#5EBBEB', color: '#F8F8F8', '&:hover': { bgcolor: '#5EBBEB' } }}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
      {/* #sale-summary — 144px pinned to the bottom of the panel: a 93px totals
          row (two equal 50% children, 8px padding each) + the 50px Finalize. */}
      <Box sx={{ flexShrink: 0, borderTop: '1px solid #000', position: 'relative' }}>
      {/* Total Amount Override panel drawn over the lower sidebar (reference:
          New Total blue cell + mode dropdown + Cancel/Confirm above the totals) */}
      {saleOverrideOpen && (
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: '100%', zIndex: 5, bgcolor: '#fff', border: '1px solid #000', borderBottom: 'none' }} onClick={(e) => e.stopPropagation()}>
          <LabelValueRow label="New Total">
            <BlueEditableCell
              ref={saleCellRef}
              display={saleDiscountValue === ''
                ? ''
                : saleDiscountMode === 'discount_percentage'
                  ? `${saleDiscountValue}%`
                  : `$${(parseFloat(saleDiscountValue) || 0).toFixed(2)}`}
              onClick={(e) => setSaleKeypadAnchor(e.currentTarget)}
            />
          </LabelValueRow>
          <TypeDropdown
            options={[
              { value: 'total_amount_override', label: 'Total Amount Override' },
              { value: 'discount_percentage', label: 'Discount Percentage' },
            ]}
            value={saleDiscountMode}
            onChange={(v) => { setSaleDiscountMode(v); setSaleDiscountValue(''); }}
          />
          <CancelConfirmRow cancelBg="#E8E9EB" onCancel={closeSaleOverride} onConfirm={applySaleDiscount} />
          <KeypadPopover
            open={!!saleKeypadAnchor}
            anchorEl={saleKeypadAnchor}
            onClose={() => setSaleKeypadAnchor(null)}
            value={saleDiscountValue}
            setValue={setSaleDiscountValue}
            onOk={applySaleDiscount}
            mode={saleDiscountMode === 'discount_percentage' ? 'percent' : 'price'}
          />
        </Box>
      )}
      {/* Payment view footer: Total / Remaining centred, then Return to Sale. */}
      {paymentView ? (
        <Box sx={{ height: 93, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: '8px' }}>
          <Typography component="div" sx={{ fontSize: 20, color: '#000', lineHeight: 'normal', letterSpacing: 'normal' }}>
            Total: <Money value={calculateTotal()} raise={4} centsSize="14px" />
          </Typography>
          <Typography component="div" sx={{ fontSize: 24, color: '#000', lineHeight: 'normal', letterSpacing: 'normal' }}>
            Remaining: <Money value={Math.max(0, calculateTotal() - paidTotal)} raise={4} centsSize="16px" />
          </Typography>
        </Box>
      ) : (
      // 93px on the reference; the Total Profit line (local addition) needs a few
      // more, so the bar grows instead of clipping it.
      <Box sx={{ display: 'flex', minHeight: 93, boxSizing: 'border-box' }}>
        <Box sx={{ width: '50%', boxSizing: 'border-box', p: '8px', color: totalsColor, fontSize: 16, fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal' }}>
          {/* Surcharges summary (sale-level) – directly above item summary, like reference design */}
          {(() => {
            // calculateTotal() refreshes each item's surchargeBreakdown as a side
            // effect; run it BEFORE reading them or the labels lag one action
            // behind the total (which is rendered after this block).
            calculateTotal?.();
            const surchargeSummary = {};
            cart.forEach((item) => {
              if (!item.surchargeBreakdown) return;
              Object.entries(item.surchargeBreakdown).forEach(([name, amount]) => {
                const num = Number(amount) || 0;
                if (!num) return;
                surchargeSummary[name] = (surchargeSummary[name] || 0) + num;
              });
            });

            const entries = Object.entries(surchargeSummary);
            if (!entries.length) return null;

            return entries.map(([name, amount]) => (
              <Typography
                key={name}
                variant="body2"
                sx={{ fontWeight: 600, color: 'text.primary', display: 'block' }}
              >
                {name}: ${Number(amount).toFixed(2)}
              </Typography>
            ));
          })()}

          {showPromotionView && selectedPromotionProduct && canViewLiveProfit ? (
            <>
              {(() => {
                const product = selectedPromotionProduct.product;
                const quantity = selectedPromotionProduct.quantity || 1;
                const price = selectedPromotionProduct.price || 0;
                const unitCost = effectiveUnitCost(
                  product,
                  settingsService.getCachedGeneralSettings().costCalculationMethod || 'Last Cost'
                );
                const totalCost = unitCost * quantity;
                const profit = price - totalCost;
                const margin = profitPercent({ totalPrice: price, totalCost, profit }, profitDisplay);
                return (
                  <>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>Cost: ${totalCost.toFixed(2)}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 'bold' }}>
                      Profit: ${profit.toFixed(2)} {margin.toFixed(2)}%
                    </Typography>
                  </>
                );
              })()}
            </>
          ) : (
            <>
              {(() => {
                // Discount = what the inline price editor took off the lines
                // (discountInfo.discountAmount); a price INCREASE never counts.
                const lineDiscount = cart.reduce(
                  (sum, item) => sum + Math.max(0, parseFloat(item.discountInfo?.discountAmount) || 0),
                  0
                );
                // Savings = what every line gave away against its normal price:
                // promotion (normalPrice), combo (comboDeal) and the manual
                // discount, counted once per line.
                const savings = cart.reduce(
                  (sum, item) => sum + lineSavings(item, parseFloat(item.discountInfo?.discountAmount) || 0),
                  0
                );
                // Reference shows TWO counters: Items (total quantity) above
                // Products (line count), both pluralised by count. They go solid
                // black once the sale has content; Savings/Discount are grey
                // (.not-in-use) ONLY while their amount is $0.00.
                const itemCount = cart.reduce((sum, item) => sum + (parseFloat(item.quantity) || 1), 0);
                const lineSx = { fontSize: 16, fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal' };
                return (
                  <>
                    {!cartEmpty && (
                      <Typography component="div" sx={{ ...lineSx, color: 'inherit' }}>
                        {itemCount} Item{itemCount === 1 ? '' : 's'}
                      </Typography>
                    )}
                    <Typography component="div" sx={{ ...lineSx, color: 'inherit' }}>
                      {cart.length} Product{cart.length === 1 ? '' : 's'}
                    </Typography>
                    <Typography component="div" sx={{ ...lineSx, color: !cartEmpty && savings > 0 ? '#000' : 'rgba(189, 189, 189, 0.7)' }}>
                      Savings: <Money value={savings} raise={4} centsSize="14px" />
                    </Typography>
                    <Typography component="div" sx={{ ...lineSx, color: !cartEmpty && lineDiscount > 0 ? '#000' : 'rgba(189, 189, 189, 0.7)' }}>
                      Discount: <Money value={lineDiscount} raise={4} centsSize="14px" />
                    </Typography>
                  </>
                );
              })()}
            </>
          )}
        </Box>
        {/* Grand total: centred in the right half, 40px dollars with the cents in
            a 28px span pushed 11px down and NO '.' glyph. */}
        <Box
          className="sale-summary-total"
          onClick={openSaleDiscount}
          sx={{ width: '50%', boxSizing: 'border-box', p: '8px', textAlign: 'center', color: totalsColor, cursor: cartEmpty ? 'not-allowed' : 'pointer' }}
        >
          <Typography component="div" sx={{ color: 'inherit', fontWeight: 400, fontSize: 40, lineHeight: 'normal', letterSpacing: 'normal' }}>
            <Money value={calculateTotal()} dot={false} raise={11} />
          </Typography>
          <Typography
            component="p"
            sx={{ color: 'inherit', fontSize: 24, fontWeight: 400, fontVariant: 'small-caps', textTransform: 'none', letterSpacing: 'normal', lineHeight: 'normal', textAlign: 'center', m: 0 }}
          >
            Total
          </Typography>
          {/* Whole-sale profit, small, under the Total figure. Same permission
              as the per-line readout. */}
          {canViewLiveProfit && !cartEmpty && (
            <Typography
              component="div"
              sx={{ fontSize: 12, lineHeight: 'normal', color: '#676B72' }}
            >
              Total Profit: $
              {cart.reduce((sum, i) => sum + lineProfit(i).profit, 0).toFixed(2)}
            </Typography>
          )}
        </Box>
      </Box>
      )}

      {/* Action Buttons */}
      {paymentView ? (
        <Button
          variant="contained"
          fullWidth
          onClick={() => setPaymentView(false)}
          disableElevation
          sx={{
            m: 0,
            p: '4px 8px',
            bgcolor: '#F8F8F8',
            color: '#313439',
            height: 50,
            fontSize: 32,
            lineHeight: 'normal',
            letterSpacing: 'normal',
            borderTop: '1px solid #000',
            borderRadius: 0,
            fontWeight: 400,
            textTransform: 'none',
            fontVariant: 'small-caps',
            '&:hover': { bgcolor: '#F8F8F8' },
          }}
        >
          Return to Sale
        </Button>
      ) : isTransactionComplete ? (
        <Button
          variant="contained"
          fullWidth
          onClick={onNewTransaction}
          sx={{
            bgcolor: '#1976d2',
            height: 50,
            borderRadius: 0,
            fontSize: '1.1rem',
            fontWeight: 'bold'
          }}
        >
          NEW TRANSACTION
        </Button>
      ) : (
        // Reference sell screen: single full-width Finalize (#5EBBEB) pinned to the
        // bottom of the panel; stays full blue even while disabled. Parking lives in
        // the Parked Sales tab, not a button here.
        <Button
          variant="contained"
          fullWidth
          disabled={cartEmpty}
          onClick={onFinalize}
          disableElevation
          sx={{
            display: 'inline-block',
            m: 0,
            p: '4px 8px',
            bgcolor: '#5ebbeb',
            color: '#f8f8f8',
            height: 50,
            fontSize: 32,
            lineHeight: 'normal',
            letterSpacing: 'normal',
            borderTop: '1px solid #000',
            borderRight: 0,
            borderBottom: 0,
            borderLeft: 0,
            borderRadius: 0,
            fontWeight: 400,
            textTransform: 'none',
            fontVariant: 'small-caps',
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
            '&:hover': { bgcolor: '#5ebbeb' },
            // Reference disabled state: computed bg stays blue but the text greys
            // to gray-500 and the cursor is not-allowed.
            '&.Mui-disabled': {
              bgcolor: '#5ebbeb',
              color: '#6a7282',
              opacity: 1,
              cursor: 'not-allowed',
              pointerEvents: 'auto',
            },
          }}
        >
          Finalize
        </Button>
      )}
      </Box>
    </>
  );

  return (
    // #sell-screen-summary: 563px outer (561 content inside the 1px black border),
    // flush to the panel's right edge, full height, overflow VISIBLE — only the
    // line-item list scrolls.
    <Box
      sx={{
        width: 563,
        maxWidth: '100%',
        ml: 'auto',
        height: '100%',
        boxSizing: 'border-box',
        border: '1px solid #000',
        borderRadius: 0,
        boxShadow: 'none',
        bgcolor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
      }}
    >
      {/* The completed-sale panel lives in SaleKeyPage — this sidebar only ever
          renders while a sale is still open. */}
      {renderCartView()}
    </Box>
  );
};

export default CartSidebar;
