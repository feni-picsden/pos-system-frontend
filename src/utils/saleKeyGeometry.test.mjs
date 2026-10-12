import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from '@babel/parser';
import { saleKeyGeometry, pointerCellDelta, canPlaceSaleKey, moveSaleKey } from './saleKeyGeometry.js';

const grid = { cols: 6, rows: 6 };
const bounds = { width: 1200, height: 600 };
const key = { id: 'a', position: { x: 0, y: 0 }, size: { width: 1, height: 1 } };

test('movement uses actual grid pixels and preserves legacy multi-cell sizes', () => {
  const legacy = { id: 'a', position: { x: 1, y: 1, w: 2, h: 3 } };
  const delta = pointerCellDelta({ clientX: 400, clientY: 100 }, { startX: 0, startY: 0 }, bounds, grid);
  const moved = moveSaleKey(legacy, delta, grid);
  assert.deepEqual(moved.position, { x: 3, y: 2, w: 2, h: 3 });
  assert.deepEqual(legacy.position, { x: 1, y: 1, w: 2, h: 3 });
});

test('movement clamps all edges for a multi-cell key', () => {
  const wide = { ...key, size: { width: 2, height: 3 } };
  assert.deepEqual(moveSaleKey(wide, { x: 20, y: 20 }, grid).position, { x: 4, y: 3, w: 2, h: 3 });
  assert.deepEqual(moveSaleKey(wide, { x: -20, y: -20 }, grid).position, { x: 0, y: 0, w: 2, h: 3 });
});

test('placement rejects overlaps and overflow but permits adjacent cells and self', () => {
  const other = { id: 'b', position: { x: 2, y: 0, w: 2, h: 2 } };
  assert.equal(canPlaceSaleKey(moveSaleKey(key, { x: 2, y: 0 }, grid), [key, other], grid), false);
  assert.equal(canPlaceSaleKey(moveSaleKey(key, { x: 1, y: 0 }, grid), [key, other], grid), true);
  assert.equal(canPlaceSaleKey({ ...key, position: { x: 6, y: 0 } }, [], grid), false);
  assert.equal(canPlaceSaleKey(key, [key], grid), true);
});

// Exercise the editor's actual event callbacks, with state and pointer capture mocked.
const editor = fs.readFileSync(new URL('../pages/Setup/SaleKeyEditor.jsx', import.meta.url), 'utf8');
const sales = fs.readFileSync(new URL('../components/SaleKey/SaleKeysGrid.jsx', import.meta.url), 'utf8');
function nodes(source) {
  const all = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    all.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  return all;
}
const editorNodes = nodes(editor);
function callback(name, context) {
  let node = editorNodes.find(node => node.type === 'VariableDeclarator' && node.id.name === name).init;
  if (node.type === 'CallExpression') node = node.arguments[0];
  return vm.runInNewContext(`(${editor.slice(node.start, node.end)})`, context);
}
const plain = value => JSON.parse(JSON.stringify(value));

test('mouse and touch resize all eight handles by real grid cells', () => {
  const expected = {
    e: [2, 2, 3, 2], w: [3, 2, 1, 2], s: [2, 2, 2, 3], n: [2, 3, 2, 1],
    se: [2, 2, 3, 3], sw: [3, 2, 1, 3], ne: [2, 3, 3, 1], nw: [3, 3, 1, 1],
  };
  for (const touch of [false, true]) for (const [direction, values] of Object.entries(expected)) {
    let result;
    const item = { id: 'a', position: { x: 2, y: 2 }, size: { width: 2, height: 2 } };
    const context = {
      isResizing: true, resizeData: { keyId: 'a', direction, startX: 0, startY: 0, startSize: item.size, startPosition: item.position, bounds },
      gridSize: grid, saleKeys: [item], selectedKey: null, pointerCellDelta, canPlaceSaleKey,
      getPointerPosition: e => e.touches?.[0] || e,
      setSaleKeys: keys => { result = keys[0]; }, debugSetSelectedKey: () => {},
    };
    const point = { clientX: 200, clientY: 100 };
    callback('handleResizeMove', context)(touch ? { touches: [point] } : point);
    assert.deepEqual([result.position.x, result.position.y, result.size.width, result.size.height], values, `${direction}, touch=${touch}`);
  }
});

test('resizing into an occupied cell keeps the original key', () => {
  let called = false;
  const context = {
    isResizing: true, resizeData: { keyId: 'a', direction: 'e', startX: 0, startY: 0, startSize: key.size, startPosition: key.position, bounds },
    gridSize: grid, saleKeys: [key, { id: 'b', position: { x: 1, y: 0 } }], selectedKey: null,
    pointerCellDelta, canPlaceSaleKey, getPointerPosition: e => e,
    setSaleKeys: () => { called = true; }, debugSetSelectedKey: () => {},
  };
  callback('handleResizeMove', context)({ clientX: 200, clientY: 0 });
  assert.equal(called, false);
});

