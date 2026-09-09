import JsBarcode from 'jsbarcode';

const FORMAT_MAP = {
  CODE128: 'CODE128',
  EAN13: 'EAN13',
  EAN8: 'EAN8',
  CODE39: 'CODE39',
};

const normalizeFormat = (format) => FORMAT_MAP[format] || 'CODE128';

export const extractBarcodeValue = (input) => {
  if (input == null) return '';

  if (Array.isArray(input)) {
    for (const item of input) {
      const resolved = extractBarcodeValue(item);
      if (resolved) return resolved;
    }
    return '';
  }

  if (typeof input === 'object') {
    const candidateKeys = ['barcode', 'code', 'value', 'ean', 'number'];
    for (const key of candidateKeys) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        const resolved = extractBarcodeValue(input[key]);
        if (resolved) return resolved;
      }
    }
    return '';
  }

  const text = String(input).trim();
  if (!text) return '';

  // If multiple barcodes exist in a single string, use the first one.
  const first = text.split(/[\n,;|]/).map((s) => s.trim()).find(Boolean);
  return first || '';
};

export const normalizeBarcodeValue = (value, format = 'CODE128') => {
  const text = extractBarcodeValue(value);
  const normalizedFormat = normalizeFormat(format);

  // EAN is a fixed-width symbology. A longer code (GTIN-14, ITF-14, an in-house
  // code) is NOT an EAN, and truncating it would silently encode a DIFFERENT
  // product. Only hand the digits to the EAN encoder when the length is one it
  // actually accepts (12 = check digit computed, 13 = complete); otherwise keep
  // the original text so createBarcodeSvgMarkup falls back to CODE128 and prints
  // the real code.
  if (normalizedFormat === 'EAN13') {
    const digits = text.replace(/\D/g, '');
    return digits.length === 12 || digits.length === 13 ? digits : text;
  }
  if (normalizedFormat === 'EAN8') {
    const digits = text.replace(/\D/g, '');
    return digits.length === 7 || digits.length === 8 ? digits : text;
  }
  return text;
};

export const createBarcodeSvgMarkup = (value, options = {}) => {
  const {
    format = 'CODE128',
    showText = true,
  } = options;

  const normalizedFormat = normalizeFormat(format);
  const sourceValue = extractBarcodeValue(value);
  const normalizedValue = normalizeBarcodeValue(sourceValue, normalizedFormat);
  if (!normalizedValue) return '';

  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const baseOptions = {
    format: normalizedFormat,
    displayValue: showText,
    margin: 0,
    background: '#ffffff',
    lineColor: '#000000',
    width: 2,
    height: showText ? 50 : 62,
    fontSize: 12,
    textMargin: 2,
  };

  try {
    JsBarcode(svgNode, normalizedValue, baseOptions);
  } catch {
    // Fallback to CODE128 when value is invalid for strict formats like EAN.
    try {
      JsBarcode(svgNode, sourceValue, { ...baseOptions, format: 'CODE128' });
    } catch {
      return '';
    }
  }

  svgNode.setAttribute('width', '100%');
  svgNode.setAttribute('height', '100%');
  svgNode.style.width = '100%';
  svgNode.style.height = '100%';
  svgNode.style.display = 'block';

  return svgNode.outerHTML;
};
