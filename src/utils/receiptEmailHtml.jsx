// Render the receipt to a self-contained HTML document for EMAIL.
//
// The backend used to build emailed receipts with its own generator
// (lib/receiptGenerator.js), which never learned the reference component shape
// ({type, style, value}) — every component came out "unknown", the body rendered
// empty and the recipient saw nothing but the <title>. Emails now render through the
// SAME component tree as the screen and the printer, and the HTML is posted to the
// backend, which only delivers it.
//
// ReferenceReceipt is plain divs/tables with INLINE styles, so the document needs no
// stylesheet — which is what mail clients want anyway (Gmail strips much of <style>).
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReferenceReceipt, { isReferenceShape } from '../components/Receipt/ReferenceReceipt';
import { buildReferenceData } from './referenceReceiptData';
import { paperSettings } from './receiptTemplateShape';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/**
 * @returns {string|null} full HTML document, or null when the template is not in the
 * reference shape — the caller then lets the backend generator handle it.
 */
export function buildReceiptEmailHtml({ receiptData, template, title = 'Receipt' }) {
  if (!receiptData) return null;
  const components = template?.config?.components || template?.components || [];
  if (!isReferenceShape(components)) return null;

  // paperSettings returns the paper width plus the per-side padding OBJECT the
  // Configure dialog writes — same values the on-screen/print wrapper applies.
  const { width, padding: pad } = paperSettings(template);
  const padCss = ['top', 'right', 'bottom', 'left']
    .map((side) => `${Number(pad?.[side]) || 0}px`)
    .join(' ');
  const markup = renderToStaticMarkup(
    <ReferenceReceipt components={components} data={buildReferenceData(receiptData)} />
  );

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:16px;background:#f5f5f5;">
    <div style="max-width:${width};width:100%;margin:0 auto;background:#fff;color:#000;padding:${padCss};box-sizing:border-box;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:12px;line-height:1.35;">
      ${markup}
    </div>
  </body>
</html>`;
}

export default buildReceiptEmailHtml;
