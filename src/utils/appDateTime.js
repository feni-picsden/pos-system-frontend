import settingsService from '../services/settingsService';
import {
  formatDateInZone,
  formatDateTimeInZone,
  formatDateValueInZone,
  toZonedDate,
} from './dateFormat';

/**
 * One clock for the whole app: Setup > General > Timezone decides which zone a
 * stored (UTC) timestamp is displayed in, so a sale, an order and a shelf
 * ticket created at the same moment show the same time on every machine.
 *
 * Mirrors utils/currency.js: a sync read of the cached company blob, defaults
 * (Australia/Sydney) until the real settings arrive.
 */
export const appTimeZone = () =>
  settingsService.getCachedGeneralSettings().timezone || 'Australia/Sydney';

// "dd/mm/yyyy"
export const formatDate = (value) => formatDateInZone(value, appTimeZone());

// "dd/mm/yyyy HH:mm:ss"
export const formatDateTime = (value) => formatDateTimeInZone(value, appTimeZone());

// Setup > General > Date Format / Time Format tokens, in the configured zone.
export const formatSettingsDate = (value) =>
  formatDateValueInZone(
    value,
    settingsService.getCachedGeneralSettings().dateFormat || 'DD/MM/YYYY',
    appTimeZone(),
  );

export const formatSettingsTime = (value) =>
  formatDateValueInZone(
    value,
    settingsService.getCachedGeneralSettings().timeFormat || 'HH:mm:ss',
    appTimeZone(),
  );

// Display-only Date carrying the configured zone's wall clock (for token
// formatters such as receipt {format(...)} expressions).
export const toAppZonedDate = (value) => toZonedDate(value, appTimeZone());

export default formatDateTime;
