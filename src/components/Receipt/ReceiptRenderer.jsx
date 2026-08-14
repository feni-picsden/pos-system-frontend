import React from 'react';
import { Paper, Box, Typography, Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { createBarcodeSvgMarkup } from '../../utils/barcodeSvg';
import { renderExpressions, buildReceiptContext } from '../../utils/receiptExpressions';
import ReferenceReceipt, { isReferenceShape } from './ReferenceReceipt';
import { buildReferenceData } from '../../utils/referenceReceiptData';
import { isWideTemplate, paperSettings, paperWidthMm } from '../../utils/receiptTemplateShape';
import { itemsPerCase } from '../../utils/saleTotals';

/**
 * Receipt Renderer Component
 * Renders receipt based on template configuration, matching backend email receipt generator
 */
const ReceiptRenderer = ({ receiptData, template, fit = false, preview = false }) => {
  if (!receiptData) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', color: '#999' }}>
        <Typography>No receipt data available</Typography>
      </Box>
    );
  }

  if (!template) {
    template = { type: 'Normal', config: { layout: 'normal' } };
  }

  // On-screen preview panes are thermal-receipt sized. A wide (A4 / Email) template
  // used to be shrunk into them, which is not a preview of anything — say so instead.
  // `preview` is opt-in so the PRINT paths (renderToStaticMarkup) still render the
  // real A4 receipt.
  if (preview && isWideTemplate(template)) {
    return (
      <>
        <Box sx={{ p: 2, textAlign: 'center', color: '#999' }}>
          <Typography>Receipt preview unsupported</Typography>
        </Box>
        {/* ponytail: the real tree still has to MOUNT — the print paths
            (SaleKeyPage.printReceipt / PrintReceiptDialog.printReceipt) copy
            document.head's emotion <style> tags, and renderToStaticMarkup cannot
            insert them (react-dom's server dispatcher no-ops useInsertionEffect).
            Hidden, not skipped: display:none still inserts the CSS. */}
        <Box sx={{ display: 'none' }} aria-hidden>
          <ReceiptRenderer receiptData={receiptData} template={template} />
        </Box>
      </>
    );
  }

  const templateType = template.type || 'Normal';
  const config = template.config || {};
  // Reference templates keep the component list on the template itself; ours has
  // historically nested it under config.
  const components = config.components || template.components || [];
  
  // Get canvas styling from template config (like backend does)
  const canvas = config.canvas || {};
  const backgroundColor = canvas.backgroundColor || '#f5f5f5';
  const primaryColor = canvas.primaryColor || '#333';
  const secondaryColor = canvas.secondaryColor || '#666';
  const fontFamily = canvas.fontFamily || "'Arial', sans-serif";
  
  // Handle fontSize - can be number or string
  const fontSizeValue = canvas.fontSize || 14;
  const fontSize = typeof fontSizeValue === 'number' ? `${fontSizeValue}px` : fontSizeValue;
  
  // Handle maxWidth - use canvas.width if set (convert mm to px for email), otherwise default
  const isWide = isWideTemplate({ type: templateType });
  // Configure > Receipt Width wins over the editor's canvas width, on BOTH shapes — a
  // template still holding editor-shape components used to fall through here and ignore
  // it entirely (the control did nothing until the merchant re-saved in the editor).
  const paperWidth = paperWidthMm(template);
  const widthValue = paperWidth || canvas.width || (isWide ? 210 : 80);
  const maxWidth = paperWidth ? '100%' : (canvas.maxWidth || (isWide ? '210mm' : '300px'));

  // Handle padding - Configure > Receipt Padding (per side, px) wins over canvas.padding.
  const paperPadding = template?.padding || config.padding;
  const paddingValue = canvas.padding || 20;
  const padding = paperPadding
    ? `${Number(paperPadding.top) || 0}px ${Number(paperPadding.right) || 0}px ${Number(paperPadding.bottom) || 0}px ${Number(paperPadding.left) || 0}px`
    : (typeof paddingValue === 'number' ? `${paddingValue}px` : paddingValue);

  const containerSx = {
    p: padding,
    bgcolor: backgroundColor,
    mb: 2,
    mx: 'auto',
    fontFamily: fontFamily,
    fontSize: fontSize,
    color: primaryColor,
    width: (isWide || paperWidth) ? `${widthValue}mm` : 'auto',
    maxWidth: maxWidth,
    lineHeight: 1.5,
    // ponytail: `fit` is the sell-screen cart column only (print and the Setup preview
    // stay full size). The template's mm width is still the design width, 100% is the
    // ceiling, and table-layout:fixed scales the fixed px column widths down
    // proportionally so a 210mm template reflows into a 400px column instead of
    // overflowing it. True pixel-exact scale-to-fit needs a measured zoom factor
    // (ResizeObserver) — add that only if a merchant needs WYSIWYG on screen.
    ...(fit && {
      width: `${widthValue}mm`,
      maxWidth: '100%',
      boxSizing: 'border-box',
      wordBreak: 'break-word',
      '& table': { tableLayout: 'fixed', width: '100%' },
    }),
  };

  // If no components, show a message (like backend does)
  if (!components || components.length === 0) {
    return (
      <Paper sx={containerSx}>
        <Box sx={{ p: 2, textAlign: 'center', color: '#999' }}>
          <Typography>No receipt template components configured</Typography>
        </Box>
      </Paper>
    );
  }

  // Templates stored in the reference's own shape ({type, style, value}) render
  // through the reference-native path — same layout rules as topdrops, including
  // its paper metrics: 270px design width, Roboto 12px base, black on white, no
  // card chrome. Measured 2026-08-05 (docs/parity/receipt-template.md §1).
  if (isReferenceShape(components)) {
    const { width: referenceWidth, padding: pad } = paperSettings(template);
    return (
      <Box
        sx={{
          width: referenceWidth,
          maxWidth: '100%',
          mx: 'auto',
          bgcolor: '#fff',
          color: '#000',
          fontFamily: 'Roboto, sans-serif',
          fontSize: '12px',
          lineHeight: 1.35,
          paddingTop: pad.top ? `${pad.top}px` : 0,
          paddingLeft: pad.left ? `${pad.left}px` : 0,
          paddingRight: pad.right ? `${pad.right}px` : 0,
          paddingBottom: pad.bottom ? `${pad.bottom}px` : 0,
          '& table': { fontSize: 'inherit' },
        }}
      >
        <ReferenceReceipt components={components} data={buildReferenceData(receiptData)} />
      </Box>
    );
  }

  // ponytail: a template that explicitly places External Receipt owns the EFT slip;
  // otherwise the payments block keeps printing it inline (Linkly requires it on the
  // receipt). Top-level only — a slip nested inside columns still double-prints.
  const data = components.some((c) => c && c.visible !== false && c.type === 'external_receipt')
    ? { ...receiptData, hideEftposSlip: true }
    : receiptData;

  return (
    <Paper sx={containerSx}>
      {components.map((component, index) => renderComponent(data, component, index))}
    </Paper>
  );
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(amount || 0);
};

