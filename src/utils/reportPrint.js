// Reference report print (Shopfront "Print" on every report page):
//   <store name>            bold, centred
//   <Report Type> by <By>   bold, centred
//   dd/MM/yyyy HH:mm:ss - dd/MM/yyyy HH:mm:ss
//   table: black rule above/below the header, no fills, small centred cells,
//   Name column left; total row under a closing rule.
// Shared by Sales / Inventory / Transfers / Purchase / Actions and the query editor.
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stamp = (d) => format(d, 'dd/MM/yyyy HH:mm:ss');

// "Premix King Portland & Ararat": every outlet when All Outlets is active,
// otherwise the navbar outlet.
export const reportPrintTitle = (outlets = [], globalMode = false, currentOutletId = null) => {
  const names = (outlets || []).map((o) => o?.name).filter(Boolean);
  if (globalMode || currentOutletId == null) return names.join(' & ');
  const cur = (outlets || []).find((o) => String(o.id) === String(currentOutletId));
  return cur?.name || names.join(' & ');
};

// Date and Time block as printed: explicit start - end even for a preset.
export const reportPrintRange = (dateRange) => {
  if (!dateRange) return '';
  const { startDate, endDate, preset } = dateRange;
  const now = new Date();
  let s = startDate instanceof Date ? startDate : startDate ? new Date(startDate) : null;
  let e = endDate instanceof Date ? endDate : endDate ? new Date(endDate) : null;
  const usePreset = preset && preset !== 'custom';
  if (usePreset || !s || !e) {
    switch (preset) {
      case 'yesterday': s = startOfDay(subDays(now, 1)); e = endOfDay(subDays(now, 1)); break;
      case 'this_week': case 'thisWeek': case 'week': s = startOfWeek(now, { weekStartsOn: 1 }); e = endOfWeek(now, { weekStartsOn: 1 }); break;
      case 'last_week': case 'lastWeek': s = startOfWeek(subDays(now, 7), { weekStartsOn: 1 }); e = endOfWeek(subDays(now, 7), { weekStartsOn: 1 }); break;
      case 'this_month': case 'thisMonth': case 'month': s = startOfMonth(now); e = endOfMonth(now); break;
      case 'last_month': case 'lastMonth': { const m = subDays(startOfMonth(now), 1); s = startOfMonth(m); e = endOfMonth(m); break; }
      case 'this_year': case 'thisYear': case 'year': s = startOfYear(now); e = endOfYear(now); break;
      case 'last_7_days': case 'last7days': s = startOfDay(subDays(now, 6)); e = endOfDay(now); break;
      case 'last_30_days': case 'last30days': s = startOfDay(subDays(now, 29)); e = endOfDay(now); break;
      case 'today': default:
        if (!s || !e || preset === 'today') { s = startOfDay(now); e = endOfDay(now); }
    }
  }
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  return `${stamp(s)} - ${stamp(e)}`;
};

// headers: [{ label, align? }]  rows: [{ cells: [...], indent?: bool, bold?: bool }]
// totals: [...] (same length as headers) — omitted when null.
export const printReportTable = ({ title = '', subtitle = '', range = '', headers = [], rows = [], totals = null }) => {
  const th = headers.map((h) => `<th style="text-align:${h.align || 'center'}">${esc(h.label)}</th>`).join('');
  const tr = rows.map((r) => `<tr>${(r.cells || []).map((c, i) => `<td style="text-align:${headers[i]?.align || 'center'}${i === 0 && r.indent ? ';padding-left:18px' : ''}${r.bold ? ';font-weight:700' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('');
  const tot = totals ? `<tr class="total">${totals.map((c, i) => `<td style="text-align:${headers[i]?.align || 'center'}">${esc(c)}</td>`).join('')}</tr>` : '';
  const html = `
    <div id="print-content">
      <style>
        @media print {
          body * { visibility: hidden; }
          #print-content, #print-content * { visibility: visible; }
          #print-content { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
          @page { margin: 12mm; }
        }
        #print-content { display: none; font-family: Arial, Helvetica, sans-serif; color: #000; padding: 8px 12px; }
        #print-content * { color: #000 !important; }
        #print-content .ttl { text-align: center; font-weight: 700; font-size: 18px; margin: 4px 0 12px; }
        #print-content .sub { text-align: center; font-weight: 700; font-size: 13px; margin: 0 0 8px; }
        #print-content .rng { text-align: center; font-weight: 700; font-size: 11px; margin: 0 0 12px; }
        #print-content table { width: 100%; border-collapse: collapse; font-size: 10px; }
        #print-content thead th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 5px 4px; font-weight: 700; font-size: 10px; }
        #print-content td { padding: 5px 4px; vertical-align: middle; word-break: break-word; }
        #print-content tr.total td { border-top: 2px solid #000; border-bottom: 2px solid #000; font-weight: 700; }
        #print-content tbody tr:last-child:not(.total) td { border-bottom: 2px solid #000; }
        #print-content tr { page-break-inside: avoid; }
      </style>
      ${title ? `<div class="ttl">${esc(title)}</div>` : ''}
      ${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
      ${range ? `<div class="rng">${esc(range)}</div>` : ''}
      <table><thead><tr>${th}</tr></thead><tbody>${tr}${tot}</tbody></table>
    </div>`;
  document.getElementById('print-content')?.remove();
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.body.appendChild(holder);
  // The browser's page header prints document.title — show the report, not the app name.
  const prevTitle = document.title;
  document.title = [title, subtitle].filter(Boolean).join(' - ') || prevTitle;
  setTimeout(() => {
    window.print();
    setTimeout(() => { holder.remove(); document.title = prevTitle; }, 100);
  }, 100);
};

// Label of a value inside the ShopfrontFilter group lists ([{ items: [{ value, label }] }]).
export const optionLabel = (groups, value) => {
  for (const g of groups || []) {
    const hit = (g.items || []).find((o) => String(o.value) === String(value));
    if (hit) return hit.label;
  }
  return value == null ? '' : String(value);
};
