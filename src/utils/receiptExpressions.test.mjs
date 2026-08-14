// node src/utils/receiptExpressions.test.mjs
import assert from 'node:assert/strict';
import { renderExpressions, evaluateExpression } from './receiptExpressions.js';

const ctx = {
  invoiceNo: '00034066',
  completedAt: '2026-08-05T11:38:10.086Z',
  user: { name: 'An' },
  note: '',
  customer: null,
  sale: { metaData: { 'iba:loyalty:customer': { MemberID: 'M42' } } },
};

// plain path
assert.equal(renderExpressions('Inv No #{invoiceNo}', ctx), 'Inv No #00034066');
assert.equal(renderExpressions('Sales Person: {user.name}', ctx), 'Sales Person: An');

// missing path -> empty, never the literal
assert.equal(renderExpressions('[{customer.name}]', ctx), '[]');
assert.equal(renderExpressions('[{nothing.here.at.all}]', ctx), '[]');

// moment-style date tokens
const formatted = renderExpressions('{format(completedAt, "Do MMM YYYY")}', ctx);
assert.match(formatted, /^5th Aug 2026$/, `got ${formatted}`);
assert.match(renderExpressions('{format(completedAt, "h:mm a")}', ctx), /^\d{1,2}:\d{2} (am|pm)$/);

// IF / CONCAT / COALESCE, case-insensitive
assert.equal(renderExpressions('{IF(note, CONCAT(note, "!"), "no note")}', ctx), 'no note');
assert.equal(renderExpressions('{IF(user.name, CONCAT("Hi ", user.name), "")}', ctx), 'Hi An');
assert.equal(renderExpressions('{coalesce(customer.name, "Guest")}', ctx), 'Guest');
assert.equal(renderExpressions('{COALESCE(customer.name, "")}', ctx), '');

// colon keys inside a path
assert.equal(evaluateExpression('sale.metaData.iba:loyalty:customer.MemberID', ctx), 'M42');

// expression split across HTML tags by the rich-text editor
assert.equal(
  renderExpressions('<span>{IF(user.name, "yes"</span> <span>, "no")}</span>', ctx),
  '<span>yes</span>',
);

// legacy {{double}} placeholders are left for the caller
assert.equal(renderExpressions('{{total}}', ctx), '{{total}}');

// unbalanced brace does not throw or eat the rest
assert.equal(renderExpressions('a {oops', ctx), 'a {oops');

console.log('receiptExpressions: all assertions passed');