// A line's tax, from whichever shape the caller passes. Reprint/sale-history lines
// carry taxName + taxAmount; live cart lines carry the rate (retailTaxRate +
// taxPercent) against a tax-INCLUSIVE line price — same formula the sale save uses,
// so the receipt's GST matches the tax banked on the sale.
const getItemTax = (item, lineTotal) => {
  const name = item.taxName || item.tax?.name || item.retailTaxRate || item.taxRateName || '';
  const stated = item.taxAmount ?? item.tax?.amount ?? (typeof item.tax === 'number' ? item.tax : null);
  // Banked tax wins over a missing/"No Tax" name — see referenceReceiptData.lineTax.
  if (!name || name === 'No Tax') {
    const amount = parseFloat(stated) || 0;
    return Math.round(amount * 100) === 0 ? { name: 'No Tax', amount: 0 } : { name: name || 'Tax', amount };
  }
  if (stated != null) return { name, amount: parseFloat(stated) || 0 };
  const percent = parseFloat(item.taxPercent) || 0;
  return { name, amount: percent > 0 ? (lineTotal * percent) / (100 + percent) : 0 };
};

// Helper function to get component styles
const getComponentStyles = (props) => {
  const padding = props.padding || { top: 0, left: 0, right: 0, bottom: 0 };
  const margin = props.margin || { top: 0, left: 0, right: 0, bottom: 0 };
  const border = props.border || { enabled: false, color: '#000000', style: 'solid', width: 1 };
  const backgroundColor = props.backgroundColor || '#ffffff';
  
  return {
    padding: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
    margin: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
    // ponytail: logo/image/columns panels toggle border.width and never set enabled - width decides when enabled is absent.
    border: (border.enabled ?? border.width > 0) ? `${border.width || 1}px ${border.style} ${border.color}` : 'none',
    backgroundColor: backgroundColor,
    // The logo/image panels store horizontalAlignment as flex values (the editor canvas
    // uses it as justifyContent); text-align only understands left/center/right.
    textAlign: props.textAlign || { 'flex-start': 'left', 'flex-end': 'right' }[props.horizontalAlignment] || props.horizontalAlignment || 'left',
  };
};

// Shared dispatcher: maps a component to its renderer (used by top-level and columns)
function renderComponent(receiptData, component, index) {
  if (!component || component.visible === false) return null;
  switch (component.type) {
    case 'header':
    case 'outlet_info':
      return renderHeaderComponent(receiptData, component, index);
    case 'outlet_logo':
    case 'logo':
      return renderLogoComponent(receiptData, component, index);
    case 'barcode':
      return renderBarcodeComponent(receiptData, component, index);
    case 'products':
    case 'items':
    case 'items-table':
      return renderProductsComponent(receiptData, component, index);
    case 'tax':
    case 'totals':
      return renderTaxComponent(receiptData, component, index);
    case 'payments':
      return renderPaymentsComponent(receiptData, component, index);
    case 'text':
    case 'footer':
      return renderTextComponent(receiptData, component, index);
    case 'indicator':
      return renderIndicatorComponent(receiptData, component, index);
    case 'surcharge':
      return renderSurchargeComponent(receiptData, component, index);
    case 'spacer':
      return renderSpacerComponent(component, index);
    case 'columns':
    case 'column':
      return renderColumnsComponent(receiptData, component, index);
    case 'image':
      return renderImageComponent(component, index);
    case 'loyalty':
      return renderLoyaltyComponent(receiptData, component, index);
    case 'account':
      return renderAccountComponent(receiptData, component, index);
    case 'gift_cards':
      return renderGiftCardsComponent(receiptData, component, index);
    case 'external_receipt':
      return renderExternalReceiptComponent(receiptData, component, index);
    default:
      return null;
  }
}

