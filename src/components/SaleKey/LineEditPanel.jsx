import React, { useState, useRef, useEffect } from 'react';
import { Box, Popover } from '@mui/material';
import {
  RemoveCircleOutline as StepDownIcon,
  AddCircleOutline as StepUpIcon,
  TouchAppOutlined as HandIcon,
  ArrowDropDown as CaretIcon,
} from '@mui/icons-material';

// Measured reference palette (topdrops.onshopfront.com sell screen)
const PANEL_BLUE = '#5EBBEB';   // tabs / editable cells / dropdown row
const CONFIRM_ORANGE = '#FF6538';
const KEY_BORDER = '#00A6F4';   // sky-500: key borders, filled keys, Ok
const KEY_HOVER = '#00BCFF';    // sky-400
const DIGIT_TEXT = '#0084D1';   // sky-600

const keyCellSx = {
  height: 63,
  border: `1px solid ${KEY_BORDER}`,
  borderRadius: '12px',
  color: DIGIT_TEXT,
  fontSize: '26.91px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  userSelect: 'none',
  bgcolor: 'transparent',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
};

// Anchored keypad popup (reference: 357px, bg #FAFAFA, arrow on the right edge
// pointing at the triggering cell, real focused decimal input, Enter=Ok,
// Escape closes only the popup). mode: 'price' ($ prefix) | 'percent'
// (% suffix) | 'qty' (steppers, value prefilled + text-selected).
export const KeypadBody = ({ value, setValue, onOk, mode = 'price', autoFocus = true, showOk = true }) => {
  // qty mode keeps the reference seed behavior for the on-screen keys: the
  // seeded quantity is replaced by the first key press instead of appended to.
  const typedRef = useRef(null);
  const inputRef = useRef(null);
  const v = String(value ?? '');
  useEffect(() => {
    if (!autoFocus) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (mode === 'qty') el.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);
  const touched = mode !== 'qty' || v === typedRef.current;
  const write = (next) => { typedRef.current = next; setValue(next); };
  useEffect(() => { typedRef.current = null; }, []);
  const press = (k) => {
    if (k === 'backspace') write(v.slice(0, -1));
    else if (k === '.') write(touched ? (v.includes('.') ? v : v + '.') : '0.');
    else write(touched ? v + k : k);
    inputRef.current?.focus();
  };
  const step = (delta) => {
    const n = (parseFloat(v) || 0) + delta;
    write(String(Math.max(0, n)));
  };
  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        {mode === 'qty' && (
          <StepDownIcon onClick={() => step(-1)} sx={{ color: KEY_BORDER, fontSize: 22, cursor: 'pointer' }} />
        )}
        <Box sx={{ position: 'relative', flex: 1, height: 50, borderRadius: '8px', bgcolor: '#fff', border: '1px solid #404040', display: 'flex', alignItems: 'center' }}>
          {mode === 'price' && (
            <Box component="span" sx={{ position: 'absolute', left: 12, color: '#404040', fontSize: 16, pointerEvents: 'none' }}>$</Box>
          )}
          <Box
            component="input"
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={v}
            onChange={(e) => {
              const next = e.target.value.replace(/[^0-9.]/g, '');
              // one decimal point max
              write(next.split('.').length > 2 ? v : next);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onOk(); }
            }}
            sx={{
              width: '100%',
              border: 'none',
              outline: 'none',
              bgcolor: 'transparent',
              fontSize: '17.94px',
              fontFamily: 'inherit',
              color: '#000',
              pl: mode === 'price' ? '26px' : 2,
              pr: mode === 'percent' ? '26px' : 2,
            }}
          />
          {mode === 'percent' && (
            <Box component="span" sx={{ position: 'absolute', right: 12, color: '#404040', fontSize: 16, pointerEvents: 'none' }}>%</Box>
          )}
        </Box>
        {mode === 'qty' && (
          <StepUpIcon onClick={() => step(1)} sx={{ color: KEY_BORDER, fontSize: 22, cursor: 'pointer' }} />
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Box key={d} onClick={() => press(d)} sx={keyCellSx}>{d}</Box>
        ))}
        <Box onClick={() => press('.')} sx={{ ...keyCellSx, bgcolor: KEY_BORDER, color: '#fff', '&:hover': { bgcolor: KEY_HOVER } }}>.</Box>
        <Box onClick={() => press('0')} sx={keyCellSx}>0</Box>
        <Box onClick={() => press('backspace')} sx={{ ...keyCellSx, bgcolor: KEY_BORDER, color: '#fff', fontSize: 22, '&:hover': { bgcolor: KEY_HOVER } }}>⌫</Box>
      </Box>
      {showOk && (
        <Box
          onClick={onOk}
          sx={{ mt: 2, height: 42, bgcolor: KEY_BORDER, color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, cursor: 'pointer', userSelect: 'none', '&:hover': { bgcolor: KEY_HOVER } }}
        >
          Ok
        </Box>
      )}
    </>
  );
};

