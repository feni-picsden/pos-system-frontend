import apiClient from './apiClient';
import { buildDefaultStatementConfig, DEFAULT_STATEMENT_SEED_VERSION } from '../utils/statementDefaults';

// Statement templates live in the database (/api/statement-templates) so every
// computer sees the same list. They used to be kept in each browser's
// localStorage; the first visit from such a browser moves them to the server.
// Shared by Setup > Statements, the statement editor, Customer Groups and the
// Balance & Payments statement viewer.

const LEGACY_KEY = 'statementTemplates';

// A template nobody has designed yet (no lastModified) follows the current
// default layout; one the user edited is left exactly as saved. Configure only
// stores email settings, which survive the refresh.
const isUntouched = (config) => !config || !config.lastModified;
const needsReseed = (config) => isUntouched(config) && Number(config?.seedVersion) !== DEFAULT_STATEMENT_SEED_VERSION;
const freshDefault = (config = {}) => ({
  ...buildDefaultStatementConfig(),
  seedVersion: DEFAULT_STATEMENT_SEED_VERSION,
  ...(config.email ? { email: config.email } : {}),
});

const importLegacyTemplates = async () => {
  let legacy;
  try {
    legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
  } catch (_) {
    legacy = [];
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return;
  const templates = legacy
    .filter((t) => t && t.name)
    .map((t) => ({
      legacyId: t.id,
      name: t.name,
      outletId: t.outletId ?? null,
      edited: Boolean(t.lastModified || t.config?.lastModified),
      config: t.config && t.config.components?.length ? t.config : freshDefault(t.config || {}),
    }));
  await apiClient.post('/statement-templates/import', { templates });
  // Kept under another key rather than deleted, in case anything needs recovering.
  localStorage.setItem(`${LEGACY_KEY}Imported`, JSON.stringify(legacy));
  localStorage.removeItem(LEGACY_KEY);
};

const loadTemplates = async () => {
  // A user without modify_statements cannot import; the local copy then waits
  // for someone who can.
  await importLegacyTemplates().catch(() => {});
  let { templates = [] } = (await apiClient.get('/statement-templates')).data || {};
  if (templates.some((t) => needsReseed(t.config))) {
    templates = await Promise.all(templates.map(async (t) => {
      if (!needsReseed(t.config)) return t;
      try {
        const { data } = await apiClient.put(`/statement-templates/${t.id}`, { config: freshDefault(t.config) });
        return data.template;
      } catch (_) {
        return { ...t, config: freshDefault(t.config) };
      }
    }));
  }
  // Reference ships one global default template named "Statement". The server
  // makes it at most once, however many pages ask at the same time.
  if (templates.length === 0) {
    try {
      const { data } = await apiClient.post('/statement-templates/default', { config: freshDefault() });
      templates = data.template ? [data.template] : [];
    } catch (_) {
      templates = [{ id: null, name: 'Statement', config: freshDefault() }];
    }
  }
  return { templates };
};

// Pages mount together (and twice under StrictMode): share one in-flight load
// so the import / default seed never runs twice.
let inFlight = null;

const statementTemplateService = {
  getTemplates: () => {
    if (!inFlight) inFlight = loadTemplates().finally(() => { inFlight = null; });
    return inFlight;
  },
  getTemplate: async (id) => (await apiClient.get(`/statement-templates/${id}`)).data,
  // outletId: a number, null for global, or left out to use the navbar outlet.
  createTemplate: async ({ name, outletId, config }) => {
    const body = { name, config: config || freshDefault() };
    if (outletId !== undefined) body.outletId = outletId;
    return (await apiClient.post('/statement-templates', body)).data;
  },
  cloneTemplate: async (template) => {
    const body = { name: `${template.name} (Copy)`, config: template.config || {}, outletId: template.outletId ?? null };
    return (await apiClient.post('/statement-templates', body)).data;
  },
  deleteTemplate: async (id) => (await apiClient.delete(`/statement-templates/${id}`)).data,
  getTemplateConfig: async (id) => {
    const { template } = (await apiClient.get(`/statement-templates/${id}`)).data;
    return { config: template?.config || {} };
  },
  updateTemplateConfig: async (id, config) => (await apiClient.put(`/statement-templates/${id}`, { config })).data,
};

export { statementTemplateService };
export default statementTemplateService;
