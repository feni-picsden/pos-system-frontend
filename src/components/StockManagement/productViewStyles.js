// Shared Shopfront product-view styling, measured off the reference
// (topdrops.onshopfront.com > Products > View). Used by ProductView.jsx and
// every section component so the 8 sections stay visually identical.

// Heavy Shopfront widget shadow (reference product-view widgets and rail cards)
export const WIDGET_SHADOW =
  "0 0 30px rgba(0,0,0,0.25), 0 15px 30px rgba(0,0,0,0.19)";

// Rail rows are divs; make them behave like buttons for keyboard users.
export const RAIL_FOCUS_SX = {
  "&:focus-visible": { outline: "2px solid #5ebbeb", outlineOffset: "-2px" },
};
export const activateOnKey = (fn) => (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fn();
  }
};

// Reference product-view Home widget: transparent card on the #f8f8f8 pane,
// 8px padding, 32px gap below, heavy shadow, square corners.
export const WIDGET_SX = {
  p: 1,
  mb: 4,
  bgcolor: "transparent",
  borderRadius: 0,
  boxShadow: WIDGET_SHADOW,
  breakInside: "avoid",
};

// Reference widget heading is a bare <h3> (1.17em bold, 1.17em bottom margin).
export const WIDGET_H3_SX = {
  fontSize: "18.72px",
  fontWeight: 700,
  color: "#000",
  m: "0 0 18.72px",
};

// Reference section heading in the non-Home sections is a bare <h2>
// (1.5em bold, 0.83em vertical margins).
export const WIDGET_H2_SX = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#000",
  m: "19.92px 0",
  lineHeight: "normal",
};

// Reference in-widget tables: collapsed 1px black grid, 16px text, 8px cells,
// bold centred headers. Nothing blue, nothing uppercase.
export const GRID_TABLE_SX = {
  borderCollapse: "collapse",
  "& th, & td": {
    border: "1px solid #000",
    fontSize: 16,
    color: "#000",
    padding: "8px",
    backgroundColor: "transparent",
    // Reference cells are 36px tall: 16px font at normal line-height + 8px pad.
    lineHeight: "normal",
  },
  "& th": { fontWeight: 700, textAlign: "center" },
  "& td": { fontWeight: 400 },
};

// Reference section root: 8px padding on the #f8f8f8 content pane, filling the
// pane height so no white band shows below short sections.
export const SECTION_ROOT_SX = {
  p: 1,
  bgcolor: "#f8f8f8",
  flexGrow: 1,
};

// ---------------------------------------------------------------------------
// Reference ".event-line" list (Sales / Purchase / Transfer history, Inventory
// Log). A striped list of 89px rows, no table, no column headers.
// ---------------------------------------------------------------------------

// The list fills the pane edge to edge - no padding on the section root.
export const EVENT_ROOT_SX = { bgcolor: "#f8f8f8", flexGrow: 1 };

export const eventRowSx = (index) => ({
  backgroundColor: index % 2 === 1 ? "#ebebeb" : "#f8f8f8",
});

export const EVENT_LINE_SX = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px",
  cursor: "pointer",
  color: "#000",
  // Reference row is a fixed 89px box that clips the taller timestamp block.
  height: 89,
  boxSizing: "border-box",
  overflow: "hidden",
};

export const EVENT_STATUS_SX = {
  width: 40,
  flexShrink: 0,
  textAlign: "center",
  fontSize: 32,
  lineHeight: 1,
};

export const EVENT_TIMESTAMP_SX = {
  width: 313,
  flexShrink: 0,
  textAlign: "center",
};
export const EVENT_DATE_SX = { fontSize: "19.2px", lineHeight: "23px" };
export const EVENT_INVOICE_SX = { fontSize: "13.44px", lineHeight: "16px" };
export const EVENT_LOCATION_SX = {
  flex: "1 1 auto",
  ml: "16px",
  fontSize: 16,
  lineHeight: "19px",
};
export const EVENT_PRICE_SX = {
  width: 220,
  flexShrink: 0,
  textAlign: "center",
  fontSize: 32,
  lineHeight: "38px",
};
export const EVENT_CENTS_SX = { fontSize: "0.7em" };

// Expanded row: 1fr / 20% grid, 16px padding, 32px gaps.
export const EVENT_EXPANDED_SX = {
  display: "grid",
  gridTemplateColumns: "1fr 20%",
  columnGap: "32px",
  rowGap: "32px",
  padding: "16px",
  color: "#000",
};
export const EVENT_SUMMARY_SX = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  columnGap: "8px",
  alignItems: "center",
  textAlign: "center",
};
export const EVENT_CLOSE_SX = {
  gridColumn: 2,
  gridRow: "1 / 3",
  alignSelf: "start",
  backgroundColor: "#1c86f2",
  color: "#f8f8f8",
  fontSize: 16,
  textAlign: "center",
  padding: "16px",
  cursor: "pointer",
  borderRadius: 0,
  textTransform: "none",
  boxShadow: "none",
  width: "100%",
  "&:hover": { backgroundColor: "#1c86f2", boxShadow: "none" },
};
// Reference totals block is a shrink-to-fit table centred in its column:
// right-aligned labels, left-aligned values, 0.3em cell padding.
export const EVENT_TOTALS_SX = {
  display: "inline-table",
  borderCollapse: "collapse",
  "& td": {
    padding: "4.8px",
    fontSize: 16,
    border: 0,
    color: "#000",
    lineHeight: "19px",
  },
  "& td:first-of-type": { textAlign: "right" },
  "& td:last-of-type": { textAlign: "left" },
};
export const EVENT_BALANCE_SX = {
  display: "flex",
  marginLeft: "auto",
  width: 366,
  borderTop: "3px double #000",
  paddingTop: "8px",
  fontSize: 24,
  lineHeight: "29px",
};

