import apiClient from './apiClient';

// Barcode Templates (Settings > Barcode Templates): variable barcodes for deli
// scales / lotto tickets. Codes: $ dollars, C cents, Q quantity, X product
// identifier, ? any character, \ escapes a literal.
export const barcodeTemplateService = {
  async getTemplates() {
    const response = await apiClient.get('/barcode-templates', { noCache: true });
    return response.data;
  },

  // { name, template, recalculateQuantity }
  async createTemplate(data) {
    const response = await apiClient.post('/barcode-templates', data);
    return response.data;
  },

  async updateTemplate(id, data) {
    const response = await apiClient.put(`/barcode-templates/${id}`, data);
    return response.data;
  },

  async deleteTemplate(id) {
    const response = await apiClient.delete(`/barcode-templates/${id}`);
    return response.data;
  },

  // Sell screen: which product / price / quantity a scanned variable barcode is.
  // Resolves to { matches: [...] } or throws 404 when nothing matches.
  async scan(code, outletId = null) {
    const params = { code, ...(outletId ? { outletId } : {}) };
    const response = await apiClient.get('/barcode-templates/scan', { params, noCache: true, silent: true });
    return response.data;
  },
};

export default barcodeTemplateService;
