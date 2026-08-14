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
  getActionColumns,
  ACTION_COLUMN_WIDTHS,
} from '../../utils/statementDefaults';

/**
 * Statement Renderer
 * Renders a customer statement from template.config.components using live
 * statement data. Mirrors StatementEditor.renderComponentContent so the live
 * statement matches the editor design (preview == live).
 *
 * statementData shape (from Balance.buildStatement -> generatedStatement.data):
 *   summary: { days0:{days,amount}, days30:{days,amount}, dateRange, overdue, current, total }  // pre-formatted strings
 *   activities: [{ date, activity, reference, total, balance, type, detail? }]  // flat, raw values
 * or grouped: [{ category, transactions:[{date,activity,reference,total,balance,detail?}] }]
 */

// Reference prints activity/detail through the component's renameable labels
// (same map StatementEditor uses so preview == live).
const actionLabels = (props = {}) => ({
  Invoice: props.labelInvoice || 'Invoice',
  Payment: props.labelPayment || 'Payment',
  'Paid in Store': props.labelPaidInStore || 'Paid in Store',
});

const money = (v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;

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

const renderComponentContent = (component, statementData) => {
  const props = component.properties || {};
  const summary = statementData.summary || {};

  switch (component.type) {
    case 'overview': {
      // Two stacked bordered boxes of equal, centered cells (reference parity
      // with StatementEditor's canvas render).
      const font = props.fontSize || 16;
      const color = props.fontColor || '#000000';
      const cell = (label, value) => (
        <Box key={label} sx={{ flex: 1, textAlign: 'center', px: 0.5, py: 0.5 }}>
          <Typography sx={{ fontSize: `${font}px`, fontWeight: 700, color, lineHeight: 1.4 }}>{label}</Typography>
          <Typography sx={{ fontSize: `${font}px`, color, lineHeight: 1.4 }}>{value}</Typography>
        </Box>
      );
      // Outer border only — no internal vertical dividers, no rule under the
      // date range (matches the editor canvas exactly).
      const row = { display: 'flex' };
      return (
        <Box
          sx={{
            backgroundColor: props.backgroundColor || '#ffffff',
            padding: `${props.padding?.top || 0}px ${props.padding?.right || 0}px ${props.padding?.bottom || 0}px ${props.padding?.left || 0}px`,
            border: props.border?.width ? `${props.border.width}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : 'none',
          }}
        >
          <Box sx={{ border: '1px solid #000', mb: '4px', ...row }}>
            {cell(summary.days0?.days || '0 days', summary.days0?.amount || formatCurrency(0))}
            {cell(summary.days30?.days || '30 days', summary.days30?.amount || formatCurrency(0))}
          </Box>
          <Box sx={{ border: '1px solid #000' }}>
            <Typography sx={{ fontSize: `${font}px`, color, textAlign: 'center', py: '3px' }}>
              {summary.dateRange || ''}
            </Typography>
            <Box sx={row}>
              {cell('Overdue', summary.overdue || formatCurrency(0))}
              {cell('Current', summary.current || formatCurrency(0))}
              {cell('Total', summary.total || formatCurrency(0))}
            </Box>
          </Box>
        </Box>
      );
    }

    case 'actions': {
      const groups = toActivityGroups(statementData.activities);
      const font = props.fontSize || 14;
      const cellColor = props.fontColor || '#000000';
      // Columns/labels/order come from the template's Actions config, so
      // renaming or disabling a column in the editor shows on the live
      // statement. Plain table: header rule only, no gridlines, all left.
      const cols = getActionColumns(props).filter((c) => c.enabled !== false);
      const labels = actionLabels(props);
      const cellValue = (key, t, running) => {
        switch (key) {
          case 'date': return formatDate(t.date);
          case 'activity': return labels[t.activity] || t.activity;
          case 'reference': return `${t.reference || '-'}${t.detail ? ` ${labels[t.detail] || t.detail}` : ''}`;
          case 'total': return formatCurrency(t.total);
          // Running account balance the endpoint already computes — payments
          // included, so the column reconciles with Total Due.
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
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={cols.length} align="center" sx={cellSx}>
                      No transactions found for the selected date range
                    </TableCell>
                  </TableRow>
                ) : (
                  groups.map((group, catIndex) => (
                    <React.Fragment key={catIndex}>
                      {group.category && (
                        <TableRow>
                          <TableCell colSpan={cols.length} sx={{ ...cellSx, fontWeight: 700 }}>{group.category}</TableCell>
                        </TableRow>
                      )}
                      {(group.transactions || []).map((t, tIndex) => {
                        const running = (group.transactions || [])
                          .slice(0, tIndex + 1)
                          .reduce((sum, x) => sum + money(x.total), 0);
                        return (
                          <TableRow key={tIndex}>
                            {cols.map((c) => (
                              <TableCell key={c.key} align="left" sx={cellSx}>
                                {cellValue(c.key, t, running)}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
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
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Credit Terms</Typography>
          <Typography variant="body2">{props.terms || 'Net 30'}</Typography>
        </Box>
      );

    case 'outlet_logo': {
      // No logo picked -> render nothing. The "component empty" placeholder is
      // editor chrome and must never print on a real customer statement.
      const logoUrl = props.imageUrl || '';
      if (!logoUrl) return null;
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
            src={logoUrl}
            alt="Outlet Logo"
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
