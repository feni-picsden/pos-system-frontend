import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
async function loadComponent(file, exportName = 'default') {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(file, import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { require, module, exports: module.exports });
  return module.exports[exportName];
}
const FamilyPriceTiers = await loadComponent('./FamilyPriceTiers.jsx');
const FamilyOverrideToast = await loadComponent('./FamilyOverrideToast.jsx');
const FamilyMemberPriceRows = await loadComponent('./FamilyPriceTiers.jsx', 'FamilyMemberPriceRows');
const priceMarkup = (product) => renderToStaticMarkup(React.createElement(FamilyPriceTiers, { product }));
const rows = (markup) => [...markup.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '').matchAll(/<tr\b[^>]*>(.*?)<\/tr>/g)]
  .filter((m) => m[1].includes('<td')).map((m) => m[1].replace(/<[^>]*>/g, ''));

test('requested quantity/price pairs have separate columns with headings', () => {
  const markup = priceMarkup({ prices: [
    { quantity: 1, price: 10 }, { quantity: 4, price: 35 }, { quantity: 24, price: 210 },
  ] });
  assert.deepEqual(rows(markup), ['1$10.00', '4$35.00', '24$210.00']);
  assert.match(markup, /aria-label="Quantity and price"/);
  assert.match(markup, /<th\b[^>]*>Quantity<\/th>/);
  assert.match(markup, /<th\b[^>]*>Price<\/th>/);
});

test('family members have one tier per row and product/category span their tiers', () => {
  const markup = renderToStaticMarkup(React.createElement('table', null,
    React.createElement('tbody', null, React.createElement(FamilyMemberPriceRows, {
      member: { id: 1, name: 'Beer', category: 'Drinks', prices: [{ quantity: 1, price: 5 }, { quantity: 6, price: 24 }] },
    }))));
  assert.deepEqual(rows(markup), ['BeerDrinks1$5.00', '6$24.00']);
  assert.equal((markup.match(/rowspan="2"/g) || []).length, 2);
});

test('default tiers sort by quantity and exclude other price sets', () => {
  assert.deepEqual(rows(priceMarkup({ prices: [
    { quantity: 24, price: 210 }, { quantity: 2, price: 999, priceSetId: 7 },
    { quantity: 1, price: 10 }, { quantity: 4, price: 35 },
  ] })), ['1$10.00', '4$35.00', '24$210.00']);
});

test('empty prices and a zero-dollar tier render correctly', () => {
  assert.match(priceMarkup({ prices: [] }), /<span>—<\/span>/);
  assert.deepEqual(rows(priceMarkup({ prices: [{ quantity: 1, price: 0 }] })), ['1$0.00']);
});

test('override offer is a persistent bottom toast with explicit apply and dismiss actions', () => {
  let applied = 0;
  let dismissed = 0;
  const toast = FamilyOverrideToast({ open: true, onOverride: () => applied++, onClose: () => dismissed++ });
  assert.equal(toast.props.open, true);
  assert.equal(toast.props.anchorOrigin.vertical, 'bottom');
  assert.equal(toast.props.autoHideDuration, undefined);
  assert.equal(applied, 0);
  const alert = toast.props.children;
  assert.equal(alert.props.severity, 'warning');
  const button = React.Children.toArray(alert.props.children).find((child) => child?.props?.component === 'button');
  button.props.onClick();
  alert.props.onClose();
  assert.equal(applied, 1);
  assert.equal(dismissed, 1);
  assert.equal(FamilyOverrideToast({ open: false }).props.open, false);
});

test('replacement toast identifies the newly selected family', () => {
  const text = (name) => {
    const toast = FamilyOverrideToast({ open: true, familyName: name });
    return renderToStaticMarkup(toast.props.children);
  };
  assert.match(text('ZZTEST Fam'), /ZZTEST Fam/);
  const replacement = text('ZZTEST Fam Coke (TEST)');
  assert.match(replacement, /ZZTEST Fam Coke \(TEST\)/);
  assert.doesNotMatch(replacement, /&quot;ZZTEST Fam&quot;/);
});
