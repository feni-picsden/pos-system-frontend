import React, { useState } from 'react';
import { Box, CircularProgress, IconButton, Paper, Popover, Slide, Typography } from '@mui/material';
import {
  DeleteOutline as DeleteIcon, // ref: outlined bin
  CropOriginal as ImageIcon, // outlined picture frame (ref icon)
  CheckCircleOutline as CheckCircleOutlineIcon,
  HighlightOffOutlined as HighlightOffOutlinedIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import { KeypadBody } from '../SaleKey/LineEditPanel';

// Reference Promotion Simulator (live 04/11/2026): a panel down the RIGHT edge of
// the Express / Advanced editor, from the app bar to the bottom button bar.
//   * "Search for a product..." strip on top with a spinner while searching and a
//     clear (x) once typed; results list PRODUCTS only (picture icon, typed text
//     highlighted sky, long names wrap); "No search results found." otherwise;
//   * one light-blue line per basket product: quantity, name, line total, bin;
//     "Item price: $x.xx" underneath once the quantity is above 1; tapping the
//     quantity opens a numeric keypad (- 1 +, digits, ., 0, backspace, Ok);
//   * under EVERY line its own status: green "Current Promotion Active" or red
//     "No Promotion Active".
export const SIMULATOR_WIDTH = 396;
export const BOTTOM_BAR_HEIGHT = 74;

const Highlight = ({ text, term }) => {
  const t = String(text || '');
  const q = String(term || '').trim();
  if (!q) return t;
  // ref: EVERY occurrence of the typed text is coloured sky, not just the first
  const lower = t.toLowerCase();
  const needle = q.toLowerCase();
  const parts = [];
  let pos = 0;
  let idx = lower.indexOf(needle, pos);
  while (idx >= 0) {
    if (idx > pos) parts.push(t.slice(pos, idx));
    parts.push(<Box key={idx} component="span" sx={{ color: '#5ebbeb' }}>{t.slice(idx, idx + q.length)}</Box>);
    pos = idx + q.length;
    idx = lower.indexOf(needle, pos);
  }
  if (pos < t.length) parts.push(t.slice(pos));
  return <>{parts}</>;
};

// The sell screen cart's own quantity keypad (reference: 357px, #FAFAFA, arrow on
// the right edge, ⊖ 1 ⊕ strip, digits, ., 0, backspace, Ok; Enter = Ok).
const QuantityKeypad = ({ anchorEl, value, onClose, onCommit }) => {
  const [text, setText] = useState(String(value));
  const ok = () => { onCommit(Math.max(1, parseInt(text, 10) || 1)); onClose(); };
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{ sx: { width: 357, p: 2, borderRadius: '12px', bgcolor: '#FAFAFA', border: '1px solid #D4D4D4', overflow: 'visible', ml: '-10px' } }}
    >
      <Box sx={{ position: 'absolute', top: 32, right: '-8px', width: 14, height: 14, bgcolor: '#FAFAFA', borderTop: '1px solid #D4D4D4', borderRight: '1px solid #D4D4D4', transform: 'rotate(45deg)' }} />
      <KeypadBody value={text} setValue={setText} onOk={ok} mode="qty" min={1} />
    </Popover>
  );
};

/**
 * @param open          boolean - the panel is only rendered while the toggle is on
 * @param search        { value, onChange(text), onKeyDown, results: [{id,name}], onPick(result), loading }
 * @param lines         [{ key, quantity, name, total, active }]
 * @param onQuantity    (key, n) => void
 * @param onRemove      (key) => void
 */
