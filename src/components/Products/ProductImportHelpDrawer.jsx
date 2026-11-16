import React, { useEffect, useRef, useState } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Close as CloseIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  LightbulbOutlined as NoteIcon,
} from '@mui/icons-material';

// Reference: the "Simple" / "Advanced" links on Import Products open the help
// article in a right-hand drawer (< > and Close at the top). Content follows
// help-centre articles 360000190871 (basic) and 360061958992 (advanced), with
// "UUID" read as the numeric ID our app uses.

const ARTICLES = [
  { id: 'simple', title: 'Importing a Basic Product CSV File' },
  { id: 'advanced', title: 'Importing an Advanced Product CSV File' },
];

const SIMPLE_COLUMNS = [
  ['name', 'The name of the product', 'Yes'],
  ['cost', 'The cost of the product (including tax if applicable)', 'Yes'],
  ['sell_price', 'The retail sell price of the product (including tax if applicable)', 'Yes'],
  ['description', 'The description of the product', 'No'],
  ['tax_rate_id', 'The ID (or name) of the Tax Rate', 'No'],
  ['category_id', 'The ID of the Category this product belongs to', 'No'],
  ['brand_id', 'The ID of the Brand this product belongs to', 'No'],
  ['family_id', 'The ID of the Family this product belongs to', 'No'],
  ['supplier_id', 'The ID of the Supplier this product belongs to', 'No'],
  ['supplier_code', 'The code used to order this product from the supplier', 'No'],
  ['case_quantity', 'The amount of items that come in a case', 'No'],
  ['barcode', 'The barcode of the product', 'No'],
];

const ADVANCED_COLUMNS = [
  ['name', 'The name of the product', 'Yes', 'N/A'],
  ['category', 'The ID of the category this product belongs to', 'No', 'No Category'],
  ['case_quantity', 'The case quantity of the product', 'If prices are specified', '1'],
  ['barcode_code_(n)', "The nth barcode's code", 'No', 'None'],
  ['barcode_qty_(n)', "The nth barcode's quantity", 'No', 'None'],
  ['price_inc_(n)', "The nth price's price (inclusive of tax)", 'No', 'None'],
  ['price_qty_(n)', "The nth price's quantity", 'No', 'None'],
  ['inv_(outlet)', 'The inventory level at the provided Outlet (in total items)', 'No', 'None'],
  ['inv_reorder_level_(outlet)', 'The inventory reorder point at the provided Outlet (in total items)', 'No', 'None'],
  ['inv_reorder_amount_(outlet)', 'The inventory reorder amount at the provided Outlet (in total items)', 'No', 'None'],
  ['cost_last_(outlet)', 'The last case cost at the provided Outlet (inclusive of tax)', 'No', '$0'],
  ['cost_avg_(outlet)', 'The average case cost at the provided Outlet (inclusive of tax)', 'No', '$0'],
  ['supplier', 'The ID of the supplier for this product', 'If supplier_code is specified', 'No Supplier'],
  ['supplier_code', 'The supplier code for this product', 'No', 'None'],
  ['tax_rate', 'The ID (or name) of the tax rate for this product', 'No', 'No tax'],
];