export const KeypadPopover = ({ open, anchorEl, onClose, value, setValue, onOk, mode = 'price' }) => (
  <Popover
    open={open}
    anchorEl={anchorEl}
    onClose={onClose}
    anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    PaperProps={{
      sx: {
        width: 357,
        p: 2,
        borderRadius: '12px',
        bgcolor: '#FAFAFA',
        border: '1px solid #D4D4D4',
        overflow: 'visible',
        // gap between the popup's right edge and the cell, for the arrow
        ml: '-10px',
      },
    }}
  >
    {/* Right-edge arrow pointing at the triggering cell */}
    <Box sx={{ position: 'absolute', top: 32, right: '-8px', width: 14, height: 14, bgcolor: '#FAFAFA', borderTop: '1px solid #D4D4D4', borderRight: '1px solid #D4D4D4', transform: 'rotate(45deg)' }} />
    <KeypadBody value={value} setValue={setValue} onOk={onOk} mode={mode} />
  </Popover>
);

// 52px row, split 50/50 with a centre divider, 16px padding per cell.
export const LabelValueRow = ({ label, children }) => (
  <Box sx={{ display: 'flex', height: 52, boxSizing: 'border-box', borderBottom: '1px solid #000', fontSize: 16, color: '#000' }}>
    <Box sx={{ width: '50%', boxSizing: 'border-box', p: 2, display: 'flex', alignItems: 'center', borderRight: '1px solid #000' }}>{label}</Box>
    <Box sx={{ width: '50%', boxSizing: 'border-box', display: 'flex', alignItems: 'stretch' }}>{children}</Box>
  </Box>
);

