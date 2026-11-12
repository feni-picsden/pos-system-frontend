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
  // Reference idle screen: one full-screen slide show (logo / promotions)
  idle: {
    components: [
      createComponent('idle-slide-1', 'slideshow', 0, 0, 100, 100, {
        slides: [],
        fallbackText: 'Select slides for promotions',
        stretchToCover: true,
      }),
    ],
  },
  // Reference sale screen: table top-left, totals top-right, a small slide show
  // under the totals, and a wide slide show along the bottom.
  sale: {
    components: [
      // White table with black grid and text, green promotion lines
      createComponent('sale-table-1', 'sale-table', 0, 0, 70, 55, {
        showGrid: true,
        gridLineColor: '#000000',
        promotionColor: '#2ce56f',
        textColor: '#000000',
        backgroundColor: '#ffffff',
        footerTextColor: '#000000',
        footerBackgroundColor: '#ffffff',
        fontSize: 20,
      }),
      createComponent('sale-total-1', 'totals', 70, 0, 30, 20, {
        textColor: '#ffffff',
        promotionColor: '#2ce56f',
        backgroundColor: '#000000',
        fontSize: 24,
        bold: true,
      }),
      createComponent('sale-slide-2', 'slideshow', 70, 20, 30, 35, {
        slides: [],
        fallbackText: 'Edit slideshow',
        backgroundColor: '#ffffff',
      }),
      createComponent('sale-slide-1', 'slideshow', 0, 55, 100, 45, {
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
