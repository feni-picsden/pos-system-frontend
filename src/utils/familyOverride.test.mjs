// Family price override rules. Run: node src/utils/familyOverride.test.mjs
import assert from 'node:assert/strict';
import {
  defaultTiers,
  deriveFamilyTemplate,
  applyFamilyTemplate,
  describeFamilyTemplate,
  describeFamilyPrice,
  describeFamilyAlignment,
} from './familyOverride.js';

// A family member as GET /products?family=<id> returns it.
const member = (over = {}) => ({
  id: 1,
  name: 'Member',
  retailTaxRate: 'GST',
  updatedAt: '2026-01-01T00:00:00.000Z',
  prices: [{ quantity: 1, price: 4, cost: 2, percentage: 0, priceSetId: null }],
  ...over,
});

const tiers = (...pairs) =>
  pairs.map(([quantity, price]) => ({ quantity, price, cost: 0, percentage: 0, priceSetId: null }));

// --- reading a product's default tiers -----------------------------------------

{
  const p = member({ prices: tiers([6, 16], [1, 3]) });
  assert.deepEqual(
    defaultTiers(p),
    [{ quantity: 1, price: 3 }, { quantity: 6, price: 16 }],
    'tiers come back ordered by quantity, whatever order the rows arrive in'
  );
}

{
  // Price Set rows are an alternative price point layered over the default group,
  // so they are not what a family aligns on.
  const p = member({
    prices: [
      { quantity: 1, price: 3, priceSetId: null },
      { quantity: 1, price: 99, priceSetId: 7 },
    ],
  });
  assert.deepEqual(defaultTiers(p), [{ quantity: 1, price: 3 }], 'price-set rows are excluded');
}

// --- deriving the family's price ------------------------------------------------

{
  const family = [
    member({ id: 1, prices: tiers([1, 3], [6, 16]) }),
    member({ id: 2, prices: tiers([1, 3], [6, 16]) }),
    member({ id: 3, prices: tiers([1, 3], [6, 16]) }),
  ];
  const t = deriveFamilyTemplate(family);
  assert.deepEqual(t.prices, [{ quantity: 1, price: 3 }, { quantity: 6, price: 16 }], 'the agreed price');
  assert.equal(t.aligned, true, 'a price-aligned family reports as aligned');
  assert.equal(t.memberCount, 3);
  assert.equal(t.agreeingCount, 3);
  assert.equal(t.retailTaxRate, 'GST');
}

{
  // Members disagree: the majority price is the family's, but the caller is told.
  const family = [
    member({ id: 1, prices: tiers([1, 3]) }),
    member({ id: 2, prices: tiers([1, 3]) }),
    member({ id: 3, prices: tiers([1, 5]) }),
  ];
  const t = deriveFamilyTemplate(family);
  assert.deepEqual(t.prices, [{ quantity: 1, price: 3 }], 'the most common price wins');
  assert.equal(t.aligned, false, 'a disagreeing family is flagged, not silently averaged');
  assert.equal(t.agreeingCount, 2);
  assert.match(
    describeFamilyTemplate(t, '10pk beer'),
    /only 2 of 3 products/,
    'the disagreement is spelled out for the user'
  );
}

{
  // A straight tie is broken by the most recently updated member: a deliberate
  // recent edit is the better guess at the family's current intent.
  const family = [
    member({ id: 1, prices: tiers([1, 3]), updatedAt: '2026-01-01T00:00:00.000Z' }),
    member({ id: 2, prices: tiers([1, 5]), updatedAt: '2026-06-01T00:00:00.000Z' }),
  ];
  const t = deriveFamilyTemplate(family);
  assert.deepEqual(t.prices, [{ quantity: 1, price: 5 }], 'the newer edit breaks the tie');
}

{
  const family = [
    member({ id: 1, retailTaxRate: 'GST', prices: tiers([1, 3]) }),
    member({ id: 2, retailTaxRate: 'GST', prices: tiers([1, 3]) }),
    member({ id: 3, retailTaxRate: 'No Tax', prices: tiers([1, 3]) }),
  ];
  assert.equal(deriveFamilyTemplate(family).retailTaxRate, 'GST', 'tax rate is voted on separately');
}

