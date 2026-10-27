import React from 'react';
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
} from '../../utils/statementDefaults';

/**
 * Statement Renderer
 * Renders a customer statement from template.config.components using live
 * statement data. Mirrors StatementEditor.renderComponentContent so the live
 * statement matches the editor design (preview == live).
 *
 * statementData shape (from Balance.buildStatement -> generatedStatement.data):
 *   summary: { dateRange, overdue, current, total }  // pre-formatted strings
 *   activities: [{ date, activity, number, reference, total, balance, type }]  // flat, raw values
 *   creditTerms: the customer group's [{ label, duration: 'P30D' }], rangeEnd
 */

// Reference prints the Type through the component's renameable labels.
const actionLabels = (props = {}) => ({
  Invoice: props.labelInvoice || 'Invoice',
  Payment: props.labelPayment || 'Payment',
});

const money = (v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;

const boxSx = (props) => ({
  backgroundColor: props.backgroundColor || '#ffffff',
  padding: `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`,
  border: props.border?.width ? `${props.border.width}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : 'none',
});

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
export const renderOverview = (props, summary = {}) => (
  <Box sx={boxSx(props)}>{totalsBlock(props, summary)}</Box>
);

const formatCurrency = (amount) => {
  if (typeof amount === 'string') return amount; // already formatted
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount || 0);
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value); // already a display string
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

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

const renderComponentContent = (component, statementData) => {
  const props = component.properties || {};
  const summary = statementData.summary || {};

  switch (component.type) {
    case 'overview':
      return renderOverview(props, summary);

    case 'actions': {
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
          // What was typed with the payment, or "in-store" for a till payment.
          case 'reference': return t.reference || '';
          case 'total': return formatCurrency(t.total);
          // What is still owed on that invoice; a payment's unused part as a minus.
          case 'balance': return formatCurrency(t.balance);
          case 'runningTotal': return formatCurrency(running);
          default: return '';
        }
      };
      const cellSx = { border: 0, py: 0, px: '4px', fontSize: `${font}px`, color: cellColor, lineHeight: 1.25 };
      return (
        <Box
          sx={{
            backgroundColor: props.backgroundColor || '#ffffff',
            padding: `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`,
            border: props.border?.width ? `${props.border.width}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : 'none',
          }}
        >
          <TableContainer>
            <Table size="small" sx={{ borderCollapse: 'collapse' }}>
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
                          <TableCell colSpan={cols.length} sx={{ ...cellSx, fontWeight: 700 }}>{group.category}</TableCell>
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
                              <TableCell key={c.key} align="left" sx={{ ...cellSx, ...(isLast ? { borderBottom: '1px solid #000' } : {}) }}>
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
            <Typography sx={{ textAlign: 'right', fontSize: `${font + 7}px`, color: cellColor, pr: '4px', py: '1px', lineHeight: 1.2 }}>
              {`${props.totalDueLabel || 'Total Due'} ${summary.total || formatCurrency(0)}`}
            </Typography>
          )}
        </Box>
      );
    }

    case 'credit_terms':
      return renderCreditTerms(props, buildCreditTermBuckets(statementData.creditTerms, statementData.activities, statementData.rangeEnd), summary);

    case 'outlet_logo': {
      // No logo picked -> render nothing. The "component empty" placeholder is
      // editor chrome and must never print on a real customer statement.
      // A logo picked in the template wins; otherwise the outlet's own logo
      // (Setup > Outlets > Logo) prints.
      const logoUrl = props.imageUrl || statementData.business?.logo || '';
      if (!logoUrl) return null;
      return (
        <Box
          sx={{
            display: 'flex',
            // Reference: the logo sits top-LEFT of the statement, about 140px
            // wide — never the full column width.
            justifyContent: props.horizontalAlignment || 'flex-start',
            backgroundColor: props.backgroundColor || '#ffffff',
            padding: `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`,
            border: `${props.border?.width || 0}px ${props.border?.style || 'solid'} ${props.border?.color || '#000000'}`,
            minHeight: 60,
            alignItems: 'flex-start',
          }}
        >
          <img
            src={logoUrl}
            alt="Outlet Logo"
            style={{
              width: props.width === 'auto' || !props.width ? 'auto' : `${props.width}px`,
              height: props.height === 'auto' || !props.height ? 'auto' : `${props.height}px`,
              maxWidth: props.width && props.width !== 'auto' ? '100%' : '140px',
              maxHeight: props.height && props.height !== 'auto' ? '300px' : '110px',
              objectFit: 'contain',
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </Box>
      );
    }

    case 'text': {
      // Resolves {customerName}/{businessName} etc. against the live customer +
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
            backgroundColor: props.backgroundColor || '#ffffff',
            padding: `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`,
            border: props.border?.enabled ? `${props.border?.width || 1}px ${props.border?.style || 'solid'} ${props.border?.color || '#000000'}` : 'none',
            fontSize: `${props.fontSize || 16}px`,
            fontWeight: props.fontWeight || 'normal',
            color: props.fontColor || '#000000',
            textAlign: props.textAlign || 'left',
          }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }

    case 'image': {
      if (!props.imageUrl) return null;
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: props.horizontalAlignment || 'center',
            backgroundColor: props.backgroundColor || '#ffffff',
            padding: `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`,
            border: `${props.border?.width || 0}px ${props.border?.style || 'solid'} ${props.border?.color || '#000000'}`,
            minHeight: 60,
            alignItems: 'center',
          }}
        >
          <img
            src={props.imageUrl}
            alt="Custom"
            style={{
              width: props.width === 'auto' || !props.width ? 'auto' : `${props.width}px`,
              height: props.height === 'auto' || !props.height ? 'auto' : `${props.height}px`,
              maxWidth: '100%',
              maxHeight: '300px',
            }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        </Box>
      );
    }

    case 'columns':
      return (
        <Box
          sx={{
            display: 'flex',
            backgroundColor: props.backgroundColor || '#ffffff',
            padding: `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`,
            border: `${props.border?.width || 0}px ${props.border?.style || 'solid'} ${props.border?.color || '#000000'}`,
          }}
        >
          {(props.columns || []).map((column, colIndex) => (
            <Box
              key={column.id || colIndex}
              sx={{
                width: `${props.columnWidths?.[colIndex] || 50}%`,
                mr: colIndex < (props.columns?.length || 0) - 1 ? 1 : 0,
              }}
            >
              {(column.components || [])
                .filter((c) => c && c.visible !== false)
                .map((nested, nestedIndex) => (
                  <Box key={nestedIndex} sx={{ mb: 1 }}>
                    {renderComponentContent(nested, statementData)}
                  </Box>
                ))}
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

const StatementRenderer = ({ statementData, template }) => {
  const components = template?.config?.components || [];
  if (!statementData || components.length === 0) return null;

  return (
    <Box>
      {components
        .filter((c) => c && c.visible !== false)
        .map((component, index) => (
          <Box key={component.id || index} sx={{ mb: 1 }}>
            {renderComponentContent(component, statementData)}
          </Box>
        ))}
    </Box>
  );
};

export default StatementRenderer;
