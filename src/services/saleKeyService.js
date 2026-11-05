import apiClient from './apiClient';

// One template key. Only actions the sell screen and the editor both know are
// used (no-action, clear-sale, add-quantity, subtract-quantity, use-case-quantity,
// view-previous-date). `payMethod` is a HINT: at creation time it becomes
// pay-exact-amount if a payment method with that name exists, else no-action.
const key = (id, name, x, y, backgroundColor, textColor, extra = {}) => ({
  id,
  name,
  action: 'no-action',
  backgroundColor,
  textColor,
  borderColor: '#000000',
  fontSize: extra.fontSize || (name.length > 10 ? 14 : 16),
  textStyle: { bold: true, italic: false, underline: false },
  behavior: { disableKey: false, preventDisable: false, preventHover: false, preventHoverAnimation: false },
  position: { x, y },
  size: { width: 1, height: 1 },
  image: null,
  ...extra,
});

const TEMPLATE_CONFIGS = {
  'home-keys': {
    gridSize: { rows: 6, cols: 6 },
    saleKeys: [
      key('nets-b', 'NETS B', 0, 0, '#000000', '#FFFFFF', { payMethod: 'NETS' }),
      key('ice', 'ICE', 1, 0, '#87CEEB', '#000000'),
      key('premix-10pack', '10 PACK PREMIX', 2, 0, '#FF0000', '#FFFFFF'),
      key('clearance', 'CLEARANCE', 3, 0, '#FF0000', '#FFFFFF'),
      key('beer-slabs', 'Beer... SLABS', 4, 0, '#000000', '#FFFFFF'),
      key('split-beer-pks', 'SPLIT BEER PKS', 5, 0, '#FFD700', '#000000'),
      key('premix-slabs-stub', 'PREMIX SLABS STUB', 0, 1, '#0000FF', '#FFFFFF'),
      key('split-premix-pks', 'SPLIT PREMIX PKS', 1, 1, '#FF00FF', '#FFFFFF'),
      key('premix-slabs-cans', 'PREMIX SLABS CANS', 2, 1, '#FF0000', '#FFFFFF'),
      key('cider', 'CIDER', 3, 1, '#FFFFFF', '#000000'),
      key('soft-drinks', 'SOFT DRINKS', 4, 1, '#FFD700', '#000000'),
      key('case-qty', 'Case Qty', 5, 1, '#0000FF', '#FFFFFF', { action: 'use-case-quantity' }),
      key('go-to-2nd-page', 'Go to 2nd page', 0, 2, '#FFD700', '#000000'),
      key('party-packs', 'Party Packs', 1, 2, '#FFD700', '#000000'),
      key('legal-age', 'Legal Age', 2, 2, '#FF0000', '#FFFFFF', {
        action: 'view-previous-date', durationAgo: 'P18Y', dateFormat: 'Do MMM YYYY', fontSize: 12,
      }),
      key('gift-voucher', 'PMK GIFT VOUCHER', 3, 2, '#FFD700', '#000000'),
      key('exact-cash', 'Exact Cash', 4, 2, '#00FF00', '#000000', { payMethod: 'Cash' }),
      key('cancel-sale', 'Cancel Sale', 5, 2, '#FF0000', '#FFFFFF', { action: 'clear-sale' }),
      key('eftpos', 'EFTPOS', 0, 3, '#FF0000', '#FFFFFF', { payMethod: 'EFTPOS' }),
      key('mobile-eftpos', 'MOBILE EFTPOS', 1, 3, '#FFD700', '#000000', { payMethod: 'Mobile EFTPOS' }),
    ],
  },
  'more-functions': {
    gridSize: { rows: 4, cols: 4 },
    saleKeys: [
      key('clear-sale', 'Clear Sale', 0, 0, '#FF0000', '#FFFFFF', { action: 'clear-sale' }),
      key('minus-quantity', 'Minus Quantity', 1, 0, '#FFA500', '#000000', { action: 'subtract-quantity' }),
      key('plus-quantity', 'Plus Quantity', 2, 0, '#00FF00', '#000000', { action: 'add-quantity' }),
      key('case-quantity', 'Case Quantity', 3, 0, '#00FF00', '#000000', { action: 'use-case-quantity' }),
    ],
  },
};

const saleKeyService = {
  getSaleKeySets: async (outletId) => {
    const params = {};
    if (outletId != null && outletId !== '') {
      params.outletId = Number(outletId);
    }
    const response = await apiClient.get('/sale-keys/sets', {
      params: Object.keys(params).length ? params : undefined,
    });
    return response.data;
  },

  getSaleKeySet: async (setId) => {
    const response = await apiClient.get(`/sale-keys/sets/${setId}`);
    return response.data.saleKeySet;
  },

  createSaleKeySet: async (setData) => {
    const response = await apiClient.post('/sale-keys/sets', setData);
    return response.data.saleKeySet;
  },

  updateSaleKeySet: async (setId, setData) => {
    const response = await apiClient.put(`/sale-keys/sets/${setId}`, setData);
    return response.data.saleKeySet;
  },

  // Without force the server answers 400 {code:'REFERENCED', referencedBy}
  // when another folder's key opens this set.
  deleteSaleKeySet: async (setId, { force = false } = {}) => {
    const response = await apiClient.delete(`/sale-keys/sets/${setId}`, {
      params: force ? { force: 1 } : undefined,
    });
    return response.data;
  },

  cloneSaleKeySet: async (setId, newName) => {
    const response = await apiClient.post(`/sale-keys/sets/${setId}/clone`, { name: newName });
    return response.data.saleKeySet;
  },

  getActiveSaleKeySet: async (outletId) => {
    const params = {};
    if (outletId != null && outletId !== '') {
      params.outletId = Number(outletId);
    }
    const response = await apiClient.get('/sale-keys/active', {
      params: Object.keys(params).length ? params : undefined,
    });
    return response.data.saleKeySet;
  },

  // Templates offered by the New dialog (reference: Home / More Functions).
  getTemplates: () => [
    { id: 'home-keys', name: 'Home Keys' },
    { id: 'more-functions', name: 'More Functions' },
  ],

  getDefaultSaleKeySets: () => {
    const now = new Date().toISOString();
    return [
      { id: 'home-keys', name: 'Home Keys', description: 'Main sale key layout', isActive: true, createdAt: now, updatedAt: now },
      { id: 'more-functions', name: 'More Functions', description: 'Additional function keys', isActive: true, createdAt: now, updatedAt: now },
    ];
  },

  // Fresh deep copy of a template. `paymentMethods` (optional, [{id,name,...}])
  // lets the pay keys become real "Pay the Exact Amount" keys; a hint with no
  // matching method stays a labelled no-action key.
  getDefaultConfig: (setId, paymentMethods = []) => {
    const tpl = TEMPLATE_CONFIGS[setId];
    if (!tpl) return { gridSize: { rows: 6, cols: 6 }, saleKeys: [] };
    const byName = (n) => paymentMethods.find((m) => String(m?.name || '').trim().toLowerCase() === n.toLowerCase());
    return {
      gridSize: { ...tpl.gridSize },
      saleKeys: tpl.saleKeys.map((k) => {
        const { payMethod, ...rest } = k;
        const copy = JSON.parse(JSON.stringify(rest));
        if (payMethod) {
          const m = byName(payMethod);
          if (m) {
            copy.action = 'pay-exact-amount';
            copy.selectedPaymentMethod = m;
            copy.paymentMethod = m.name;
          }
        }
        return copy;
      }),
    };
  },
};

export default saleKeyService;
