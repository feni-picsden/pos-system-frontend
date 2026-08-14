// ponytail: one self-check for the only non-trivial logic here — variable
// substitution. Run: node src/utils/statementDefaults.test.mjs
import assert from 'node:assert/strict';
import { applyStatementVariables, buildDefaultStatementComponents, groupActivitiesByAge } from './statementDefaults.js';

// Live API customer shape (GET /customers/:id/statement)
const live = {
  id: 7,
  firstName: 'John', lastName: 'Smith', company: 'Shopfront',
  billingStreet1: '425 Smith St', billingSuburb: 'Fitzroy', billingPostcode: '3065', billingState: 'VIC',
};
assert.equal(
  applyStatementVariables('{customerCode}|{customerName}|{customerContact}|{customerAddress}|{customerCity}', live),
  '7|Shopfront|John Smith|425 Smith St|Fitzroy 3065 VIC'
);

// Editor mock shape
const mock = { code: '1234', name: 'Shopfront', contact: 'John Smith', address: '425 Smith St', city: 'Fitzroy 3065 VIC' };
assert.equal(applyStatementVariables('{customerCode} {customerCity}', mock), '1234 Fitzroy 3065 VIC');

// Unknown tokens survive; missing customer degrades to empty strings, never literals.
assert.equal(applyStatementVariables('{notAVar} {customerName}', mock), '{notAVar} Shopfront');
assert.equal(applyStatementVariables('[{customerName}]', undefined), '[]');
assert.equal(applyStatementVariables('', mock), '');

// Business variables resolve from the outlet; missing ones go empty, never literal.
const outlet = { name: 'Top Drops', address: '1 Bringelly Rd', email: 'a@b.com', phone: '(02) 9606 6476' };
assert.equal(
  applyStatementVariables('{businessName}|{businessAddress}|{businessEmail}|{businessPhone}|{businessAbn}', mock, outlet),
  'Top Drops|1 Bringelly Rd|a@b.com|(02) 9606 6476|'
);
assert.equal(applyStatementVariables('[{businessName}]', mock), '[]');

// The seeded business block must be fully resolvable — no literal {...} left over.
const seededBusiness = buildDefaultStatementComponents()
  .flatMap((c) => (c.properties?.columns || []).flatMap((col) => col.components || []))
  .find((c) => c.properties?.richTextContent?.includes('{business'));
assert.ok(seededBusiness, 'default template seeds a business block');
assert.ok(!/\{business\w+\}/.test(applyStatementVariables(seededBusiness.properties.richTextContent, live, outlet)));

// The seeded address block must be fully resolvable — no literal {...} left over.
const seeded = buildDefaultStatementComponents()
  .flatMap((c) => (c.properties?.columns || []).flatMap((col) => col.components || []))
  .find((c) => c.properties?.richTextContent?.includes('{customer'));
assert.ok(seeded, 'default template seeds a customer address block');
assert.ok(!/\{customer\w+\}/.test(applyStatementVariables(seeded.properties.richTextContent, live)));

// Activities group under aging headings, splitting 30 days before the range end.
const end = new Date('2012-05-11');
const acts = [
  { date: '2012-04-10', activity: 'Invoice' }, // 31 days before end -> 30 days
  { date: '2012-05-10', activity: 'Invoice' }, // 1 day before end   -> Current
];
assert.deepEqual(groupActivitiesByAge(acts, end).map((g) => g.category), ['30 days', 'Current']);
assert.equal(groupActivitiesByAge(acts, end)[0].transactions.length, 1);
// Empty buckets are dropped, not rendered as bare headings.
assert.deepEqual(groupActivitiesByAge([acts[1]], end).map((g) => g.category), ['Current']);
assert.deepEqual(groupActivitiesByAge([], end), []);

console.log('statementDefaults: all checks passed');
