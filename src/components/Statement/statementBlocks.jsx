import React from 'react';
import { formatDate as formatAppDate } from '../../utils/appDateTime';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  applyStatementVariables,
  getPrintedActionColumns,
  ACTION_COLUMN_WIDTHS,
  buildCreditTermBuckets,
  statementBorderCss,
} from '../../utils/statementDefaults';

/**
 * Statement blocks — ONE drawing of every statement component, shared by the
 * printed statement (StatementRenderer: Customers > Balance view / print, the
 * editor's Preview) and the editor canvas. The editor adds only its chrome
 * (outlines, toolbars, zone tags, drop targets) around these, and that chrome
 * takes no layout space, so a block sits at the same size and position in the
 * editor, the Preview and the print.
 *
 * statementData shape (from Balance.buildStatement -> generatedStatement.data):
 *   summary: { dateRange, overdue, current, total }  // pre-formatted strings
 *   activities: [{ date, activity, number, reference, total, balance, type }]  // flat, raw values
 *   creditTerms: the customer group's [{ label, duration: 'P30D' }], rangeEnd
 */

// Reference prints the Type (and a payment's detail) through the component's
// renameable labels.
const actionLabels = (props = {}) => ({
  Invoice: props.labelInvoice || 'Invoice',
  Payment: props.labelPayment || 'Payment',
  'Paid in Store': props.labelPaidInStore || 'Paid In Store',
});

