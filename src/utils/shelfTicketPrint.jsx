import React from 'react';
import { createBarcodeSvgMarkup, extractBarcodeValue } from './barcodeSvg';

// ------- Replace variables with product data -------

export const replaceVars = (content = '', data = {}) =>
  content
    .replace(/\{productName\}/g, data.productName || data.name || '')
    .replace(/\{price\}/g, data.price || '')
    .replace(/\{salePrice\}/g, data.salePrice || '')
    .replace(/\{barcode\}/g, extractBarcodeValue(data.barcode) || '')
    .replace(/\{category\}/g, data.category?.name || data.category || '')
    .replace(/\{brand\}/g, data.brand || '')
    .replace(/\{sku\}/g, data.sku || data.code || '')
    .replace(/\{description\}/g, data.description || '')
    .replace(/\{unit\}/g, data.unit || 'EA');

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
      const priceVal = (el.content || '').includes('{salePrice}') ? data.salePrice : data.price;
      return (
        <div style={{
          width: '100%', height: '100%', overflow: 'hidden', boxSizing: 'border-box',
          fontSize: `${el.fontSize || 20}pt`, fontFamily: el.fontFamily || 'Arial',
          fontWeight: el.fontWeight || 'bold', fontStyle: el.fontStyle || 'normal',
          color: el.color || '#000', display: 'flex', alignItems: 'center',
          justifyContent: justifyMap[el.textAlign] || 'flex-start', padding: '0 1mm', lineHeight: 1,
        }}>
          {(el.prefix || '') + (priceVal || '0.00') + (el.suffix || '')}
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
    const val = (el.content || '').includes('{salePrice}') ? data.salePrice : data.price;
    inner = `<div style="width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-size:${el.fontSize || 20}pt;font-family:${el.fontFamily || 'Arial'};font-weight:${el.fontWeight || 'bold'};font-style:${el.fontStyle || 'normal'};color:${el.color || '#000'};display:flex;align-items:center;justify-content:${justifyMap[el.textAlign] || 'flex-start'};padding:0 1mm;line-height:1;">${(el.prefix || '') + (val || '0.00') + (el.suffix || '')}</div>`;
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
