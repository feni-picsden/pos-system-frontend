import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import orderInvoiceService from '../../services/orderInvoiceService';

// Receive an in-transit transfer. Same frame as the app's confirm dialog
// (AppDialogProvider). When every line already exists at the destination it is a
// plain confirm; a line the destination does not have asks where its stock goes:
// a new product copied from the source, or an existing destination product - the
// one sharing its barcode / near-identical name is pre-selected. Nothing is
// remembered: the next receive suggests again. Used by the Orders list, the
// transfer page and the notification bell, so all three behave the same.

// The dialog sits above the app chrome (zIndex 2000), so the search list must sit above the dialog.
const DIALOG_Z = 2000;

const PAPER_SX = {
  width: 560,
  maxWidth: '92vw',
  overflow: 'hidden',
  bgcolor: '#f8f8f8',
  borderRadius: 0,
  border: '1px solid #000',
  boxShadow: '0 0 30px 0 rgba(0,0,0,.25), 0 15px 30px 0 rgba(0,0,0,.19)',
};
const btnSx = (bg, hover) => ({
  bgcolor: bg,
  color: '#fff',
  textTransform: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  px: 3,
  '&:hover': { bgcolor: hover },
  '&.Mui-disabled': { bgcolor: bg, color: '#fff', opacity: 0.5 },
});

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// "1 item", "2 cases", "1 case 3 items" - a zero part is left out.
const unitsText = (units, caseQuantity) => {
  const cq = caseQuantity > 1 ? caseQuantity : 1;
  const cases = cq > 1 ? Math.floor(units / cq) : 0;
  const items = cq > 1 ? units % cq : units;
  const parts = [cases && plural(cases, 'case'), (items || !cases) && plural(items, 'item')].filter(Boolean);
  return parts.join(' ');
};

// Starting choice for a line: its suggestion when there is one, else a new product.
const suggestedChoice = (line) => (line.suggestion
  ? { mode: 'existing', product: line.suggestion }
  : { mode: 'new', product: null });

// Same shape as the backend's productSummary (lib/transferMatch.js), built from a
// GET /products row: barcode, case size, 1-unit price (own outlet first), stock.
const barcodeList = (barcodes) => {
  let arr = barcodes;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { return []; }
  }
  return (Array.isArray(arr) ? arr : [])
    .map((b) => String(typeof b === 'string' ? b : b?.code ?? '').trim())
    .filter((code) => code && code !== 'undefined');
};
const toSummary = (p) => {
  const tiers = (p.prices || []).filter((pr) => Number(pr.quantity) === 1);
  const tier = tiers.find((pr) => pr.outletId != null && pr.outletId === p.outletId)
    || tiers.find((pr) => pr.outletId == null) || tiers[0];
  const inventory = Number(p.inventory);
  return {
    id: p.id,
    name: p.name,
    barcodes: barcodeList(p.barcodes),
    caseQuantity: p.caseQuantity > 0 ? p.caseQuantity : 1,
    price: tier ? Number(tier.price) || 0 : null,
    inventory: Number.isFinite(inventory) ? inventory : null,
    category: p.category?.name || null,
  };
};

const money = (v) => (v == null ? '-' : `$${Number(v).toFixed(2)}`);
const codesText = (s) => (s?.barcodes?.length ? s.barcodes.join(', ') : '-');
// "Barcode 999111 · case 6 · $3.50 · Drinks" - a detail the product does not have is left out.
const detailText = (s, { stock } = {}) => [
  s?.barcodes?.length ? `Barcode ${s.barcodes.join(', ')}` : null,
  s?.caseQuantity > 1 ? `case ${s.caseQuantity}` : null,
  s?.price != null ? money(s.price) : null,
  s?.category || null,
  stock ?? (s?.inventory != null ? `stock ${unitsText(s.inventory, s.caseQuantity)}` : null),
].filter(Boolean).join(' · ');
const shareBarcode = (a, b) => (a?.barcodes || []).some((c) => (b?.barcodes || []).includes(c));
const caseDiffers = (a, b) => a && b && a.caseQuantity !== b.caseQuantity;

