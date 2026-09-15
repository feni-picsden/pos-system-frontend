// Family price rules. Run: node src/utils/familyOverride.test.mjs
import assert from 'node:assert/strict';
import {
  defaultTiers,
  deriveFamilyTemplate,
  applyFamilyTemplate,
  tiersKey,
  groupFamilyLines,
  shareByQuantity,
  bestRateTier,
  findHigherRateQuantity,
} from './familyOverride.js';

// A family member as GET /products?family=<id> returns it.
const member = (over = {}) => ({
  id: 1,
  name: 'Member',
  retailTaxRate: 'GST',
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

// --- the family's price -----------------------------------------------------------

{
  // One product in the family: its quantity prices are the family's.
  const t = deriveFamilyTemplate([member({ prices: tiers([1, 3], [6, 16]) })]);
  assert.deepEqual(t.prices, [{ quantity: 1, price: 3 }, { quantity: 6, price: 16 }]);
  assert.equal(t.retailTaxRate, 'GST');
}

{
  // Several products that disagree: the FIRST product in the family wins.
  const family = [
    member({ id: 1, name: 'test1', prices: tiers([1, 5]), retailTaxRate: 'No Tax' }),
    member({ id: 2, name: 'test2', prices: tiers([1, 3]) }),
    member({ id: 3, name: 'test3', prices: tiers([1, 3]) }),
  ];
  const t = deriveFamilyTemplate(family);
  assert.deepEqual(t.prices, [{ quantity: 1, price: 5 }], 'the first product sets the price');
  assert.equal(t.retailTaxRate, 'No Tax', 'and the tax rate');
  assert.equal(t.sourceProduct.name, 'test1');
}

{
  // A first product with no price (request price) is skipped, not copied as "no price".
  const family = [member({ id: 1, prices: [] }), member({ id: 2, prices: tiers([1, 7]) })];
  assert.deepEqual(deriveFamilyTemplate(family).prices, [{ quantity: 1, price: 7 }]);
}

{
  assert.equal(deriveFamilyTemplate([]), null, 'an empty family offers nothing');
  assert.equal(deriveFamilyTemplate(null), null, 'a missing family is safe');
  assert.equal(deriveFamilyTemplate([member({ prices: [] })]), null, 'members with no price offer nothing');
}

// --- applying it to the form ----------------------------------------------------

{
  const formData = {
    name: 'Plastic cups',
    retailTaxRate: 'No Tax',
    prices: [
      { quantity: 1, price: 9.99, cost: 4.5, percentage: 0, priceSetId: null },
      { quantity: 1, price: 8, cost: 4.5, percentage: 0, priceSetId: 3 },
    ],
    caseQuantity: 8,
  };
  const t = deriveFamilyTemplate([member({ prices: tiers([1, 3], [6, 16]), retailTaxRate: 'GST' })]);
  const out = applyFamilyTemplate(formData, t);

  assert.deepEqual(
    out.prices.filter((p) => p.priceSetId == null).map((p) => [p.quantity, p.price]),
    [[1, 3], [6, 16]],
    'the family price quantities replace the product\'s own'
  );
  assert.equal(out.prices.filter((p) => p.priceSetId === 3).length, 1, 'price-set rows are kept');
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
  const out = applyFamilyTemplate(formData, { prices: [{ quantity: 1, price: 3 }], retailTaxRate: null });
  assert.equal(out.retailTaxRate, 'GST', 'a missing family tax rate leaves the product\'s intact');
}

// --- price points: best rate ------------------------------------------------------

{
  const dearPack = [{ quantity: 1, price: 5 }, { quantity: 6, price: 60 }];
  const at = (qty) => {
    const t = bestRateTier(dearPack, qty);
    return t ? (t.price / t.quantity) * qty : null;
  };
  assert.equal(at(6), 30, 'a $60 six-pack dearer than $5 singles: 6 sell for $30 (reference)');
  assert.equal(at(7), 35, '7 also sell at the single rate');
  assert.equal(at(1), 5, 'one sells at the single price');

  const goodPack = [{ quantity: 1, price: 3 }, { quantity: 6, price: 16 }];
  assert.equal(bestRateTier(goodPack, 6).quantity, 6, 'a cheaper six-pack is still used at 6');
  assert.equal(bestRateTier(goodPack, 5).quantity, 1, 'below the pack, the single price applies');
  assert.equal(bestRateTier([{ quantity: 6, price: 16 }], 3), null, 'nothing at or below the quantity');
  assert.equal(
    bestRateTier([{ quantity: 1, price: 5 }, { quantity: 2, price: 10 }], 2).quantity,
    2,
    'an equal rate picks the larger pack'
  );
}

{
  assert.equal(
    findHigherRateQuantity([{ quantity: 1, price: 5 }, { quantity: 6, price: 60 }]),
    6,
    'the six-pack at $10 each is dearer than the $5 single'
  );
  assert.equal(
    findHigherRateQuantity([{ quantity: 1, price: 3 }, { quantity: 6, price: 16 }]),
    null,
    'a cheaper pack is fine'
  );
  assert.equal(
    findHigherRateQuantity([{ quantity: 6, price: 60 }, { quantity: 1, price: 5 }]),
    6,
    'rows are compared by quantity, whatever order they are in'
  );
  assert.equal(
    findHigherRateQuantity([
      { quantity: 1, price: 5, priceSetId: null },
      { quantity: 6, price: 20, priceSetId: 3 },
    ]),
    null,
    'rows in different Price Sets are not compared with each other'
  );
  assert.equal(
    findHigherRateQuantity([{ quantity: 1, price: 0 }, { quantity: 6, price: 16 }]),
    null,
    'a blank $0 row is ignored'
  );
}

// --- sell screen: family quantity pricing ---------------------------------------

{
  assert.equal(
    tiersKey([{ quantity: 6, price: 16 }, { quantity: 1, price: 3 }]),
    tiersKey([{ quantity: 1, price: '3' }, { quantity: '6', price: 16 }]),
    'the same tiers give the same key whatever order or type they arrive in'
  );
  assert.notEqual(
    tiersKey([{ quantity: 1, price: 3 }]),
    tiersKey([{ quantity: 1, price: 4 }]),
    'a different price is a different key'
  );
}

{
  const same = tiersKey([{ quantity: 1, price: 3 }, { quantity: 6, price: 16 }]);
  const lines = [
    { key: 'a', familyId: 9, tiersKey: same, quantity: 3 },
    { key: 'x', familyId: null, tiersKey: same, quantity: 5 }, // not in a family
    { key: 'b', familyId: 9, tiersKey: same, quantity: 3 },
    { key: 'c', familyId: 7, tiersKey: same, quantity: 2 }, // alone in its family
  ];
  const groups = groupFamilyLines(lines);
  assert.equal(groups.length, 1, 'only a family with 2+ lines in the cart groups');
  assert.deepEqual(groups[0].map((l) => l.key), ['a', 'b'], 'cart order is kept');
}

{
  // A family whose members carry different prices does not group.
  const lines = [
    { key: 'a', familyId: 9, tiersKey: tiersKey([{ quantity: 1, price: 3 }]), quantity: 3 },
    { key: 'b', familyId: 9, tiersKey: tiersKey([{ quantity: 1, price: 5 }]), quantity: 3 },
  ];
  assert.equal(groupFamilyLines(lines).length, 0, 'misaligned members price on their own');
}

{
  assert.deepEqual(shareByQuantity(16, [3, 3]), [8, 8], '3 + 3 of $16 is $8 + $8');
  assert.deepEqual(shareByQuantity(16, [4, 2]), [10.67, 5.33], '4 + 2 of $16 splits by quantity');
  const odd = shareByQuantity(10, [1, 1, 1]);
  assert.equal(Math.round(odd.reduce((a, b) => a + b, 0) * 100), 1000, 'the shares always add back to the total');
  assert.deepEqual(odd, [3.34, 3.33, 3.33], 'the leftover cent goes to one line, not lost');
  assert.deepEqual(shareByQuantity(16, [0, 0]), [0, 0], 'no quantity, no share');
}

console.log('familyOverride: all assertions passed');
