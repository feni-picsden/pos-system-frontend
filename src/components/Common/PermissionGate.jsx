import React from 'react';
import { useHasPermission, useHasAnyPermission, useHasAllPermissions } from '../../hooks/usePermissions';

/**
 * PermissionGate component - conditionally renders children based on user permissions
 * 
 * Usage:
 * <PermissionGate permission="users.add">
 *   <Button>Add User</Button>
 * </PermissionGate>
 * 
 * <PermissionGate anyPermission={['users.edit', 'users.delete']}>
 *   <div>Can edit or delete users</div>
 * </PermissionGate>
 * 
 * <PermissionGate allPermissions={['users.view', 'users.edit']}>
 *   <div>Can both view and edit users</div>
 * </PermissionGate>
 */
const PermissionGate = ({ 
  children, 
  permission, 
  anyPermission, 
  allPermissions, 
  fallback = null 
}) => {
  const hasPermission = useHasPermission(permission);
  const hasAnyPermission = useHasAnyPermission(anyPermission);
  const hasAllPermissions = useHasAllPermissions(allPermissions);

  // Determine if user has required permissions
  // No permission prop = fail CLOSED (it used to default-allow).
  if (!permission && !anyPermission && !allPermissions) {
    if (import.meta.env.DEV) console.warn('PermissionGate rendered without any permission prop - denying');
    return fallback;
  }

  let hasAccess = true;

  if (permission) {
    hasAccess = hasPermission;
  } else if (anyPermission) {
    hasAccess = hasAnyPermission;
  } else if (allPermissions) {
    hasAccess = hasAllPermissions;
  }

  return hasAccess ? children : fallback;
};

export default PermissionGate;