// Product details live behind an (i) icon - hover (or tap) to read them. The dialog
// sits at DIALOG_Z, so the tooltip is lifted above it.
const InfoTip = ({ children }) => (
  <Tooltip
    arrow
    placement="right"
    enterTouchDelay={0}
    title={children}
    slotProps={{
      popper: { sx: { zIndex: DIALOG_Z + 100 } },
      tooltip: {
        sx: {
          bgcolor: '#fff', color: '#313439', border: '1px solid #d9d9d9', p: 1, maxWidth: 400,
          boxShadow: '0 4px 14px rgba(0,0,0,.15)',
        },
      },
      arrow: { sx: { color: '#fff', '&::before': { border: '1px solid #d9d9d9' } } },
    }}
  >
    <InfoOutlinedIcon sx={{ fontSize: 18, color: '#1c86f2', cursor: 'help', flexShrink: 0 }} />
  </Tooltip>
);

// One product's details as label/value rows (a detail it does not have is left out).
const DetailList = ({ product }) => {
  const rows = [
    product?.barcodes?.length && ['Barcode', product.barcodes.join(', ')],
    product && ['Case size', product.caseQuantity],
    product?.price != null && ['Price', money(product.price)],
    product?.category && ['Category', product.category],
  ].filter(Boolean);
  return (
    <Box component="table" sx={{ borderCollapse: 'collapse' }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <Box component="td" sx={{ fontSize: 12.5, color: '#676b72', pr: 1.5, py: 0.25 }}>{label}</Box>
            <Box component="td" sx={{ fontSize: 12.5, py: 0.25 }}>{value}</Box>
          </tr>
        ))}
      </tbody>
    </Box>
  );
};

// Shown inline (not only in the tooltip): receiving into a product with another
// case size is the one mismatch worth stopping for.
const CaseWarning = ({ source, target }) => (caseDiffers(source, target) ? (
  <Typography sx={{ fontSize: 12.5, color: '#c2410c', mt: 0.5 }}>
    Different case size ({source.caseQuantity} vs {target.caseQuantity}) - check it is the same product.
  </Typography>
) : null);

// Side-by-side check of what was sent against the product it lands on.
const MatchDetails = ({ source, target, fromName, toName }) => {
  if (!source || !target) return null;
  const same = (ok) => ({ color: ok ? '#16a34a' : '#313439', fontWeight: ok ? 600 : 400 });
  // A row is shown only when at least one side has that detail.
  const rows = [
    (source.barcodes.length || target.barcodes.length)
      && ['Barcode', codesText(source), codesText(target), same(shareBarcode(source, target))],
    ['Case size', source.caseQuantity, target.caseQuantity, caseDiffers(source, target) ? { color: '#c2410c', fontWeight: 700 } : same(true)],
    (source.price != null || target.price != null)
      && ['Price', money(source.price), money(target.price), same(source.price === target.price)],
    (source.category || target.category)
      && ['Category', source.category || '-', target.category || '-', same(source.category === target.category)],
  ].filter(Boolean);
  const cell = { fontSize: 12.5, py: 0.25, pr: 1.5, verticalAlign: 'top', wordBreak: 'break-word' };
  return (
    <Box>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Box component="th" sx={{ ...cell, width: 80 }} />
            <Box component="th" sx={{ ...cell, textAlign: 'left', color: '#676b72', fontWeight: 600 }}>{fromName || 'Sent'}</Box>
            <Box component="th" sx={{ ...cell, textAlign: 'left', color: '#676b72', fontWeight: 600 }}>{toName || 'Receiving'}</Box>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b, bSx]) => (
            <tr key={label}>
              <Box component="td" sx={{ ...cell, color: '#676b72' }}>{label}</Box>
              <Box component="td" sx={cell}>{a}</Box>
              <Box component="td" sx={{ ...cell, ...bSx }}>{b}</Box>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
};

