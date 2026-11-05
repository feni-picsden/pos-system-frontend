import React, { useEffect, useState } from 'react';
import { Box, Popover } from '@mui/material';
import { CustomPicker } from 'react-color';
import { Saturation, Hue, Alpha } from 'react-color/lib/components/common';

// Reference colour picker (receipt editor): saturation square, hue bar, alpha bar,
// then a hex box (#rrggbbaa) with a blue "Done" button.
const Pointer = () => (
  <Box sx={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px #000', transform: 'translate(-11px, -2px)', bgcolor: 'transparent' }} />
);

const PickerBody = CustomPicker(({ hex, hsl, hsv, rgb, onChange, onDone }) => {
  const alphaHex = Math.round((rgb?.a ?? 1) * 255).toString(16).padStart(2, '0');
  const [text, setText] = useState(`${hex}${alphaHex}`);
  useEffect(() => { setText(`${hex}${alphaHex}`); }, [hex, alphaHex]);

  const commitText = (v) => {
    const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v.trim());
    if (!m) return;
    onChange({ hex: `#${m[1]}`, a: m[2] ? parseInt(m[2], 16) / 255 : 1, source: 'hex' });
  };

  return (
    <Box sx={{ width: 250, bgcolor: '#fff', border: '1px solid #000' }}>
      <Box sx={{ position: 'relative', height: 150 }}>
        <Saturation hsl={hsl} hsv={hsv} onChange={onChange} pointer={Pointer} />
      </Box>
      <Box sx={{ position: 'relative', height: 22 }}>
        <Hue hsl={hsl} onChange={onChange} pointer={Pointer} />
      </Box>
      <Box sx={{ position: 'relative', height: 22 }}>
        <Alpha rgb={rgb} hsl={hsl} onChange={onChange} pointer={Pointer} />
      </Box>
      <Box sx={{ display: 'flex', height: 52 }}>
        <Box
          component="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { commitText(e.target.value); onDone(); } }}
          sx={{ flex: 1, minWidth: 0, border: 0, px: 2, fontSize: 16, outline: 'none', fontFamily: 'inherit' }}
        />
        <Box
          component="button"
          type="button"
          onClick={() => { commitText(text); onDone(); }}
          sx={{ width: 54, border: 0, bgcolor: '#5ebbeb', color: '#fff', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Done
        </Box>
      </Box>
    </Box>
  );
});

// Drop-in for `<input type="color" value onChange />`: renders an invisible
// full-size click target over its parent swatch and calls onChange({ target: { value } }).
// Value with alpha < 1 is passed as #rrggbbaa; fully opaque stays #rrggbb.
const ColorInput = ({ value, onChange, style, 'aria-label': ariaLabel }) => {
  const [anchor, setAnchor] = useState(null);
  const [color, setColor] = useState(value || '#000000');
  useEffect(() => { if (!anchor) setColor(value || '#000000'); }, [value, anchor]);

  const emit = (c) => {
    const a = c.rgb?.a ?? c.a ?? 1;
    const hex = (c.hex || '#000000').toLowerCase();
    const out = a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}` : hex;
    setColor(out);
    onChange?.({ target: { value: out } });
  };

  // Two layouts, matching how the old <input type="color"> was used:
  // - overlay (no style, or style.opacity 0): invisible click target over a parent swatch;
  // - swatch (any other style): the button IS the visible colour bar.
  const overlay = !style || style.opacity === 0;
  const buttonSx = overlay
    ? { position: 'absolute', inset: 0, width: '100%', height: '100%', p: 0, m: 0, border: 0, background: 'transparent', cursor: 'pointer', opacity: 0 }
    : { display: 'block', p: 0, m: 0, cursor: 'pointer', ...style, backgroundColor: color, boxSizing: 'border-box' };

  return (
    <>
      <Box
        component="button"
        type="button"
        aria-label={ariaLabel || 'Pick colour'}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={buttonSx}
      />
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { borderRadius: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.25)' } }}
      >
        <PickerBody color={color} onChange={emit} onDone={() => setAnchor(null)} />
      </Popover>
    </>
  );
};

export default ColorInput;
