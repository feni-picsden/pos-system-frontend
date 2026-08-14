import apiClient from './apiClient';

const resolveSuperAdminOutletId = () => {
  try {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isSuperAdmin = user?.isSuperAdmin === true || user?.hasAllPermission === true;
    if (!isSuperAdmin) return undefined;

    const selectedOutletId = localStorage.getItem('selectedOutletId');
    if (selectedOutletId === null || selectedOutletId === undefined || selectedOutletId === '') return null;
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

const buildQuery = (params = {}) => {
  const outletId = resolveSuperAdminOutletId();
  const merged = { ...params };
  if (outletId !== undefined) merged.outletId = outletId;

  const query = new URLSearchParams();
  Object.entries(merged).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  return query.toString();
};

const shelfTicketTemplateService = {
  // List templates (outlet-aware)
  getTemplates: async (params = {}) => {
    const response = await apiClient.get(`/shelf-ticket-templates?${buildQuery(params)}`);
    return response.data;
  },

  // Get single template
  getTemplate: async (id) => {
    const response = await apiClient.get(`/shelf-ticket-templates/${id}`);
    return response.data;
  },

  // Create template
  createTemplate: async (templateData) => {
    const response = await apiClient.post('/shelf-ticket-templates', withOutletContext(templateData));
    return response.data;
  },

  // Update template (full or partial)
  updateTemplate: async (id, templateData) => {
    const response = await apiClient.put(`/shelf-ticket-templates/${id}`, templateData);
    return response.data;
  },

  // Delete template
  deleteTemplate: async (id) => {
    const response = await apiClient.delete(`/shelf-ticket-templates/${id}`);
    return response.data;
  },

  // Duplicate/clone template
  duplicateTemplate: async (id, targetOutletId) => {
    const body = targetOutletId !== undefined ? { outletId: targetOutletId } : withOutletContext({});
    const response = await apiClient.post(`/shelf-ticket-templates/${id}/duplicate`, body);
    return response.data;
  },

  // Seed built-in default templates for this outlet (call once on first visit)
  seedDefaults: async () => {
    const response = await apiClient.post('/shelf-ticket-templates/seed-defaults', withOutletContext({}));
    return response.data;
  },
};

export default shelfTicketTemplateService;