// Small helper: a titled block with label/value rows (loyalty, account, gift cards)
const renderRow = (label, value, key, fontSize, fontColor, fontWeight = 'bold') => (
  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, fontSize: `${fontSize}px`, color: fontColor }}>
    <Typography variant="body2">{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight }}>{value}</Typography>
  </Box>
);

const renderBlockTitle = (showTitle, title, fontSize, fontColor) => (
  showTitle && title
    ? <Typography variant="subtitle1" sx={{ fontSize: `${fontSize}px`, fontWeight: 'bold', color: fontColor, mb: 1 }}>{title}</Typography>
    : null
);

// Render Image Component (custom image from props, unlike logo which falls back to outlet)
const renderImageComponent = (component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  const imageUrl = props.imageUrl || '';
  if (!imageUrl) return null;

  const formatSize = (value) => (value && value !== 'auto' ? `${value}px` : 'auto');

  return (
    <Box key={index} sx={{ ...styles, textAlign: styles.textAlign }}>
      <img
        src={imageUrl}
        alt="Receipt image"
        style={{
          maxWidth: '100%',
          width: formatSize(props.width),
          height: formatSize(props.height),
          objectFit: 'contain',
          display: styles.textAlign === 'center' ? 'block' : 'inline-block',
          margin: styles.textAlign === 'center' ? '0 auto' : '0',
        }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    </Box>
  );
};

// Render Loyalty Component (driven by receiptData.loyalty)
const renderLoyaltyComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';

  const loyalty = receiptData.loyalty;
  if (!loyalty) return null;

  // ponytail: key is authoritative; label map is the fallback for pre-key templates
  const keyByName = {
    'Current Points': 'currentPoints',
    'Earned': 'earned',
    'Spent': 'spent',
    'Before Sale': 'beforeSale',
    'After Sale': 'afterSale',
  };
  const items = props.loyaltyItems || props.fields || [];
  const rows = items
    .filter(f => f.enabled)
    .map((f, i) => {
      const key = f.key || keyByName[f.name];
      const value = key ? loyalty[key] : undefined;
      if (value === undefined || value === null) return null;
      return renderRow(f.name, value, i, fontSize, fontColor, props.fontWeight);
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <Box key={index} sx={styles}>
      {renderBlockTitle(props.showTitle === true, props.title, fontSize, fontColor)}
      {rows}
    </Box>
  );
};

// Render Account Component (driven by receiptData.account)
const renderAccountComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';

  const account = receiptData.account;
  if (!account) return null;

  // fields is an object keyed by data key: { startBalance: {name, enabled}, ... }
  const fields = props.fields || {};
  const rows = Object.entries(fields)
    .sort(([, a], [, b]) => (a?.order || 0) - (b?.order || 0))
    .filter(([, f]) => f && f.enabled)
    .map(([key, f], i) => {
      const value = account[key];
      if (value === undefined || value === null) return null;
      return renderRow(f.name || key, formatCurrency(value), i, fontSize, fontColor, props.fontWeight);
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <Box key={index} sx={styles}>
      {renderBlockTitle(props.showTitle === true, props.title, fontSize, fontColor)}
      {rows}
    </Box>
  );
};

// Render Gift Cards Component (driven by receiptData.giftCards)
const renderGiftCardsComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';

  const giftCards = receiptData.giftCards || [];
  if (giftCards.length === 0) return null;

  const keyByName = {
    'Original': 'original',
    'Amount Used': 'amountUsed',
    'Current': 'current',
    'Expiry': 'expiry',
  };
  const fields = (props.fields || []).filter(f => f.enabled);

  return (
    <Box key={index} sx={styles}>
      {renderBlockTitle(props.showTitle === true, props.title, fontSize, fontColor)}
      {giftCards.map((card, ci) => (
        <Box key={ci} sx={{ mb: 1 }}>
          {card.id && (
            <Typography variant="body2" sx={{ fontSize: `${fontSize}px`, color: fontColor, fontWeight: 'bold' }}>
              {`Gift Card ${card.id}`}
            </Typography>
          )}
          {fields.map((f, i) => {
            const key = f.key || keyByName[f.name]; // ponytail: keyByName is the legacy fallback for templates saved before field.key
            const raw = key ? card[key] : undefined;
            if (raw === undefined || raw === null) return null;
            const value = key === 'expiry' ? raw : formatCurrency(raw);
            return renderRow(f.name, value, `${ci}-${i}`, fontSize, fontColor, props.fontWeight);
          })}
        </Box>
      ))}
    </Box>
  );
};

