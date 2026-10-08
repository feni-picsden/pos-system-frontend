import { useState } from 'react';
import TextField from '@mui/material/TextField';
import { parseNumberInput } from '../../utils/numberInput';

/**
 * A number TextField whose 0 can be erased.
 *
 * `value={x || 0}` + `onChange={parseFloat(e.target.value) || 0}` turned a
 * cleared box straight back into "0" (and typing after it gave "05"). Here the
 * raw text is kept locally while the field is being edited; every valid number
 * is committed as it is typed, an empty box commits nothing, and on blur an
 * empty box commits `fallback` (the old `|| 0` / `|| 1` default).
 *
 * Props: value (number | '' | null), onCommit(number), fallback (default 0),
 * int (parseInt instead of parseFloat), plus any TextField prop.
 */
const NumberField = ({ value, onCommit, fallback = 0, int = false, onBlur, ...props }) => {
  const [text, setText] = useState(null); // null = not being edited
  const shown = text !== null ? text : value === '' || value == null ? '' : String(value);
  return (
    <TextField
      {...props}
      type="number"
      value={shown}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const n = parseNumberInput(raw, { int });
        if (n !== '') onCommit(n);
      }}
      onBlur={(e) => {
        if (text !== null && parseNumberInput(text, { int }) === '') onCommit(fallback);
        setText(null);
        if (onBlur) onBlur(e);
      }}
    />
  );
};

export default NumberField;
