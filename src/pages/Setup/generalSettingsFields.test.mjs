import assert from 'node:assert/strict';
import { normalizeCompanySettings, COMPANY_CONSTRAINTS } from './generalSettingsFields.js';

// The legacy blob values that used to survive a save untouched (G07).
const out = normalizeCompanySettings({
  currencyCode: 'Australian Dollars (AUD)',
  startOfWeek: 'Monday',
  customerSearchLevel: '',
  productSearchLevel: '',
  searchCacheSaveLocation: '',
  debugLoggingLevel: '',
  costCalculationMethod: 'Average',
  setPricesBasedOn: 'Average',
  familyPriceDistributionMethod: 'Proportional'
});
assert.equal(out.currencyCode, 'AUD');
assert.equal(out.startOfWeek, 'monday');
assert.equal(out.customerSearchLevel, 'full');
assert.equal(out.productSearchLevel, 'full');
assert.equal(out.searchCacheSaveLocation, 'indexeddb');
assert.equal(out.debugLoggingLevel, 'normal');
assert.equal(out.costCalculationMethod, 'Average Cost');
assert.equal(out.setPricesBasedOn, 'Cost Calculation Method');
assert.equal(out.familyPriceDistributionMethod, 'Evenly');

// Keys the blob never carried must NOT be invented.
assert.equal('currencyCode' in normalizeCompanySettings({}), false);

// Clamp source for out-of-range typing (G21).
assert.deepEqual(
  { ...COMPANY_CONSTRAINTS.invoiceNumberLength },
  { min: 0, max: 20, step: 1, required: true, type: 'number', fallback: 8 }
);
assert.equal(COMPANY_CONSTRAINTS.generalAutoLogoutTime.min, 60);
assert.equal(COMPANY_CONSTRAINTS.generalAutoLogoutTime.max, 7200);

console.log('generalSettingsFields: ok');
