import apiClient from './apiClient';

/**
 * Duplicate lookup built from GET /products/by-barcode/:code, one call per code.
 * Used when the batch endpoint isn't available. A 404 from that route means the
 * code is unused, which is a "no duplicates" answer, not a failure.
 */
async function checkDuplicatesViaBarcodeLookup(codes, excludeProductId) {
  const excludeId = parseInt(excludeProductId, 10);
  const duplicates = {};

  await Promise.all(
    codes.map(async (code) => {
      try {
        // noCache: a barcode saved on another product moments ago must show up,
        // not be hidden behind the shared 2-minute GET cache.
        const response = await apiClient.get(
          `/products/by-barcode/${encodeURIComponent(code)}`,
          { noCache: true, silent: true }
        );
        const payload = response?.data || {};
        const matches = payload.products || (payload.product ? [payload.product] : []);
        const others = matches
          .filter((p) => !(Number.isInteger(excludeId) && Number(p.id) === excludeId))
          .map((p) => ({ id: p.id, name: p.name }));
        if (others.length > 0) duplicates[code] = others;
      } catch (error) {
        if (error?.response?.status !== 404) {
          console.error(`Error looking up barcode ${code}:`, error);
        }
      }
    })
  );

  return duplicates;
}

const barcodeService = {
  getBarcodes: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.productCreatedAtStart) {
      params.append('productCreatedAtStart', filters.productCreatedAtStart);
    }
    if (filters.productCreatedAtEnd) {
      params.append('productCreatedAtEnd', filters.productCreatedAtEnd);
    }
    if (filters.lastStocktakedAtStart) {
      params.append('lastStocktakedAtStart', filters.lastStocktakedAtStart);
    }
    if (filters.lastStocktakedAtEnd) {
      params.append('lastStocktakedAtEnd', filters.lastStocktakedAtEnd);
    }
    if (filters.lastSoldAtStart) {
      params.append('lastSoldAtStart', filters.lastSoldAtStart);
    }
    if (filters.lastSoldAtEnd) {
      params.append('lastSoldAtEnd', filters.lastSoldAtEnd);
    }
    if (filters.inventoryLevel) {
      params.append('inventoryLevel', filters.inventoryLevel);
    }
    if (filters.barcodeSearch) {
      params.append('barcodeSearch', filters.barcodeSearch);
    }
    if (filters.onlyDuplicates) {
      params.append('onlyDuplicates', filters.onlyDuplicates);
    }

    const response = await apiClient.get(`/barcodes?${params.toString()}`);
    return response.data;
  },

  // Returns { [code]: [{ id, name }] } for codes already used by OTHER products.
  // Codes with no other owner are simply absent from the map.
  checkDuplicates: async (codes, excludeProductId = null) => {
    const wanted = [...new Set((codes || []).map((c) => String(c ?? '').trim()).filter(Boolean))];
    if (wanted.length === 0) return {};

    try {
      const response = await apiClient.post('/barcodes/check-duplicates', {
        codes: wanted,
        excludeProductId,
      });
      return response.data?.duplicates || {};
    } catch (error) {
      // A backend without the batch endpoint (older deploy) 404s. Fall back to
      // the per-code scanner lookup, which every backend has and which already
      // returns EVERY product matching a code.
      if (error?.response?.status !== 404) throw error;
      return checkDuplicatesViaBarcodeLookup(wanted, excludeProductId);
    }
  },

  // Attach an unknown code to an existing product (the register's associate flow).
  // `quantity` is the pack size the code adds per scan.
  associateBarcode: async (productId, code, quantity = 1) => {
    const response = await apiClient.post(`/barcodes/${productId}`, { code, quantity });
    return response.data;
  },

  deleteBarcode: async (productId, barcodeCode) => {
    const response = await apiClient.delete(`/barcodes/${productId}/${encodeURIComponent(barcodeCode)}`);
    return response.data;
  },
};

export default barcodeService;