// The blue editable half-cell with the hand-pointer hint icon; opens the keypad.
export const BlueEditableCell = React.forwardRef(({ display, onClick }, ref) => (
  <Box
    ref={ref}
    onClick={onClick}
    sx={{ flex: 1, bgcolor: PANEL_BLUE, p: 2, display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', fontSize: 16, color: '#000' }}
  >
    <Box component="span" sx={{ flex: 1 }}>{display}</Box>
    <HandIcon sx={{ fontSize: 16, color: '#000' }} />
  </Box>
));

// Cancel (grey) | Confirm (orange) full-width halves, 39px, 19.2px black text.
export const CancelConfirmRow = ({ onCancel, onConfirm, cancelBg = '#E5E7EB' }) => (
  <Box sx={{ display: 'flex', height: 39 }}>
    <Box onClick={onCancel} sx={{ width: '50%', bgcolor: cancelBg, color: '#000', fontSize: '19.2px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none' }}>Cancel</Box>
    <Box onClick={onConfirm} sx={{ width: '50%', bgcolor: CONFIRM_ORANGE, color: '#000', fontSize: '19.2px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', userSelect: 'none' }}>Confirm</Box>
  </Box>
);

// Reference-styled type dropdown: 41px #5EBBEB row + caret, absolutely
// positioned white options panel (1px black border, radius 8, 56px options).
export const TypeDropdown = ({ options, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ height: 41, boxSizing: 'border-box', bgcolor: PANEL_BLUE, display: 'flex', alignItems: 'center', pl: 2, pr: 1, cursor: 'pointer', userSelect: 'none', fontSize: 16, color: '#000', borderBottom: '1px solid #000' }}
      >
        <Box component="span" sx={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected?.label}</Box>
        <CaretIcon sx={{ fontSize: 24, color: '#000', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </Box>
      {open && (
        <Box sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: '#fff', border: '1px solid #000', borderRadius: '8px', overflow: 'auto', maxHeight: 288 }}>
          {options.map((o) => (
            <Box
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              sx={{ height: 56, boxSizing: 'border-box', p: 2, display: 'flex', alignItems: 'center', fontSize: 16, cursor: 'pointer', userSelect: 'none', color: o.value === value ? KEY_BORDER : '#000', '&:hover': { bgcolor: '#74D4FF', color: '#0A0A0A' } }}
            >
              {o.label}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// The measured six advanced types — no Case Rate / Sell Rate on the reference.
export const DISCOUNT_TYPES = [
  { value: 'total_price_override', label: 'Total Price Override' },
  { value: 'item_price_override', label: 'Item Price Override' },
  { value: 'case_price_override', label: 'Case Price Override' },
  { value: 'discount_percentage', label: 'Discount Percentage' },
  { value: 'discount_total_amount', label: 'Discount Total Amount' },
  { value: 'discount_item_amount', label: 'Discount Item Amount' },
];

// Pure discount math (was CartSidebar applyDiscount) — also drives the
// read-only computed New Price preview row for the discount types.
export const computeDiscount = (item, type, amount) => {
  const quantity = parseFloat(item.quantity) || 1;
  const caseQuantity = parseFloat(item.caseQuantity) || 1;
  const currentTotal = parseFloat(item.price) || 0;
  const unit = currentTotal / quantity;
  let finalPrice = currentTotal;
  let discountInfo = null;
  switch (type) {
    case 'total_price_override':
      finalPrice = amount;
      discountInfo = { type, originalPrice: currentTotal, newPrice: amount, discountAmount: currentTotal - amount };
      break;
    case 'item_price_override':
      finalPrice = amount * quantity;
      discountInfo = { type, originalPrice: unit, newPrice: amount, discountAmount: (unit - amount) * quantity };
      break;
    case 'case_price_override': {
      const unitP = amount / caseQuantity;
      finalPrice = unitP * quantity;
      discountInfo = { type, originalPrice: unit, newPrice: unitP, discountAmount: (unit - unitP) * quantity };
      break;
    }
    case 'discount_percentage': {
      const pct = Math.min(100, amount);
      finalPrice = currentTotal * (1 - pct / 100);
      discountInfo = { type, originalPrice: currentTotal, discountPercentage: pct, discountAmount: currentTotal * (pct / 100) };
      break;
    }
    case 'discount_total_amount':
      finalPrice = Math.max(0, currentTotal - amount);
      discountInfo = { type, originalPrice: currentTotal, discountAmount: amount };
      break;
    case 'discount_item_amount': {
      const totalDiscount = amount * quantity;
      finalPrice = Math.max(0, currentTotal - totalDiscount);
      discountInfo = { type, originalPrice: unit, discountPerItem: amount, discountAmount: totalDiscount };
      break;
    }
    default:
      return null;
  }
  finalPrice = Math.round(Math.max(0, finalPrice) * 100) / 100;
  return { finalPrice, discountInfo };
};

const isDiscountType = (t) => t.startsWith('discount_');

// Inline line-edit panel rendered under the cart line (reference
// .product-line-discount). Opens on the Simple tab, editable cell EMPTY,
// keypad auto-opened; keypadNonce toggles the keypad on price re-clicks.
const LineEditPanel = ({ item, keypadNonce, onConfirm, onCancel }) => {
  const [tab, setTab] = useState('simple');
  const [type, setType] = useState('total_price_override');
  const [amount, setAmount] = useState('');
  const [keypadAnchor, setKeypadAnchor] = useState(null);
  const cellRef = useRef(null);

  // Auto-open on mount; re-clicking the line price bumps the nonce = toggle.
  useEffect(() => {
    setKeypadAnchor((k) => (k ? null : cellRef.current));
  }, [keypadNonce]);

  const effectiveType = tab === 'simple' ? 'total_price_override' : type;
  const percentMode = effectiveType === 'discount_percentage';
  const keypadMode = percentMode ? 'percent' : 'price';

  // Normal Price = the AUTOMATIC pre-override line total.
  const normalTotal = item.discountInfo
    ? (parseFloat(item.price) || 0) + Math.max(0, parseFloat(item.discountInfo.discountAmount) || 0)
    : parseFloat(item.price) || 0;

  const display = amount === ''
    ? ''
    : percentMode
      ? `${amount}%`
      : `$${(parseFloat(amount) || 0).toFixed(2)}`;

  const apply = () => {
    const num = parseFloat(amount);
    // Empty value: close with no change (reference: cell opens empty)
    if (amount === '' || isNaN(num) || num < 0) { onCancel(); return; }
    const result = computeDiscount(item, effectiveType, num);
    if (!result) { onCancel(); return; }
    onConfirm({ ...item, price: result.finalPrice, discountInfo: result.discountInfo });
  };

  const preview = computeDiscount(item, effectiveType, parseFloat(amount) || 0);

  return (
    <Box sx={{ borderBottom: '1px solid #000', bgcolor: '#fff' }} onClick={(e) => e.stopPropagation()}>
      {/* Simple | Advanced tabs */}
      <Box sx={{ display: 'flex' }}>
        {['simple', 'advanced'].map((t, i) => (
          <Box
            key={t}
            onClick={() => { setTab(t); setAmount(''); setKeypadAnchor(null); }}
            sx={{ width: '50%', height: 52, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#000', cursor: 'pointer', userSelect: 'none', bgcolor: tab === t ? PANEL_BLUE : 'transparent', borderBottom: '1px solid #000', borderRight: i === 0 ? '1px solid #000' : 'none' }}
          >
            {t === 'simple' ? 'Simple' : 'Advanced'}
          </Box>
        ))}
      </Box>
      <LabelValueRow label="Normal Price">
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>${normalTotal.toFixed(2)}</Box>
      </LabelValueRow>
      {tab === 'advanced' && (
        <TypeDropdown
          options={DISCOUNT_TYPES}
          value={type}
          onChange={(v) => { setType(v); setAmount(''); setKeypadAnchor(null); }}
        />
      )}
      {tab === 'advanced' && isDiscountType(type) ? (
        <>
          <LabelValueRow label="Discount">
            <BlueEditableCell ref={cellRef} display={display} onClick={(e) => setKeypadAnchor(e.currentTarget)} />
          </LabelValueRow>
          {/* Read-only computed preview */}
          <LabelValueRow label="New Price">
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>${(preview?.finalPrice ?? normalTotal).toFixed(2)}</Box>
          </LabelValueRow>
        </>
      ) : (
        <LabelValueRow label="New Price">
          <BlueEditableCell ref={cellRef} display={display} onClick={(e) => setKeypadAnchor(e.currentTarget)} />
        </LabelValueRow>
      )}
      <CancelConfirmRow onCancel={onCancel} onConfirm={apply} />
      <KeypadPopover
        open={!!keypadAnchor}
        anchorEl={keypadAnchor}
        onClose={() => setKeypadAnchor(null)}
        value={amount}
        setValue={setAmount}
        onOk={apply}
        mode={keypadMode}
      />
    </Box>
  );
};

export default LineEditPanel;
