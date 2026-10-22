import React from 'react';
import QueryEditorPage, { POPULAR_QUERIES } from '../../components/Reports/QueryEditorPage';
import purchaseReportService from '../../services/purchaseReportService';
import transferReportService from '../../services/transferReportService';
import inventoryReportService from '../../services/inventoryReportService';
import salesReportService from '../../services/salesReportService';

// Reference default query of the Purchase Report editor (Outlet, Consolidate Yes).
const DEFAULT_PURCHASE_QUERY = `SELECT
    BY_NAME AS "Name",
    cost AS "Total Cost",
    fees AS "Fees",
    freight AS "Freight",
    payment_fees AS "Payment Fees",
    tax AS "Tax Amount"
FROM orders
BY outlet
ORDER "Name" asc
CONSOLIDATED`;

// FROM orders runs on the purchase engine; the other sources on their own.
const runPurchaseQuery = (params) => {
  if (/\bFROM\s+orders\b/i.test(params.query)) return purchaseReportService.runQuery(params);
  if (/\bFROM\s+transfers\b/i.test(params.query)) return transferReportService.runQuery(params);
  if (/\bFROM\s+(products|inventory)\b/i.test(params.query)) return inventoryReportService.runQuery(params);
  return salesReportService.runQuery(params);
};

const PurchaseQueryEditor = () => (
  <QueryEditorPage
    runQuery={runPurchaseQuery}
    popularQueries={POPULAR_QUERIES}
    defaultQuery={DEFAULT_PURCHASE_QUERY}
    saveReportType="purchase"
    savePath="/reports/purchases/query"
    title="Purchase Query Report"
    fileStem="purchase-query-report"
  />
);

export default PurchaseQueryEditor;