{
  assert.equal(deriveFamilyTemplate([]), null, 'an empty family offers nothing');
  assert.equal(deriveFamilyTemplate(null), null, 'a missing family is safe');
  assert.equal(
    deriveFamilyTemplate([member({ prices: [] })]),
    null,
    'members with no price offer nothing to align to'
  );
}

// --- applying it to the form ----------------------------------------------------

{
  const formData = {
    name: 'Plastic cups',
    retailTaxRate: 'No Tax',
    prices: [{ quantity: 1, price: 9.99, cost: 4.5, percentage: 0 }],
    caseQuantity: 8,
  };
  const t = deriveFamilyTemplate([member({ prices: tiers([1, 3], [6, 16]), retailTaxRate: 'GST' })]);
  const out = applyFamilyTemplate(formData, t);

  assert.deepEqual(
    out.prices.map((p) => [p.quantity, p.price]),
    [[1, 3], [6, 16]],
    'the family price quantities replace the product\'s own'
  );
  assert.equal(out.retailTaxRate, 'GST', 'the tax rate is overridden too');
  assert.equal(out.prices[0].cost, 4.5, 'the product KEEPS its own cost at qty 1');
  assert.equal(out.prices[1].cost, 4.5, 'a new tier inherits the qty-1 cost, never a sibling\'s');
  assert.equal(out.name, 'Plastic cups', 'nothing else on the form is touched');
  assert.equal(out.caseQuantity, 8, 'case quantity is left alone');
  assert.notEqual(out, formData, 'the form is not mutated in place');
}

{
  const formData = { prices: [{ quantity: 1, price: 1, cost: 2 }], retailTaxRate: 'GST' };
  assert.equal(applyFamilyTemplate(formData, null), formData, 'no template is a no-op');
}

{
  // A template with no tax rate must not blank the product's existing one.
  const formData = { prices: [{ quantity: 1, price: 1, cost: 2 }], retailTaxRate: 'GST' };
  const out = applyFamilyTemplate(formData, {
    prices: [{ quantity: 1, price: 3 }],
    retailTaxRate: null,
  });
  assert.equal(out.retailTaxRate, 'GST', 'a missing family tax rate leaves the product\'s intact');
}

// --- the sentence shown to the user ---------------------------------------------

{
  const t = deriveFamilyTemplate([member({ prices: tiers([1, 3], [6, 16]), retailTaxRate: 'GST' })]);
  assert.equal(
    describeFamilyTemplate(t, '10pk beer'),
    '"10pk beer" is priced at $3.00 each, 6 for $16.00 and GST.',
    'the summary reads as a sentence, not a diff'
  );
  assert.equal(describeFamilyAlignment(t, '10pk beer'), '', 'an aligned family adds no warning line');
  assert.ok(!describeFamilyTemplate(t, '10pk beer').includes('\n'), 'and stays on one line');
}

{
  // A disagreeing family: the warning is its OWN line, not tacked onto the price.
  const t = deriveFamilyTemplate([
    member({ id: 1, prices: tiers([1, 3]) }),
    member({ id: 2, prices: tiers([1, 5]), updatedAt: '2026-06-01T00:00:00.000Z' }),
  ]);
  assert.equal(
    describeFamilyPrice(t, 'Test Beer 6pack'),
    '"Test Beer 6pack" is priced at $5.00 each and GST.',
    'the price line carries no warning text'
  );
  assert.equal(
    describeFamilyAlignment(t, 'Test Beer 6pack'),
    'Note: only 1 of 2 products in "Test Beer 6pack" use this price.',
    'the warning stands alone'
  );
  const combined = describeFamilyTemplate(t, 'Test Beer 6pack');
  assert.equal(
    combined.split('\n').length,
    2,
    'the save prompt gets exactly two lines, not one wrapped sentence'
  );
  assert.equal(
    combined,
    `${describeFamilyPrice(t, 'Test Beer 6pack')}\n${describeFamilyAlignment(t, 'Test Beer 6pack')}`,
    'and the two halves are the same text the banner renders separately'
  );
}

console.log('familyOverride: all assertions passed');
