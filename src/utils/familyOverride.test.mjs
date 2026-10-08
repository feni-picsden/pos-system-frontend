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
  highMixPrice,
  matchPricePoints,
  findHigherRateQuantity,
} from './familyOverride.js';

// --- Family Price Distribution Method = Match Price Points -----------------------
{
  // Support article examples: family price points 1 @ 5, 4 @ 15.99, 24 @ 70
  const art = [{ quantity: 1, price: 5 }, { quantity: 4, price: 15.99 }, { quantity: 24, price: 70 }];
  const own = (q) => highMixPrice(art, q);
  assert.deepEqual(matchPricePoints(own(5), [4, 1], art, own), [15.99, 5], 'article 1: A x4, B x1');
  assert.deepEqual(matchPricePoints(own(5), [1, 1, 1, 1, 1], art, own), [5, 5, 5, 5, 0.99], 'article 2: five singles, last absorbs');
  assert.deepEqual(matchPricePoints(own(25), [12, 8, 5], art, own), [47.97, 31.98, -4.95], 'article 3: 12 / 8 / 5, the 5 goes negative');
  // Evenly on the same baskets (what shareByQuantity gives) - article's other column
  assert.deepEqual(shareByQuantity(own(5), [4, 1]), [16.79, 4.2], 'article 1 evenly');
  assert.deepEqual(shareByQuantity(own(25), [12, 8, 5]), [36, 24, 15], 'article 3 evenly');

  // Measured on the reference (TEST family, 08/10/2026): 1 @ 6.50, 4 @ 24, 10 @ 55, 24 @ 120
  const jb = [[1, 6.5], [4, 24], [10, 55], [24, 120]].map(([quantity, price]) => ({ quantity, price }));
  const ownJb = (q) => highMixPrice(jb, q);
  assert.deepEqual(matchPricePoints(ownJb(5), [2, 3], jb, ownJb), [12.2, 18.3], 'reference: nothing matched -> evenly');
  assert.deepEqual(matchPricePoints(ownJb(5), [1, 4], jb, ownJb), [6.5, 24], 'reference: single + 4-pack');
  assert.deepEqual(matchPricePoints(ownJb(7), [3, 4], jb, ownJb), [19.5, 24], 'reference: 4-pack matched, the 3 takes the rest');
  // 12 as a family is 10-pack + 2 singles = $68, under two 4-packs + a 4-pack ($72):
  // both lines match, the gap lands on the last one (article example 2's rule).
  assert.equal(ownJb(12), 68, 'family total for 12');
  assert.deepEqual(matchPricePoints(ownJb(12), [8, 4], jb, ownJb), [48, 20], 'both matched, last absorbs the gap');
}

// --- High Mix Price (Setup > General > Use Quantity Rate = High Mix Price) -------
// Totals measured on the reference (08/10/2026) with a test product priced
// 1 @ 6.50, 4 @ 24, 10 @ 55, 24 @ 120 under High Mix Price.
{
  const jb = [[1, 6.5], [4, 24], [10, 55], [24, 120]].map(([quantity, price]) => ({ quantity, price }));
  assert.equal(highMixPrice(jb, 1), 6.5, 'reference qty 1');
  assert.equal(highMixPrice(jb, 4), 24, 'reference qty 4');
  assert.equal(highMixPrice(jb, 5), 30.5, 'reference qty 5: 4-pack + single');
  assert.equal(highMixPrice(jb, 7), 43.5, 'reference qty 7: 4-pack + 3 singles');
  assert.equal(highMixPrice(jb, 8), 48, 'reference qty 8: two 4-packs, not 4-pack + 4 singles');
  assert.equal(highMixPrice(jb, 9), 54.5, 'reference qty 9: two 4-packs + single');
  assert.equal(highMixPrice(jb, 11), 61.5, 'reference qty 11: 10-pack + single');
  assert.equal(highMixPrice(jb, 24), 120, 'exact case');
  assert.equal(highMixPrice(jb, 25), 126.5, 'case + single');

  // Support article "Setting Prices and Configuring Price Calculation":
  // 1 @ 3.50, 6 @ 15, 24 @ 50, buying 7 → Quantity Rate 15/6*7 = 17.50, High Mix 15 + 3.50
  const art = [{ quantity: 1, price: 3.5 }, { quantity: 6, price: 15 }, { quantity: 24, price: 50 }];
  assert.equal(highMixPrice(art, 7), 18.5, 'article: 6-pack + single');
  const artQr = bestRateTier(art, 7);
  assert.equal(Math.round((artQr.price / artQr.quantity) * 7 * 100) / 100, 17.5, 'article: quantity rate 17.50');

  // Reference More Info example: 1 @ $10, 2 @ $15, buying 3 → $25 (Quantity Rate: $22.50)
  const ref = [{ quantity: 1, price: 10 }, { quantity: 2, price: 15 }];
  assert.equal(highMixPrice(ref, 3), 25, 'More Info example');
  const qr = bestRateTier(ref, 3);
  assert.equal((qr.price / qr.quantity) * 3, 22.5, 'quantity rate differs');

  // A dearer-per-unit pack is never forced in
  assert.equal(highMixPrice([{ quantity: 1, price: 5 }, { quantity: 6, price: 60 }], 6), 30, 'six singles beat a dear six-pack');
  // No single price point: leftover at the smallest point's per-unit rate
  assert.equal(highMixPrice([{ quantity: 6, price: 24 }], 7), 28, '6-pack + 1 at the pack rate');
  // Below every price point there is nothing to build from - null, and the sell
  // screen falls back the same way Quantity Rate does (bestRateTier is null too).
  assert.equal(highMixPrice([{ quantity: 6, price: 24 }], 3), null, 'below the only pack');
  assert.equal(highMixPrice([], 3), null, 'no rows');
  assert.equal(highMixPrice(ref, 0), null, 'zero quantity');
}

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

