import React from 'react';
import QueryEditorPage, { POPULAR_QUERIES } from '../../components/Reports/QueryEditorPage';
import transferReportService from '../../services/transferReportService';
import inventoryReportService from '../../services/inventoryReportService';
import salesReportService from '../../services/salesReportService';

// Reference default query of the Transfers Report editor (Outlet, Consolidate Yes).
const DEFAULT_TRANSFER_QUERY = `SELECT
    BY_NAME AS "Name",
    cost AS "Cost",
    tax AS "Tax Amount"
FROM transfers
BY outlet
ORDER "Name" asc
CONSOLIDATED`;

// FROM transfers runs on the transfers engine; FROM products on the inventory
// one; the shared Popular list (sales / orders / revisions) on the sales engine.
const runTransferQuery = (params) => {
  if (/\bFROM\s+transfers\b/i.test(params.query)) return transferReportService.runQuery(params);
  if (/\bFROM\s+(products|inventory)\b/i.test(params.query)) return inventoryReportService.runQuery(params);
  return salesReportService.runQuery(params);
};

const TransferQueryEditor = () => (
  <QueryEditorPage
    runQuery={runTransferQuery}
    popularQueries={POPULAR_QUERIES}
    defaultQuery={DEFAULT_TRANSFER_QUERY}
    saveReportType="transfer"
    savePath="/reports/transfer-reports/query"
    title="Transfers Query Report"
    fileStem="transfers-query-report"
  />
);

export default TransferQueryEditor;
