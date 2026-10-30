// ponytail: one self-check for the only non-trivial logic here — variable
// substitution. Run: node src/utils/statementDefaults.test.mjs
import assert from 'node:assert/strict';
import {
  applyStatementVariables, buildDefaultStatementComponents, isoDurationDays, buildCreditTermBuckets, getPrintedActionColumns,
} from './statementDefaults.js';

// Live API customer shape (GET /customers/:id/statement)
const live = {
  id: 7, code: 'C7',
  firstName: 'John', lastName: 'Smith', company: 'Shopfront',
  billingStreet1: '425 Smith St', billingSuburb: 'Fitzroy', billingPostcode: '3065', billingState: 'VIC',
};
assert.equal(
  applyStatementVariables('{customerCode}|{customerCompany}|{customerName}|{customerContact}|{customerAddress}|{customerCity}', live),
  'C7|Shopfront|John Smith|John Smith|425 Smith St|Fitzroy 3065 VIC'
);

// Reference: blank lines at the top go (no code -> starts at the company / name,
// never the id); an empty field further down keeps its blank line.
const block = '<div>{customerCode}<br/>{customerCompany}<br/>{customerName}<br/>{customerCity}</div>';
assert.equal(applyStatementVariables(block, { ...live, code: null }), '<div>Shopfront<br/>John Smith<br/>Fitzroy 3065 VIC</div>');
assert.equal(applyStatementVariables(block, { ...live, code: '', company: '' }), '<div>John Smith<br/>Fitzroy 3065 VIC</div>');
assert.equal(applyStatementVariables(block, { ...live, company: '' }), '<div>C7<br/><br/>John Smith<br/>Fitzroy 3065 VIC</div>');
// A blank value mid-line keeps the break; a bare "Ph:" caption still goes.
assert.equal(applyStatementVariables('<b>x</b><br/>Ph: {businessPhone}<br/>{businessEmail}', live, { email: 'a@b.com' }), '<b>x</b><br/><br/>a@b.com');

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

// Group credit terms are ISO 8601 durations.
assert.equal(isoDurationDays('P15D'), 15);
assert.equal(isoDurationDays('P30D'), 30);
assert.equal(isoDurationDays('P2W'), 14);
assert.equal(isoDurationDays('P1M'), 30);
assert.equal(isoDurationDays('P0D'), 0);
assert.equal(isoDurationDays('30'), null);
assert.equal(isoDurationDays('P'), null);
assert.equal(isoDurationDays('P1DT12H'), 1.5);
assert.equal(isoDurationDays('PT36H'), 1.5);
assert.equal(isoDurationDays('PT'), null);
assert.equal(isoDurationDays('P1DT'), null);

// Credit Terms box: what is owed at the end, by the longest term its age reached.
const end = new Date('2012-05-11T12:00:00');
const acts = [
  { date: '2012-04-01T10:00:00', balance: 40 },  // 40 days old -> 30 days
  { date: '2012-05-10T10:00:00', balance: 12.5 }, // 1 day old   -> 0 days
  { date: '2012-05-01T10:00:00', balance: 0 },    // paid        -> nowhere
  { date: '2012-05-02T10:00:00', balance: -2 },   // unused credit, a minus
];
assert.deepEqual(
  buildCreditTermBuckets([{ label: '', duration: 'P30D' }, { label: '0 days', duration: 'P0D' }], acts, end).map((t) => [t.label, t.amount]),
  [['0 days', 10.5], ['30 days', 40]]
);
// No terms on the group (or none readable) -> no box.
assert.deepEqual(buildCreditTermBuckets([], acts, end), []);
assert.deepEqual(buildCreditTermBuckets([{ label: 'Net', duration: '30' }], acts, end), []);

// Invoice numbers print in a header-less column right after Type.
assert.deepEqual(getPrintedActionColumns({}).map((c) => c.key), ['date', 'activity', 'number', 'reference', 'total', 'balance']);
assert.equal(getPrintedActionColumns({}).find((c) => c.key === 'number').label, '');

console.log('statementDefaults: all checks passed');
