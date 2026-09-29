import React from 'react';
import { createBarcodeSvgMarkup, extractBarcodeValue } from './barcodeSvg';

// ------- Replace variables with product data -------

// Multi-buy price points, after the reference's DesignPro fields (Everyday Tickets):
//   {qty2} {price2}     second price point and its quantity   (PRICE_IND1 / LBLPRICE1)
//   {qty3} {price3}     third price point                     (PRICE_IND2 / LBLPRICE2)
//   {caseQty} {casePrice}  carton price at the case quantity  (PRICE_INDC / LBLPRICEC)
//   {unitPrice2} {unitPriceCase}  per-unit rate of those      (PRICET / RATE_INDC)
//   {multiBuy}          every pack price in one line, "6 for $36.00 · 24 for $120.00"
// A point the product does not have renders blank, never "0.00".
export const replaceVars = (content = '', data = {}) =>
  content
    .replace(/\{productName\}/g, data.productName || data.name || '')
    .replace(/\{price\}/g, data.price || '')
    .replace(/\{salePrice\}/g, data.salePrice || '')
    .replace(/\{qty2\}/g, data.qty2 || '')
    .replace(/\{price2\}/g, data.price2 || '')
    .replace(/\{qty3\}/g, data.qty3 || '')
    .replace(/\{price3\}/g, data.price3 || '')
    .replace(/\{caseQty\}/g, data.caseQty || '')
    .replace(/\{casePrice\}/g, data.casePrice || '')
    .replace(/\{unitPrice2\}/g, data.unitPrice2 || '')
    .replace(/\{unitPriceCase\}/g, data.unitPriceCase || '')
    .replace(/\{multiBuy\}/g, data.multiBuy || '')
    .replace(/\{barcode\}/g, extractBarcodeValue(data.barcode) || '')
    .replace(/\{category\}/g, data.category?.name || data.category || '')
    .replace(/\{brand\}/g, data.brand || '')
    .replace(/\{sku\}/g, data.sku || data.code || '')
    .replace(/\{description\}/g, data.description || '')
    .replace(/\{unit\}/g, data.unit || 'EA');

// Multi-buy price points from a ticket's price breaks ({quantity, price}[]): the
// second and third tiers above the single, and the carton (the tier at the case
// quantity). Missing tiers stay blank — the template prints nothing for them.
const money = (n) => (Number.isFinite(Number(n)) ? Number(n).toFixed(2) : '');
export const multiBuyData = (input) => {
  const breaks = (Array.isArray(input?.priceBreaks) ? input.priceBreaks : [])
    .map((b) => ({ quantity: Number(b?.quantity) || 0, price: Number(b?.price) }))
    .filter((b) => b.quantity > 1 && Number.isFinite(b.price))
    .sort((a, b) => a.quantity - b.quantity);
  const caseQty = Number(input?.caseQuantity) || 0;
  const second = breaks[0];
  const third = breaks[1];
  const carton = caseQty > 1 ? breaks.find((b) => b.quantity === caseQty) : null;
  const rate = (tier) => (tier ? money(tier.price / tier.quantity) : '');
  return {
    qty2: second ? String(second.quantity) : '',
    price2: second ? money(second.price) : '',
    qty3: third ? String(third.quantity) : '',
    price3: third ? money(third.price) : '',
    caseQty: caseQty > 1 ? String(caseQty) : '',
    casePrice: carton ? money(carton.price) : '',
    unitPrice2: rate(second),
    unitPriceCase: rate(carton),
    multiBuy: breaks.map((b) => `${b.quantity} for $${money(b.price)}`).join(' · '),
  };
};

// The figure a Price element shows, by the token in its content. The regular
// price falls back to 0.00 (a ticket always has one); a pack price the product
// lacks stays blank so the prefix/suffix are not printed around nothing.
export const priceValueFor = (el, data = {}) => {
  const content = el?.content || '';
  const pick = [
    ['{salePrice}', data.salePrice],
    ['{price2}', data.price2],
    ['{price3}', data.price3],
    ['{casePrice}', data.casePrice],
  ].find(([token]) => content.includes(token));
  if (pick) return pick[1] ? { value: pick[1], blank: false } : { value: '', blank: true };
  return { value: data.price || '0.00', blank: false };
};

// ------- Render a single template element as React nodes (mm units) -------

