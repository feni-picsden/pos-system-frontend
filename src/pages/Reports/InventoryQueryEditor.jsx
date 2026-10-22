import React from 'react';
import QueryEditorPage, { POPULAR_QUERIES } from '../../components/Reports/QueryEditorPage';
import inventoryReportService from '../../services/inventoryReportService';
import salesReportService from '../../services/salesReportService';

// Reference default query of the Inventory Report editor (Inventory On Hand,
// Consolidate No).
const DEFAULT_INVENTORY_QUERY = `SELECT
    BY_NAME AS "Name",
    case_quantity AS "Case Quantity",
    inventory.outlet AS "Outlet",
    inventory.case_level AS "Case Level",
    inventory.single_level AS "Item Level",
    costs.last_cost AS "Last Case Cost (Inc)" TOTAL(NONE),
    costs.average_cost AS "Average Case Cost (Inc)" TOTAL(NONE),
    FORMAT(costs.average_cost * (inventory.case_level + (inventory.single_level / case_quantity)), '$', '', 2) AS "Value (Inc) (Average)" TOTAL(SUM)
FROM products
BY product
WHERE
    inventory.single_level + (inventory.case_level * case_quantity) > 0
ORDER "Name" asc
UNCONSOLIDATED`;

// FROM products runs on the inventory engine; the reference Popular list (sales,
// orders, revisions queries — same nine as the Sales editor) runs on the sales one.
const runInventoryQuery = (params) =>
  (/\bFROM\s+(products|inventory)\b/i.test(params.query) ? inventoryReportService.runQuery(params) : salesReportService.runQuery(params));

const InventoryQueryEditor = () => (
  <QueryEditorPage
    runQuery={runInventoryQuery}
    popularQueries={POPULAR_QUERIES}
    defaultQuery={DEFAULT_INVENTORY_QUERY}
    saveReportType="inventory"
    savePath="/reports/inventory/query"
    title="Inventory Query Report"
    fileStem="inventory-query-report"
  />
);

export default InventoryQueryEditor;