// Render External Receipt Component (driven by receiptData.externalReceipt)
const renderExternalReceiptComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  const fontSize = props.fontSize || 12;
  const fontColor = props.fontColor || '#000000';
  // ponytail: the editor stores 'Normal'/'Bold'/'Light'; only bold is a real CSS keyword
  const fontWeight = { bold: 'bold', light: 300 }[String(props.fontWeight || '').toLowerCase()] || 'normal';

  // ponytail: no builder ever sets receiptData.externalReceipt; the EFT slip rides on each payment
  const ext = receiptData.externalReceipt || (receiptData.payments || []).filter((p) => p.eftposReceipt).map((p) => p.eftposReceipt);
  if (!ext || Object.keys(ext).length === 0) return null;

  return (
    <Box key={index} sx={{ ...styles, fontFamily: 'monospace' }}>
      {renderBlockTitle(props.showTitle === true, props.title, fontSize, fontColor)}
      {Object.values(ext).map((line, i) => (
        <Typography key={i} variant="body2" sx={{ fontSize: `${fontSize}px`, color: fontColor, fontWeight, whiteSpace: 'pre' }}>
          {String(line)}
        </Typography>
      ))}
    </Box>
  );
};

// Render Header Component
const renderHeaderComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';
  const fontWeight = props.fontWeight || 'normal';
  const textAlign = props.textAlign || 'center';
  
  const outlet = receiptData.outlet || {};
  const outletName = outlet.name || '';
  const outletAddress = outlet.address || '';
  const outletEmail = outlet.email || '';
  const outletPhone = outlet.phone || '';
  const outletABN = outlet.abn || '';
  
  // Get heading text based on sale status
  const saleType = receiptData.status || 'completed';
  const parkedSaleHeading = props.parkedSale || '';
  const completedSaleHeading = props.completedSale || '';
  let headingText = completedSaleHeading;
  if (saleType === 'parked' || saleType === 'held' || receiptData.isParked) {
    headingText = parkedSaleHeading;
  }
  
  return (
    <Box key={index} sx={styles}>
      {outletName && (
        <Typography variant="h5" sx={{ 
          fontSize: `${fontSize + 4}px`, 
          fontWeight: fontWeight === 'bold' ? 'bold' : '600',
          color: fontColor,
          textAlign: textAlign,
          mb: 1
        }}>
          {outletName}
        </Typography>
      )}
      {headingText && (
        <Typography variant="h6" sx={{ 
          fontSize: `${fontSize + 2}px`, 
          fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
          color: fontColor,
          textAlign: textAlign,
          mb: 1
        }}>
          {headingText}
        </Typography>
      )}
      {outletAddress && (
        <Typography variant="body2" sx={{ 
          fontSize: `${fontSize}px`,
          fontWeight: fontWeight,
          color: fontColor,
          textAlign: textAlign,
          mb: 0.5
        }}>
          {outletAddress}
        </Typography>
      )}
      {outletEmail && (
        <Typography variant="body2" sx={{ 
          fontSize: `${fontSize}px`,
          fontWeight: fontWeight,
          color: fontColor,
          textAlign: textAlign,
          mb: 0.5
        }}>
          {outletEmail}
        </Typography>
      )}
      {outletPhone && (
        <Typography variant="body2" sx={{ 
          fontSize: `${fontSize}px`,
          fontWeight: fontWeight,
          color: fontColor,
          textAlign: textAlign,
          mb: 0.5
        }}>
          Phone: {outletPhone}
        </Typography>
      )}
      {outletABN && (
        <Typography variant="body2" sx={{ 
          fontSize: `${fontSize}px`, 
          fontWeight: fontWeight,
          color: fontColor,
          textAlign: textAlign,
          mb: 0.5
        }}>
          ABN: {outletABN}
        </Typography>
      )}
    </Box>
  );
};

// Render Logo Component
const renderLogoComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);

  const outlet = receiptData.outlet || {};
  const logoUrl = props.imageUrl || outlet.logo || '';

  if (!logoUrl) return null;

  const formatSize = (value) => (value && value !== 'auto' ? `${value}px` : 'auto');

  return (
    <Box key={index} sx={{ ...styles, textAlign: styles.textAlign }}>
      <img
        src={logoUrl}
        alt={outlet.name || 'Logo'}
        style={{
          maxWidth: '100%',
          width: formatSize(props.width),
          height: formatSize(props.height),
          objectFit: 'contain',
          display: styles.textAlign === 'center' ? 'block' : 'inline-block',
          margin: styles.textAlign === 'center' ? '0 auto' : '0'
        }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    </Box>
  );
};

// Render Barcode Component
const renderBarcodeComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';
  // Prefer the sale number — its digits are scannable back into a return recall.
  const barcodeValue = props.barcodeValue || receiptData.saleNumber || receiptData.transactionId || '';
  // ponytail: CODE128 via the shelf-ticket util (jsbarcode, already a dep); no format
  // picker until the editor's barcode panel exposes one. Centred to match the editor canvas.
  const svg = createBarcodeSvgMarkup(barcodeValue, { format: 'CODE128', showText: true });

  return (
    <Box key={index} sx={{ ...styles, textAlign: props.textAlign || 'center' }}>
      {svg ? (
        // jsbarcode's svg carries inline width/height:100%, so the wrapper owns the box.
        <Box sx={{ height: 60, maxWidth: 300, mx: 'auto' }} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <Typography variant="caption" sx={{ fontSize: `${fontSize}px`, color: fontColor }}>
          {barcodeValue}
        </Typography>
      )}
    </Box>
  );
};

