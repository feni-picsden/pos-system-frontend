import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, BackspaceOutlined, DeleteOutline, Close } from '@mui/icons-material';
import LoyaltyPaymentDialog from '../Loyalty/LoyaltyPaymentDialog';
import PayByCardDialog from '../Payment/PayByCardDialog';
import CashOutDialog from '../Payment/CashOutDialog';
import TyroPairingDialog from '../Payment/TyroPairingDialog';
import tyroService from '../../services/tyroService';
import { isEftposMethod } from '../../services/linklyService';
import { allowsCashOut, getPaymentMethodSettings } from '../../services/paymentMethodService';
import settingsService from '../../services/settingsService';
import { useAppDialogs } from '../Common/AppDialogProvider';
import { formatMoney } from '../../utils/currency';

// ponytail: one resolver for effective customer-management flags. The customer's own
// value wins only when overrideCustomerGroup is set (and actually provided); otherwise
// the group value applies. allowAccountSales is group-only (applies to every member).
const effectiveCustomerFlags = (customer) => {
  const group = customer?.customerGroup || {};
  const override = !!customer?.overrideCustomerGroup;
  const pick = (own, grp) =>
    override && own !== undefined && own !== null && own !== '' ? own : grp;
  return {
    allowAccountSales: !!group.allowAccountSales,
    requireOrderReference: !!pick(customer?.requireOrderReference, group.requireOrderReference),
    accountLimit: pick(customer?.accountLimit, group.accountLimit),
  };
};

// ponytail: accountLimit choke. Block only when a real positive cap would be breached by
// currentOwing + this on-account charge. null/empty/0/NaN == unlimited (matches the
// "Unlimited" display in CustomerGroupView), so OFF stays a true no-op.
const exceedsAccountLimit = (currentOwing, onAccountAmount, accountLimit) => {
  const limit = Number(accountLimit);
  if (!Number.isFinite(limit) || limit <= 0) return false; // unlimited / unset
  const owing = Number(currentOwing) || 0;
  const charge = Number(onAccountAmount) || 0;
  return owing + charge > limit + 0.01; // 0.01 mirrors PAYMENT_TOLERANCE
};

// ponytail: refund tender size. A return sale has a NEGATIVE remaining balance
// (money owed back), so the recorded payment must be negative and capped at what
// is owed. No typed amount = refund the whole balance. The numpad strips the
// minus sign, so a typed 16.50 and -16.50 mean the same thing here.
const refundTender = (typedAmount, remainingBalance) => {
  const owed = -remainingBalance;
  const amt = Math.abs(Number(typedAmount) || 0);
  return -(amt > 0 ? Math.min(amt, owed) : owed);
};

// "Use Rounding" (Setup > Payment Methods): round to the nearest currency amount.
// The step is Setup > General > Currency > "Round To" (0.05 in Australia).
// Applies to what this method tenders; other methods are exact.
const roundingStep = () => Number(settingsService.getCachedGeneralSettings().roundTo) || 0.05;
const roundTender = (amount, method, step = roundingStep()) => {
  if (getPaymentMethodSettings(method).useRounding !== true) return amount;
  const sign = amount < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(amount) / step) * step;
};

// Cash is the only tender that can be over-paid: the difference is handed back as
// change from the drawer. Every other method is capped at the balance still owed.
const isCashMethod = (method) =>
  [method?.name, method?.type].some((v) => String(v || '').trim().toLowerCase() === 'cash');

// Runnable self-checks for the money paths (silent unless the arithmetic regresses).
const roundingOn = { masterDatabaseRef: JSON.stringify({ useRounding: true }) };
console.assert(roundTender(10.02, roundingOn, 0.05) === 10, 'rounding: 10.02 -> 10.00');
console.assert(Math.abs(roundTender(10.03, roundingOn, 0.05) - 10.05) < 1e-9, 'rounding: 10.03 -> 10.05');
console.assert(Math.abs(roundTender(10.04, roundingOn, 0.1) - 10) < 1e-9, 'rounding: Round To 0.10 -> 10.00');
console.assert(roundTender(10.02, {}, 0.05) === 10.02, 'rounding: off by default');
console.assert(refundTender('', -16.5) === -16.5, 'refund: empty amount refunds the balance');
console.assert(refundTender('16.50', -16.5) === -16.5, 'refund: typed amount is signed negative');
console.assert(refundTender('5', -16.5) === -5, 'refund: partial refund keeps balance owing');
console.assert(refundTender('99', -16.5) === -16.5, 'refund: capped at the balance owed');
console.assert(exceedsAccountLimit(90, 20, 100) === true, 'accountLimit: 90+20 > 100 must block');
console.assert(exceedsAccountLimit(50, 20, 100) === false, 'accountLimit: 50+20 <= 100 must pass');
console.assert(exceedsAccountLimit(999, 999, 0) === false, 'accountLimit: 0 == unlimited');
console.assert(exceedsAccountLimit(999, 999, null) === false, 'accountLimit: null == unlimited');
console.assert(exceedsAccountLimit(50, 20, '100') === false, 'accountLimit: string cap coerces');

// Reference money format: dollars at full size, cents raised at ~70% size.
// Money was a local component that shrank the cents to 70% and lifted them with
// verticalAlign:top — while the sell screen sidebar pushed its cents DOWN and the
// grand total dropped the decimal point. formatMoney is the one format now.

