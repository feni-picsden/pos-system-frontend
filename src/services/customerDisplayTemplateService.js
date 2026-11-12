import customerDisplayService from './customerDisplayService';
import { normalizeCustomerDisplayTemplate } from '../utils/customerDisplayDefaults';

const normalizeId = (template) => {
  const rawId = template.id;
  const numericId = Number(rawId);
  const id =
    rawId != null && rawId !== '' && Number.isFinite(numericId)
      ? numericId
      : rawId;
  return normalizeCustomerDisplayTemplate({ ...template, id });
};

const toPayload = (template) => {
  const normalized = normalizeCustomerDisplayTemplate(template);
  return {
    name: String(normalized.name || '').trim(),
    isActive: normalized.isActive !== false,
    defaultTextColor: normalized.defaultTextColor,
    defaultBackgroundColor: normalized.defaultBackgroundColor,
    idleLayout: normalized.idle,
    saleLayout: normalized.sale,
  };
};

const customerDisplayTemplateService = {
  async listTemplates(outletId) {
    try {
      const templates = await customerDisplayService.listTemplates(outletId);
      if (!Array.isArray(templates) || templates.length === 0) {
        return [];
      }
      return templates.map(normalizeId);
    } catch (error) {
      console.error('customerDisplayTemplateService.listTemplates', error);
      return [];
    }
  },

  // One template by id (404 -> null). Errors other than 404 propagate.
  async getTemplate(templateId) {
    try {
      const template = await customerDisplayService.getTemplate(templateId);
      return template ? normalizeId(template) : null;
    } catch (error) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  },

  async upsertTemplate(template) {
    const payload = toPayload(template);
    const idNum = Number(template.id);
    const shouldUpdate =
      template.id != null &&
      template.id !== '' &&
      Number.isFinite(idNum) &&
      idNum > 0;

    let savedId = idNum;
    let saved = null;
    if (shouldUpdate) {
      saved = await customerDisplayService.updateTemplate(idNum, payload);
    } else {
      saved = await customerDisplayService.createTemplate({
        ...payload,
        name: payload.name || 'Customer Display',
      });
      const createdNum = Number(saved?.id);
      savedId = Number.isFinite(createdNum) ? createdNum : saved?.id;
    }
    const templates = await this.listTemplates();
    return { savedId, template: saved ? normalizeId(saved) : null, templates };
  },

  async removeTemplate(templateId) {
    await customerDisplayService.deleteTemplate(templateId);
    return this.listTemplates();
  },

  // Reference "Confirm Clone": the copy takes the name the user typed
  // (prefilled "<name> - Clone"). Fresh copy from the server so the clone gets
  // the latest saved design.
  async cloneTemplate(templateId, name) {
    const source =
      (await this.getTemplate(templateId)) ||
      (await this.listTemplates()).find((item) => String(item.id) === String(templateId));
    if (!source) throw new Error('Customer display template not found');

    const cloneName = String(name || `${source.name} - Clone`).trim();
    const created = await customerDisplayService.createTemplate({
      ...toPayload(source),
      name: cloneName,
    });
    return created ? normalizeId(created) : null;
  },
};

export default customerDisplayTemplateService;
