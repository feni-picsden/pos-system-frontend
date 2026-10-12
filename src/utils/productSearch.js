import { normalizeBarcodeCodes, stripHtml } from '../services/posLocalDb.js';
import { rankProducts } from './searchRank.js';

export function matchesProductSearch(product, search = '') {
  const words = String(search).trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${product?.name || ''} ${stripHtml(product?.description)} ${normalizeBarcodeCodes(product?.barcodes).join(' ')}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

export function searchProducts(products, search = '') {
  return rankProducts((products || []).filter((product) => matchesProductSearch(product, search)), search);
}