const H1 = ({ id, children }) => (
  <Typography id={`pi-help-${id}`} component="h2" sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.25, mt: 2, mb: 1, scrollMarginTop: 16 }}>
    {children}
  </Typography>
);
const P = ({ children, italic = false }) => (
  <Typography sx={{ fontSize: 16, mb: 1.5, lineHeight: 1.6, fontStyle: italic ? 'italic' : 'normal' }}>{children}</Typography>
);
const Ol = ({ items }) => (
  <Box component="ol" sx={{ pl: 3, mb: 1.5, '& li': { fontSize: 16, lineHeight: 1.6 } }}>
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </Box>
);
const Ul = ({ items, italic = false }) => (
  <Box component="ul" sx={{ pl: 3, mb: 1.5, '& li': { fontSize: 16, lineHeight: 1.6, fontStyle: italic ? 'italic' : 'normal' } }}>
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </Box>
);
const Note = ({ children }) => (
  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5 }}>
    <NoteIcon sx={{ color: '#1c86f2', mt: '2px' }} />
    <Box>
      <Typography sx={{ fontSize: 16, color: '#1c86f2', fontWeight: 500, mb: 0.5 }}>Note</Typography>
      <Typography sx={{ fontSize: 16, lineHeight: 1.6, color: '#1a56a0' }}>{children}</Typography>
    </Box>
  </Box>
);
const cellSx = { fontSize: 16, py: 0.5, px: 1, border: 'none', verticalAlign: 'top' };
const ColumnTable = ({ rows, withDefault = false }) => (
  <Table size="small" sx={{ mb: 2 }} data-testid="help-column-table">
    <TableHead>
      <TableRow>
        <TableCell sx={{ ...cellSx, fontWeight: 700 }}>Column</TableCell>
        <TableCell sx={{ ...cellSx, fontWeight: 700, textAlign: 'center' }}>Description</TableCell>
        <TableCell sx={{ ...cellSx, fontWeight: 700, textAlign: 'center' }}>Required</TableCell>
        {withDefault && <TableCell sx={{ ...cellSx, fontWeight: 700, textAlign: 'center' }}>Default Value</TableCell>}
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((r) => (
        <TableRow key={r[0]}>
          <TableCell sx={{ ...cellSx, whiteSpace: 'nowrap' }}>{r[0]}</TableCell>
          <TableCell sx={cellSx}>{r[1]}</TableCell>
          <TableCell sx={{ ...cellSx, textAlign: withDefault ? 'left' : 'center' }}>{r[2]}</TableCell>
          {withDefault && <TableCell sx={cellSx}>{r[3]}</TableCell>}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default function ProductImportHelpDrawer({ open, onClose, article = 'simple' }) {
  const [current, setCurrent] = useState(article);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setCurrent(article);
    const t = setTimeout(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, 30);
    return () => clearTimeout(t);
  }, [open, article]);

  const idx = ARTICLES.findIndex((a) => a.id === current);
  const go = (i) => { setCurrent(ARTICLES[i].id); if (bodyRef.current) bodyRef.current.scrollTop = 0; };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 1400 }}
      PaperProps={{ sx: { width: 'min(770px, 100vw)', display: 'flex', flexDirection: 'column', boxShadow: 'none' }, 'data-testid': 'product-import-help' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 3, pt: 2 }}>
        <IconButton size="small" aria-label="Previous article" onClick={() => go(idx - 1)} disabled={idx <= 0}><PrevIcon /></IconButton>
        <IconButton size="small" aria-label="Next article" onClick={() => go(idx + 1)} disabled={idx >= ARTICLES.length - 1}><NextIcon /></IconButton>
        <Button
          onClick={onClose}
          startIcon={<CloseIcon sx={{ fontSize: 18 }} />}
          sx={{ ml: 'auto', color: '#000', fontSize: 16, fontWeight: 700, textTransform: 'none' }}
        >
          Close
        </Button>
      </Box>
      <Box ref={bodyRef} sx={{ flex: 1, overflowY: 'auto', px: 4, pb: 4 }}>
        {current === 'simple' ? (
          <Box data-testid="help-article-simple">
            <H1 id="simple">Importing a Basic Product CSV File Into Crinit Shop</H1>
            <P>You can import new products via a CSV file.</P>
            <P italic>
              Note: This does not merge products together and it does not allow multiple prices or barcodes to be set.
              If you have products that are linked together already and more details than the CSV import can provide,
              use the advanced product CSV importer (Import Mode: Advanced).
            </P>
            <P>To import products via a CSV file:</P>
            <Ol items={[
              'Select the Menu icon',
              'Select Stock Management',
              'Select Products',
              'Select Import Products',
              'Choose the file containing the products you wish to import',
              'Select Import',
            ]} />
            <P>Your CSV file can contain the following columns:</P>
            <ColumnTable rows={SIMPLE_COLUMNS} />
            <P>The ID of a category, brand, family, supplier or tax rate is shown on its page under Setup / Stock Management.</P>
            <P>
              You can also import additional information to the products by adding a column that has the format
              <i> additional_[safe name]</i>. So if you have an additional field called "Region" which has the safe name
              "region", your field will be called <i>additional_region</i>.
            </P>
            <P italic>Notes:</P>
            <Ul italic items={[
              'Column order does not matter',
              'Columns are case sensitive',
              'All other columns present will be ignored',
              'Sell price can include the currency symbol (e.g. "$" and "€").',
              'To join columns together (such as the name) use the concatenate function (to join A1 and B1 together with a space use =CONCATENATE(A1, " ", B1)).',
            ]} />
          </Box>
        ) : (
          <Box data-testid="help-article-advanced">
            <H1 id="advanced">Importing an Advanced Product CSV File Into Crinit Shop</H1>
            <P>Crinit Shop features an advanced CSV importer for products that use dynamic columns to set multiple prices, barcodes and inventory levels.</P>
            <Box sx={{ bgcolor: '#e3f2fd', borderLeft: '4px solid #1c86f2', p: 2, mb: 2 }}>
              <Note>
                We also have a basic CSV importer which is simpler to use, but only allows you to have one price and barcode.
                If your use-case supports it, we would recommend using the basic importer instead (Import Mode: Simple).
              </Note>
              <Note>
                Whilst this is more powerful than the basic product importer, it doesn&apos;t allow for the addition of every possible field.
              </Note>
            </Box>
            <P>To import products via an advanced CSV file:</P>
            <Ol items={[
              'Select the Menu icon,',
              'Select Stock Management,',
              'Select Products,',
              'Select Import Products,',
              'Set Import Mode to Advanced,',
              'Select a file,',
              'Select Import',
            ]} />
            <P>Your CSV file can contain the following columns:</P>
            <ColumnTable rows={ADVANCED_COLUMNS} withDefault />
            <Ul items={[
              <>Where <i>(outlet)</i> exists, you&apos;ll need to substitute the ID of the Outlet,</>,
              <>Where <i>(n)</i> exists, you&apos;ll need to specify an incrementing number starting at one, for example if you have three prices at the price points 1, 6 and 24 with the prices being $4.99, $20.99, $45.99 respectively, you&apos;ll need to specify the columns like so:</>,
            ]} />
            <Table size="small" sx={{ mb: 2, width: 'auto' }}>
              <TableHead>
                <TableRow>
                  {['price_inc_1', 'price_qty_1', 'price_inc_2', 'price_qty_2', 'price_inc_3', 'price_qty_3'].map((h) => (
                    <TableCell key={h} sx={{ ...cellSx, fontWeight: 700 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  {['$4.99', '1', '$20.99', '6', '$45.99', '24'].map((v, i) => <TableCell key={i} sx={cellSx}>{v}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
            <P>Additional things to be aware of:</P>
            <Ul items={[
              'Column order does not matter,',
              'Columns are case sensitive,',
              'All other columns present will be ignored,',
              'Sell / Cost fields can include the currency symbol (e.g. "$"),',
              'Fields that have (outlet) or (n) in their name must not have brackets in the column name,',
              'One outlet column set per file - import each outlet from its own file.',
            ]} />
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