// Render Products Component
const renderProductsComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const fields = props.fields || [];
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';
  const fontWeight = props.fontWeight || 'Normal';
  // ponytail: header + Total Items/Savings stay bold, they're deliberate on both surfaces
  const bodyWeight = fontWeight === 'Light' ? 300 : fontWeight.toLowerCase();

  // Check which fields are enabled
  const getFieldEnabled = (fieldName) => {
    if (!fields.length) return false;
    const field = fields.find(f => f.name === fieldName);
    return field?.enabled === true;
  };
  
  const showProduct = getFieldEnabled('Product');
  const showCaseQty = getFieldEnabled('Case Qty');
  const showQty = getFieldEnabled('Qty');
  const showItemPrice = getFieldEnabled('Item Price');
  const showDiscount = getFieldEnabled('Discount');
  const showPrice = getFieldEnabled('Price');
  const showCasePrice = getFieldEnabled('Case Price');
  const showNormalPrice = getFieldEnabled('Normal Price');
  const showTotalItems = getFieldEnabled('Total Items');
  const showSavings = getFieldEnabled('Savings');
  
  const items = receiptData.items || [];
  
  return (
    <Box key={index} sx={styles}>
      <Table sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <TableHead>
          <TableRow>
            {showProduct && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'left',
                py: 1.25,
                px: 0.625
              }}>
                Product
              </TableCell>
            )}
            {showCaseQty && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'center',
                width: '80px',
                py: 1.25,
                px: 0.625
              }}>
                Case Qty
              </TableCell>
            )}
            {showQty && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'center',
                width: '80px',
                py: 1.25,
                px: 0.625
              }}>
                Qty
              </TableCell>
            )}
            {showItemPrice && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'right',
                width: '100px',
                py: 1.25,
                px: 0.625
              }}>
                Item Price
              </TableCell>
            )}
            {showDiscount && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'right',
                width: '90px',
                py: 1.25,
                px: 0.625
              }}>
                Discount
              </TableCell>
            )}
            {showPrice && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'right',
                width: '90px',
                py: 1.25,
                px: 0.625
              }}>
                Price
              </TableCell>
            )}
            {showCasePrice && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'right',
                width: '100px',
                py: 1.25,
                px: 0.625
              }}>
                Case Price
              </TableCell>
            )}
            {showNormalPrice && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'right',
                width: '110px',
                py: 1.25,
                px: 0.625
              }}>
                Normal Price
              </TableCell>
            )}
            {showTotalItems && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'right',
                width: '100px',
                py: 1.25,
                px: 0.625
              }}>
                Total Items
              </TableCell>
            )}
            {showSavings && (
              <TableCell sx={{ 
                fontSize: `${fontSize}px`, 
                color: fontColor, 
                fontWeight: 'bold',
                borderBottom: `2px solid ${fontColor}`,
                textAlign: 'right',
                width: '90px',
                py: 1.25,
                px: 0.625
              }}>
                Savings
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, itemIndex) => {
            // Sale-cart lines carry `price` as the LINE total and record the
            // discount on discountInfo; sale-history lines carry unitPrice and a
            // plain discount. Derive both shapes here — the only place all three
            // callers route through.
            const itemDiscount = parseFloat(item.discount ?? item.discountInfo?.discountAmount ?? 0) || 0;
            const itemSavings = parseFloat(item.savings || 0);
            // One shared resolver (defaults to 1), so a line that carries no case
            // size prints the same figure live and on a reprint.
            const caseQty = Number(item.caseQty) || itemsPerCase(item.product || item);
            // A line with no promotion (or a sale banked before normalPrice was stored)
            // sold at its normal price: price + savings, the same identity the
            // reference-shaped path uses. Never print $0.00 as a "normal price".
            const normalPrice = parseFloat(item.normalPrice || item.regularPrice || 0)
              || (parseFloat(item.price ?? item.totalPrice ?? 0) || 0) + itemSavings;
            const quantity = parseFloat(item.quantity || 1) || 1;
            const totalPrice = parseFloat(item.price ?? item.totalPrice ?? 0) || 0;
            const itemPrice = item.unitPrice != null
              ? parseFloat(item.unitPrice) || 0
              : totalPrice / quantity;
            // ponytail: Case Price stays whatever the line carries — a derived
            // unitPrice * caseQty would be wrong under case-tier promo pricing.
            // Missing stays missing: printing $0.00 on a tax invoice claims a
            // real price the line never had.
            const casePrice = item.casePrice != null && item.casePrice !== ''
              ? parseFloat(item.casePrice) || 0
              : null;
            // Taxed lines carry the marker the Indicator component's legend refers to.
            // ponytail: '*' is the editor's default and only indicator; read it off the
            // indicator component if a template ever ships a different symbol.
            const isTaxed = getItemTax(item, totalPrice).name !== 'No Tax';

            return (
              <TableRow key={itemIndex}>
                {showProduct && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    fontWeight: bodyWeight,
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {item.name || item.productName || item.description || ''}{isTaxed ? ' *' : ''}
                    {props.showProductNote !== false && item.note ? (
                      <Box sx={{ fontSize: `${fontSize - 2}px`, color: fontColor }}>- {item.note}</Box>
                    ) : null}
                  </TableCell>
                )}
                {showCaseQty && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    fontWeight: bodyWeight,
                    textAlign: 'center',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {caseQty}
                  </TableCell>
                )}
                {showQty && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    fontWeight: bodyWeight,
                    textAlign: 'center',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {quantity}
                  </TableCell>
                )}
                {showItemPrice && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    fontWeight: bodyWeight,
                    textAlign: 'right',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {formatCurrency(itemPrice)}
                  </TableCell>
                )}
                {showDiscount && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: itemDiscount > 0 ? '#d32f2f' : fontColor,
                    fontWeight: bodyWeight,
                    textAlign: 'right',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {itemDiscount > 0 ? '-' : ''}{formatCurrency(itemDiscount)}
                  </TableCell>
                )}
                {showPrice && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    fontWeight: bodyWeight,
                    textAlign: 'right',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {formatCurrency(totalPrice)}
                  </TableCell>
                )}
                {showCasePrice && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    fontWeight: bodyWeight,
                    textAlign: 'right',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {casePrice == null ? '-' : formatCurrency(casePrice)}
                  </TableCell>
                )}
                {showNormalPrice && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    fontWeight: bodyWeight,
                    textAlign: 'right',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {formatCurrency(normalPrice)}
                  </TableCell>
                )}
                {showTotalItems && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: fontColor,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {/* ponytail: cart lines already carry units — a case add multiplies
                        quantity by itemsPerCase at add time — so this is just quantity. */}
                    {quantity}
                  </TableCell>
                )}
                {showSavings && (
                  <TableCell sx={{ 
                    fontSize: `${fontSize}px`, 
                    color: itemSavings > 0 ? '#d32f2f' : fontColor,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    borderBottom: '1px solid #e0e0e0',
                    py: 1.25,
                    px: 0.625
                  }}>
                    {formatCurrency(itemSavings)}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
};

// Render Tax/Totals Component
const renderTaxComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const showTotal = props.showTotal === true;
  const showTitle = props.showTitle === true;
  const title = props.title || '';
  const totalLabel = props.totalLabel || '';
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';
  const fontWeight = props.fontWeight || 'normal';

  const taxItems = props.taxItems || props.fields || [];
  
  const subtotal = parseFloat(receiptData.subtotal || 0);
  const discount = parseFloat(receiptData.discount || 0);
  const tax = parseFloat(receiptData.tax || 0);
  const rounding = parseFloat(receiptData.rounding || 0);
  const total = parseFloat(receiptData.total || 0);
  const savings = parseFloat(receiptData.savings || 0);
  
  // Calculate change from payments
  const payments = receiptData.payments || [];
  const paidAmount = payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  // Prefer the authoritative change the sale computed. Deriving paid - total reads 0
  // whenever the cash line was already netted down to the applied amount.
  const changeAmount = receiptData.change != null ? parseFloat(receiptData.change) || 0 : paidAmount - total;
  
  // Aggregate taxes from items by tax name
  const taxesByName = {};
  const items = receiptData.items || [];
  
  items.forEach(item => {
    const lineTotal = parseFloat(item.price ?? item.totalPrice ?? 0) || 0;
    const { name, amount } = getItemTax(item, lineTotal);
    taxesByName[name] = (taxesByName[name] || 0) + amount;
  });
  
  // Build tax rows
  const taxRows = taxItems
    .filter(item => item.enabled)
    .map((item, itemIndex) => {
      let value = 0;
      let label = item.name || '';
      // The editor lets the merchant retitle a field; item.key keeps the original
      // name so the lookup below survives a rename. Tax rows still match on the name.
      const key = item.key || label;

      if (taxesByName[label] !== undefined) {
        value = taxesByName[label];
      } else if (key.toLowerCase() === 'discount' || key.toLowerCase() === 'discounts') {
        value = discount;
      } else if (key.toLowerCase() === 'savings') {
        value = savings;
      } else if (key.toLowerCase() === 'rounding') {
        value = rounding;
      } else if (key.toLowerCase() === 'total') {
        value = total;
      } else if (key.toLowerCase() === 'change') {
        value = changeAmount;
      } else if (key.toLowerCase() === 'subtotal') {
        value = subtotal;
      }

      if (!value && value !== 0) return null;
      if (value === 0) return null;

      const isNegative = key.toLowerCase() === 'discount' || key.toLowerCase() === 'savings';
      const isTotal = key.toLowerCase() === 'total';
      
      return (
        <Box 
          key={itemIndex}
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            py: 1,
            fontSize: `${fontSize}px`,
            color: fontColor,
            fontWeight: isTotal ? 'bold' : fontWeight,
            borderTop: isTotal ? `2px solid ${fontColor}` : 'none',
            mt: isTotal ? 1 : 0,
            pt: isTotal ? 1.5 : 1
          }}
        >
          <Typography variant="body2">{label}</Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: 'bold',
              color: isNegative && value > 0 ? '#d32f2f' : fontColor
            }}
          >
            {/* Refund/return sales carry negative totals — keep the sign. */}
            {(isNegative && value > 0) || value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}
          </Typography>
        </Box>
      );
    })
    .filter(Boolean);
  
  if (taxRows.length === 0 && !showTotal) {
    return null;
  }
  
  return (
    <Box key={index} sx={styles}>
      {showTitle && title && (
        <Typography variant="subtitle1" sx={{ 
          fontSize: `${fontSize}px`, 
          fontWeight: 'bold', 
          color: fontColor, 
          mb: 1 
        }}>
          {title}
        </Typography>
      )}
      {taxRows}
      {showTotal && totalLabel && taxRows.length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          py: 1.5,
          mt: 1.25,
          borderTop: `2px solid ${fontColor}`,
          fontSize: `${fontSize + 4}px`,
          fontWeight: 'bold',
          color: fontColor
        }}>
          <Typography variant="h6">{totalLabel}</Typography>
          <Typography variant="h6">{formatCurrency(total)}</Typography>
        </Box>
      )}
    </Box>
  );
};

const renderPaymentsComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';
  // ponytail: the editor stores 'Normal'/'Bold'/'Light'; only bold is a real CSS keyword
  const fontWeight = { bold: 'bold', light: 300 }[String(props.fontWeight || '').toLowerCase()] || 'normal';
  const showPaymentTitle = props.showTitle === true;
  const paymentTitle = props.title || '';
  const showPaymentNames = props.showPaymentNames !== false;
  const showAmounts = props.showAmounts !== false;
  const showChange = props.showChange === true;
  const changeLabel = props.changeLabel || '';
  
  const payments = receiptData.payments || [];
  const totalPaid = payments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const total = parseFloat(receiptData.total || 0);
  // Prefer the authoritative change the sale computed (paid - total reads 0 when the
  // cash line was already netted down to the applied amount).
  const change = receiptData.change != null ? parseFloat(receiptData.change) || 0 : totalPaid - total;
  
  if (payments.length === 0) return null;
  
  return (
    <Box key={index} sx={styles}>
      {showPaymentTitle && paymentTitle && (
        <Typography variant="subtitle1" sx={{ 
          fontSize: `${fontSize}px`, 
          fontWeight: 'bold', 
          color: fontColor, 
          mb: 1 
        }}>
          {paymentTitle}
        </Typography>
      )}
      {payments.map((payment, paymentIndex) => (
        <Box key={paymentIndex} sx={{ py: 1, fontSize: `${fontSize}px`, color: fontColor }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            {showPaymentNames && (
              <Typography variant="body2" sx={{ textTransform: 'uppercase', fontWeight }}>
                {payment.method || payment.paymentMethod || payment.description || ''}
              </Typography>
            )}
            {showAmounts && (
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(payment.amount || 0)}
              </Typography>
            )}
          </Box>
          {showPaymentNames && payment.description && payment.description !== payment.method && (
            <Typography variant="caption" sx={{ display: 'block', color: fontColor, opacity: 0.8 }}>
              {payment.description}
            </Typography>
          )}
        </Box>
      ))}
      {showChange && change > 0 && changeLabel && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          py: 1.25,
          mt: 1.25,
          borderTop: `1px solid ${fontColor}`,
          fontSize: `${fontSize}px`,
          fontWeight: 'bold',
          color: fontColor
        }}>
          <Typography variant="body2">{changeLabel}</Typography>
          <Typography variant="body2">{formatCurrency(change)}</Typography>
        </Box>
      )}
      {/* Linkly EFTPOS customer receipt text (carried on the payment as eftposReceipt) */}
      {!receiptData.hideEftposSlip && payments.filter((p) => p.eftposReceipt).map((p, i) => (
        <Typography
          key={`eftpos-${i}`}
          component="pre"
          sx={{
            m: 0,
            mt: 1,
            fontFamily: 'monospace',
            // The EFT slip is fixed-width bank text (24/40 cols) and must print
            // verbatim — wrapping it re-flows the amounts onto their own lines.
            fontSize: `${Math.min(fontSize, 9)}px`,
            lineHeight: 1.25,
            whiteSpace: 'pre',
            overflowX: 'auto',
            color: fontColor,
          }}
        >
          {p.eftposReceipt}
        </Typography>
      ))}
    </Box>
  );
};

