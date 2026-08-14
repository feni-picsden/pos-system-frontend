// Shared chrome for the Shelf Ticket surfaces (Everyday + Promotional).
// Shopfront's ticket screens have no transitions and no ripple anywhere.
export const INSTANT = 'all 0s ease';

/**
 * Full-bleed action bar pinned to the viewport bottom (the reference bar is fixed, so it
 * stays visible with one row or a thousand). Pages must reserve BAR_CLEARANCE at the
 * bottom so the last row is not covered.
 */
export const BAR_CLEARANCE = '74px';

export const TICKET_BAR_SX = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
  flexWrap: 'wrap',
  minHeight: 58,
  px: 1,
  py: 1,
  bgcolor: '#5ebbeb',
  borderRadius: 0,
  boxShadow: 'none',
};

export const EXPORT_BUTTON_SX = {
  minWidth: 115,
  height: 42,
  padding: '8px 32px',
  bgcolor: '#5ebbeb',
  color: '#fff',
  border: '1px solid #fff',
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  '&:hover': { bgcolor: '#0ea5e9', border: '1px solid #fff', boxShadow: 'none' },
};

/**
 * Shopfront's Export hands a DesignPro data file (POSLABELNEW) to Hardware Connect.
 * In the browser the working equivalent is downloading the same field set as a file
 * DesignPro can open.
 * ponytail: CSV, not DBF — DesignPro reads both; swap to .dbf only if a client needs it.
 */
export const downloadCsv = (filename, headers, rows) => {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
