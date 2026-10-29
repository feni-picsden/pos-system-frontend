import React, { useState, useRef, useEffect } from 'react';
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

// Reference: the "For information about formatting click here." link in the
// Import Stocktake dialog opens the help article in a right-hand drawer (left
// table of contents, article on the right, < > and Close). Content is the
// support.onshopfront.com article 34108517200909 "External Stocktake Import & Export".

const SECTIONS = [
  { id: 'exporting', title: 'Exporting Your Product File', level: 0 },
  { id: 'importing', title: 'Importing the Stocktake File', level: 0 },
  { id: 'format', title: 'Stocktake File Format', level: 1 },
  { id: 'uploading', title: 'Uploading into Shopfront', level: 1 },
  { id: 'processing', title: 'Processing in Shopfront', level: 0 },
  { id: 'matching', title: 'Product Matching', level: 1 },
  { id: 'discrepancy', title: 'Discrepancy Checking & Applying Inventory', level: 1 },
];

const EXPORT_COLUMNS = [
  ['Product', 'The name of the product'],
  ['Category', 'The category the product belongs to'],
  ['Case Quantity', 'The amount of items that are contained within a case'],
  ['Barcode', 'The barcode that corresponds to the quantity of the product (provided as it\'s stored in the system)'],
  ['Quantity', 'The quantity the barcode corresponds to'],
  ['Ex Cost', 'The last cost for the quantity exclusive of any tax'],
  ['Inc Cost', 'The last cost for the quantity inclusive of any tax'],
  ['Replacement Cost', 'The replacement cost provided by the core supplier (otherwise the last cost for the product) inclusive of any tax'],
  ['Ex Avg Cost', 'The average cost of the quantity exclusive of any tax (not exported when running as last cost)'],
  ['Inc Avg Cost', 'The average cost of the quantity inclusive of any tax (not exported when running as last cost)'],
];

const IMPORT_COLUMNS = [
  ['name', 'The name of the product counted', 'No'],
  ['barcode', 'The barcode of the product counted', 'Yes'],
  ['cost', 'The single cost of the product (inclusive of tax)', 'No'],
  ['quantity', 'The quantity of the barcode that was counted', 'Yes'],
];

