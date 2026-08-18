// One door for "email this receipt". Renders the receipt with the same component tree
// the screen and printer use, then posts the HTML — the backend's own generator does not
// understand reference-shape templates and mailed an empty body.
import receiptTemplateService from './receiptTemplateService';
import salesService from './salesService';
import { saleToReceiptData } from '../utils/saleToReceiptData';
import { buildReceiptEmailHtml } from '../utils/receiptEmailHtml';

/** Resolve the email template; falls back to the default Sale template. */
const resolveEmailTemplate = async () => {
  const emailTemplate = await receiptTemplateService.getEmailDefault().catch(() => null);
  if (emailTemplate) return emailTemplate;
  const res = await receiptTemplateService.getTemplates({ for: 'Sale' }).catch(() => null);
  return (res?.templates || [])[0] || null;
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
  try {
    const data = receiptData || (sale ? saleToReceiptData(sale) : null);
    if (data) {
      const tpl = template || (await resolveEmailTemplate());
      html = buildReceiptEmailHtml({
        receiptData: data,
        template: tpl,
        title: `Receipt - ${data.transactionId || saleId}`,
      });
    }
  } catch (error) {
    // Rendering must never block the send; the backend generator still runs server-side.
    console.error('[Receipt] Email render failed, falling back to server render:', error);
  }

  return salesService.emailReceipt(saleId, receiverEmails, senderEmail, html);
}

export default emailSaleReceipt;
