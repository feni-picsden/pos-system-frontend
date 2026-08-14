export const CUSTOMER_DISPLAY_SETTINGS_KEY = 'customer_display_templates';

const createComponent = (id, type, x, y, w, h, settings = {}) => ({
  id,
  type,
  x,
  y,
  w,
  h,
  zIndex: 1,
  settings
});

export const createDefaultCustomerDisplayTemplate = () => ({
  id: `customer-display-${Date.now()}`,
  name: 'Customer Display',
  defaultTextColor: '#ffffff',
  defaultBackgroundColor: '#000000',
  idle: {
    components: [
      createComponent('idle-slide-1', 'slideshow', 5, 8, 45, 70, {
        slides: [],
        fallbackText: 'Select slides for promotions',
      }),
      createComponent('idle-text-1', 'text', 52, 8, 43, 18, {
        text: 'Welcome to our store',
        color: '#ffffff',
        fontSize: 30,
      }),
      createComponent('idle-image-1', 'image', 52, 30, 43, 48, {
        src: '',
        fallbackText: 'Select to Add Image',
      }),
    ],
  },
  sale: {
    components: [
      createComponent('sale-table-1', 'sale-table', 0, 0, 72, 58, {
        showGrid: true,
        promotionColor: '#2ce56f',
        textColor: '#ffffff',
        backgroundColor: '#000000',
      }),
      createComponent('sale-total-1', 'totals', 72, 0, 28, 28, {
        textColor: '#ffffff',
        savingsColor: '#2ce56f',
        backgroundColor: '#000000',
      }),
      // {{customerName}} is substituted from the attached sale customer by CustomerDisplayRenderer.
      createComponent('sale-customer-1', 'text', 72, 28, 28, 12, {
        text: '{{customerName}}',
        color: '#ffffff',
        fontSize: 26,
      }),
      createComponent('sale-slide-1', 'slideshow', 0, 58, 100, 42, {
        slides: [],
        fallbackText: 'Edit slideshow',
      }),
    ],
  },
});

const parseLayoutField = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value;
  return null;
};

export const normalizeCustomerDisplayTemplate = (template) => {
  const safeTemplate = template || {};
  const rest = { ...safeTemplate };
  delete rest.idleLayout;
  delete rest.saleLayout;
  delete rest.idle;
  delete rest.sale;

  const idleSource = Object.prototype.hasOwnProperty.call(safeTemplate, 'idle')
    ? safeTemplate.idle
    : safeTemplate.idleLayout;
  const saleSource = Object.prototype.hasOwnProperty.call(safeTemplate, 'sale')
    ? safeTemplate.sale
    : safeTemplate.saleLayout;

  const idleParsed = parseLayoutField(idleSource) || null;
  const saleParsed = parseLayoutField(saleSource) || null;

  const baseDefaults = createDefaultCustomerDisplayTemplate();

  const idleComponents = Array.isArray(idleParsed?.components)
    ? idleParsed.components.map((c) => (c && typeof c === 'object' ? { ...c } : c))
    : [];
  const saleComponents = Array.isArray(saleParsed?.components)
    ? saleParsed.components.map((c) => (c && typeof c === 'object' ? { ...c } : c))
    : [];

  return {
    ...baseDefaults,
    ...rest,
    idle: {
      ...(idleParsed && typeof idleParsed === 'object' ? idleParsed : {}),
      components: idleComponents,
    },
    sale: {
      ...(saleParsed && typeof saleParsed === 'object' ? saleParsed : {}),
      components: saleComponents,
    },
  };
};
