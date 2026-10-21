export const OUTLET_COLORS = ['#b77cac', '#b6ca67', '#62b7cf', '#e5ad65', '#8497cd', '#71b5a2'];
export const outletColor = id => OUTLET_COLORS[Math.max(0, (Number(id) || 1) - 1) % OUTLET_COLORS.length];
export function timelineSaleColor(sale, colorBy = 'outlet', outletColors = {}) {
  if (colorBy === 'user') {
    if (sale?.userId != null) return outletColor(sale.userId);
    // Older API responses contain the user's name but no userId. Give those
    // users stable individual colors too, rather than one shared fallback.
    const name = String(sale?.user || 'Unknown').trim().toLowerCase();
    let hash = 0;
    for (const char of name) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
    return OUTLET_COLORS[hash % OUTLET_COLORS.length];
  }
  return outletColors[sale?.outletId] || outletColor(sale?.outletId);
}
export const money = value => {
  const n = Number(value) || 0;
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Keep quiet intervals between sales, but omit unused hours at either end.
export function activeTimeline(slots = []) {
  const occupied = slot => Number(slot.saleCount) > 0 || slot.sales?.length > 0 || Number(slot.revenue) !== 0;
  const first = slots.findIndex(occupied);
  if (first < 0) return [];
  let last = slots.length - 1;
  while (!occupied(slots[last])) last--;
  return slots.slice(first, Math.min(slots.length, last + 2));
}

// Comparisons are keyed by the CURRENT window on the server. Never fall back
// to a neighbouring point when a period has no sales.
export function kpiSeries(outlets, metric) {
  const byKey = new Map();
  outlets.forEach(o => (o.history || []).forEach(bucket => {
    const row = byKey.get(bucket.key) || { key: bucket.key, time: bucket.time };
    row[`value_${o.id}`] = Number(bucket[metric]) || 0;
    row[`compare_${o.id}`] = Number(bucket.comparison?.[metric]) || 0;
    byKey.set(bucket.key, row);
  }));
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function tableWithTotal(rows = [], kind) {
  if (!rows.length) return [];
  const revenue = rows.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);
  if (kind === 'products') return [...rows, { name: 'Total', revenue,
    quantity: rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0), __isTotal: true }];
  const transactionCount = rows.reduce((sum, row) => sum + (Number(row.transactionCount) || 0), 0);
  return [...rows, { name: 'Total', revenue, transactionCount,
    averageSale: transactionCount ? revenue / transactionCount : 0, __isTotal: true }];
}

// Shared by reports with independently completing filter requests.
export function createRequestGate() {
  let version = 0;
  return { next: () => ++version, isCurrent: token => token === version, invalidate: () => { version++; } };
}
