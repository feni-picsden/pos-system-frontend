// A refresh icon should visibly turn a full circle on every click, even when the
// reload finishes in a few milliseconds. `spinning` stays true for at least one
// full turn (matches spinSx's 0.8s round) and for as long as `busy` is true.
//   const [spinning, spin] = useSpinOnce(loading);
//   <IconButton onClick={() => { spin(); reload(); }}><RefreshIcon sx={spinSx(spinning)} /></IconButton>
import { useCallback, useEffect, useRef, useState } from 'react';

export const SPIN_MS = 800;

export default function useSpinOnce(busy = false) {
  const [clicked, setClicked] = useState(false);
  const timer = useRef(null);
  const spin = useCallback(() => {
    setClicked(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; setClicked(false); }, SPIN_MS);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return [clicked || Boolean(busy), spin];
}