export const renderPrintElement = (el, data = {}) => {
  const rv = (c) => replaceVars(c, data);
  const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

  switch (el.type) {
    case 'text':
      return (
        <div style={{
          width: '100%', height: '100%', overflow: 'hidden', boxSizing: 'border-box',
          fontSize: `${el.fontSize || 10}pt`, fontFamily: el.fontFamily || 'Arial',
          fontWeight: el.fontWeight || 'normal', fontStyle: el.fontStyle || 'normal',
          textDecoration: el.textDecoration || 'none', color: el.color || '#000',
          textAlign: el.textAlign || 'left',
          backgroundColor: el.backgroundColor !== 'transparent' ? (el.backgroundColor || '') : '',
          display: 'flex', alignItems: 'center', padding: '0 1mm', lineHeight: 1.2, wordBreak: 'break-word',
        }}>
          {rv(el.content)}
        </div>
      );

    case 'price': {
      const { value: priceVal, blank } = priceValueFor(el, data);
      if (blank) return <div style={{ width: '100%', height: '100%' }} />;
      return (
        <div style={{
          width: '100%', height: '100%', overflow: 'hidden', boxSizing: 'border-box',
          fontSize: `${el.fontSize || 20}pt`, fontFamily: el.fontFamily || 'Arial',
          fontWeight: el.fontWeight || 'bold', fontStyle: el.fontStyle || 'normal',
          color: el.color || '#000', display: 'flex', alignItems: 'center',
          justifyContent: justifyMap[el.textAlign] || 'flex-start', padding: '0 1mm', lineHeight: 1,
        }}>
          {(el.prefix || '') + priceVal + (el.suffix || '')}
        </div>
      );
    }

    case 'barcode': {
      const barcodeVal = extractBarcodeValue(data[el.field]) || extractBarcodeValue(data.barcode) || '';
      const markup = createBarcodeSvgMarkup(barcodeVal, {
        format: el.format,
        showText: el.showText !== false,
      });
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#fff' }}>
          <div
            style={{ width: '100%', height: '100%' }}
            dangerouslySetInnerHTML={{ __html: markup }}
          />
        </div>
      );
    }

    case 'image':
      return el.src
        ? <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain', display: 'block' }} />
        : null;

    case 'shape':
      return (
        <div style={{
          width: '100%', height: '100%', boxSizing: 'border-box',
          backgroundColor: el.backgroundColor || 'transparent',
          border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000'}` : 'none',
          borderRadius: el.borderRadius ? `${el.borderRadius}px` : 0,
        }} />
      );

    case 'line':
      return <div style={{ width: '100%', height: '100%', backgroundColor: el.color || '#000' }} />;

    default:
      return null;
  }
};


const elToHtml = (el, data) => {
  const rv = (c = '') => replaceVars(c, data);
  const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };

  let inner = '';
  if (el.type === 'text') {
    const bg = el.backgroundColor && el.backgroundColor !== 'transparent' ? `background-color:${el.backgroundColor};` : '';
    inner = `<div style="width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-size:${el.fontSize || 10}pt;font-family:${el.fontFamily || 'Arial'};font-weight:${el.fontWeight || 'normal'};font-style:${el.fontStyle || 'normal'};text-decoration:${el.textDecoration || 'none'};color:${el.color || '#000'};text-align:${el.textAlign || 'left'};${bg}display:flex;align-items:center;padding:0 1mm;line-height:1.2;word-break:break-word;">${rv(el.content)}</div>`;
  } else if (el.type === 'price') {
    const { value: val, blank } = priceValueFor(el, data);
    inner = blank
      ? ''
      : `<div style="width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-size:${el.fontSize || 20}pt;font-family:${el.fontFamily || 'Arial'};font-weight:${el.fontWeight || 'bold'};font-style:${el.fontStyle || 'normal'};color:${el.color || '#000'};display:flex;align-items:center;justify-content:${justifyMap[el.textAlign] || 'flex-start'};padding:0 1mm;line-height:1;">${(el.prefix || '') + val + (el.suffix || '')}</div>`;
  } else if (el.type === 'barcode') {
    const bv = extractBarcodeValue(data[el.field]) || extractBarcodeValue(data.barcode) || '';
    const markup = createBarcodeSvgMarkup(bv, {
      format: el.format,
      showText: el.showText !== false,
    });
    inner = `<div style="width:100%;height:100%;overflow:hidden;background:#fff;">${markup}</div>`;
  } else if (el.type === 'shape') {
    const shapeRadius = el.shape === 'circle' ? '50%' : (el.borderRadius ? `${el.borderRadius}px` : '');
    inner = `<div style="width:100%;height:100%;box-sizing:border-box;background-color:${el.backgroundColor || 'transparent'};${el.borderWidth ? `border:${el.borderWidth}px solid ${el.borderColor || '#000'};` : ''}${shapeRadius ? `border-radius:${shapeRadius};` : ''}"></div>`;
  } else if (el.type === 'line') {
    inner = `<div style="width:100%;height:100%;background-color:${el.color || '#000'};"></div>`;
  } else if (el.type === 'image' && el.src) {
    inner = `<img src="${el.src}" style="width:100%;height:100%;object-fit:${el.fit || 'contain'};display:block;" />`;
  }

  return `<div style="position:absolute;left:${el.x}mm;top:${el.y}mm;width:${el.width}mm;height:${el.height}mm;overflow:hidden;">${inner}</div>`;
};

export const handlePrintPreview = (template, products) => {
  const ticketsHtml = products.map(product => {
    const elementsHtml = (template.elements || []).map(el => elToHtml(el, product)).join('');
    return `<div style="position:relative;width:${template.width}mm;height:${template.height}mm;background-color:${template.backgroundColor || '#fff'};overflow:hidden;display:inline-block;margin:0;flex-shrink:0;break-inside:avoid;page-break-inside:avoid;">${elementsHtml}</div>`;
  }).join('');

  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Shelf Tickets — ${template.name}</title>
  <style>
    @page { margin: 10mm; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; }
    .tickets-wrap { display: flex; flex-wrap: wrap; gap: 3mm; padding: 5mm; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
  <div class="tickets-wrap">${ticketsHtml}</div>
</body>
</html>`;

  // Use an off-screen iframe so the browser print dialog opens directly
  // without navigating to a preview tab/window.
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const cleanup = () => {
    try {
      if (iframe && iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    } catch {
      // no-op
    }
  };

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(printHtml);
  doc.close();

  const doPrint = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }

    // Ensure render is complete before opening dialog
    setTimeout(() => {
      win.focus();
      win.print();
    }, 100);

    // Cleanup after printing (or if user cancels)
    win.onafterprint = cleanup;
    setTimeout(cleanup, 60000);
  };

  if (doc.readyState === 'complete') {
    doPrint();
  } else {
    iframe.onload = doPrint;
  }
};
