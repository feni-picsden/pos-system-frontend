import settingsService from '../services/settingsService';
import { getPaymentMethodSettings } from '../services/paymentMethodService';

// "Use Rounding" (Setup > Payment Methods): round to the nearest currency amount.
// The step is Setup > General > Currency > "Round To" (0.05 in Australia).
// Applies to what this method tenders; other methods are exact.
// Shared by FinalizeSaleDialog and the sell screen's payment sale keys.
export const roundingStep = () => Number(settingsService.getCachedGeneralSettings().roundTo) || 0.05;

export const roundTender = (amount, method, step = roundingStep()) => {
  if (getPaymentMethodSettings(method).useRounding !== true) return amount;
  const sign = amount < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(amount) / step) * step;
};

// What a rounded tender that settles `balance` books as Rounding: the balance less
// the balance rounded (+ when rounded down, - when rounded up), 0 when exact.
export const roundingAdjustment = (balance, method, step = roundingStep()) => {
  const diff = Math.round((balance - roundTender(balance, method, step)) * 100) / 100;
  return Math.abs(diff) < step ? diff : 0;
};
