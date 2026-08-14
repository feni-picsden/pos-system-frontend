// Which cost a product is judged against — the "Cost Calculation Method" company
// setting (Setup > General > Company), documented by the reference as:
//   Last Cost    - the cost the most recent invoice landed at
//   Average Cost - running weighted average of received stock
//   Mixed Mode   - Average while inventory is positive, Last once it goes negative
// The setting existed here but nothing read it; every profit figure silently used
// the last cost.
export const effectiveUnitCost = (product, method = 'Last Cost') => {
  if (!product) return 0;
  const last = Number(product.itemCost) || 0;
  const average = product.averageItemCost != null ? Number(product.averageItemCost) || 0 : null;
  if (average == null) return last;
  if (method === 'Average Cost') return average;
  if (method === 'Mixed Mode') return (Number(product.inventory) || 0) > 0 ? average : last;
  return last;
};

export const effectiveCaseCost = (product, method = 'Last Cost') => {
  if (!product) return 0;
  const last = Number(product.caseCost) || 0;
  const average = product.averageCaseCost != null ? Number(product.averageCaseCost) || 0 : null;
  if (average == null) return last;
  if (method === 'Average Cost') return average;
  if (method === 'Mixed Mode') return (Number(product.inventory) || 0) > 0 ? average : last;
  return last;
};
