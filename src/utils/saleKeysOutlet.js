/**
 * Resolve which outlet sale key sets should be scoped to (navbar + sell screen).
 * Prefer selectedOutletId from SelectedOutletContext (navbar).
 */
export function getSaleKeysOutletId({
  isSuperAdmin,
  getOutletId,
  selectedOutletId,
} = {}) {
  const superAdmin =
    typeof isSuperAdmin === 'function' ? isSuperAdmin() : Boolean(isSuperAdmin);

  if (selectedOutletId != null && selectedOutletId !== '') {
    return Number(selectedOutletId);
  }

  if (superAdmin) {
    const saved = localStorage.getItem('selectedOutletId');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  }

  const fromUser = typeof getOutletId === 'function' ? getOutletId() : null;
  return fromUser != null ? Number(fromUser) : null;
}