// Render Text Component
const renderTextComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const textContent = props.richTextContent || props.content || '';
  
  if (!textContent) return null;
  
  // Substitute variables in text
  let processedText = textContent;
  processedText = processedText.replace(/\{\{transactionId\}\}/g, receiptData.transactionId || '');
  processedText = processedText.replace(/\{\{date\}\}/g, receiptData.date || '');
  processedText = processedText.replace(/\{\{total\}\}/g, formatCurrency(receiptData.total || 0));
  processedText = processedText.replace(/\{\{subtotal\}\}/g, formatCurrency(receiptData.subtotal || 0));
  processedText = processedText.replace(/\{\{change\}\}/g, formatCurrency(receiptData.change || 0));
  processedText = processedText.replace(/\{\{surchargeTotal\}\}/g, formatCurrency(receiptData.surchargeTotal || 0));
  
  // Replace surcharge names and amounts
  if (receiptData.surcharges && Object.keys(receiptData.surcharges).length > 0) {
    const surchargeEntries = Object.entries(receiptData.surcharges);
    processedText = processedText.replace(/\{\{surchargeName\}\}/g, surchargeEntries[0]?.[0] || '');
    processedText = processedText.replace(/\{\{surcharges\}\}/g, 
      surchargeEntries.map(([name, amount]) => `${name}: ${formatCurrency(amount)}`).join(', ')
    );
  }
  
  // Replace customer info
  if (receiptData.customer) {
    processedText = processedText.replace(/\{\{customerName\}\}/g,
      `${receiptData.customer.firstName || ''} ${receiptData.customer.lastName || ''}`.trim()
    );
  }

  // Reference-style single-brace expressions: {invoiceNo}, {user.name},
  // {format(completedAt, "Do MMM YYYY h:mm:ss a")}, {IF(...)}, {coalesce(...)}.
  // Runs after the legacy {{placeholders}}, which it copies through untouched.
  processedText = renderExpressions(processedText, buildReceiptContext(receiptData));

  return (
    <Box 
      key={index} 
      sx={styles}
      dangerouslySetInnerHTML={{ __html: processedText }}
    />
  );
};

