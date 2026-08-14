import React from 'react';
import { createBarcodeSvgMarkup } from '../../utils/barcodeSvg';
import { renderExpressions } from '../../utils/receiptExpressions';

// Renders a receipt from a template stored in the reference's own shape:
// components are {type, style, value}, data is the feed built by
// referenceReceiptData.js. Layout mirrors the DOM measured on topdrops
// 2026-08-05 (docs/parity/receipt-template.md §6): plain divs/tables, money
// right-aligned, and a component with no data renders an empty table — never a
// heading or a zero row.
//
// Kept hook-free so renderToStaticMarkup (print) can use it directly.

const px = (value) => (value === '' || value == null ? undefined : `${value}px`);

// Width/height come from the panel as a raw string ('auto' or a number typed by the
// merchant, per the panel's own "auto or pixels (e.g. 100)" hint). React only appends
// px to NUMBERS, so `width: '100'` was an invalid declaration the browser dropped and
// the image printed full width while the editor canvas (which appends px itself)
// showed 100px. Anything with a unit already is passed through.
const cssSize = (value) => {
  if (value == null || value === '' || value === 'auto') return undefined;
  const raw = String(value).trim();
  return /^-?\d+(\.\d+)?$/.test(raw) ? `${raw}px` : raw;
};

const borderSide = (side) => {
  if (!side || !side.borderStyle || side.borderStyle === 'none') return undefined;
  const width = Number(side.borderWidth) || 0;
  if (!width) return undefined;
  return `${width}px ${side.borderStyle} ${side.borderColor || '#000'}`;
};

export const styleToCss = (style = {}) => {
  const padding = style.padding || {};
  const border = style.border || {};
  return {
    color: style.color || undefined,
    backgroundColor: style.background || undefined,
    fontSize: px(style.fontSize),
    fontWeight: style.fontWeight || undefined,
    textAlign: style.textAlign || undefined,
    paddingTop: px(padding.top),
    paddingLeft: px(padding.left),
    paddingRight: px(padding.right),
    paddingBottom: px(padding.bottom),
    borderTop: borderSide(border.top),
    borderLeft: borderSide(border.left),
    borderRight: borderSide(border.right),
    borderBottom: borderSide(border.bottom),
  };
};

// A block saved with no column set at all (older builds stored `value: ''` for a
// component dropped from the palette) printed nothing. Fall back to the reference's
// own column set so the block a template author added actually appears.
const DEFAULT_COLUMNS = {
  tax: [{ column: 'tax', name: 'Tax' }, { column: 'total', name: 'Total' }],
  payment: [{ column: 'payment', name: 'Payments' }, { column: 'amount', name: 'Amount' }],
  total: [
    { column: 'rounding', name: 'Rounding' }, { column: 'savings', name: 'Savings' },
    { column: 'discount', name: 'Discount' }, { column: 'sale', name: 'Total' },
    { column: 'change', name: 'Change' },
  ],
  surcharge: [{ column: 'surcharge', name: 'Surcharge' }, { column: 'amount', name: 'Amount' }],
  loyalty: [
    { column: 'current-loyalty', name: 'Current Points' }, { column: 'earned', name: 'Earned' },
    { column: 'spent', name: 'Spent' }, { column: 'before-sale', name: 'Before sale' },
    { column: 'after-sale', name: 'After sale' },
  ],
  account: [
    { column: 'start-balance', name: 'Start balance' }, { column: 'end-balance', name: 'End balance' },
    { column: 'changed-balance', name: 'Balance changed' }, { column: 'current-balance', name: 'Current Balance' },
  ],
  // What the hardcoded gift-card rows used to print, kept for blocks stored without
  // a column set at all.
  gift_cards: [{ column: 'used', name: 'Amount Used' }, { column: 'current', name: 'Current' }],
};

const enabledColumns = (value, type) => {
  const columns = value?.columns;
  if (!Array.isArray(columns) || columns.length === 0) return DEFAULT_COLUMNS[type] || [];
  return columns.filter((column) => column.enabled);
};

// Every money figure on the receipt — the product table's Total column and the
// amount column of every label/value block — sits in ONE column of this width, so
// the figures line up down the paper as they do on the reference. It used to be
// 33% here and content-width in the product table, which stair-stepped the amounts.
const MONEY_COL = '26%';

