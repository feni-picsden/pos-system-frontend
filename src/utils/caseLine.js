// A cart / sale line sold AS A CASE (reference: `isCase` on the line).
//
// The line's `quantity` is always UNITS (1 case of 6 = quantity 6), so pricing,
// stock and tax never change. What changes is how the line is shown and stepped:
//   - it reads "1 <name> (Case)" and its qty is cases, not units;
//   - the +/- keys and the keypad move by whole cases;
//   - the footer counts it under Cases, not Items.
// Everything that needs those rules goes through here so they cannot drift.

// A line only behaves as a case when it is flagged AND the product really packs
// more than one unit — a "case" of 1 is just an item.
export const isCaseLine = (line) =>
  !!line?.isCase && (Number(line?.caseQuantity) || 1) > 1;

// Units per +/- press: a whole case on a case line, one unit otherwise.
export const lineStep = (line) => (isCaseLine(line) ? Number(line.caseQuantity) : 1);

// The number shown on the line: cases for a case line, units otherwise. Sign is
// kept (a returned case shows -1).
export const displayQuantity = (line) => {
  const qty = Number(line?.quantity) || 0;
  if (!isCaseLine(line)) return qty;
  const cases = qty / Number(line.caseQuantity);
  // Whole cases print whole; a broken case (e.g. after a barcode ± of 1) shows 2 dp.
  return Number.isInteger(cases) ? cases : Math.round(cases * 100) / 100;
};

// Name with the reference " (Case)" suffix. `caseText` is Setup > General's
// "Case" word.
export const displayName = (line, caseText = 'Case') =>
  isCaseLine(line) ? `${line.name} (${caseText})` : line?.name || '';

// Reference toggle ("Use Case Quantity" on a selected line): N cases <-> N units.
// Returns the new { isCase, quantity } — the caller re-prices from that quantity.
export const toggleCase = (line) => {
  const cq = Number(line?.caseQuantity) || 1;
  const qty = Number(line?.quantity) || 0;
  if (cq <= 1) return { isCase: false, quantity: qty };
  return line?.isCase
    ? { isCase: false, quantity: qty / cq }
    : { isCase: true, quantity: qty * cq };
};

// Footer counters (reference: cases and items counted separately, then joined
// as "2 Cases and 3 Items"; a single kind prints alone; each word pluralised).
export const countCartLines = (cart = []) =>
  (cart || []).reduce(
    (acc, line) => {
      const shown = displayQuantity(line);
      if (isCaseLine(line)) acc.cases += shown;
      else acc.items += Number(line?.quantity) || 1;
      return acc;
    },
    { cases: 0, items: 0 },
  );

export const plural = (word, n) => (Math.abs(n) === 1 ? word : `${word}s`);

// A BANKED sale item (Sales History shape: productName / quantity / isCase) shown
// the way the sell screen showed it. The case size is not stored on the line, so
// the caller resolves it from the product (1 when unknown → plain items).
export const saleItemDisplay = (item, caseQuantity, { caseText = 'Case', singleText = 'Item' } = {}) => {
  const line = { ...item, name: item?.comboName || item?.productName || '', caseQuantity };
  const asCase = isCaseLine(line);
  const qty = displayQuantity(line);
  return {
    qty,
    // "Case"/"Cases" or "Item"/"Items" for the "<qty> <word> <name>" history row.
    word: plural(asCase ? caseText : singleText, qty),
    // "Name (Case)" for rows that print no unit word.
    name: displayName(line, caseText),
    isCase: asCase,
  };
};

export const formatCountLine = ({ cases, items }, singleText = 'Item', caseText = 'Case') => {
  const parts = [];
  if (cases) parts.push(`${cases} ${plural(caseText, cases)}`);
  if (items) parts.push(`${items} ${plural(singleText, items)}`);
  return parts.join(' and ');
};
