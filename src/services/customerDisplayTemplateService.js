import customerDisplayService from './customerDisplayService';
import { normalizeCustomerDisplayTemplate } from '../utils/customerDisplayDefaults';

const customerDisplayTemplateService = {
  async listTemplates(outletId) {
    try {
      const templates = await customerDisplayService.listTemplates(outletId);
      if (!Array.isArray(templates) || templates.length === 0) {
        return [];
      }
      return templates.map((template) => {
        const rawId = template.id;
        const numericId = Number(rawId);
        const id =
          rawId != null && rawId !== '' && Number.isFinite(numericId)
            ? numericId
            : rawId;
        return normalizeCustomerDisplayTemplate({ ...template, id });
      });
    } catch (error) {
      console.error('customerDisplayTemplateService.listTemplates', error);
      return [];
    }
  },

  async upsertTemplate(template) {
    const normalized = normalizeCustomerDisplayTemplate(template);
    const payload = {
      name: normalized.name,
      isActive: normalized.isActive !== false,
      defaultTextColor: normalized.defaultTextColor,
      defaultBackgroundColor: normalized.defaultBackgroundColor,
      idleLayout: normalized.idle,
      saleLayout: normalized.sale,
    };
    const idNum = Number(template.id);
    const shouldUpdate =
      template.id != null &&
      template.id !== '' &&
      Number.isFinite(idNum) &&
      idNum > 0;

    let savedId = idNum;
    if (shouldUpdate) {
      await customerDisplayService.updateTemplate(idNum, payload);
    } else {
      const created = await customerDisplayService.createTemplate({
        ...payload,
        name: payload.name || 'Customer Display',
      });
      const createdNum = Number(created?.id);
      savedId = Number.isFinite(createdNum) ? createdNum : created?.id;
    }
    const templates = await this.listTemplates();
    return { savedId, templates };
  },

  async removeTemplate(templateId) {
    await customerDisplayService.deleteTemplate(templateId);
    return this.listTemplates();
  },

  async cloneTemplate(templateId) {
    const templates = await this.listTemplates();
    const source = templates.find((item) => item.id === templateId);
    if (!source) return templates;

    const cloned = {
      ...source,
      id: `customer-display-${Date.now()}`,
      name: `${source.name} Copy`,
    };
    await customerDisplayService.createTemplate({
      ...cloned,
      id: undefined,
      idleLayout: cloned.idle,
      saleLayout: cloned.sale,
    });
    return this.listTemplates();
  },
};

export default customerDisplayTemplateService;