// A label/value table — the shape every totals-style block uses on the reference.
const RowTable = ({ rows, style }) => (
  <table style={{ width: '100%', borderCollapse: 'collapse', ...styleToCss(style) }}>
    <tbody>
      {rows.map((row, index) => (
        <tr key={index}>
          <td style={{ textAlign: 'right' }}>{row.label}</td>
          {/* paddingLeft keeps a gap between label and figure when the block sits in
              a narrow Columns cell, where the 26% money column alone would collide. */}
          <td style={{ textAlign: 'right', width: MONEY_COL, whiteSpace: 'nowrap', paddingLeft: 6 }}>{row.value}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

const money = (amount) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
  .format(Number(amount) || 0);

const PRODUCT_ALIGN = {
  qty: 'center',
  'case-qty': 'center',
  'total-items': 'center',
  product: 'left',
};

const renderProduct = (component, data) => {
  const columns = enabledColumns(component.value, 'product');
  const showNote = component.value?.showProductNote;
  const showReason = component.value?.showDiscountReason;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', ...styleToCss(component.style) }}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.column}
              style={{
                fontWeight: 'bold',
                textAlign: PRODUCT_ALIGN[column.column] || 'right',
                // The line total shares the receipt-wide money column.
                width: column.column === 'price' ? MONEY_COL : undefined,
              }}
            >
              {column.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(data.products || []).map((product, index) => (
          <tr key={index}>
            {columns.map((column) => (
              <td
                key={column.column}
                style={{
                  textAlign: PRODUCT_ALIGN[column.column] || 'right',
                  verticalAlign: 'top',
                  width: column.column === 'price' ? MONEY_COL : undefined,
                }}
              >
                {product[column.column]}
                {column.column === 'product' && data.indicators?.[product.tax] ? <sup>*</sup> : null}
                {column.column === 'product' && showNote && product.note
                  ? <div style={{ paddingLeft: 8 }}>- {product.note}</div> : null}
                {column.column === 'product' && showReason && product['discount-reason']
                  ? <div style={{ paddingLeft: 8 }}>- {product['discount-reason']}</div> : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// `total` prints only the enabled columns that actually have a value this sale —
// the reference leaves an empty table rather than printing "Rounding $0.00".
const renderTotal = (component, data) => {
  const totals = data.total || {};
  const key = { sale: 'sale', change: 'change', rounding: 'rounding', savings: 'savings', discount: 'discount' };
  const rows = enabledColumns(component.value, 'total')
    .filter((column) => Number(totals[key[column.column]]) )
    .map((column) => ({ label: column.name, value: money(totals[key[column.column]]) }));
  return <RowTable rows={rows} style={component.style} />;
};

const renderTax = (component, data) => {
  const columns = enabledColumns(component.value, 'tax').map((c) => c.column);
  const rows = (data.tax || []).map((entry) => ({
    label: columns.includes('tax') ? entry.tax : '',
    value: columns.includes('total') ? entry.total : '',
  }));
  return <RowTable rows={rows} style={component.style} />;
};

const renderPayment = (component, data) => {
  const columns = enabledColumns(component.value, 'payment').map((c) => c.column);
  const rows = (data.payments || []).map((payment) => ({
    label: columns.includes('payment') ? payment.payment : '',
    value: columns.includes('amount') ? payment.amount : '',
  }));
  return <RowTable rows={rows} style={component.style} />;
};

// loyalty/account: a column whose data value is `false` is hidden.
const renderDataColumns = (component, source, formatValue = (v) => v, type) => {
  const rows = enabledColumns(component.value, type)
    .filter((column) => source?.[column.column] !== false && source?.[column.column] != null)
    .map((column) => ({ label: column.name, value: formatValue(source[column.column]) }));
  return <RowTable rows={rows} style={component.style} />;
};

const renderTaxIndicator = (component, data) => {
  const { indicator = '*', text = '', tax } = component.value || {};
  // The template stores a tax id; our feed keys taxes by name, so fall back to the
  // first tax on the sale (what a single-rate store always wants).
  const name = data.tax?.find((entry) => entry.id === tax)?.tax || data.tax?.[0]?.tax;
  if (!name || !data.products?.some((product) => data.indicators?.[product.tax])) return null;
  return (
    <div style={styleToCss(component.style)}>
      <strong>{indicator}</strong> {text} {name}
    </div>
  );
};

const renderColumn = (component, data, depth) => (
  <div style={{ display: 'flex', width: '100%', ...styleToCss(component.style) }}>
    {(component.value || []).map((cell, index) => (
      <div key={index} style={{ width: `${(cell.width || 0) * 100}%` }}>
        {(cell.components || []).map((child, childIndex) => (
          <ReferenceComponent key={childIndex} component={child} data={data} depth={depth + 1} />
        ))}
      </div>
    ))}
  </div>
);

const ReferenceComponent = ({ component, data, depth = 0 }) => {
  if (!component) return null;
  const { type, style = {}, value } = component;

  switch (type) {
    // `image` shares this case: it used to render `<img style={{maxWidth:'100%'}}>`
    // and ignore style.width/height entirely, so the Image panel's Width/Height moved
    // the editor canvas and did nothing to the printed receipt. Only the outlet logo
    // falls back to the sale's logo when the component carries no image of its own.
    case 'img':
    case 'logo':
    case 'image': {
      const src = style.image || (type === 'image' ? '' : data.logo);
      if (!src) return null;
      return (
        <div style={{ display: 'flex', justifyContent: style.horizAlign || 'center', ...styleToCss(style) }}>
          <img
            src={src}
            alt=""
            style={{
              width: cssSize(style.width) || '100%',
              height: cssSize(style.height) || 'auto',
              maxWidth: '100%',
            }}
          />
        </div>
      );
    }

    case 'text':
      return (
        <div
          style={styleToCss(style)}
          dangerouslySetInnerHTML={{ __html: renderExpressions(value || '', data.text || {}) }}
        />
      );

    case 'heading': {
      const parked = String(data.status || '').toUpperCase() === 'PARKED';
      const text = parked ? value?.parked : value?.completed;
      if (!text) return null;
      return <div style={styleToCss(style)}>{text}</div>;
    }

    case 'product':
      return renderProduct(component, data);
    case 'total':
      return renderTotal(component, data);
    case 'tax':
      return renderTax(component, data);
    case 'payment':
      return renderPayment(component, data);
    case 'tax_indicator':
      return renderTaxIndicator(component, data);
    case 'account':
      return renderDataColumns(component, data.account, money, 'account');
    case 'loyalty':
      return renderDataColumns(component, data.loyalty, undefined, 'loyalty');
    case 'surcharge':
      return (
        <RowTable
          style={style}
          rows={(data.surcharges || []).map((s) => ({ label: s.surcharge, value: s.amount }))}
        />
      );
    // `giftCards` is the reference registry's own key (measured 2026-08-07);
    // `gift_cards` is the older key some stored templates still carry.
    // Driven by the enabled columns like every other table block — it used to
    // hardcode "Gift Card <id>" / "Remaining", so renaming a column, disabling
    // Current or enabling Original/Expiry in the panel changed nothing here.
    case 'giftCards':
    case 'gift_cards':
      return (
        <RowTable
          style={style}
          rows={(data.giftCards || []).flatMap((card) => [
            { label: `Gift Card ${card.id}`, value: '' },
            ...enabledColumns(value, 'gift_cards').map((column) => ({
              label: column.name, value: card[column.column],
            })),
          ])}
        />
      );

    case 'spacer':
      return <div style={{ height: px(value) || '100px' }} />;

    case 'column':
    case 'columns':
      return renderColumn(component, data, depth);

    case 'barcode': {
      const barcodeValue = value || data.invoiceNo;
      if (!barcodeValue) return null;
      return (
        <div
          style={{ textAlign: style.textAlign || 'center', ...styleToCss(style) }}
          dangerouslySetInnerHTML={{ __html: createBarcodeSvgMarkup(String(barcodeValue)) }}
        />
      );
    }

    case 'eftpos':
    case 'external_receipt': {
      if (!data.eftpos) return null;
      return (
        <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap', ...styleToCss(style) }}>
          {data.eftpos}
        </pre>
      );
    }

    default:
      return null;
  }
};

// Exported so the template editor's canvas can draw a component with the SAME code
// the receipt prints with — two renderers drifted apart (the canvas printed
// "Rounding:" left-aligned, the receipt printed "Rounding" right-aligned).
export { ReferenceComponent };

// True when a template's components are stored in the reference shape.
export const isReferenceShape = (components) => Array.isArray(components)
  && components.some((component) => component && ('style' in component || 'value' in component) && !component.properties);

const ReferenceReceipt = ({ components = [], data }) => (
  <div style={{ width: '100%', background: '#fff' }}>
    {components.map((component, index) => (
      <ReferenceComponent key={index} component={component} data={data} />
    ))}
  </div>
);

export default ReferenceReceipt;