// --- picking a family: what the confirm dialog is built from
{
  const { formatTiers, familyCategoryCheck } = await import('./familyOverride.js');
  const beer = (name, extra = {}) => ({ name, isActive: true, category: { name: 'Beer' }, prices: [{ quantity: 6, price: 16 }, { quantity: 1, price: 5 }], ...extra });

  assert.equal(formatTiers(beer('Carlton')), '1 for $5.00, 6 for $16.00', 'ordered by quantity');
  assert.equal(formatTiers({ prices: [{ quantity: 1, price: 9, priceSetId: 2 }] }), '', 'price-set rows are not the family price');

  assert.deepEqual(familyCategoryCheck('Soft Drinks', [beer('Carlton'), beer('VB')]),
    { mismatch: true, familyCategories: ['Beer'] }, 'a soft drink is a stranger among beers');
  assert.equal(familyCategoryCheck('Beer', [beer('Carlton')]).mismatch, false, 'same category is fine');
  assert.equal(familyCategoryCheck('', [beer('Carlton')]).mismatch, false, 'no category of its own: nothing to compare');
  assert.equal(familyCategoryCheck('Wine', []).mismatch, false, 'empty family: nothing to compare');
  assert.equal(familyCategoryCheck('Wine', [beer('Old', { isActive: false })]).mismatch, false, 'inactive members are ignored');
  assert.equal(familyCategoryCheck('Beer', [beer('A', { category: 'Beer' })]).mismatch, false, 'string category');
}

