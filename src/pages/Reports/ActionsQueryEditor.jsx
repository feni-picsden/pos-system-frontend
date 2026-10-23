import React from 'react';
import QueryEditorPage, { POPULAR_QUERIES } from '../../components/Reports/QueryEditorPage';
import actionsReportService from '../../services/actionsReportService';
import transferReportService from '../../services/transferReportService';
import purchaseReportService from '../../services/purchaseReportService';
import inventoryReportService from '../../services/inventoryReportService';
import salesReportService from '../../services/salesReportService';

// Reference default query of the Actions (Misc) Report editor (Report Type Actions).
const DEFAULT_ACTIONS_QUERY = `SELECT
    BY_NAME AS "Name",
    user AS "User",
    affecting_type AS "Affecting Type",
    action AS "Action",
    additional AS "Additional",
    timestamp AS "Timestamp"
FROM actions
BY actions
ORDER "Timestamp" desc, "Time Cancelled" desc
UNCONSOLIDATED`;

// FROM actions | revisions | cash_movements | inventory_log | actions, sales run
// on the actions engine (FROM sales too — the Discounted Sales rows); the other
// sources on their own editors.
const runActionsQuery = (params) => {
  const q = params.query || '';
  if (/\bFROM\s+(actions|revisions|cash_movements|inventory_log)\b/i.test(q)) return actionsReportService.runQuery(params);
  if (/\bFROM\s+sales\b[^\n]*\bWHERE\b/i.test(q) && /product_discount_reason|discount\s*<>\s*0/i.test(q)) return actionsReportService.runQuery(params);
  if (/\bFROM\s+transfers\b/i.test(q)) return transferReportService.runQuery(params);
  if (/\bFROM\s+orders\b/i.test(q)) return purchaseReportService.runQuery(params);
  if (/\bFROM\s+(products|inventory)\b/i.test(q)) return inventoryReportService.runQuery(params);
  return salesReportService.runQuery(params);
};

const ActionsQueryEditor = () => (
  <QueryEditorPage
    runQuery={runActionsQuery}
    popularQueries={POPULAR_QUERIES}
    defaultQuery={DEFAULT_ACTIONS_QUERY}
    saveReportType="actions"
    savePath="/reports/actions/query"
    title="Actions Query Report"
    fileStem="actions-query-report"
  />
);

export default ActionsQueryEditor;
