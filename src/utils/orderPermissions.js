// Orders & Invoices button gates (user 16/10/2026): a button is shown only when
// the backend route it calls would accept the user. Keys mirror
// routes/ordersInvoices.js exactly (requirePermission / requireAnyPermission).
// Display only - nothing here changes what the API enforces.

const T = (type) => String(type || 'ORDER').toUpperCase();

export const CREATE_KEYS = ['orders-invoices.add', 'stock_create_credit', 'stock_create_return', 'stock_create_transfer'];
export const EDIT_KEYS = ['orders-invoices.edit', 'stock_edit_credit', 'stock_edit_return', 'stock_edit_transfer'];

const createKeyFor = (type) => ({ TRANSFER: 'stock_create_transfer', RETURN: 'stock_create_return', CREDIT_NOTE: 'stock_create_credit' }[T(type)] || 'orders-invoices.add');
const editKeyFor = (type) => ({ TRANSFER: 'stock_edit_transfer', RETURN: 'stock_edit_return', CREDIT_NOTE: 'stock_edit_credit' }[T(type)] || 'orders-invoices.edit');

/**
 * @param {{hasPermission:Function, hasAnyPermission:Function}} perms from usePermissions()
 */
export const orderGates = ({ hasPermission, hasAnyPermission }) => {
  const has = (k) => hasPermission(k);
  const any = (ks) => hasAnyPermission(ks);
  const edit = has('orders-invoices.edit');
  return {
    // POST /  : any create key passes the API; the type's own key or the generic add
    canCreate: (type) => any([createKeyFor(type), 'orders-invoices.add']),
    // PUT /:id : generic edit or the type's own edit key
    canEdit: (type) => any([editKeyFor(type), 'orders-invoices.edit']),
    // PATCH /:id/receive, /transfer-receive, preview : stock_receive AND orders-invoices.edit
    canReceive: has('stock_receive') && edit,
    // PATCH /:id/transfer-send : stock_send AND orders-invoices.edit
    canSendTransfer: has('stock_send') && edit,
    // POST /:id/send-email marks the document SENT. The route only asks for
    // orders-invoices.view, but a view-only user must not change status from the
    // UI, so the button follows the edit keys (user 16/10/2026).
    canSendEmail: any(EDIT_KEYS),
    // PATCH /:id/apply : orders-invoices.edit
    canApply: edit,
    // DELETE /:id
    canDelete: has('orders-invoices.delete'),
    // POST /:id/return-items : stock_create_return AND orders-invoices.edit
    canReturnItems: has('stock_create_return') && edit,
    // POST /:id/reorder-items : orders-invoices.edit
    canReorder: edit,
    // POST /:id/reviews : modify_order_reviewers AND orders-invoices.edit
    canCreateReview: has('modify_order_reviewers') && edit,
    // POST /:id/attachments : orders-invoices.edit
    canAttach: edit,
  };
};

export default orderGates;