// --- family vs promotion: the cheaper basket wins (reference behaviour)
{
  const { chooseFamilyPricing } = await import('./familyOverride.js');
  // Family ladder 1@5, 6@16, 24@80 — highest break that fits, the rest at the single price.
  const ladder = (q) => { let left = q, total = 0; for (const [n, p] of [[24, 80], [6, 16], [1, 5]]) { total += Math.floor(left / n) * p; left %= n; } return total; };
  const line = (quantity, ownPrice, promoPriced = false) => ({ quantity, ownPrice, promoPriced });
  const prices = (r) => r.map((x) => x.price);

  // The audit case: 3 VB + 3 Carlton on a $3.50 promotion. Family 6-for-$16 beats $25.50.
  let r = chooseFamilyPricing([line(3, 15), line(3, 10.5, true)], ladder);
  assert.deepEqual(prices(r), [8, 8], 'family deal is cheaper than keeping the promotion');
  assert.deepEqual(r.map((x) => x.familyPriced), [true, true]);

  // Still dearer with a deep promotion ($15 + $3 = $18 > $16): the family wins again.
  r = chooseFamilyPricing([line(3, 15), line(3, 3, true)], ladder);
  assert.deepEqual(prices(r), [8, 8], '$18 with the promotion is still dearer than the $16 family');
}
{
  const { chooseFamilyPricing } = await import('./familyOverride.js');
  const ladder = (q) => { let left = q, total = 0; for (const [n, p] of [[24, 80], [6, 16], [1, 5]]) { total += Math.floor(left / n) * p; left %= n; } return total; };
  const line = (quantity, ownPrice, promoPriced = false) => ({ quantity, ownPrice, promoPriced });
  const prices = (r) => r.map((x) => x.price);

  // Promotion cheaper than the family: 1 + 1 (family 2 x $5 = $10) vs promo line $1 -> $6.
  let r = chooseFamilyPricing([line(1, 5), line(1, 1, true)], ladder);
  assert.deepEqual(prices(r), [5, 1], 'a genuinely cheaper promotion is kept');
  assert.deepEqual(r.map((x) => x.familyPriced), [false, false]);

  // Promotion kept AND the other two lines still group as a family among themselves.
  r = chooseFamilyPricing([line(3, 15), line(3, 15), line(1, 0.5, true)], ladder);
  assert.deepEqual(prices(r), [8, 8, 0.5], 'rest of the family still gets 6 for $16');
  assert.deepEqual(r.map((x) => x.familyPriced), [true, true, false]);

  // No promotion in the group: exactly the behaviour there was before.
  r = chooseFamilyPricing([line(3, 15), line(3, 15)], ladder);
  assert.deepEqual(prices(r), [8, 8]);
  r = chooseFamilyPricing([line(4, 20), line(2, 10)], ladder);
  assert.deepEqual(prices(r), [10.67, 5.33], 'split by quantity, to the cent');

  // A tie keeps the promotion (its saving stays visible).
  r = chooseFamilyPricing([line(3, 15), line(3, 1, true)], (q) => (q === 6 ? 16 : q * 5));
  assert.deepEqual(prices(r), [15, 1], 'tie -> promotion stays');

  // The customer's price list is applied to each family share.
  r = chooseFamilyPricing([line(3, 15), line(3, 15)], ladder, (l, share) => share * 0.9);
  assert.deepEqual(prices(r), [7.2, 7.2]);

  assert.deepEqual(prices(chooseFamilyPricing([line(2, 10)], ladder)), [10], 'a single line is not a group');
}

// --- measured on the live reference (ZZTEST family 1@$5 / 6@$24, A on a criteria
// promotion "2 for $8", 01/10/2026): the register prices the whole basket both ways
// and charges the lower total. A criteria-promotion line is NOT left out of its family.
{
  const { chooseFamilyPricing, groupFamilyLines } = await import('./familyOverride.js');
  const ladder = (q) => Math.floor(q / 6) * 24 + (q % 6) * 5;
  const promoA = (q) => Math.floor(q / 2) * 8 + (q % 2) * 5; // what the criteria pass charges A
  const line = (quantity, ownPrice, promoPriced = false) => ({ familyId: 1, tiersKey: '1@5|6@24', quantity, ownPrice, promoPriced });
  const prices = (r) => r.map((x) => x.price);

  // A 3 (promo $13) + B 3 ($15) = $28  vs  family 6 for $24  -> $12 + $12 (live SS 691)
  let r = chooseFamilyPricing([line(3, promoA(3), true), line(3, 15)], ladder);
  assert.deepEqual(prices(r), [12, 12], 'live: 3 + 3 -> $24 family, promotion loses');
  assert.deepEqual(r.map((x) => x.familyPriced), [true, true]);

  // A 4 (promo $16) + B 2 ($10) = $26  vs  family $24 -> $16 + $8 (live SS 693)
  r = chooseFamilyPricing([line(4, promoA(4), true), line(2, 10)], ladder);
  assert.deepEqual(prices(r), [16, 8], 'live: 4 + 2 -> $24 family');

  // A 2 (promo $8) + B 3 ($15) = $23  vs  family 5 singles $25 -> promotion kept (live SS 692)
  r = chooseFamilyPricing([line(2, promoA(2), true), line(3, 15)], ladder);
  assert.deepEqual(prices(r), [8, 15], 'live: 2 + 3 -> promotion $23 beats $25');
  assert.deepEqual(r.map((x) => x.familyPriced), [false, false]);

  // A 3 alone: no family partner -> not a group, the promotion price stands ($13, live SS 694)
  assert.equal(groupFamilyLines([line(3, promoA(3), true)]).length, 0, 'a lone line never forms a family group');
}

console.log('familyOverride: all assertions passed');
