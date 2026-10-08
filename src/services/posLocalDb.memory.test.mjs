// node src/services/posLocalDb.memory.test.mjs
// The sell screen reads promotions/products from the in-memory catalog. Writes
// made by the page caches (putStoreAll / putStoreItem / invalidateStore) must be
// mirrored there, or a promotion set inactive on the Promotions page kept
// discounting the cart until a full reload. Runs without IndexedDB (node).
import assert from 'node:assert/strict';
import posLocalDb from './posLocalDb.js';

const promoA = { id: 1, name: 'A', isActive: true, outletId: null };
const promoB = { id: 2, name: 'B', isActive: true, outletId: 1 };
const promoC = { id: 3, name: 'C', isActive: false, outletId: null };

// putStoreAll('promotions') replaces the memory list
await posLocalDb.putStoreAll('promotions', [promoA, promoB, promoC]);
assert.deepEqual(posLocalDb.getPromotions().map((p) => p.id), [1, 2, 3], 'promotions mirrored to memory');

// a toggle on the Promotions page: the interceptor invalidates, the refetch refills
await posLocalDb.invalidateStore('promotions');
assert.deepEqual(posLocalDb.getPromotions(), [], 'invalidate empties the memory list');
await posLocalDb.putStoreAll('promotions', [promoA, { ...promoB, isActive: false }, promoC]);
assert.equal(posLocalDb.getPromotions().filter((p) => p.isActive).length, 1, 'only A still active after refill');

// products: putStoreAll keeps sellable rows only; putStoreItem upserts one row (post-sale stock)
await posLocalDb.putStoreAll('products', [
  { id: 10, name: 'Beer', status: 'Active', currentStockCases: 5, barcodes: ['111'] },
  { id: 11, name: 'Old', status: 'Inactive' },
]);
assert.deepEqual(posLocalDb.getProducts().map((p) => p.id), [10], 'inactive products are not sellable');
assert.equal(posLocalDb.getProductByBarcode('111')?.id, 10, 'barcode map rebuilt');
await posLocalDb.putStoreItem('products', { id: 10, name: 'Beer', status: 'Active', currentStockCases: 4, barcodes: ['111'] });
assert.equal(posLocalDb.getProducts().find((p) => p.id === 10).currentStockCases, 4, 'stock row replaced in memory');
assert.equal(posLocalDb.getProducts().length, 1, 'upsert does not duplicate');
await posLocalDb.putStoreItem('products', { id: 12, name: 'New', status: 'Active', barcodes: [] });
assert.equal(posLocalDb.getProducts().length, 2, 'new row added');
// invalidating products must NOT wipe memory (search keeps working during a re-sync)
await posLocalDb.invalidateStore('products');
assert.equal(posLocalDb.getProducts().length, 2, 'products stay in memory on invalidate');

// unrelated stores never touch the sell catalog
await posLocalDb.putStoreAll('users', [{ id: 1 }]);
assert.equal(posLocalDb.getProducts().length, 2);
assert.equal(posLocalDb.getPromotions().length, 3);

console.log('posLocalDb memory mirror: all assertions passed');