const PromotionSimulatorPanel = ({ open, search, lines, onQuantity, onRemove }) => {
  const [keypad, setKeypad] = useState(null); // { anchorEl, key, quantity }
  const term = String(search.value || '').trim();
  // Slides in from the right edge (300ms) when the toggle goes on.
  return (
    <Slide direction="left" in={open} timeout={300} mountOnEnter unmountOnExit>
    <Box
      sx={{
        position: 'fixed',
        top: 50, // app bar height (DashboardLayout HEADER_HEIGHT) so the panel's edge touches it
        right: 0,
        bottom: BOTTOM_BAR_HEIGHT,
        width: SIMULATOR_WIDTH,
        bgcolor: '#fff',
        borderLeft: '1px solid #404040',
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Reference: dark 1px rule under the search strip (same tone as the panel's left edge). */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', borderBottom: '1px solid #404040' }}>
        <Box
          component="input"
          type="text"
          autoComplete="off"
          placeholder="Search for a product..."
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
          onKeyDown={search.onKeyDown}
          sx={{
            flex: 1,
            height: 55,
            boxSizing: 'border-box',
            pl: '16px',
            pr: '14px',
            border: 0,
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: 16,
            color: '#000',
            bgcolor: '#fff',
            '&::placeholder': { color: '#808080', opacity: 1 }
          }}
        />
        {search.loading && <CircularProgress size={18} sx={{ color: '#b5b5b5', mr: 1.5 }} />}
        {term && (
          <IconButton size="small" onClick={() => search.onChange('')} sx={{ color: '#404040', mr: '6px' }}>
            <CancelIcon sx={{ fontSize: 28 }} />
          </IconButton>
        )}
        {term && !search.loading && (
          // ref: full-width white sheet straight under the strip, soft shadow, square corners
          <Paper square elevation={0} sx={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 5, maxHeight: 560, overflow: 'auto', boxShadow: '0 6px 12px rgba(0,0,0,0.25)', px: '20px', pt: '14px', pb: '10px' }}>
            {search.results.length === 0 ? (
              <Typography sx={{ fontSize: 18, color: '#000', py: 1 }}>No search results found.</Typography>
            ) : (
              <>
                <Typography sx={{ fontSize: 16, color: '#9e9e9e', letterSpacing: 0.5, lineHeight: '22px', mb: '6px' }}>PRODUCTS</Typography>
                {search.results.map((r) => (
                  <Box
                    key={r.id}
                    onClick={() => search.onPick(r)}
                    sx={{ display: 'flex', alignItems: 'flex-start', gap: '12px', py: '9px', cursor: 'pointer', '&:hover': { bgcolor: '#f5f5f5' } }}
                  >
                    <ImageIcon sx={{ fontSize: 22, color: '#555', mt: '1px' }} />
                    <Typography sx={{ fontSize: 18, color: '#404040', lineHeight: '23px' }}>
                      <Highlight text={r.name} term={search.value} />
                    </Typography>
                  </Box>
                ))}
              </>
            )}
          </Paper>
        )}
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {lines.map((line) => (
          <Box key={line.key}>
            {/* Reference line (measured): 43px tall, 75px with "Item price"; plain quantity
                number 23px in, name ~20px after it, total right, outlined bin 20px from
                the edge; "Item price" ends under the bin. */}
            <Box
              sx={{
                bgcolor: '#d6edfb',
                pl: '23px',
                pr: '20px',
                py: '12px',
                display: 'grid',
                gridTemplateColumns: '12px 1fr auto 22px',
                gridTemplateRows: 'auto',
                alignItems: 'center',
                columnGap: '18px',
                rowGap: '8px',
                minHeight: 47,
                boxSizing: 'border-box'
              }}
            >
              <Box
                component="button"
                type="button"
                onClick={(e) => setKeypad({ anchorEl: e.currentTarget, key: line.key, quantity: line.quantity })}
                sx={{ border: 0, outline: 'none', bgcolor: 'transparent', fontFamily: 'inherit', fontSize: 16, color: '#000', cursor: 'pointer', textAlign: 'left', p: 0, m: 0, lineHeight: '23px', height: 23, '&:focus, &:focus-visible': { outline: 'none' } }}
              >
                {line.quantity}
              </Box>
              <Typography sx={{ fontSize: 16, color: '#000', lineHeight: '23px' }}>{line.name}</Typography>
              <Typography sx={{ fontSize: 16, color: '#000', lineHeight: '23px' }}>${(Number(line.total) || 0).toFixed(2)}</Typography>
              <DeleteIcon
                onClick={() => onRemove(line.key)}
                sx={{ fontSize: 22, color: '#404040', cursor: 'pointer', justifySelf: 'end', display: 'block' }}
              />
              {line.quantity > 1 && (
                // second row: "Item price" right-aligned, ending under the bin (ref)
                <Typography sx={{ gridColumn: '2 / 5', fontSize: 16, color: '#000', textAlign: 'right', lineHeight: '24px' }}>
                  Item price: ${((Number(line.total) || 0) / line.quantity).toFixed(2)}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px', px: '12px', height: 44, borderTop: '1px solid #404040', borderBottom: '1px solid #404040', boxSizing: 'border-box', color: line.active ? '#16a34a' : '#e33430' }}>
              {line.active ? <CheckCircleOutlineIcon sx={{ fontSize: 17 }} /> : <HighlightOffOutlinedIcon sx={{ fontSize: 17 }} />}
              <Typography sx={{ fontSize: 16, color: 'inherit', lineHeight: '22px' }}>{line.active ? 'Current Promotion Active' : 'No Promotion Active'}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {keypad && (
        <QuantityKeypad
          anchorEl={keypad.anchorEl}
          value={keypad.quantity}
          onClose={() => setKeypad(null)}
          onCommit={(n) => onQuantity(keypad.key, n)}
        />
      )}
    </Box>
    </Slide>
  );
};

export default PromotionSimulatorPanel;
