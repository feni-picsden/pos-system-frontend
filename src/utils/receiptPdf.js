// Turn a rendered receipt (self-contained HTML document, see receiptEmailHtml) into a
// PDF for an email attachment. Reference attaches its receipt attachments as files the
// customer can open anywhere; a raw .html attachment shows Gmail users the markup.
//
// Rendered offscreen in the live document (fonts/styles resolved), rasterised with
// html2canvas and paged onto A4 with jsPDF — the same pair Balance.jsx uses for the
// statement download. Both libraries are lazy-loaded so the sell screen bundle stays put.

const A4 = { w: 210, h: 297 }; // mm

/**
 * @param {string} html  full HTML document (or fragment)
 * @param {object} [opts]
 * @param {number} [opts.widthPx=794] render width; 794px ≈ 210mm at 96dpi
 * @returns {Promise<string>} base64 PDF (no data: prefix)
 */
export async function htmlToPdfBase64(html, { widthPx = 794 } = {}) {
  if (!html || typeof document === 'undefined') return null;
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  // Body of the document only — the outer <html>/<head> can't be nested in a div.
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [])[1] || html;

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed', left: '-10000px', top: '0', width: `${widthPx}px`,
    background: '#fff', zIndex: '-1', pointerEvents: 'none',
  });
  host.innerHTML = body;
  document.body.appendChild(host);
  try {
    // Let images (logo) settle before rasterising.
    await Promise.all(Array.from(host.querySelectorAll('img')).map((img) => (
      img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
    )));
    const canvas = await html2canvas(host, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageHeightPx = Math.floor(canvas.width * (A4.h / A4.w)); // canvas px per A4 page
    const pages = Math.max(1, Math.ceil(canvas.height / pageHeightPx));
    for (let p = 0; p < pages; p += 1) {
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.min(pageHeightPx, canvas.height - p * pageHeightPx);
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, p * pageHeightPx, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
      if (p > 0) pdf.addPage();
      const hMm = (slice.height / canvas.width) * A4.w;
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, A4.w, hMm);
    }
    // data:application/pdf;base64,....
    return pdf.output('datauristring').split(',')[1] || null;
  } finally {
    host.remove();
  }
}

export default htmlToPdfBase64;