// Render Indicator Component
const renderIndicatorComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const text = props.text || 'Indicates items with';
  const indicator = props.indicator || '*';
  const tax = props.tax || '';
  const fontSize = props.fontSize || 12;
  const fontColor = props.fontColor || '#000000';
  const fontWeight = props.fontWeight || 'normal';

  if (!text || !indicator) return null;

  return (
    <Box key={index} sx={styles}>
      <Typography variant="body2" sx={{ fontSize: `${fontSize}px`, fontWeight, color: fontColor }}>
        <strong>{indicator}</strong> {text} {tax}
      </Typography>
    </Box>
  );
};

// Render Surcharge Component
const renderSurchargeComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const fontSize = props.fontSize || 14;
  const fontColor = props.fontColor || '#000000';
  const fontWeight = props.fontWeight || 'normal';
  const showTitle = props.showTitle === true;
  const title = props.title || 'Surcharge';
  const showTotal = props.showTotal === true;
  const totalLabel = props.totalLabel || 'Total';
  
  // Get surcharges from receipt data
  const surcharges = receiptData.surcharges || {};
  const surchargeTotal = receiptData.surchargeTotal || 0;
  
  // Don't render if no surcharges
  if (!surcharges || Object.keys(surcharges).length === 0 || surchargeTotal <= 0) {
    return null;
  }
  
  const surchargeEntries = Object.entries(surcharges);
  const validSurcharges = surchargeEntries.filter(([name, amount]) => parseFloat(amount || 0) > 0);
  
  if (validSurcharges.length === 0) {
    return null;
  }
  
  return (
    <Box key={index} sx={styles}>
      {showTitle && title && (
        <Typography variant="subtitle1" sx={{ 
          fontSize: `${fontSize}px`, 
          fontWeight: 'bold', 
          color: fontColor, 
          mb: 1 
        }}>
          {title}
        </Typography>
      )}
      {validSurcharges.map(([name, amount], surchargeIndex) => {
        const surchargeAmount = parseFloat(amount || 0);
        if (surchargeAmount <= 0) return null;
        
        return (
          <Box 
            key={surchargeIndex}
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              py: 1,
              fontSize: `${fontSize}px`,
              color: fontColor,
              fontWeight,
            }}
          >
            <Typography variant="body2">{name}</Typography>
            {showTotal && (
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {formatCurrency(surchargeAmount)}
              </Typography>
            )}
          </Box>
        );
      })}
      {showTotal && totalLabel && validSurcharges.length > 0 && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          py: 1.25,
          mt: 1.25,
          borderTop: `1px solid ${fontColor}`,
          fontSize: `${fontSize}px`,
          fontWeight: 'bold',
          color: fontColor
        }}>
          <Typography variant="body2">{totalLabel}</Typography>
          <Typography variant="body2">{formatCurrency(surchargeTotal)}</Typography>
        </Box>
      )}
    </Box>
  );
};

// Render Spacer Component
const renderSpacerComponent = (component, index) => {
  const props = component.properties || {};
  const height = props.height || 10;
  
  return <Box key={index} sx={{ height: `${height}px` }} />;
};

// Render Columns Component
const renderColumnsComponent = (receiptData, component, index) => {
  const props = component.properties || {};
  const styles = getComponentStyles(props);
  
  const columnsArray = props.columns || [];
  const columnWidths = props.columnWidths || [];
  const gap = props.gap || 10;
  
  if (columnsArray.length === 0) return null;
  
  return (
    <Box 
      key={index} 
      sx={{ 
        ...styles,
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap'
      }}
    >
      {columnsArray.map((column, colIndex) => {
        const colComponents = column.components || [];
        const colWidth = columnWidths[colIndex] || Math.floor(100 / columnsArray.length);
        
        return (
          <Box 
            key={colIndex}
            sx={{ 
              flex: `0 0 ${colWidth}%`,
              ...(colIndex < columnsArray.length - 1 && { pr: `${gap}px` })
            }}
          >
            {colComponents.map((colComp, compIndex) => renderComponent(receiptData, colComp, compIndex))}
          </Box>
        );
      })}
    </Box>
  );
};

export default ReceiptRenderer;