// Splits a formatted amount so the cents render at 0.7em, like the reference.
export const splitMoney = (value) => {
  const n = Number(value) || 0;
  const s = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
  const i = s.lastIndexOf(".");
  return i === -1 ? [s, ""] : [s.slice(0, i + 1), s.slice(i + 1)];
};

// ---------------------------------------------------------------------------
// Reference ".orders-invoices-table" (Purchase History, Transfer History).
// ---------------------------------------------------------------------------
export const ORDERS_TABLE_SX = {
  width: "auto",
  minWidth: "100%",
  borderCollapse: "collapse",
  "& > * > tr": { borderBottom: "1px solid #000" },
  "& > * > tr > th": {
    textTransform: "uppercase",
    backgroundColor: "#ebebeb",
    color: "#000",
    fontWeight: 700,
    fontSize: 16,
    padding: "16px 8px",
    textAlign: "center",
    border: 0,
    position: "sticky",
    top: 0,
    zIndex: 1,
    lineHeight: "normal",
  },
  "& > * > tr > td": {
    fontSize: 16,
    fontWeight: 400,
    color: "#000",
    padding: "8px",
    border: 0,
    textAlign: "center",
    lineHeight: "normal",
  },
  // Reference left-aligns the From/To cells; className beats the child selector.
  "& > * > tr > td.left": { textAlign: "left" },
  "& > * > tr > td.nopad": { padding: 0 },
  "& > tbody > tr": { height: 95, boxSizing: "border-box" },
  "& .main": { fontSize: "17.6px", fontWeight: 500 },
  "& .secondary": {
    fontSize: "12.8px",
    fontWeight: 400,
    color: "#676b72",
    textTransform: "uppercase",
  },
};

// Reference order status pill.
export const ORDER_STATUS_COLORS = {
  OPEN: "#1c86f2",
  PENDING: "#1c86f2",
  DRAFT: "#1c86f2",
  SENT: "#f6993f",
  PARTIAL: "#f6993f",
  RECEIVED: "#32b643",
  COMPLETED: "#32b643",
  CANCELLED: "#e3342f",
  IN: "#32b643",
  OUT: "#f6993f",
  INTERNAL: "#1c86f2",
};
export const orderStatusSx = (status) => ({
  display: "inline",
  backgroundColor: ORDER_STATUS_COLORS[String(status || "").toUpperCase()] || "#676b72",
  color: "rgba(255,255,255,0.8)",
  borderRadius: "20%",
  padding: "8px",
  fontSize: 16,
});

// ---------------------------------------------------------------------------
// Reference ".inventory-log-table": blue uppercase header (the only section
// where the reference actually uses the blue header), #313439 grid, zebra rows.
// ---------------------------------------------------------------------------
export const INVENTORY_LOG_TABLE_SX = {
  borderCollapse: "collapse",
  width: "100%",
  "& > * > tr > th": {
    backgroundColor: "#5ebbeb",
    color: "#f8f8f8",
    fontWeight: 700,
    fontSize: 16,
    textTransform: "uppercase",
    padding: "16px 8px",
    border: "1px solid #313439",
    textAlign: "left",
    lineHeight: "normal",
  },
  "& > * > tr > td": {
    fontSize: 16,
    fontWeight: 400,
    color: "#000",
    padding: "16px 8px",
    border: "1px solid #313439",
    textAlign: "center",
    lineHeight: "normal",
  },
  "& > * > tr > th.center, & > * > tr > td.center": { textAlign: "center" },
  "& > * > tr > th.left, & > * > tr > td.left": { textAlign: "left" },
  "& > * > tr > th.tight, & > * > tr > td.tight": { padding: 0 },
};
export const inventoryLogRowSx = (index) => ({
  backgroundColor: index % 2 === 0 ? "#f8f8f8" : "#ebebeb",
});
// The Before / Changed / After cells hold a small 2-column quantity table.
export const INVENTORY_QTY_TABLE_SX = {
  width: "100%",
  borderCollapse: "collapse",
  "& td": { border: 0, textAlign: "center", fontSize: 16, color: "#000" },
  "& .title": { padding: "4px" },
  "& .value": { padding: "0 8px 8px" },
  "& .qty": { fontSize: "22.4px", lineHeight: "normal" },
  "& .label": { fontSize: 16, lineHeight: "normal" },
};

// Reference ".nice-error" empty state: 160px glyph beside a 24px/700 heading
// and a 16px body, the pair centred on the row.
export const NICE_ERROR_SX = {
  display: "flex",
  justifyContent: "center",
  padding: "16px",
  color: "#000",
};
export const NICE_ERROR_ICON_SX = {
  width: 200,
  mr: "8px",
  textAlign: "center",
  fontSize: 160,
  lineHeight: 1,
  fontWeight: 300,
};
export const NICE_ERROR_REASON_SX = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};
// Default <h2>/<p> margins are part of the reference spacing (69px / 51px blocks).
export const NICE_ERROR_HEADING_SX = {
  fontSize: 24,
  fontWeight: 700,
  m: "19.92px 0",
};
export const NICE_ERROR_BODY_SX = { fontSize: 16, fontWeight: 400, m: "16px 0" };

// Reference outlet combobox: full width, 42px tall, 8px radius, #404040 border.
export const OUTLET_SELECT_SX = {
  width: "100%",
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    backgroundColor: "#fff",
    height: 42,
    padding: "0 8px 0 8px",
  },
  "& .MuiOutlinedInput-input": { padding: "8px !important", fontSize: 16 },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "#404040",
    borderWidth: "1px",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" },
  "& .Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: "#000",
    borderWidth: "2px",
  },
  "& input::placeholder": { color: "#808080", opacity: 1 },
};