// Search box for "Add to an existing product" - destination outlet products only.
const DestinationProductPicker = ({ outletId, value, onChange, disabled }) => {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    const term = input.trim();
    if (term.length < 2 || (value && term === value.name)) return undefined;
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await orderInvoiceService.searchDestinationProducts(term, outletId);
        setOptions(found.map(toSummary));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [input, outletId, value]);

  return (
    <Autocomplete
      size="small"
      disabled={disabled}
      value={value}
      options={value && !options.some((o) => o.id === value.id) ? [value, ...options] : options}
      getOptionLabel={(o) => o?.name || ''}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(x) => x}
      loading={loading}
      onChange={(_, v) => onChange(v)}
      onInputChange={(_, v) => setInput(v)}
      noOptionsText={input.trim().length < 2 ? 'Type to search...' : 'No products found'}
      slotProps={{ popper: { sx: { zIndex: DIALOG_Z + 100 } } }}
      renderOption={(props, o) => {
        // Keyed by id - two products can share a name; MUI's key is the label.
        const liProps = { ...props };
        delete liProps.key;
        return (
          <li key={o.id} {...liProps}>
            <Box>
              <Typography sx={{ fontSize: 14 }}>{o.name}</Typography>
              {detailText(o) && (
                <Typography sx={{ fontSize: 12, color: '#676b72' }}>{detailText(o)}</Typography>
              )}
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search product..."
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: '#fff' } }}
        />
      )}
    />
  );
};

