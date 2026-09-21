import { useMemo } from 'react';
import { APP_PAGES } from '../components/Layout/Sidebar';
import { usePermissions } from './usePermissions';
import { useSelectedOutlet } from '../contexts/SelectedOutletContext';

// Admin-only pages the sidebar hides from everyone else (same ids it checks).
const SUPER_ADMIN_ONLY = new Set(['outlets', 'registers', 'master-database-products']);

/**
 * Pages the signed-in user can open, for the Quick Menu "Page" dropdown. Same
 * permission rule the sidebar uses, so the picker never offers a page the user
 * would be refused. Deduplicated by path (a group and its first child can share one).
 */
export const useAppPages = () => {
  const { hasAnyPermission, user, loading } = usePermissions();
  const { isTrueSuperAdmin } = useSelectedOutlet();

  return useMemo(() => {
    if (loading) return [];
    const seen = new Set();
    return APP_PAGES.filter((page) => {
      if (SUPER_ADMIN_ONLY.has(page.id) && !isTrueSuperAdmin) return false;
      const allowed =
        !page.permissions.length || user?.hasAllPermission || hasAnyPermission(page.permissions);
      if (!allowed || seen.has(page.path)) return false;
      seen.add(page.path);
      return true;
    });
  }, [hasAnyPermission, user, loading, isTrueSuperAdmin]);
};

export default useAppPages;