test('drag moves a key, blocks collisions, and cancellation restores it', () => {
  let keys = [key, { id: 'b', position: { x: 2, y: 0 } }];
  const context = {
    isResizing: false, canvasRef: { current: { getBoundingClientRect: () => bounds } },
    dragRef: { current: null }, suppressKeyClick: { current: false }, gridSize: grid,
    saleKeys: keys, moveSaleKey, pointerCellDelta, canPlaceSaleKey, saleKeyGeometry,
    setSaleKeys: updater => { keys = updater(keys); }, debugSetSelectedKey: () => {},
  };
  const target = { setPointerCapture: () => {}, hasPointerCapture: () => true, releasePointerCapture: () => {} };
  const event = { button: 0, pointerId: 1, clientX: 0, clientY: 0, currentTarget: target };
  callback('handleKeyDragStart', context)(event, key);
  callback('handleKeyDragMove', context)({ ...event, clientX: 2 });
  assert.equal(context.suppressKeyClick.current, false);
  callback('handleKeyDragMove', context)({ ...event, clientX: 200 });
  assert.equal(keys[0].position.x, 1);
  assert.equal(context.suppressKeyClick.current, true);
  callback('handleKeyDragMove', context)({ ...event, clientX: 400 });
  assert.equal(keys[0].position.x, 1);
  callback('handleKeyDragEnd', context)({ ...event, type: 'pointercancel' });
  assert.deepEqual(plain(keys[0]), key);
  assert.equal(context.dragRef.current, null);
});

test('drop keeps the moved key and suppresses the following selection click', () => {
  let result = [key];
  const context = {
    dragRef: { current: { key, bounds, startX: 0, startY: 0, pointerId: 2, moved: false } },
    suppressKeyClick: { current: false }, gridSize: grid, saleKeys: [key], moveSaleKey, pointerCellDelta, canPlaceSaleKey,
    setSaleKeys: updater => { result = updater(result); }, debugSetSelectedKey: () => {},
  };
  callback('handleKeyDragMove', context)({ pointerId: 2, clientX: 400, clientY: 100 });
  callback('handleKeyDragEnd', context)({ pointerId: 2, type: 'pointerup', currentTarget: { hasPointerCapture: () => false } });
  assert.equal(result[0].position.x, 2);
  assert.equal(result[0].position.y, 1);
  let stopped = false;
  callback('handleKeyClick', context)(key, { stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
});

test('frequent pointer movement updates the grid only when its snapped cell changes', () => {
  let writes = 0;
  const context = {
    isResizing: false, canvasRef: { current: { getBoundingClientRect: () => bounds } },
    dragRef: { current: null }, suppressKeyClick: { current: false }, gridSize: grid,
    saleKeys: [key], moveSaleKey, pointerCellDelta, canPlaceSaleKey, saleKeyGeometry,
    setSaleKeys: updater => { updater([key]); writes++; }, debugSetSelectedKey: () => {},
  };
  const event = { pointerId: 1, button: 0, clientX: 0, clientY: 0, currentTarget: { setPointerCapture: () => {} } };
  callback('handleKeyDragStart', context)(event, key);
  const move = callback('handleKeyDragMove', context);
  for (let x = 5; x < 100; x++) move({ ...event, clientX: x });
  assert.equal(writes, 0);
  for (let x = 100; x < 300; x++) move({ ...event, clientX: x });
  assert.equal(writes, 1);
  move({ ...event, clientX: 300 });
  assert.equal(writes, 2);
  move({ ...event, pointerId: 2, clientX: 500 });
  assert.equal(writes, 2);
});

test('drag movement is not delayed by position or size transitions', () => {
  const expression = editorNodes.find(node => node.type === 'ObjectProperty' && node.key.name === 'transition').value;
  const transition = vm.runInNewContext(editor.slice(expression.start, expression.end), { key: { behavior: {} } });
  assert.equal(transition.includes('all'), false);
  assert.equal(/left|top|width|height|transform/.test(transition), false);
});

test('Sales honours saved border colours and retains the case-mode highlight', () => {
  const expression = nodes(sales).find(node => node.type === 'ObjectProperty' && node.key.name === 'border').value;
  for (const colour of ['#ff0000', '#000000', '#00ff00', undefined]) {
    const actual = vm.runInNewContext(sales.slice(expression.start, expression.end), { isCaseModeKey: false, saleKey: { borderColor: colour } });
    assert.equal(actual, `1px solid ${colour || '#ffffff'}`);
  }
  assert.equal(vm.runInNewContext(sales.slice(expression.start, expression.end), { isCaseModeKey: true, saleKey: { borderColor: '#ff0000' } }), '3px solid #0284c7');
  const sanitized = callback('sanitizeSaleKeys', {})([{ ...key, borderColor: '#ff0000', selectedProduct: { id: 1 } }]);
  assert.equal(sanitized[0].borderColor, '#ff0000');
  assert.equal(sanitized[0].selectedProduct, undefined);
});
