import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogContent,
} from '@mui/material';
import ColorInput from './ColorInput';
import { borderToCss, normalizeBorder, isSideOn, BORDER_SIDES } from '../../utils/receiptTemplateShape';
import { REF_MENU_PROPS, BLUE, DARK } from './refMenuProps';

// Shared by the Receipt and Statement editors (moved out of ReceiptEditor.jsx).
export { REF_MENU_PROPS, BLUE, DARK };

// ---- Border Settings dialog (reference "Edit Border") ----------------------------
// Simple edits all four sides together; Advanced edits the side picked with the
// arrows. Update hands back the per-side border { top, right, bottom, left }, each
// { width, style, color } — the shape receiptTemplateShape stores per side.
const BORDER_STYLES = ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'];
const DEFAULT_BORDER_SIDE = { width: 1, style: 'solid', color: '#000000' };
// Filled / outlined triangles per side, in picker order.
const SIDE_ARROWS = {
  top: { filled: '▲', outlined: '△', pos: { top: 4, left: '50%', transform: 'translateX(-50%)' } },
  right: { filled: '▶', outlined: '▷', pos: { right: 6, top: '50%', transform: 'translateY(-50%)' } },
  bottom: { filled: '▼', outlined: '▽', pos: { bottom: 4, left: '50%', transform: 'translateX(-50%)' } },
  left: { filled: '◀', outlined: '◁', pos: { left: 6, top: '50%', transform: 'translateY(-50%)' } },
};

const sameSide = (a, b) => Number(a.width) === Number(b.width) && a.style === b.style && a.color === b.color;

