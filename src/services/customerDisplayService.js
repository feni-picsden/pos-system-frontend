import apiClient from './apiClient';

const resolveSuperAdminOutletId = () => {
  try {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isSuperAdmin = user?.isSuperAdmin === true || user?.hasAllPermission === true;
    if (!isSuperAdmin) return undefined;

    const selectedOutletId = localStorage.getItem('selectedOutletId');
    if (selectedOutletId === null || selectedOutletId === undefined || selectedOutletId === '') {
      return null;
    }
    const parsed = Number.parseInt(selectedOutletId, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return undefined;
  }
};

const withOutletContext = (data = {}) => {
  const outletId = resolveSuperAdminOutletId();
  if (outletId === undefined) return data;
  return { ...data, outletId };
};

const customerDisplayService = {
  async listTemplates(outletId) {
    const response = await apiClient.get('/customer-display/templates', {
      params: outletId ? { outletId } : undefined,
    });
    return response.data?.templates || [];
  },

  async createTemplate(template) {
    const response = await apiClient.post(
      '/customer-display/templates',
      withOutletContext(template)
    );
    return response.data?.template;
  },

  async updateTemplate(templateId, template) {
    const response = await apiClient.put(`/customer-display/templates/${templateId}`, template);
    return response.data?.template;
  },

  async deleteTemplate(templateId) {
    await apiClient.delete(`/customer-display/templates/${templateId}`);
  },

  async getRegisterConfig(registerId) {
    const response = await apiClient.get(`/customer-display/register/${registerId}/config`, {
      silent: true,
    });
    return response.data?.config || null;
  },

  async updateRegisterConfig(registerId, config) {
    const response = await apiClient.put(`/customer-display/register/${registerId}/config`, config);
    return response.data?.config || null;
  },

  async getRegisterState(registerId) {
    const response = await apiClient.get(`/customer-display/register/${registerId}/state`);
    return response.data || {};
  },

  async updateRegisterState(registerId, mode, payload) {
    const response = await apiClient.put(
      `/customer-display/register/${registerId}/state`,
      { mode, payload },
      { silent: true }
    );
    return response.data?.state || null;
  },
};

export default customerDisplayService;
