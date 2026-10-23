// Search-bar chips ({ type, id, name, deleted, mode }) saved with a favourite
// report and restored from the URL when the favourite is viewed (reference
// restores the Included / Excluded chips together with the other filters).
const KEY = 'chips';

export function chipsToParam(chips) {
  const list = (chips || []).filter((c) => c && c.mode !== 'off');
  return list.length ? JSON.stringify(list.map(({ type, id, name, deleted, mode }) => ({ type, id, name, deleted: !!deleted, mode: mode || 'include' }))) : '';
}

export function chipsFromParams(searchParams) {
  const raw = searchParams?.get?.(KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list)
      ? list.filter((c) => c && c.type && c.id !== undefined && c.id !== null).map((c) => ({ type: c.type, id: c.id, name: c.name || '', deleted: !!c.deleted, mode: c.mode === 'exclude' ? 'exclude' : 'include' }))
      : [];
  } catch {
    return [];
  }
}