const money = (v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;

const cssSize = (v) => {
  const s = String(v ?? '').trim();
  if (!s || s === 'auto') return 'auto';
  return /^\d+(\.\d+)?$/.test(s) ? `${s}px` : s;
};

const paddingCss = (props) =>
  `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`;

const boxSx = (props) => ({
  backgroundColor: props.backgroundColor || '#ffffff',
  padding: paddingCss(props),
  ...statementBorderCss(props.border),
});

// ---- shared geometry (the editor canvas uses these too) -------------------------
// Gap under every block, top level and inside a column cell.
export const statementBlockGapSx = { mb: 1 };
// Columns: the cells fill the block exactly (flex-basis + gap; width:% + margin
// overflowed it by the gap width).
export const statementColumnsSx = (props = {}) => ({ display: 'flex', gap: 1, ...boxSx(props) });
export const statementColumnCellSx = (props = {}, colIndex = 0) => ({
  flex: `1 1 ${props.columnWidths?.[colIndex] || 50}%`,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
});
// Inner inset of a column cell, as the editor has always drawn it.
export const statementColumnInnerSx = { p: 1, width: '100%', boxSizing: 'border-box' };

// Order the printed statement exactly as the editor lays it out: Header zone,
// then Body, then Footer (stable within a zone). Array order alone printed a
// block added to the Header later at the bottom of the page.
const ZONE_ORDER = { header: 0, body: 1, footer: 2 };
export const orderStatementComponents = (components = []) =>
  components
    .map((c, i) => ({ c, i, z: ZONE_ORDER[c?.zone || 'body'] ?? 1 }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map(({ c }) => c);

// Overview / Credit Terms cell: bold caption over its amount, centred.
const summaryCell = (props, label, value) => {
  const text = { fontSize: `${props.fontSize || 12}px`, color: props.fontColor || '#000000', lineHeight: 1.4 };
  return (
    <Box key={label} sx={{ flex: 1, textAlign: 'center', px: 0.5, py: 0.5 }}>
      <Typography sx={{ ...text, fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ ...text, fontWeight: props.fontWeight || 'normal' }}>{value}</Typography>
    </Box>
  );
};

const formatCurrency = (amount) => {
  if (typeof amount === 'string') return amount; // already formatted
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0);
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value); // already a display string
  // The store's calendar day (Setup > General > Timezone).
  return formatAppDate(d);
};

// The date range over Overdue / Current / Total Due.
const totalsBlock = (props, summary = {}) => (
  <>
    <Typography sx={{ fontSize: `${props.fontSize || 12}px`, color: props.fontColor || '#000000', fontWeight: props.fontWeight || 'normal', textAlign: 'center', py: '3px' }}>
      {summary.dateRange || ''}
    </Typography>
    <Box sx={{ display: 'flex' }}>
      {summaryCell(props, 'Overdue', summary.overdue || formatCurrency(0))}
      {summaryCell(props, 'Current', summary.current || formatCurrency(0))}
      {summaryCell(props, 'Total Due', summary.total || formatCurrency(0))}
    </Box>
  </>
);

// Reference Overview: the totals, styled only by the component's own settings
// (font, colours, padding, border).
// Reference draws the date range + Overdue / Current / Total Due inside a 1px
// black box whichever component (Overview / Credit Terms) prints it.
export const renderOverview = (props, summary = {}) => (
  <Box sx={boxSx(props)}><Box sx={{ border: '1px solid #000' }}>{totalsBlock(props, summary)}</Box></Box>
);

// Normalise activities into groups of transactions so the Actions table can
// render both the flat live shape and the grouped shape uniformly.
const toActivityGroups = (activities = []) => {
  if (!Array.isArray(activities) || activities.length === 0) return [];
  if (activities[0] && Array.isArray(activities[0].transactions)) return activities;
  return [{ category: null, transactions: activities }];
};

// Reference Credit Terms: ONE component drawing two boxes, each with its own
// black border, a small gap apart — one cell per customer-group credit term
// ("0 days" / "30 days") with what is due in it, then the date range over
// Overdue / Current / Total Due. `terms` = buildCreditTermBuckets(); with none
// (the group has no terms) only the totals box prints.
const innerBox = { border: '1px solid #000' };
export const renderCreditTerms = (props, terms, summary) => (
  <Box sx={boxSx(props)}>
    {terms && terms.length > 0 && (
      <Box sx={{ ...innerBox, display: 'flex', mb: '4px' }}>
        {terms.map((t) => summaryCell(props, t.label, typeof t.amount === 'number' ? formatCurrency(t.amount) : t.amount))}
      </Box>
    )}
    <Box sx={innerBox}>{totalsBlock(props, summary)}</Box>
  </Box>
);

const renderActions = (props, statementData) => {
  const summary = statementData.summary || {};
  const groups = toActivityGroups(statementData.activities);
  const font = props.fontSize || 14;
  const cellColor = props.fontColor || '#000000';
  // Columns/labels/order come from the template's Actions config, so
  // renaming or disabling a column in the editor shows on the live
  // statement. Plain table: header rule only, no gridlines, all left.
  const cols = getPrintedActionColumns(props);
  const labels = actionLabels(props);
  const cellValue = (key, t, running) => {
    switch (key) {
      case 'date': return formatDate(t.date);
      case 'activity': return labels[t.activity] || t.activity;
      // The invoice number(s) the row is for (blank for unused credit).
      case 'number': return t.number || '';
      // What was typed with the payment, or "in-store" for a till payment; the
      // sample rows carry a renameable detail ("Paid In Store") after it.
      case 'reference': return `${t.reference || ''}${t.detail ? ` ${labels[t.detail] || t.detail}` : ''}`.trim();
      case 'total': return formatCurrency(t.total);
      // What is still owed on that invoice; a payment's unused part as a minus.
      case 'balance': return formatCurrency(t.balance);
      case 'runningTotal': return formatCurrency(running);
      default: return '';
    }
  };
  // Reference spacing: column heads and rows sit 16px in from the table's left
  // edge, the "30 days" / "Current" group label 8px; 8px between columns.
  const cellSx = { border: 0, py: 0, px: '4px', fontSize: `${font}px`, color: cellColor, lineHeight: 1.25, '&:first-of-type': { pl: '16px' } };
  return (
    <Box sx={boxSx(props)}>
      <TableContainer>
        {/* Fixed layout so the column widths hold (reference: even, roomy columns). */}
        <Table size="small" sx={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
          <TableHead>
            <TableRow>
              {cols.map((h) => (
                <TableCell
                  key={h.key}
                  align="left"
                  sx={{ ...cellSx, width: ACTION_COLUMN_WIDTHS[h.key], fontWeight: 700, borderBottom: '1px solid #000' }}
                >
                  {h.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          {/* Reference: nothing in the range leaves the table empty, no message. */}
          <TableBody>
            {groups.map((group, catIndex) => (
              <React.Fragment key={catIndex}>
                {group.category && (
                  <TableRow>
                    <TableCell colSpan={cols.length} sx={{ ...cellSx, fontWeight: 700, '&:first-of-type': { pl: '8px' } }}>{group.category}</TableCell>
                  </TableRow>
                )}
                {(group.transactions || []).map((t, tIndex) => {
                  const running = (group.transactions || [])
                    .slice(0, tIndex + 1)
                    // Account running total: payments reduce it.
                    .reduce((sum, x) => sum + (x.type === 'payment' || x.activity === 'Payment' ? -1 : 1) * money(x.total), 0);
                  // Reference closes the table with a full-width rule under
                  // the last line, right above "Total Due".
                  const isLast = catIndex === groups.length - 1 && tIndex === (group.transactions || []).length - 1;
                  return (
                    <TableRow key={tIndex}>
                      {cols.map((c) => (
                        // Reference keeps a payment's invoice numbers on ONE line
                        // ("#0089208, #0090530, …") and never wraps money / dates.
                        <TableCell key={c.key} align="left" sx={{ ...cellSx, whiteSpace: c.key === 'reference' ? 'normal' : 'nowrap', ...(isLast ? { borderBottom: '1px solid #000' } : {}) }}>
                          {cellValue(c.key, t, running)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {props.showTotalDue !== false && (
        <Typography sx={{ textAlign: 'right', fontSize: `${font + 7}px`, color: cellColor, pr: '8px', pt: '2px', pb: '2px', lineHeight: 1.2 }}>
          {`${props.totalDueLabel || 'Total Due'} ${summary.total || formatCurrency(0)}`}
        </Typography>
      )}
    </Box>
  );
};

// One leaf block (everything but Columns, whose cells the caller lays out with the
// shared column sx). Returns null for a block that prints nothing (no image, no
// text) — the editor draws its own "component empty" placeholder there.
export const renderStatementBlock = (component, statementData = {}) => {
  const props = component?.properties || {};
  const summary = statementData.summary || {};

  switch (component?.type) {
    case 'overview':
      return renderOverview(props, summary);

    case 'actions':
      return renderActions(props, statementData);

    case 'credit_terms':
      return renderCreditTerms(props, buildCreditTermBuckets(statementData.creditTerms, statementData.activities, statementData.rangeEnd), summary);

    case 'outlet_logo': {
      // A logo picked in the template wins; otherwise the outlet's own logo
      // (Setup > Outlets > Logo) prints. None -> nothing: the "component empty"
      // placeholder is editor chrome and must never print.
      const logoUrl = props.imageUrl || statementData.business?.logo || '';
      if (!logoUrl) return null;
      // Sized as the editor canvas draws it (reference: the editor and the
      // preview show the logo at the same size): Width / Height as set, "auto" =
      // the file's own size, never wider than its column, at most 300px tall.
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: props.horizontalAlignment || 'center',
            ...boxSx(props),
            minHeight: 60,
            alignItems: 'center',
          }}
        >
          <img
            src={logoUrl}
            alt="Outlet Logo"
            style={{
              width: cssSize(props.width),
              height: cssSize(props.height),
              maxWidth: '100%',
              maxHeight: '300px',
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </Box>
      );
    }

    case 'text': {
      // Resolves {customerName}/{businessName} etc. against the customer +
      // outlet so seeded blocks print real details, not literal placeholders.
      const html = applyStatementVariables(
        props.richTextContent || props.content || '',
        statementData.customer,
        statementData.business
      );
      if (!html) return null;
      return (
        <Box
          sx={{
            ...statementBorderCss(props.border, { legacyUsesEnabled: true }),
            backgroundColor: props.backgroundColor || '#ffffff',
            padding: paddingCss(props),
            fontSize: `${props.fontSize || 16}px`,
            fontWeight: props.fontWeight || 'normal',
            color: props.fontColor || '#000000',
            textAlign: props.textAlign || 'left',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{ width: '100%', fontSize: 'inherit', color: 'inherit', textAlign: 'inherit', fontWeight: 'inherit' }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Box>
      );
    }

    case 'image': {
      if (!props.imageUrl) return null;
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: props.horizontalAlignment || 'center',
            ...boxSx(props),
            minHeight: 60,
            alignItems: 'center',
          }}
        >
          <img
            src={props.imageUrl}
            alt="Custom"
            style={{
              width: cssSize(props.width),
              height: cssSize(props.height),
              maxWidth: '100%',
              maxHeight: '100px',
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </Box>
      );
    }

    case 'columns':
      return (
        <Box sx={statementColumnsSx(props)}>
          {(props.columns || []).map((column, colIndex) => (
            <Box key={column.id || colIndex} sx={statementColumnCellSx(props, colIndex)}>
              <Box sx={statementColumnInnerSx}>
                {(column.components || [])
                  .filter((c) => c && c.visible !== false)
                  .map((nested, nestedIndex) => (
                    <Box key={nestedIndex} sx={statementBlockGapSx}>
                      {renderStatementBlock(nested, statementData)}
                    </Box>
                  ))}
              </Box>
            </Box>
          ))}
        </Box>
      );

    case 'spacer':
      return <Box sx={{ height: `${props.height || 30}px` }} />;

    default:
      return null;
  }
};
