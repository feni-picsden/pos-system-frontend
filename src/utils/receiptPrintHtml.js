// Build the print document for a receipt. Sizes the page to the template's paper
// (thermal width for a Normal receipt, A4 for the wide types), forces a white
// background and full-width fill, and strips the on-screen card chrome (grey Paper
// bg, rounded corners, 300px cap, shadow) — so the printed receipt fills the paper
// instead of sitting as a small grey card in the corner of a default A4 sheet.
//
// Both print paths (SaleKeyPage sale receipt + PrintReceiptDialog reprint) route
// through here so the printed output is identical and correctly sized.
import { isWideTemplate, paperWidthMm } from './receiptTemplateShape.js';

export function buildReceiptPrintHtml({ markup, headStyles = '', template, title = 'Receipt' }) {
  // An explicit Configure > Receipt Width is the paper: without this the page stayed
  // 80mm/A4 while ReceiptRenderer emitted a narrower box, printing a centred strip.
  const explicitMm = paperWidthMm(template);
  const isWide = !explicitMm && isWideTemplate(template);
  // Design width in mm: the editor stores canvas.width; fall back to 80mm thermal
  // for a Normal receipt, 210mm for the wide (A4/Email) layouts.
  const widthMm = explicitMm || Number(template?.config?.canvas?.width) || (isWide ? 210 : 80);
  const pageSize = isWide ? 'A4' : `${widthMm}mm auto`;
  const pageMargin = isWide ? '10mm' : '0';
  const bodyWidth = isWide ? 'auto' : `${widthMm}mm`;
  const paperPad = isWide ? '8mm' : '2mm';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    ${headStyles}
    <style>
      @page { size: ${pageSize}; margin: ${pageMargin}; }
      html, body { margin: 0; padding: 0; background: #fff; }
      body { width: ${bodyWidth}; }
      /* Fill the paper, white, no on-screen card chrome at print time. */
      .MuiPaper-root {
        background: #fff !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        max-width: none !important;
        width: 100% !important;
        margin: 0 !important;
        padding: ${paperPad} !important;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>${markup}</body>
</html>`;
}
