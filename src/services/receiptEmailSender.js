// One door for "email this receipt". Renders the receipt with the same component tree
// the screen and printer use, then posts the HTML — the backend's own generator does not
// understand reference-shape templates and mailed an empty body.
//
// Reference flow (Shopfront): the outlet's EMAIL receipt template is the mail body, and
// that template's Configure > "Receipt Attachments" (name + another receipt template,
// e.g. the A4 one) are rendered too and attached to the mail.
import receiptTemplateService from './receiptTemplateService';
import salesService from './salesService';
import { saleToReceiptData } from '../utils/saleToReceiptData';
import { buildReceiptEmailHtml } from '../utils/receiptEmailHtml';
import { isReferenceShape } from '../components/Receipt/ReferenceReceipt';
import { renderExpressions, buildReceiptContext } from '../utils/receiptExpressions';
import { DEFAULT_ATTACHMENT_NAME, toReferenceComponents } from '../utils/receiptTemplateShape';
import { htmlToPdfBase64 } from '../utils/receiptPdf';

// A template saved by the old editor keeps its components in the editor shape
// ({id, type, visible, properties}); the renderer only reads the reference shape
// ({type, style, value}). Convert on the fly — the same conversion the editor does
// on Save — so an Email/A4 template that was never re-saved still mails a body.
const normalizeTemplate = (template) => {
  if (!template) return null;
  const raw = template.config?.components || template.components || [];
  if (!Array.isArray(raw) || raw.length === 0) return template;
  if (isReferenceShape(raw)) return template;
  const components = toReferenceComponents(raw.filter((c) => c && c.visible !== false));
  return { ...template, config: { ...(template.config || {}), components } };
};
const componentsOf = (template) => template?.config?.components || template?.components || [];
// Only a reference-shape template can be rendered into a mail body / attachment.
const renderable = (template) => !!template && isReferenceShape(componentsOf(template));

/** The outlet's Email receipt template (carries the attachments list), if any. */
const fetchEmailTemplate = () => receiptTemplateService.getEmailDefault().then(normalizeTemplate).catch(() => null);

/**
 * The template the BODY is rendered from. The Email template when it renders; otherwise
 * the first renderable Sale template (wide A4/Email type preferred) — an Email template
 * still saved in the old component shape used to leave the mail empty.
 */
const resolveBodyTemplate = async (emailTemplate) => {
  if (renderable(emailTemplate)) return emailTemplate;
  const res = await receiptTemplateService.getTemplates({ for: 'Sale' }).catch(() => null);
  const list = (res?.templates || []).map(normalizeTemplate).filter(renderable);
  return list.find((t) => /a4|email/i.test(String(t.type || ''))) || list[0] || null;
};

/**
 * Configure > Receipt Attachments of the Email template, rendered as PDF files:
 * [{ name, pdfBase64 }] (falls back to { name, html } if the PDF can't be built).
 */
const renderAttachments = async (emailTemplate, data) => {
  const configured = emailTemplate?.config?.attachments;
  if (!Array.isArray(configured) || configured.length === 0) return [];
  const context = buildReceiptContext(data);
  const out = [];
  for (const att of configured) {
    if (!att?.receiptTemplateId) continue;
    try {
      const res = await receiptTemplateService.getTemplate(att.receiptTemplateId);
      const template = normalizeTemplate(res?.template || res);
      if (!renderable(template)) continue;
      // Name placeholders are the receipt ones ({outlet.name}, {invoiceNo}, ...).
      const name = renderExpressions(att.name || DEFAULT_ATTACHMENT_NAME, context).trim() || 'Receipt';
      const html = buildReceiptEmailHtml({ receiptData: data, template, title: name });
      if (!html) continue;
      const pdfBase64 = await htmlToPdfBase64(html).catch((error) => {
        console.error('[Receipt] PDF attachment failed, sending HTML instead', error);
        return null;
      });
      out.push(pdfBase64 ? { name, pdfBase64 } : { name, html });
    } catch (error) {
      console.error('[Receipt] Could not render attachment', att, error);
    }
  }
  return out;
};

/**
 * @param {object} params
 * @param {number} params.saleId
 * @param {string[]} params.receiverEmails
 * @param {string} [params.senderEmail]
 * @param {object} [params.sale]        full sale row, when the caller already has it
 * @param {object} [params.receiptData] already-shaped receipt data (sell screen)
 * @param {object} [params.template]    force a template instead of the resolved one
 */
export async function emailSaleReceipt({ saleId, receiverEmails, senderEmail, sale, receiptData, template }) {
  let html = null;
  let attachments = [];
  try {
    const data = receiptData || (sale ? saleToReceiptData(sale) : null);
    if (data) {
      const emailTemplate = template || (await fetchEmailTemplate());
      const bodyTemplate = template || (await resolveBodyTemplate(emailTemplate));
      html = buildReceiptEmailHtml({
        receiptData: data,
        template: bodyTemplate,
        title: `Receipt - ${data.transactionId || saleId}`,
      });
      attachments = await renderAttachments(emailTemplate, data);
    }
  } catch (error) {
    // Rendering must never block the send; the backend generator still runs server-side.
    console.error('[Receipt] Email render failed, falling back to server render:', error);
  }

  return salesService.emailReceipt(saleId, receiverEmails, senderEmail, html, attachments);
}

export default emailSaleReceipt;
