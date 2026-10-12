import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';

const source = readFileSync(new URL('./useAutoFocusFirstInput.js', import.meta.url), 'utf8');
const nodes = new Map();
for (const top of parse(source, { sourceType: 'module' }).program.body) {
  const node = top.type === 'ExportDefaultDeclaration' ? top.declaration : top;
  if (node.type === 'VariableDeclaration') for (const declaration of node.declarations) nodes.set(declaration.id.name, declaration.init);
  if (node.type === 'FunctionDeclaration') nodes.set(node.id.name, node);
}
function harness({ disabled = false, readOnly = false, hidden = false } = {}) {
  const timers = [];
  const events = new Map();
  let observer;
  const body = {};
  const document = { body, activeElement: body, querySelectorAll: () => [],
    addEventListener: (name, callback) => events.set(name, callback), removeEventListener: () => {} };
  const input = { tagName: 'INPUT', type: 'text', disabled, readOnly, hidden,
    getClientRects: () => input.hidden ? [] : [1], closest: () => null,
    focus: () => { document.activeElement = input; } };
  const children = [input];
  const context = vm.createContext({ document, getComputedStyle: () => ({ visibility: 'visible' }),
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; }, clearTimeout: () => {},
    useEffect: (callback) => callback(),
    MutationObserver: class { constructor(callback) { this.callback = callback; observer = this; }
      observe(root, options) { this.options = options; } disconnect() {} },
  });
  for (const [name, node] of nodes) context[name] = vm.runInContext(`(${source.slice(node.start, node.end)})`, context);
  context.useAutoFocusFirstInput({ current: { querySelectorAll: () => children } }, '/products');
  const firstAttempt = () => timers.find((timer) => timer.delay === 50).callback();
  return { document, input, children, observer, events, firstAttempt,
    mutate: (attribute) => {
      if (observer.options.attributes && observer.options.attributeFilter.includes(attribute)) observer.callback();
    } };
}
test('first enabled input receives focus', () => {
  const h = harness(); h.firstAttempt(); assert.equal(h.document.activeElement, h.input);
});
test('disabled input receives focus when loading enables it', () => {
  const h = harness({ disabled: true }); h.firstAttempt(); assert.notEqual(h.document.activeElement, h.input);
  h.input.disabled = false; h.mutate('disabled'); assert.equal(h.document.activeElement, h.input);
});
test('readonly and hidden inputs become focusable when attributes change', () => {
  for (const attribute of ['readonly', 'hidden']) {
    const h = harness(attribute === 'readonly' ? { readOnly: true } : { hidden: true }); h.firstAttempt();
    h.input[attribute === 'readonly' ? 'readOnly' : 'hidden'] = false;
    h.mutate(attribute); assert.equal(h.document.activeElement, h.input);
  }
});
test('user interaction cancels waiting focus', () => {
  const h = harness({ disabled: true }); h.firstAttempt(); h.events.get('pointerdown')();
  h.input.disabled = false; h.mutate('disabled'); assert.notEqual(h.document.activeElement, h.input);
});
test('another active text field keeps its focus', () => {
  const h = harness(); const other = { tagName: 'INPUT' }; h.document.activeElement = other;
  h.firstAttempt(); assert.equal(h.document.activeElement, other);
});
