// "/sale-keys/sets/7" -> "/sale-keys". apiClient's GET cache keys start with
// the request url, so busting on the first path segment clears every cached
// read of that resource after a write. Deliberately coarse: over-busting costs
// one refetch, under-busting shows stale data after a save.
export function resourcePrefix(url = '') {
  const path = String(url ?? '').split('?')[0];
  const [, first] = path.split('/');
  return first ? `/${first}` : path;
}
