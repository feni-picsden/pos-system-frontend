// Who may receive an in-transit transfer, mirroring PATCH /orders-invoices/:id/transfer-receive:
// a SENT transfer whose destination is an outlet (not a transferee / vendor connection),
// received by a global admin or by a user of the destination outlet.
export const canReceiveTransfer = (doc, user, isGlobalAdmin) => {
  if (!doc || String(doc.type || '').toUpperCase() !== 'TRANSFER') return false;
  if (String(doc.status || '').toUpperCase() !== 'SENT') return false;
  const to = String(doc.to ?? '').trim();
  if (!/^\d+$/.test(to)) return false;
  if (isGlobalAdmin) return true;
  return user?.outletId != null && String(user.outletId) === to;
};
