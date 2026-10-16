import { useSelectedOutlet } from '../contexts/SelectedOutletContext';
import { useSelectedRegister } from '../contexts/SelectedRegisterContext';

/**
 * In-page Outlet / Register filter visibility (user rule, 16/10/2026):
 *   header outlet not selected (All Outlets)      -> Outlet filter shown, Register filter shown
 *   header outlet selected, register not selected -> Outlet filter hidden, Register filter shown
 *   header outlet + register selected             -> both hidden
 * Hidden = display only; the page keeps its state/logic. A hidden Register
 * filter should send the header register (headerRegisterId) instead.
 * Outlet users (no header switch) always have an outlet, so their Outlet
 * filter is hidden too; their Register filter follows the header register.
 */
export default function useHeaderScope() {
  const { selectedOutletId, isAllOutlets, isTrueSuperAdmin } = useSelectedOutlet();
  const { selectedRegister } = useSelectedRegister();
  const headerOutletSelected = isTrueSuperAdmin ? !isAllOutlets : true;
  const headerRegisterId = selectedRegister?.id ?? null;
  return {
    showOutletFilter: !headerOutletSelected,
    showRegisterFilter: headerRegisterId == null,
    headerOutletId: headerOutletSelected ? (selectedOutletId ?? null) : null,
    headerRegisterId,
  };
}
