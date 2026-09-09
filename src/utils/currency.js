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

/**
 * Plain money for the sell screen: always a dot and always two decimals — $40.00,
 * never $40 or $40.5. Negatives lead with the sign ( -$4.50 ), and anything
 * unparseable reads $0.00 rather than $NaN.
 *
 * The sell screen wrote money three different ways: a `Money` component that
 * shrank the cents and nudged them off the baseline (up in one dialog, down in
 * another, and with the decimal point dropped entirely on the grand total), and
 * raw `${amount}` on the sale-key tiles which showed no cents at all. One
 * function now, so a price reads the same everywhere it appears.
 *
 * Uses a literal `$` to match the rest of the sell screen. Where the shop's
 * configured currency and locale matter, use formatCurrency above instead.
 */
export const formatMoney = (value) => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  // Round FIRST, then decide the sign: a tiny negative (a rounding crumb off a
  // split payment, say) would otherwise print "-$0.00".
  const text = Math.abs(safe).toFixed(2);
  return `${parseFloat(text) > 0 && safe < 0 ? '-' : ''}$${text}`;
};

export default formatCurrency;
