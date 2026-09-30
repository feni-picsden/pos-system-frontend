// Keyboard highlight for search-result dropdowns (reference: top result
// pre-highlighted, ArrowUp/Down move, Enter adds, Escape closes). One hook can
// drive several boxes on a page - each box passes its own key ('sim', a
// criterion id...). Pure rules live in utils/searchKeys.js.
import { useCallback, useState } from 'react';
import { nextIndex, pickIndex } from '../../utils/searchKeys';

export const ACTIVE_ROW_SX = { bgcolor: '#d6ecfa', boxShadow: 'inset 3px 0 0 #5ebbeb' };

const useResultKeys = () => {
  const [active, setActive] = useState({});

  const indexOf = useCallback((key) => (active[key] == null ? 0 : active[key]), [active]);
  const isActive = useCallback((key, i) => indexOf(key) === i, [indexOf]);
  const reset = useCallback((key) => setActive((prev) => ({ ...prev, [key]: 0 })), []);

  /**
   * onKeyDown for the search input. `results` is the list currently shown,
   * `onSelect(row)` adds the row, `onClose()` (optional) hides the list.
   */
  const handleKeyDown = useCallback((key, results, onSelect, onClose) => (e) => {
    const len = Array.isArray(results) ? results.length : 0;
    if (len === 0) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const i = pickIndex(indexOf(key), len);
      if (i >= 0) onSelect(results[i]);
      reset(key);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Escape') {
      e.preventDefault();
      const i = nextIndex(e.key, indexOf(key), len);
      if (i < 0) { if (onClose) onClose(); reset(key); return; }
      setActive((prev) => ({ ...prev, [key]: i }));
    }
  }, [indexOf, reset]);

  return { isActive, reset, handleKeyDown };
};

export default useResultKeys;