const BorderSettingsDialog = ({ open, value, onCancel, onUpdate }) => {
  const [mode, setMode] = useState('simple');
  const [side, setSide] = useState('top');
  const [sides, setSides] = useState(() => normalizeBorder(value));

  // Seed from the component each time the dialog opens. A component with no border
  // at all opens on the reference defaults (1px solid black); nothing changes until
  // Update. Sides that differ open in Advanced.
  useEffect(() => {
    if (!open) return;
    const current = normalizeBorder(value);
    const any = BORDER_SIDES.some((k) => isSideOn(current[k]));
    setSides(any ? current : Object.fromEntries(BORDER_SIDES.map((k) => [k, { ...DEFAULT_BORDER_SIDE }])));
    setMode(BORDER_SIDES.every((k) => sameSide(current[k], current.top)) ? 'simple' : 'advanced');
    setSide('top');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const shown = mode === 'simple' ? sides.top : sides[side];

  const edit = (patch) => {
    const next = { ...shown, ...patch };
    // A width typed onto a 'none' side means "draw it"; picking a visible style for a
    // 0-wide side gives it the default width. Width 0 or style None = no border.
    if (patch.width != null && Number(patch.width) > 0 && next.style === 'none') next.style = 'solid';
    if (patch.style && patch.style !== 'none' && !(Number(next.width) > 0)) next.width = 1;
    setSides((prev) => (mode === 'simple'
      ? Object.fromEntries(BORDER_SIDES.map((k) => [k, { ...next }]))
      : { ...prev, [side]: next }));
  };

  const update = () => onUpdate(mode === 'simple'
    ? Object.fromEntries(BORDER_SIDES.map((k) => [k, { ...sides.top }]))
    : sides);

  const segment = (key, label) => (
    <Button
      onClick={() => setMode(key)}
      disableElevation
      sx={{
        bgcolor: mode === key ? BLUE : DARK,
        color: '#fff',
        borderRadius: 0,
        textTransform: 'none',
        px: 2.5,
        '&:hover': { bgcolor: mode === key ? '#1670d0' : '#24272b' },
      }}
    >
      {label}
    </Button>
  );

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{
        elevation: 0,
        sx: { width: 526, maxWidth: '92vw', bgcolor: '#fff', borderRadius: 0, overflow: 'visible', position: 'relative', mt: 8 },
      }}
    >
      {/* Reference: big blue '?' badge sitting half over the top edge */}
      <Box sx={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 120, borderRadius: '50%', bgcolor: BLUE, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, fontWeight: 700, lineHeight: 1,
      }}>
        ?
      </Box>
      <DialogContent sx={{ px: 2, pt: 9, pb: 2, overflow: 'visible' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#000' }}>Border Settings</Typography>
          <Box sx={{ display: 'flex' }}>
            {segment('simple', 'Simple')}
            {segment('advanced', 'Advanced')}
          </Box>
        </Box>

        {/* Side picker: the inner bar shows the border as currently set on each side */}
        {/* Live preview: the bar redraws with the pending (not yet Updated) border. */}
        {/* Preview widths are capped so a big width (e.g. 100) fills the bar instead of
            growing it over the Simple/Advanced toggle. The saved width is unchanged. */}
        <Box sx={{ position: 'relative', width: 250, height: 100, mx: 'auto', mb: 2, bgcolor: '#e5e5e5', overflow: 'hidden' }}>
          <Box
            sx={{
              position: 'absolute', top: 32, left: 32, width: 186, height: 36, bgcolor: '#f8f8f8', boxSizing: 'border-box', overflow: 'hidden',
              ...borderToCss(Object.fromEntries(BORDER_SIDES.map((k) => {
                const s = mode === 'simple' ? sides.top : sides[k];
                return [k, { ...s, width: Math.min(Number(s?.width) || 0, 18) }];
              }))),
            }}
          />
          {BORDER_SIDES.map((k) => {
            const picked = mode === 'advanced' && side === k;
            return (
              <Box
                key={k}
                component="button"
                type="button"
                aria-label={`${k} border`}
                disabled={mode === 'simple'}
                onClick={() => setSide(k)}
                sx={{
                  position: 'absolute',
                  ...SIDE_ARROWS[k].pos,
                  p: 0,
                  border: 0,
                  background: 'none',
                  lineHeight: 1,
                  fontSize: 16,
                  cursor: mode === 'simple' ? 'default' : 'pointer',
                  color: picked ? BLUE : '#8a8d91',
                }}
              >
                {mode === 'simple' || picked ? SIDE_ARROWS[k].filled : SIDE_ARROWS[k].outlined}
              </Box>
            );
          })}
        </Box>

        {/* Width | Style | Colour on one row */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
          <Box sx={{ width: 100 }}>
            <Typography sx={{ fontSize: 16, color: '#000' }}>Width</Typography>
            <TextField
              type="number"
              inputProps={{ min: 0 }}
              value={shown.width}
              onChange={(e) => edit({ width: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 0, height: 54 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000' } }}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 16, color: '#000' }}>Style</Typography>
            <Select
              fullWidth
              value={BORDER_STYLES.includes(shown.style) ? shown.style : 'none'}
              onChange={(e) => edit({ style: e.target.value })}
              sx={{ bgcolor: '#fff', borderRadius: '8px', height: 54, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' } }}
              // Reference list: opens BELOW the field, ~5 rows then scroll, 1px black
              // frame, hovered row light blue, picked row in blue text.
              MenuProps={REF_MENU_PROPS}
            >
              {BORDER_STYLES.map((st) => (
                <MenuItem key={st} value={st}>{st.charAt(0).toUpperCase() + st.slice(1)}</MenuItem>
              ))}
            </Select>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 16, color: '#000' }}>Colour</Typography>
            {/* Reference swatch: colour inside a thick black frame; click = picker popup */}
            <Box sx={{ position: 'relative', width: 74, height: 54, bgcolor: shown.color, border: '5px solid #000', boxSizing: 'border-box', cursor: 'pointer' }}>
              <ColorInput
                aria-label="Border colour"
                value={shown.color || '#000000'}
                onChange={(e) => edit({ color: e.target.value })}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <Box sx={{ display: 'flex', gap: 2, px: 2, pb: 2 }}>
        <Button
          onClick={onCancel}
          disableElevation
          sx={{ flex: 1, borderRadius: 0, bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #676b72', textTransform: 'none', fontSize: 28, fontWeight: 400, height: 48, '&:hover': { bgcolor: '#ececec' } }}
        >
          Cancel
        </Button>
        <Button
          onClick={update}
          disableElevation
          sx={{ flex: 1, borderRadius: 0, bgcolor: BLUE, color: '#fff', textTransform: 'none', fontSize: 28, fontWeight: 400, height: 48, '&:hover': { bgcolor: '#1670d0' } }}
        >
          Update
        </Button>
      </Box>
    </Dialog>
  );
};

export default BorderSettingsDialog;