// directWhenMatched: when every product already exists at the destination there is
// nothing to decide, so the list page and the notification bell receive at once with
// no popup (as they did before this dialog); the transfer page keeps its confirm.
const TransferReceiveDialog = ({ open, transferId, onClose, onReceived, directWhenMatched = false }) => {
  const [preview, setPreview] = useState(null);
  const [choices, setChoices] = useState({}); // { [sourceProductId]: { mode: 'new'|'existing', product } }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // receive response, shown as the summary
  const [showMatched, setShowMatched] = useState(null); // null = decide automatically

  useEffect(() => {
    if (!open || !transferId) return undefined;
    let alive = true;
    setPreview(null);
    setChoices({});
    setError('');
    setDone(null);
    setShowMatched(null);
    setLoading(true);
    orderInvoiceService.getTransferReceivePreview(transferId)
      .then((data) => {
        if (!alive) return;
        setPreview(data);
        const initial = {};
        (data.lines || []).filter((l) => !l.match).forEach((l) => { initial[l.sourceProductId] = suggestedChoice(l); });
        setChoices(initial);
      })
      .catch((err) => alive && setError(err?.response?.data?.error || 'Failed to load the transfer'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [open, transferId]);

  const lines = preview?.lines || [];
  const unmatched = lines.filter((l) => !l.match);
  const matched = lines.filter((l) => l.match);
  // A same-named product with a different case size is worth a look before
  // receiving: the matched list opens by itself, and is shown even when there is
  // nothing else to decide (otherwise an all-matched transfer is a plain confirm).
  const caseMismatch = matched.some((l) => caseDiffers(l.source, l.match));
  const matchedOpen = showMatched ?? caseMismatch;
  const showMatchedList = matched.length > 0 && (unmatched.length > 0 || caseMismatch);
  const missingPick = unmatched.some((l) => choices[l.sourceProductId]?.mode === 'existing' && !choices[l.sourceProductId]?.product);
  // Lines the destination has no likely product for - the only ones that may create one.
  const notFound = unmatched.filter((l) => !l.suggestion);

  const setChoice = (id, patch) => setChoices((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  // Bulk action for transfers with many products the destination does not have.
  const createAllNew = () => setChoices((prev) => ({
    ...prev,
    ...Object.fromEntries(notFound.map((l) => [l.sourceProductId, { ...prev[l.sourceProductId], mode: 'new' }])),
  }));

  const handleReceive = async ({ direct = false } = {}) => {
    setSubmitting(true);
    setError('');
    try {
      const productMap = {};
      unmatched.forEach((l) => {
        const c = choices[l.sourceProductId];
        productMap[l.sourceProductId] = c?.mode === 'existing' && c.product ? c.product.id : 'new';
      });
      const data = await orderInvoiceService.receiveTransfer(transferId, unmatched.length ? productMap : undefined);
      onReceived?.(data);
      if (direct) onClose?.(); else setDone(data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to receive transfer');
    } finally {
      setSubmitting(false);
    }
  };

  // Nothing to decide and the caller wants no popup: receive as soon as the preview
  // says every line matches (a case-size mismatch still gets the confirm).
  const direct = directWhenMatched && preview && !done && unmatched.length === 0 && !caseMismatch;
  useEffect(() => {
    if (direct && !submitting && !error) handleReceive({ direct: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direct]);

  const toName = preview?.toName || 'the receiving outlet';
  const close = () => { if (!submitting) onClose?.(); };

  return (
    <Dialog
      open={open}
      onClose={close}
      PaperProps={{ elevation: 0, sx: { ...PAPER_SX, ...(unmatched.length > 1 && { width: 680 }) } }}
      sx={{ zIndex: DIALOG_Z }}
    >
      <Box sx={{ bgcolor: done ? '#e8f6ec' : '#e8f1fd', px: 3, py: 1.75, display: 'flex', alignItems: 'center', gap: 1 }}>
        {done
          ? <CheckCircleOutlineIcon sx={{ color: '#16a34a', fontSize: 22 }} />
          : <HelpOutlineIcon sx={{ color: '#1c86f2', fontSize: 22 }} />}
        <Typography sx={{ color: done ? '#16a34a' : '#1c86f2', fontWeight: 700, fontSize: 18 }}>
          {done ? 'Transfer received' : 'Receive transfer'}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pt: 3, pb: 2.5 }}>
        {(loading || (direct && !error)) && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={28} /></Box>
        )}

        {!loading && preview && !done && !(direct && !error) && (
          <>
            {/* Every product already exists at the destination: the plain confirm, as
                before this dialog - nothing to decide, no product list. */}
            <Typography sx={{ color: '#313439', fontSize: 16, mb: unmatched.length ? 2.5 : 0 }}>
              {unmatched.length
                ? `Receive ${preview.orderNumber} from ${preview.fromName || 'the source outlet'} to ${toName}?`
                : `Receive transfer ${preview.orderNumber} (${preview.fromName || 'source'} → ${toName})? The stock is added to ${toName}.`}
            </Typography>

            {unmatched.length > 0 && (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
                  <Typography sx={{ color: '#313439', fontSize: 15, fontWeight: 700 }}>Check before receiving:</Typography>
                  {notFound.length > 1 && (
                    <Button size="small" variant="outlined" onClick={createAllNew} disabled={submitting} sx={{ textTransform: 'none' }}>
                      Create all {notFound.length} as new
                    </Button>
                  )}
                </Box>
                {/* Many lines scroll inside the dialog; the buttons stay in view. */}
                <Box sx={{ maxHeight: '50vh', overflowY: 'auto', pr: unmatched.length > 3 ? 0.5 : 0 }}>
                {unmatched.map((l) => {
                  const c = choices[l.sourceProductId] || { mode: 'new' };
                  const found = l.suggestion;
                  const link = { color: '#1c86f2', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' };
                  const into = c.mode === 'existing' && c.product;
                  return (
                    <Box key={l.sourceProductId} sx={{ border: '1px solid #d9d9d9', bgcolor: '#fff', px: 2, py: 1.5, mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                          {l.name}
                          <Box component="span" sx={{ fontSize: 14, color: '#676b72', fontWeight: 400 }}> · {unitsText(l.units, l.caseQuantity)}</Box>
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {/* The (i) explains the option that is selected right now. */}
                          {into ? (
                            <InfoTip>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>
                                {unitsText(l.units, l.caseQuantity)} is added to "{c.product.name}" at {toName}. No new product is created.
                              </Typography>
                              <MatchDetails source={l.source} target={c.product} fromName={preview.fromName} toName={toName} />
                            </InfoTip>
                          ) : c.mode === 'existing' ? (
                            <InfoTip>
                              <Typography sx={{ fontSize: 12.5 }}>
                                Search a product at {toName} - the {unitsText(l.units, l.caseQuantity)} is added to its stock. No new product is created.
                              </Typography>
                            </InfoTip>
                          ) : l.source && (
                            <InfoTip>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>
                                A new product "{l.name}" is created at {toName} with {unitsText(l.units, l.caseQuantity)} in stock, copied from {preview.fromName || 'the source outlet'}:
                              </Typography>
                              <DetailList product={l.source} />
                            </InfoTip>
                          )}
                        </Box>
                      </Box>

                      {/* Found at the destination (same barcode / near-identical name): the stock
                          goes into it - no "Create new", which would mint a duplicate. "Change"
                          opens the search for the rare wrong guess. */}
                      {found && !c.changing && (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CheckCircleIcon sx={{ fontSize: 18, color: '#16a34a' }} />
                            <Typography sx={{ fontSize: 14, color: '#16a34a', fontWeight: 600 }}>
                              {c.product?.name}
                              <Box component="span" sx={{ color: '#676b72', fontWeight: 400 }}>
                                {' '}({found.reason === 'barcode' ? 'same barcode' : 'similar name'})
                              </Box>
                            </Typography>
                          </Box>
                          {!submitting && (
                            <Box component="span" sx={link} onClick={() => setChoice(l.sourceProductId, { changing: true })}>Change</Box>
                          )}
                        </Box>
                      )}

                      {!found && (
                        <RadioGroup
                          row
                          sx={{ mt: 0.75, gap: 1.5 }}
                          value={c.mode}
                          onChange={(e) => setChoice(l.sourceProductId, { mode: e.target.value })}
                        >
                          <FormControlLabel
                            value="new"
                            control={<Radio size="small" />}
                            label={<Typography sx={{ fontSize: 14 }}>Create new product</Typography>}
                            disabled={submitting}
                          />
                          <FormControlLabel
                            value="existing"
                            control={<Radio size="small" />}
                            label={<Typography sx={{ fontSize: 14 }}>Add to existing product</Typography>}
                            disabled={submitting}
                          />
                        </RadioGroup>
                      )}

                      {((found && c.changing) || (!found && c.mode === 'existing')) && (
                        <Box sx={{ mt: found ? 0.75 : 0 }}>
                          <DestinationProductPicker
                            outletId={preview.toOutletId}
                            value={c.product || null}
                            onChange={(product) => setChoice(l.sourceProductId, { product })}
                            disabled={submitting}
                          />
                          {found && !submitting && (
                            <Box
                              component="span"
                              sx={{ ...link, display: 'inline-block', mt: 0.5 }}
                              onClick={() => setChoice(l.sourceProductId, { product: found, changing: false })}
                            >
                              Use {found.name}
                            </Box>
                          )}
                        </Box>
                      )}

                      {into && <CaseWarning source={l.source} target={c.product} />}
                    </Box>
                  );
                })}
                </Box>
              </>
            )}

            {showMatchedList && (
              <Box sx={{ mt: 2 }}>
                <Button
                  size="small"
                  onClick={() => setShowMatched(!matchedOpen)}
                  sx={{ textTransform: 'none', px: 0, minWidth: 0, fontWeight: 600, mb: 0.75 }}
                >
                  {matchedOpen ? 'Hide' : 'Show'} {plural(matched.length, 'product')} with the same name
                </Button>
                {matchedOpen && (
                  <Box sx={{ maxHeight: '30vh', overflowY: 'auto', border: '1px solid #e5e7eb', bgcolor: '#fff' }}>
                    {matched.map((l) => (
                      <Box key={l.sourceProductId} sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f0f0f0' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                            <CheckCircleIcon sx={{ fontSize: 18, color: '#16a34a', flexShrink: 0 }} />
                            <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
                              {l.name}
                              {l.match.name !== l.name && (
                                <Box component="span" sx={{ color: '#676b72', fontWeight: 400 }}> → {l.match.name}</Box>
                              )}
                              <Box component="span" sx={{ fontSize: 13, color: '#676b72', fontWeight: 400 }}> · {unitsText(l.units, l.caseQuantity)}</Box>
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <InfoTip>
                              <MatchDetails source={l.source} target={l.match} fromName={preview.fromName} toName={toName} />
                            </InfoTip>
                          </Box>
                        </Box>
                        <CaseWarning source={l.source} target={l.match} />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}
          </>
        )}

        {done && (
          <Box sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {(done.results || []).map((r, i) => (
              <Typography key={i} sx={{ fontSize: 15, color: r.success ? '#313439' : '#e0393e' }}>
                {r.success
                  ? `${r.source && r.source !== r.product ? `${r.source} → ` : ''}${r.product} (+${r.received})`
                  : `${r.product}: ${r.error}`}
              </Typography>
            ))}
          </Box>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1.25 }}>
        {done ? (
          <Button onClick={close} disableElevation sx={btnSx('#5ebbeb', '#48a9dc')}>OK</Button>
        ) : (
          <>
            <Button onClick={close} disabled={submitting} disableElevation sx={btnSx('#8a8d91', '#76797d')}>
              Cancel
            </Button>
            <Button
              onClick={handleReceive}
              disabled={loading || !preview || submitting || missingPick}
              disableElevation
              sx={btnSx('#5ebbeb', '#48a9dc')}
            >
              {submitting ? 'Receiving…' : 'Receive'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TransferReceiveDialog;