const Note = ({ children }) => (
  <Box sx={{ bgcolor: '#dff0fb', borderLeft: '4px solid #5ebbeb', p: 2, my: 2, color: '#1a5f86' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
      <NoteIcon sx={{ fontSize: 18 }} />
      <Typography sx={{ fontSize: 16 }}>Note</Typography>
    </Box>
    <Typography sx={{ fontSize: 16 }}>{children}</Typography>
  </Box>
);

const H2 = ({ id, children }) => (
  <Typography id={`es-help-${id}`} sx={{ fontSize: 24, fontWeight: 700, mt: 3, mb: 1.5, scrollMarginTop: 16 }}>
    {children}
  </Typography>
);
const H3 = ({ id, children }) => (
  <Typography id={`es-help-${id}`} sx={{ fontSize: 19, fontWeight: 700, mt: 2.5, mb: 1, scrollMarginTop: 16 }}>
    {children}
  </Typography>
);
const P = ({ children }) => <Typography sx={{ fontSize: 16, mb: 1.5, lineHeight: 1.6 }}>{children}</Typography>;
const Ol = ({ items }) => (
  <Box component="ol" sx={{ pl: 3, mb: 1.5, '& li': { fontSize: 16, lineHeight: 1.6 } }}>
    {items.map((it, i) => (
      <li key={i}>
        {it.text}
        {it.sub && (
          <Box component="ul" sx={{ pl: 3 }}>{it.sub.map((s, j) => <li key={j}>{s}</li>)}</Box>
        )}
      </li>
    ))}
  </Box>
);
const Ul = ({ items }) => (
  <Box component="ul" sx={{ pl: 3, mb: 1.5, '& li': { fontSize: 16, lineHeight: 1.6 } }}>
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </Box>
);
const cellSx = { fontSize: 16, py: 0.5, px: 1, border: 'none' };
const ColumnTable = ({ rows, required }) => (
  <Table size="small" sx={{ mb: 2, width: 'auto' }}>
    <TableHead>
      <TableRow>
        <TableCell sx={{ ...cellSx, fontWeight: 700 }}>Column</TableCell>
        <TableCell sx={{ ...cellSx, fontWeight: 700 }}>Description</TableCell>
        {required && <TableCell sx={{ ...cellSx, fontWeight: 700 }}>Required</TableCell>}
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((r) => (
        <TableRow key={r[0]}>
          <TableCell sx={cellSx}>{r[0]}</TableCell>
          <TableCell sx={cellSx}>{r[1]}</TableCell>
          {required && <TableCell sx={cellSx}>{r[2]}</TableCell>}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default function ExternalStocktakeHelpDrawer({ open, onClose, initialSection = 'format' }) {
  const [current, setCurrent] = useState(initialSection);
  const bodyRef = useRef(null);

  const goTo = (id, smooth = true) => {
    setCurrent(id);
    const el = bodyRef.current?.querySelector(`#es-help-${id}`);
    if (el) el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  };

  // Reference opens the drawer on "Stocktake File Format" (the link's anchor).
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => goTo(initialSection, false), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSection]);
  const idx = SECTIONS.findIndex((s) => s.id === current);
  const prev = () => idx > 0 && goTo(SECTIONS[idx - 1].id);
  const next = () => idx < SECTIONS.length - 1 && goTo(SECTIONS[idx + 1].id);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      // Opened from inside the Import Stocktake dialog (z 1300): sit above it,
      // like the reference where the article covers the dialog.
      sx={{ zIndex: 1400 }}
      PaperProps={{ sx: { width: 'min(1120px, 100vw)', display: 'flex', flexDirection: 'row', boxShadow: 'none' } }}
    >
      {/* table of contents */}
      <Box sx={{ width: 350, flexShrink: 0, bgcolor: '#e1e8ee', p: 2.5, overflowY: 'auto' }}>
        {SECTIONS.map((s) => (
          <Typography
            key={s.id}
            onClick={() => goTo(s.id)}
            sx={{
              fontSize: 16,
              pl: s.level ? 2 : 0,
              py: 0.5,
              cursor: 'pointer',
              color: '#000',
              textDecoration: current === s.id ? 'underline' : 'none',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {s.title}
          </Typography>
        ))}
      </Box>

      {/* article */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 3, pt: 2 }}>
          <IconButton size="small" onClick={prev} disabled={idx <= 0}><PrevIcon /></IconButton>
          <IconButton size="small" onClick={next} disabled={idx >= SECTIONS.length - 1}><NextIcon /></IconButton>
          <Button
            onClick={onClose}
            startIcon={<CloseIcon sx={{ fontSize: 18 }} />}
            sx={{ ml: 'auto', color: '#000', fontSize: 16, fontWeight: 700, textTransform: 'none' }}
          >
            Close
          </Button>
        </Box>
        <Box ref={bodyRef} sx={{ flex: 1, overflowY: 'auto', px: 4, pb: 4 }}>
          <H2 id="exporting">Exporting Your Product File</H2>
          <P>The first step when using an external stocktaker is to provide them with a list of your products, in Shopfront we've got a standardised format that stocktakers can use.</P>
          <P>Head to the External Stocktakes page (Menu &gt; Stock Management &gt; More &gt; External Stocktake) then press the <i>Export Stocktake File</i> button.</P>
          <P>Select whether or not you'd like to export products that don't contain barcodes. If you do export them, you'll need a way to manually import them back into the system (e.g., some stocktakes provide a custom number to unmatched products you can use in place of a barcode).</P>
          <P>Finally, press <i>Export</i>.</P>
          <Note>If you're a multi-Outlet store, make sure you're in the correct location before exporting.</Note>
          <P>The CSV file that is downloaded can then be provided to your stocktaker for them to use. It contains the following columns:</P>
          <ColumnTable rows={EXPORT_COLUMNS} />

          <H2 id="importing">Importing the Stocktake File</H2>
          <P>After the stocktaker has completed counting your products, they can provide you with a CSV file that can be imported back into Shopfront.</P>

          <H3 id="format">Stocktake File Format</H3>
          <P>The file should contain the following columns:</P>
          <ColumnTable rows={IMPORT_COLUMNS} required />
          <P>The following information should be noted about the file:</P>
          <Ul items={[
            'Column order does not matter',
            'Column headers are required',
            'Column headers are case-sensitive',
            'If provided, cost must be greater than zero',
            'Cost can contain currency symbols (e.g. $ and €)',
            'Quantity can be set to zero',
          ]} />
          <Note>Be careful if you open or save the file using Excel. Unfortunately, Excel attempts to pass barcodes as numbers, and because they're long, they'll be converted to scientific notation.</Note>

          <H3 id="uploading">Uploading into Shopfront</H3>
          <P>Once you've received the file from the stocktaker, you then need to upload it into Shopfront, this can be done by:</P>
          <Ol items={[
            { text: 'Navigating to the External Stocktake page (Menu > Stock Management > More > External Stocktake)' },
            { text: 'Pressing the Import Stocktake File button' },
            { text: 'Selecting the file' },
            { text: 'Selecting whether to zero all stock not counted', sub: ['If this toggle is disabled, any products that exist in your file but don\'t exist in the stocktaker file will not be touched'] },
            { text: 'Selecting whether this file will add to the existing stock or override the stock' },
          ]} />
          <Note>If you're a multi-Outlet store, you can select which location to import the file into.</Note>
          <P>Once you're all ready to start processing it, press the <i>Import</i> button. Shopfront will begin to process this in the background and may take a few minutes, you'll receive a notification once it's done.</P>

          <H2 id="processing">Processing in Shopfront</H2>
          <P>After you've uploaded the file and you've received the notification that it's ready to go, you can now process the stock in your store.</P>
          <P>You'll need to view the external stocktake, this can be done by either opening the notification you've received or by pressing the <i>View</i> button on the External Stocktake page (Menu &gt; Stock Management &gt; More &gt; External Stocktake).</P>
          <P>Processing an External Stocktake involves two parts:</P>
          <Ol items={[{ text: 'Product Matching' }, { text: 'Discrepancy Checking & Applying Inventory' }]} />

          <H3 id="matching">Product Matching</H3>
          <P>Product matching needs to be completed first. Shopfront attempts to match the file back to your products by matching the barcode, but sometimes a stocktaker will provide a barcode you don't have in your file, or you might have a duplicate barcode, and you'll need to select which one to use.</P>
          <P>Any product that doesn't match your system will be highlighted in green. You can elect to associate the unmatched barcode with an existing product or you can create a new product.</P>
          <Note>If you complete the stocktake without associating or creating all the products on the stocktake, they'll be automatically created in your file.</Note>
          <P>Once you're happy with how the file looks, you can then press the <i>Complete</i> button which finishes this step and move onto the next step which allows you to adjust the stock in Shopfront.</P>

          <H3 id="discrepancy">Discrepancy Checking &amp; Applying Inventory</H3>
          <P>After you've completed the Product matching step, you'll now be able to check any discrepancies and apply the stocktake to your product file.</P>
          <P>Once you're on the apply screen for the external stocktake, you can elect to either review or apply the stocktake.</P>
          <P>Pressing the <i>Apply Stocktake</i> button will cause Shopfront to start applying the stock in the background (this may take a few minutes), alternatively you can press the <i>Review</i> button to check for any discrepancies before applying it (but don't forget to apply it once you're done!).</P>
        </Box>
      </Box>
    </Drawer>
  );
}
