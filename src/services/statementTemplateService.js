import { buildDefaultStatementConfig } from '../utils/statementDefaults';

// Statement templates are stored client-side in localStorage (the reference keeps them
// out of the receipt-templates API). Shared by Setup > Statement Templates and any consumer
// that needs to assign a statement template (e.g. Customer Groups).
const statementTemplateService = {
  getTemplates: async () => {
    // ponytail: one-time purge of pre-parity audit scratch templates; marker keeps it idempotent.
    if (!localStorage.getItem('statementTemplatesSeeded')) {
      localStorage.removeItem('statementTemplates');
      localStorage.setItem('statementTemplatesSeeded', '1');
    }
    const stored = localStorage.getItem('statementTemplates');
    const templates = stored ? JSON.parse(stored) : [];
    // ponytail: reference ships one default template named "Statement"; seed it once when empty.
    if (templates.length === 0) {
      templates.push({
        id: Date.now(),
        name: 'Statement',
        createdAt: new Date().toISOString(),
        config: buildDefaultStatementConfig(),
      });
      localStorage.setItem('statementTemplates', JSON.stringify(templates));
    }
    return { templates };
  },
  createTemplate: async (data) => {
    const newTemplate = {
      id: Date.now(),
      ...data,
      config: data.config || buildDefaultStatementConfig()
    };
    const stored = localStorage.getItem('statementTemplates');
    const templates = stored ? JSON.parse(stored) : [];
    templates.push(newTemplate);
    localStorage.setItem('statementTemplates', JSON.stringify(templates));
    return { template: newTemplate };
  },
  deleteTemplate: async (id) => {
    const stored = localStorage.getItem('statementTemplates');
    if (stored) {
      const templates = JSON.parse(stored).filter(t => t.id !== id);
      localStorage.setItem('statementTemplates', JSON.stringify(templates));
    }
    return { success: true };
  },
  getTemplateConfig: async (id) => {
    const stored = localStorage.getItem('statementTemplates');
    const templates = stored ? JSON.parse(stored) : [];
    const template = templates.find(t => t.id === id);
    return { config: (template && template.config) || {} };
  },
  updateTemplateConfig: async (id, config) => {
    const stored = localStorage.getItem('statementTemplates');
    const templates = stored ? JSON.parse(stored) : [];
    const index = templates.findIndex(t => t.id === id);
    if (index !== -1) {
      templates[index] = { ...templates[index], config, lastModified: new Date().toISOString() };
      localStorage.setItem('statementTemplates', JSON.stringify(templates));
    }
    return { success: true };
  },
};

export { statementTemplateService };
export default statementTemplateService;
