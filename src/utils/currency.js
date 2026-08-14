import settingsService from '../services/settingsService';

/**
 * One money format for the whole app: Setup > General decides the currency code
 * and the number locale (blank locale = en-AU), so every importer follows the
 * setting without touching its own code.
 */
export const formatCurrency = (amount) => {
  const { currencyCode, numberLocale } = settingsService.getCachedGeneralSettings();
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(numberLocale || 'en-AU', {
      style: 'currency',
      currency: currencyCode || 'AUD',
    }).format(value);
  } catch {
    // A typo'd locale / currency code must not blank out every price on screen.
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
  }
};

export default formatCurrency;