const FinalizeSaleDialog = ({
  open,
  onClose,
  payments,
  selectedCustomer,
  total,
  remainingBalance,
  availablePaymentMethods,
  defaultPaymentMethodId = null, // register's Default Payment Method (Setup > General > Registers)
  onAddPayment,
  onRemovePayment,
  onSelectPaymentMethod,
  onAddCustomer,
  onRemoveCustomer,
  onReturnToSale,
  onCompleteTransaction,
  customerLoyaltyInfo,
  loyaltyProgramEnabled = false,
  loyaltyCalculation,
  outletId,
}) => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [showLoyaltyDialog, setShowLoyaltyDialog] = useState(false);
  const [cardCharge, setCardCharge] = useState(null); // { amountCents, cashOutCents, methodName }
  const [cashOutPrompt, setCashOutPrompt] = useState(null); // { goodsCents, methodName }
  // Tyro method awaiting a device pairing (reference art. 360020096032)
  const [tyroPairingMethod, setTyroPairingMethod] = useState(null);
  const [orderReference, setOrderReference] = useState('');
  const autoCompleteAttemptedRef = useRef(false);
  const amountInputRef = useRef(null);

  // ponytail: effective flags drive the customer-management gates in this dialog.
  const eff = effectiveCustomerFlags(selectedCustomer);
  // ponytail: requireOrderReference — a reference must be present before we finalize.
  const needsOrderRef = eff.requireOrderReference && !orderReference.trim();
  // ponytail: allowAccountSales — hide On Account when the group forbids account sales
  // (parent already pre-filters, so this is a no-op when allowed / already removed).
  const gatedPaymentMethods = eff.allowAccountSales
    ? availablePaymentMethods
    : availablePaymentMethods.filter(
        (m) => m.name?.toLowerCase() !== 'on account' && m.type?.toLowerCase() !== 'on account'
      );
  // ponytail: setup can hold two payment-method records with the same label in
  // different casing ('EFTPOS Cash Out' / 'EFTPOS CASH OUT'); their tiles are
  // indistinguishable on screen and the extra one wraps the 6-col grid onto a
  // second row. Keep the first of each label. Fix the data too if you want the
  // record gone; this only stops the duplicate tile.
  const tenderLabel = (m) => (m?.name || m?.type || '').trim().toLowerCase();
  const visiblePaymentMethods = gatedPaymentMethods.filter(
    (m, i, all) => all.findIndex((o) => tenderLabel(o) === tenderLabel(m)) === i
  );

  useEffect(() => {
    if (!open) {
      setPaymentAmount('');
      setSelectedPaymentMethod(null);
      setOrderReference('');
      autoCompleteAttemptedRef.current = false;
    }
  }, [open]);

  // Reference parity: Escape closes the finalize panel back to the sale (cart kept).
  // Guarded so Escape inside a child dialog (loyalty / cash out / PIN pad) only closes that dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showLoyaltyDialog || cardCharge || cashOutPrompt) return;
      onReturnToSale();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, showLoyaltyDialog, cardCharge, cashOutPrompt, onReturnToSale]);

  // Reference ("How to Pay During a Sale"): Enter while the currency input is
  // focused puts the payment through on the DEFAULT payment method (the one
  // flagged default in Setup > Payment Methods, else the first tile). No amount
  // typed = the whole balance, exactly as tapping that tile would.
  const enterTenderRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onEnter = (e) => {
      if (e.key !== 'Enter') return;
      if (document.activeElement !== amountInputRef.current) return;
      if (enterTenderRef.current) {
        e.preventDefault();
        enterTenderRef.current();
      }
    };
    window.addEventListener('keydown', onEnter);
    return () => window.removeEventListener('keydown', onEnter);
  }, [open]);

  const PAYMENT_TOLERANCE = 0.01;
  // Refund/return sales have a negative total; |remaining| within tolerance means settled either way.
  const isFullyPaid =
    Math.abs(total) > PAYMENT_TOLERANCE &&
    Math.abs(remainingBalance) <= PAYMENT_TOLERANCE &&
    payments.length > 0;

  // Already fully paid when finalize opens (e.g. paid on sales screen first)
  useEffect(() => {
    // ponytail: requireOrderReference — never auto-finalize until the reference is entered.
    if (!open || !isFullyPaid || autoCompleteAttemptedRef.current || needsOrderRef) return;
    autoCompleteAttemptedRef.current = true;
    const timer = setTimeout(() => {
      onCompleteTransaction(payments);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, isFullyPaid, payments, onCompleteTransaction, needsOrderRef]);

  const handleKeypadClick = (value) => {
    if (value === 'backspace') {
      setPaymentAmount(prev => prev.slice(0, -1));
    } else if (value === '.') {
      if (!paymentAmount.includes('.')) {
        setPaymentAmount(prev => prev + '.');
      }
    } else {
      setPaymentAmount(prev => prev + value);
    }
  };

  // The payment row(s) for a non-integrated tender of `requested` dollars.
  //  * Cash may exceed the balance (change); other methods are capped at it.
  //  * A method with "Use Rounding" rounds what it takes. When that tender pays the
  //    WHOLE balance but rounds it DOWN (10.02 -> 10.00), the customer owes nothing
  //    more, so the unrounded cents go on a Rounding row — otherwise 2c stays
  //    "remaining" and the sale can never finish.
  //  * Never a $0 row (a tender that rounds to nothing adds nothing).
  const tenderRows = (requested, method) => {
    const name = method.name || method.type;
    const tender = isCashMethod(method) ? requested : Math.min(requested, remainingBalance);
    if (!(tender > 0)) return [];
    const rounded = Math.round(roundTender(tender, method) * 100) / 100;
    const rows = rounded > 0 ? [{ amount: rounded, method: name, description: name }] : [];
    const coversBalance = tender >= remainingBalance - PAYMENT_TOLERANCE;
    const shortBy = Math.round((remainingBalance - rounded) * 100) / 100;
    if (coversBalance && shortBy > 0 && shortBy < roundingStep()) {
      rows.push({ amount: shortBy, method: 'Rounding', description: 'Rounding' });
    }
    return rows;
  };

  const handlePaymentMethodClick = (method) => {
    // ponytail: requireOrderReference — block any payment entry until a reference exists.
    if (needsOrderRef) {
      alert('Please enter an order reference before taking payment for this customer.');
      return;
    }
    setSelectedPaymentMethod(method);
    const amount = parseFloat(paymentAmount) || 0;

    // Tyro-typed method with no terminal paired on this device: the reference
    // shows the pairing screen the first time Tyro is used (pairing is stored
    // per browser device). Once paired, the tender records as usual.
    if ((method.type || '') === 'Tyro' && !tyroService.getPairing()) {
      setTyroPairingMethod(method);
      return;
    }

    // Handle card / EFTPOS: process through the Linkly PIN pad instead of just
    // recording a payment. The payment is only added once the card is approved.
    if (isEftposMethod(method)) {
      // Negative balance = money owed back to the customer -> card REFUND.
      if (remainingBalance < -PAYMENT_TOLERANCE) {
        const refundAmount = amount > 0 ? Math.min(amount, -remainingBalance) : -remainingBalance;
        setCardCharge({
          amountCents: Math.round(refundAmount * 100),
          methodName: method.name || method.type || 'EFTPOS',
          txnType: 'refund',
        });
        return;
      }
      const chargeAmount = amount > 0 ? Math.min(amount, remainingBalance) : remainingBalance;
      const goodsCents = Math.max(0, Math.round(chargeAmount * 100));
      // Cash-out-enabled method: ask for the cash amount first, then charge the
      // card for goods + cash out in one transaction.
      if (allowsCashOut(method)) {
        setCashOutPrompt({ goodsCents, methodName: method.name || method.type || 'EFTPOS' });
        return;
      }
      if (chargeAmount > 0) {
        setCardCharge({
          amountCents: goodsCents,
          methodName: method.name || method.type || 'EFTPOS',
          txnType: 'purchase',
        });
      }
      return;
    }

    // Refund (return sale): the balance is negative, so EVERY non-integrated tender
    // pays money back — record a negative payment. Same rule the EFTPOS branch above
    // uses; the branches below all assume a positive balance and would no-op.
    if (remainingBalance < -PAYMENT_TOLERANCE) {
      onAddPayment({
        amount: refundTender(paymentAmount, remainingBalance),
        method: method.name || method.type,
        description: method.name || method.type,
      });
      setPaymentAmount('');
      setSelectedPaymentMethod(null);
      return;
    }

    // Handle "On Account" payment method
    if ((method.name?.toLowerCase() === 'on account' || method.type?.toLowerCase() === 'on account')) {
      const accountAmount = amount > 0 ? Math.min(amount, remainingBalance) : remainingBalance;

      // ponytail: accountLimit — refuse an on-account charge that breaches the credit cap.
      if (exceedsAccountLimit(selectedCustomer?.currentOwing, accountAmount, eff.accountLimit)) {
        alert('This on-account amount would exceed the customer account limit.');
        return;
      }

      if (accountAmount > 0) {
        // The order reference travels WITH the payment (saveSaleToHistory forwards
        // payment.reference to createSale). onAddPayment completes the sale itself once
        // it is fully paid, so there is no second, delayed completion here — that one
        // carried the reference but always lost to the first and was skipped.
        onAddPayment({
          amount: accountAmount,
          method: 'On Account',
          description: 'On Account Payment',
          reference: orderReference.trim() || undefined,
        });
        setPaymentAmount('');
        setSelectedPaymentMethod(null);
      }
      return;
    }
    
    // Handle Loyalty payment method
    if ((method.name?.toLowerCase() === 'loyalty' || method.type?.toLowerCase() === 'loyalty') && customerLoyaltyInfo) {
      // For loyalty, use available points or remaining balance, whichever is less
      const maxLoyaltyAmount = customerLoyaltyInfo.redemptionValue || 0;
      const loyaltyAmount = amount > 0 ? Math.min(amount, maxLoyaltyAmount, remainingBalance) : Math.min(maxLoyaltyAmount, remainingBalance);
      
      if (loyaltyAmount > 0) {
        onAddPayment({
          amount: loyaltyAmount,
          method: 'Loyalty',
          description: 'Loyalty Points Redemption'
        });
        setPaymentAmount('');
        setSelectedPaymentMethod(null);
      }
      return;
    }
    
    // Cash may be over-paid (e.g. $100 on a $49 sale) — change is calculated on
    // complete; other methods are capped at the balance (see tenderRows).
    // Ref: clicking a tender with the amount left empty pays the full remaining
    // balance (same default the EFTPOS / On Account / Loyalty branches use).
    const rows = tenderRows(amount > 0 ? amount : remainingBalance, method);
    if (rows.length > 0) {
      onAddPayment(rows.length === 1 ? rows[0] : rows);
      setPaymentAmount('');
      setSelectedPaymentMethod(null);
    }
  };

  // Enter on the amount box tenders on the default method (see the keydown
  // effect above). Kept in a ref so the listener always calls the fresh closure.
  enterTenderRef.current = () => {
    if (showLoyaltyDialog || cardCharge || cashOutPrompt || tyroPairingMethod) return;
    if (Math.abs(remainingBalance) <= PAYMENT_TOLERANCE) return;
    // Register setting first (reference), then the method flagged default in
    // Setup > Payment Methods, then Cash, then the first tile.
    const method =
      (defaultPaymentMethodId != null && defaultPaymentMethodId !== '' &&
        visiblePaymentMethods.find((m) => String(m.id) === String(defaultPaymentMethodId))) ||
      visiblePaymentMethods.find((m) => m.isDefault) ||
      visiblePaymentMethods.find((m) => isCashMethod(m)) ||
      visiblePaymentMethods[0];
    if (method) handlePaymentMethodClick(method);
  };

  const handlePayExactAmount = () => {
    if (selectedPaymentMethod && remainingBalance > 0) {
      // ponytail: requireOrderReference — block the finalize path until a reference exists.
      if (needsOrderRef) {
        alert('Please enter an order reference before taking payment for this customer.');
        return;
      }
      // Handle "On Account" payment method
      if (selectedPaymentMethod.name?.toLowerCase() === 'on account' || selectedPaymentMethod.type?.toLowerCase() === 'on account') {
        // ponytail: accountLimit — refuse an on-account charge that breaches the credit cap.
        if (exceedsAccountLimit(selectedCustomer?.currentOwing, remainingBalance, eff.accountLimit)) {
          alert('This on-account amount would exceed the customer account limit.');
          return;
        }
        // Pay exact remaining balance with On Account
        const onAccountPayment = {
          amount: remainingBalance,
          method: 'On Account',
          description: 'On Account Payment',
          // Travels with the payment; onAddPayment completes the sale (see the click path).
          reference: orderReference.trim() || undefined,
        };

        // Create the payment object with the same format as handleAddPaymentFromDialog creates
        const newPayment = {
          id: `payment-${crypto.randomUUID()}`,
          amount: remainingBalance,
          method: 'On Account',
          timestamp: Date.now(),
          description: 'On Account Payment',
          // ponytail: requireOrderReference — persist the ref via payment.reference.
          reference: orderReference.trim() || undefined,
        };
        
        onAddPayment(onAccountPayment);
        setPaymentAmount('');
        setSelectedPaymentMethod(null);
        
        // Auto-complete the sale when "On Account" payment covers the full amount
        console.log('[On Account] Pay exact amount - auto-completing sale');
        console.log('[On Account] Created payment object:', newPayment);
        
        return;
      }
      
      // Handle Loyalty payment method
      if ((selectedPaymentMethod.name?.toLowerCase() === 'loyalty' || selectedPaymentMethod.type?.toLowerCase() === 'loyalty') && customerLoyaltyInfo) {
        const maxLoyaltyAmount = customerLoyaltyInfo.redemptionValue || 0;
        const loyaltyAmount = Math.min(remainingBalance, maxLoyaltyAmount);
        
        if (loyaltyAmount > 0) {
          onAddPayment({
            amount: loyaltyAmount,
            method: 'Loyalty',
            description: 'Loyalty Points Redemption'
          });
          setPaymentAmount('');
          setSelectedPaymentMethod(null);
        }
        return;
      }
      
      // EFTPOS must go through the PIN pad, never a direct payment record.
      if (isEftposMethod(selectedPaymentMethod)) {
        handlePaymentMethodClick(selectedPaymentMethod);
        return;
      }

      const rows = tenderRows(remainingBalance, selectedPaymentMethod);
      if (rows.length > 0) onAddPayment(rows.length === 1 ? rows[0] : rows);
      setPaymentAmount('');
      setSelectedPaymentMethod(null);
    }
  };

  const keypadButtons = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', 'backspace']
  ];

  // Predictive tendered amounts (reference parity): exact remaining plus the
  // remaining rounded up to each prediction denomination from the methods'
  // settings (Setup > Payment Methods), deduped ascending. ponytail: union of
  // all methods' denominations; NO fallback — the reference shows no prediction
  // row unless a method has denominations configured.
  const predictionAmounts = useMemo(() => {
    const denoms = new Set();
    (availablePaymentMethods || []).forEach((m) => {
      String(getPaymentMethodSettings(m).predictionDenominations || '')
        .split(',')
        .map((s) => parseFloat(s))
        .filter((n) => Number.isFinite(n) && n > 0)
        .forEach((n) => denoms.add(n));
    });
    if (denoms.size === 0) return [];
    const rem = Math.max(0, remainingBalance || 0);
    const amounts = new Set([Math.round(rem * 100)]);
    [...denoms].forEach((d) => {
      const up = Math.ceil((rem - 0.001) / d) * d;
      if (up > 0) amounts.add(Math.round(up * 100));
    });
    return [...amounts].sort((a, b) => a - b).slice(0, 6).map((c) => c / 100);
  }, [availablePaymentMethods, remainingBalance]);

  if (!open) return null;

  return (
    <Box sx={{ display: 'flex', height: '100%', width: '100%', maxWidth: '100%', bgcolor: 'white', overflow: 'hidden', position: 'relative', zIndex: 0 ,gap: '10px' }}>
        {/* Payment Input and Keypad Section — panel has NO padding: each block supplies
            its own inset, and the panel itself is the scroll container (reference parity). */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'block', p: 0, overflowY: 'auto', bgcolor: 'white', border: '1px solid #000' }}>
          {/* Title — spans the full panel width, collapsing 19.92px margins */}
          <Typography component="h2" sx={{ m: '16px 0', fontSize: 20, fontWeight: 'bold', lineHeight: 'normal', letterSpacing: 'normal', color: '#000', textAlign: 'center' }}>
            Finalise Sale
          </Typography>

          {/* Amount and keypad form one connected, square bordered panel. */}
          <Box sx={{ width: 400, maxWidth: 'calc(100% - 32px)', bgcolor: 'white', border: '1px solid #000', m: '16px auto 24px' }}>
            {/* Amount row: '$' prefix + borderless editable input, bottom border only */}
            <Box sx={{ display: 'flex', alignItems: 'center', height: 91, borderBottom: '1px solid #000', px: 2, boxSizing: 'border-box' }}>
              <Box component="span" sx={{ fontFamily: 'inherit', fontSize: '26.91px', lineHeight: 1.25, fontWeight: 400, color: '#000', mr: 1.5, flexShrink: 0 }}>
                $
              </Box>
              <Box
                component="input"
                type="text"
                inputMode="decimal"
                autoFocus
                ref={amountInputRef}
                value={paymentAmount}
                onChange={(e) => {
                  // digits + a single decimal point only
                  let v = e.target.value.replace(/[^0-9.]/g, '');
                  const dot = v.indexOf('.');
                  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
                  setPaymentAmount(v);
                }}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  bgcolor: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: '26.91px',
                  lineHeight: 1.25,
                  letterSpacing: 'normal',
                  fontWeight: 400,
                  color: '#000',
                  textAlign: 'left',
                  p: 0,
                }}
              />
              {paymentAmount !== '' && (
                <IconButton
                  aria-label="Clear payment amount"
                  onClick={() => {
                    setPaymentAmount('');
                    amountInputRef.current?.focus();
                  }}
                  sx={{ color: 'error.main', flexShrink: 0 }}
                >
                  <Close fontSize="small" />
                </IconButton>
              )}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
              {keypadButtons.flat().map((key, index) => (
                <Box
                  key={key}
                  component="button"
                  type="button"
                  aria-label={key === 'backspace' ? 'Backspace' : undefined}
                  onClick={() => {
                    handleKeypadClick(key);
                    amountInputRef.current?.focus();
                  }}
                  sx={{
                    height: 72,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: '#fff',
                    color: '#676b72',
                    fontFamily: 'inherit',
                    fontSize: '26.91px',
                    fontWeight: 400,
                    border: 0,
                    borderRight: index % 3 < 2 ? '1px solid #000' : 0,
                    borderBottom: index < 9 ? '1px solid #000' : 0,
                    borderRadius: 0,
                    cursor: 'pointer',
                    p: 0,
                    transition: 'none',
                    '&:hover': { color: '#313439' },
                  }}
                >
                  {key === 'backspace' ? <BackspaceOutlined sx={{ fontSize: '26.91px' }} /> : key}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Predictive tendered-amount buttons — only when a method has denominations configured */}
          {predictionAmounts.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Grid container spacing={1} sx={{ maxWidth: 400 }}>
                {predictionAmounts.map((amt) => (
                  <Grid item xs={4} key={amt}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => setPaymentAmount(amt.toFixed(2))}
                      sx={{
                        height: 40,
                        fontSize: 16,
                        fontWeight: 700,
                        border: '1px solid #000',
                        // Selected (armed) tender reads as the palette primary; hover is the
                        // lighter zebra fill so the two states stay distinguishable.
                        bgcolor: paymentAmount === amt.toFixed(2) ? '#5ebbeb' : 'white',
                        color: paymentAmount === amt.toFixed(2) ? '#f8f8f8' : '#000',
                        borderRadius: 0,
                        '&:hover': {
                          border: '1px solid #000',
                          bgcolor: paymentAmount === amt.toFixed(2) ? '#5ebbeb' : '#f8f8f8',
                        },
                      }}
                    >
                      ${amt.toFixed(2)}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Payment Method Buttons: 6-col grid, 16px gap, 16px padding, auto-sized rows.
              No inner scroll container — the panel above is what scrolls. */}
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))', lg: 'repeat(7, minmax(0, 1fr))' }, gridAutoRows: 'auto', gap: '12px', p: '0 12px 16px' }}>
              {visiblePaymentMethods.map((method, index) => {
                // "Default to Pay Exact" (Setup > Payment Methods) is the only thing
                // that decides this: whether the method can be used without specifying
                // an amount first. Every tender pays exact unless it is explicitly
                // switched off, Cash included — press Cash on an empty input and it
                // takes the exact remaining balance. Only an explicit false gates the
                // tile, so an unconfigured method is never silently locked.
                // A refund (negative balance) has nothing to type — the tile stays live.
                const methodSettings = getPaymentMethodSettings(method);
                const needsAmountFirst = methodSettings.defaultToPayExact === false;
                const amountLocked =
                  needsAmountFirst &&
                  !paymentAmount.trim() &&
                  remainingBalance > -PAYMENT_TOLERANCE;
                // Setup > Payment Methods > "Payment Button Background / Text
                // Colour" (hex). Unset or invalid = the plain white/black tile.
                const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? v : null);
                const isAccountOrLoyalty = [method.name, method.type].some(value =>
                  ['on account', 'loyalty'].includes(String(value || '').trim().toLowerCase()));
                const tileBg = hex(methodSettings.buttonBackgroundColour) || (isAccountOrLoyalty ? '#e5e7eb' : null);
                const tileFg = hex(methodSettings.buttonTextColour);
                return (
                  <Button
                    key={method.id || index}
                    disabled={needsOrderRef || amountLocked || ((method.name?.toLowerCase() === 'loyalty' || method.type?.toLowerCase() === 'loyalty') && !(customerLoyaltyInfo?.loyaltyPoints > 0))}
                    onClick={() => {
                      if (method.type === 'Gift Card' || method.name === 'Vii Gift Card') {
                        onSelectPaymentMethod(method);
                      } else if ((method.name?.toLowerCase() === 'loyalty' || method.type?.toLowerCase() === 'loyalty')) {
                        // Open loyalty payment dialog
                        if (customerLoyaltyInfo && customerLoyaltyInfo.loyaltyPoints > 0) {
                          setShowLoyaltyDialog(true);
                        } else {
                          // Show message if customer has no points
                          alert('Customer does not have any loyalty points available for redemption.');
                        }
                      } else {
                        // One path for every tender. handlePaymentMethodClick already
                        // covers all four cases: refund, On Account, Loyalty, and a
                        // plain tender — and an empty input there means "the whole
                        // remaining balance" (tenderRows, line ~332). A second inline
                        // copy of that used to live here and called roundTender direct,
                        // so a rounded-down cash tender left a few cents "remaining"
                        // and the sale could never finish; tenderRows adds the Rounding
                        // row that closes it.
                        handlePaymentMethodClick(method);
                      }
                    }}
                    sx={{
                      display: 'block',
                      minWidth: 0,
                      minHeight: 72,
                      p: 2,
                      textTransform: 'none',
                      border: '1px solid currentColor',
                      bgcolor: tileBg || 'transparent',
                      color: tileFg || '#000',
                      borderRadius: 0,
                      fontSize: 20,
                      fontWeight: 400,
                      lineHeight: 'normal',
                      letterSpacing: 'normal',
                      transition:
                        'color 0.15s, background-color 0.15s, border-color 0.15s, outline-color 0.15s, text-decoration-color 0.15s, fill 0.15s, stroke 0.15s',
                      '&:hover': {
                        border: '1px solid currentColor',
                        bgcolor: tileBg || 'transparent',
                      },
                      // Amount-locked tiles look identical to enabled ones (reference);
                      // the order-reference gate keeps its greyed affordance.
                      '&.Mui-disabled': {
                        bgcolor: method.name?.toLowerCase() === 'loyalty' || method.type?.toLowerCase() === 'loyalty' ? '#e5e7eb' : tileBg || 'transparent',
                        color: isAccountOrLoyalty || (amountLocked && !needsOrderRef) ? '#000' : '#737373',
                        borderColor: '#000',
                        cursor: amountLocked && !needsOrderRef ? 'pointer' : 'default',
                      },
                    }}
                  >
                    {method.name || method.type}
                  </Button>
                );
              })}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, px: 1.5, pb: 2 }}>
              {selectedCustomer && eff.allowAccountSales && (
                <Box sx={{ fontSize: 12 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, mb: .5 }}>Account Customer Details</Typography>
                  <Typography sx={{ fontSize: 12 }}>Account Balance: {formatMoney(Number(selectedCustomer.currentOwing) || 0)}</Typography>
                  {selectedCustomer.accountLimit > 0 && <Typography sx={{ fontSize: 12 }}>Account Limit: {formatMoney(selectedCustomer.accountLimit)}</Typography>}
                </Box>
              )}
              {loyaltyProgramEnabled && customerLoyaltyInfo?.loyaltyEnabled && (
                <Box sx={{ ml: 'auto', textAlign: 'right' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, mb: .5 }}>Loyalty Customer Details</Typography>
                  <Typography sx={{ fontSize: 12 }}>Customer Loyalty Points: {customerLoyaltyInfo.loyaltyPoints || 0}</Typography>
                  <Typography sx={{ fontSize: 12 }}>Customer Loyalty Value: {formatMoney(customerLoyaltyInfo.redemptionValue || 0)}</Typography>
                  <Typography sx={{ fontSize: 12 }}>Loyalty Earned This Sale: {loyaltyCalculation?.totalPointsEarned || 0}</Typography>
                  <Typography sx={{ fontSize: 12 }}>Points to Redeem Sale: {Math.ceil(Math.max(0, Number(total) || 0) * (Number(customerLoyaltyInfo.redemptionRate) || 0))}</Typography>
                </Box>
              )}
            </Box>

            {/* Pay Exact Amount Button */}
            {selectedPaymentMethod && remainingBalance > 0 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  disabled={needsOrderRef}
                  onClick={handlePayExactAmount}
                  sx={{
                    bgcolor: '#16a34a',
                    color: '#f8f8f8',
                    px: 4,
                    py: 1.5,
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 0,
                    // Surface has no hover fills (tiles/footer measured flat).
                    '&:hover': {
                      bgcolor: '#16a34a',
                    }
                  }}
                >
                  Pay ${remainingBalance.toFixed(2)}
                </Button>
              </Box>
            )}
          </Box>
        </Box>
        {/* Sidebar Section */}
        <Box sx={{ 
          flex: '0 0 561px',
          maxWidth: '100%',
          display: 'flex', 
          flexDirection: 'column', 
          bgcolor: 'white',
          border: '1px solid #000',
          overflow: 'hidden'
        }}>
          {selectedCustomer ? (
            <Box sx={{ minHeight: 60, px: 1.5, py: 1, borderBottom: '1px solid #000', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 20, overflowWrap: 'anywhere' }}>
                  {selectedCustomer.company || `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim()}
                </Typography>
                {selectedCustomer.customerGroup?.name && (
                  <Typography sx={{ fontSize: 10, color: '#676b72' }}>
                    {selectedCustomer.customerGroup.name}
                  </Typography>
                )}
              </Box>
              {eff.allowAccountSales ? (
                <Box sx={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <Typography sx={{ fontSize: 26 }}>{formatMoney(Number(selectedCustomer.currentOwing) || 0)}</Typography>
                  <Typography sx={{ fontSize: 12 }}>Owing</Typography>
                </Box>
              ) : loyaltyProgramEnabled && customerLoyaltyInfo?.loyaltyEnabled ? (
                <Box sx={{ textAlign: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 12 }}>Loyalty</Typography>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box><Typography sx={{ fontSize: 9 }}>POINTS</Typography><Typography sx={{ fontSize: 12 }}>{customerLoyaltyInfo.loyaltyPoints || 0}</Typography></Box>
                    <Box><Typography sx={{ fontSize: 9 }}>VALUE</Typography><Typography sx={{ fontSize: 12 }}>{formatMoney(customerLoyaltyInfo.redemptionValue || 0)}</Typography></Box>
                  </Box>
                </Box>
              ) : null}
              <IconButton aria-label="Remove customer" onClick={onRemoveCustomer} size="small" sx={{ color: '#000' }}>
                <Close sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ) : (
            <Box component="button" type="button" onClick={onAddCustomer} sx={{ minHeight: 60, px: 1.5, display: 'flex', alignItems: 'center', gap: 1, border: 0, borderBottom: '1px solid #000', bgcolor: '#fff', cursor: 'pointer', flexShrink: 0 }}>
              <AddIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: 18, fontWeight: 700 }}>Add Customer</Typography>
            </Box>
          )}
          {/* Order Reference — required by some customer groups (requireOrderReference) */}
          {eff.requireOrderReference && (
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #000' }}>
              <TextField
                label="Order Reference"
                required
                value={orderReference}
                onChange={(e) => setOrderReference(e.target.value)}
                error={needsOrderRef}
                helperText={needsOrderRef ? 'Required before finalizing this sale' : ' '}
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
                  },
                  '& input::placeholder': { color: '#808080', opacity: 1 },
                }}
              />
            </Box>
          )}

          {/* Reference hides the sale line items while finalize is open — empty white rail body */}
          <Box sx={{ flex: 1, bgcolor: 'white' }} />

          {/* Sale Summary — centred block under a black hairline, reference money format */}
          <Box sx={{
            p: '0px 16px 0px 0px',
            borderTop: '1px solid #000',
            borderRight: 0,
            borderBottom: 0,
            borderLeft: 0,
            minHeight: 68,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'start',
            color: '#000',
            bgcolor: 'transparent',
          }}>
            {payments.length > 0 && (
              <Box sx={{ mb: 1 }}>
                {payments.map((payment, index) => (
                  <Box
                    key={payment.id || index}
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}
                  >
                    <Typography component="div" sx={{ fontSize: '19.2px', fontWeight: 700, color: '#676b72' }}>
                      {payment.description}: {formatMoney(payment.amount)}
                    </Typography>
                    {/* A mis-keyed tender must be removable in place. PIN pad charges are
                        left alone — the money already moved, refund it on the pad instead. */}
                    {onRemovePayment && payment.id && !payment.integrated && (
                      <IconButton
                        size="small"
                        aria-label="Remove payment"
                        onClick={() => onRemovePayment(payment.id)}
                        sx={{ color: '#dc2626', p: '2px', '&:hover': { bgcolor: 'transparent' } }}
                      >
                        <DeleteOutline sx={{ fontSize: 18 }} />
                      </IconButton>
                    )}
                  </Box>
                ))}
              </Box>
            )}
            <Typography component="div" sx={{ fontSize: '23.04px', fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal' }}>
              Total: {formatMoney(total)}
            </Typography>
            {remainingBalance < -PAYMENT_TOLERANCE ? (
              <Typography component="div" sx={{ fontSize: '23.04px', fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal' }}>
                Change: {formatMoney(-remainingBalance)}
              </Typography>
            ) : (
              <Typography component="div" sx={{ fontSize: '23.04px', fontWeight: 400, lineHeight: 'normal', letterSpacing: 'normal' }}>
                Remaining: {formatMoney(remainingBalance)}
              </Typography>
            )}
          </Box>

          {/* Complete / Return buttons — full-bleed to the rail edges */}
          {isFullyPaid && (
            <Button
              fullWidth
              variant="contained"
              disabled={needsOrderRef}
              onClick={() => {
                // ponytail: requireOrderReference — final guard on the explicit complete action.
                if (needsOrderRef) return;
                onCompleteTransaction(payments);
              }}
              disableElevation
              sx={{
                height: 50,
                flexShrink: 0,
                bgcolor: '#5ebbeb',
                color: '#f8f8f8',
                borderRadius: 0,
                textTransform: 'none',
                fontSize: 16,
                fontWeight: 700,
                lineHeight: 1,
                '&:hover': {
                  bgcolor: '#4aa9dd',
                },
              }}
            >
              Complete Sale
            </Button>
          )}
          <Button
            fullWidth
            onClick={onReturnToSale}
            sx={{
              height: 50,
              flexShrink: 0,
              p: '4px 8px 4px 8px',
              border: '1px solid #000',
              bgcolor: '#f8f8f8',
              color: '#313439',
              borderRadius: 0,
              textTransform: 'none',
              // Caps come from font-variant, not text-transform (reference parity).
              fontSize: 32,
              fontWeight: 400,
              fontVariant: 'small-caps',
              lineHeight: 'normal',
              letterSpacing: 'normal',
              // Flat hover (measured): no transition to inherit.
              transition: 'none',
              '&:hover': {
                border: '1px solid #000',
                bgcolor: '#f8f8f8',
              },
            }}
          >
            Return to Sale
          </Button>
        </Box>

        {/* Loyalty Payment Dialog */}
        <LoyaltyPaymentDialog
          open={showLoyaltyDialog}
          onClose={() => setShowLoyaltyDialog(false)}
          saleTotal={remainingBalance}
          customerPoints={customerLoyaltyInfo?.loyaltyPoints || 0}
          customerLoyaltyInfo={customerLoyaltyInfo}
          outletId={outletId}
          onAddLoyaltyPayment={(paymentData) => {
            onAddPayment({
              amount: paymentData.amount,
              method: paymentData.method,
              description: paymentData.description,
              pointsRedeemed: paymentData.pointsRedeemed
            });
            setShowLoyaltyDialog(false);
        }}
      />

        {/* Tyro pairing screen — shown on the first Tyro payment on this device,
            per the reference; once paired the tender records immediately. */}
        <TyroPairingDialog
          open={Boolean(tyroPairingMethod)}
          onClose={() => setTyroPairingMethod(null)}
          onPaired={() => {
            const method = tyroPairingMethod;
            setTyroPairingMethod(null);
            if (method) handlePaymentMethodClick(method);
          }}
        />

        {/* Ask for the cash-out amount, then charge goods + cash out */}
        <CashOutDialog
          open={Boolean(cashOutPrompt)}
          goodsAmount={(cashOutPrompt?.goodsCents || 0) / 100}
          onClose={() => setCashOutPrompt(null)}
          onConfirm={(cashOutCents) => {
            setCardCharge({
              amountCents: cashOutPrompt.goodsCents,
              cashOutCents,
              methodName: cashOutPrompt.methodName,
              txnType: 'purchase',
            });
            setCashOutPrompt(null);
          }}
        />

        {/* Card / EFTPOS payment via Linkly PIN pad */}
        <PayByCardDialog
          open={Boolean(cardCharge)}
          amountCents={cardCharge?.amountCents}
          cashOutCents={cardCharge?.cashOutCents || 0}
          txnType={cardCharge?.txnType || 'purchase'}
          registerId={undefined}
          onClose={() => setCardCharge(null)}
          onApproved={(txn) => {
            const cashOutCents = cardCharge?.cashOutCents || 0;
            const requestedCents = (cardCharge?.amountCents || 0) + cashOutCents;
            // Partial approval (prepaid cards): the bank may approve less than
            // requested — record what was actually approved and leave the
            // shortfall as balance owing for another tender.
            const approvedCents =
              (txn?.approvedAmountCents ?? 0) + (txn?.approvedCashOutCents ?? 0);
            const recordCents =
              approvedCents > 0 ? Math.min(approvedCents, requestedCents) : requestedCents;
            if (recordCents < requestedCents) {
              alert(
                `Card approved $${(recordCents / 100).toFixed(2)} of $${(
                  requestedCents / 100
                ).toFixed(2)} — take the remaining balance with another tender.`
              );
            }
            onAddPayment({
              // Card was charged goods + cash out; record the full charge so the
              // cash-out portion surfaces as change for the operator to hand over.
              // Refund records as a negative payment so the balance closes to zero.
              amount: (recordCents / 100) * (cardCharge?.txnType === 'refund' ? -1 : 1),
              method: cardCharge?.methodName || 'EFTPOS',
              description: `Card${txn?.cardType ? ' ' + txn.cardType : ''}${
                txn?.authCode ? ' · Auth ' + txn.authCode : ''
              }${cashOutCents > 0 ? ' · Cash out $' + (cashOutCents / 100).toFixed(2) : ''}`,
              reference: txn?.txnRef,
              integrated: true, // went through the PIN pad — blocks clear/cancel until refunded
              // Linkly EFT slip printed on the sale receipt. Prefer the customer
              // copy; fall back to the merchant copy when the terminal only
              // returns one (sandbox/training pads do this).
              eftposReceipt: txn?.customerReceipt || txn?.merchantReceipt || null,
            });
            setCardCharge(null);
            setPaymentAmount('');
            setSelectedPaymentMethod(null);
          }}
          onDeclined={() => {
            /* leave the dialog open showing the decline; operator can retry */
          }}
        />
    </Box>
  );
};

export default FinalizeSaleDialog;

