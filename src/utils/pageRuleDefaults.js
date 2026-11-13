// Setup > Page Rules (reference art. 360021629152): the three creation wizards
// and the DEFAULT Page Rule script each one runs when no custom rule is saved.
// The editor opens on the default script (as the reference does), "Reset Wizard"
// puts it back, and a saved script identical to the default counts as default.
import customerWizard from '../pageRules/customerWizard.default.txt?raw';
import productWizard from '../pageRules/productWizard.default.txt?raw';
import promotionWizard from '../pageRules/promotionWizard.default.txt?raw';

export const PAGE_RULES = [
  { key: 'page_rule_customers', label: 'Customers', title: 'Customer Wizard', defaultCode: customerWizard },
  { key: 'page_rule_products', label: 'Products', title: 'Product Wizard', defaultCode: productWizard },
  { key: 'page_rule_promotions', label: 'Promotions', title: 'Promotion Wizard', defaultCode: promotionWizard },
];

export const pageRuleByKey = (key) => PAGE_RULES.find((r) => r.key === key) || null;

const normalise = (code) => String(code || '').replace(/\r\n/g, '\n').trim();

export const isDefaultCode = (key, code) => {
  const rule = pageRuleByKey(key);
  return !rule || normalise(code) === normalise(rule.defaultCode);
};

// The CUSTOM script a creation wizard should run, or null when the built-in
// wizard applies: no saved code, code that failed validation (reference: the
// wizard is skipped and the full form shown), or code identical to the default.
export const resolveCustomPageRuleCode = (key, settingValue) => {
  const code = settingValue?.code;
  if (code && settingValue?.valid !== false && !isDefaultCode(key, code)) return code;
  return null;
};
