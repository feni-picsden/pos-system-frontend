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
} from '@mui/icons-material';

// Reference: "Looking for the file format? Click here." on the Import Gift
// Cards page opens the help article in a right-hand drawer (left table of
// contents, article on the right, < > and Close) - same control as the
// External Stocktake help. Content: support.onshopfront.com article
// 115003889472 "Setting up and Selling Gift Cards".

const SECTIONS = [
  { id: 'setup', title: 'Setting up and Selling Gift Cards', level: 0 },
  { id: 'payment', title: 'Creating the Gift Card Payment Method', level: 1 },
  { id: 'selling', title: 'Selling a Gift Card', level: 1 },
  { id: 'redeeming', title: 'Redeeming a Gift Card', level: 1 },
  { id: 'configuring', title: 'Configuring Gift Cards', level: 0 },
  { id: 'enabling', title: 'Enabling and Disabling Gift Cards', level: 1 },
  { id: 'expiry', title: 'Modifying Expiry', level: 1 },
  { id: 'receipts', title: 'Adding to Receipts', level: 1 },
  { id: 'sharing', title: 'Sharing Between Outlets', level: 1 },
  { id: 'viewing', title: 'Viewing Gift Card Details and Balances', level: 0 },
  { id: 'exporting', title: 'Exporting a List of Current Gift Cards to CSV', level: 1 },
  { id: 'cancelling', title: 'Cancelling a Gift Card', level: 0 },
  { id: 'importing', title: 'How to Import Gift Cards', level: 0 },
];

const IMPORT_COLUMNS = [
  ['code', 'The name of the product', 'Yes'],
  ['balance', 'The current balance of the gift card', 'Yes'],
  ['outlet', 'The UUID of the outlet (only applies to multi outlet stores)', 'No'],
  ['original', 'The original gift card sale amount', 'No'],
  ['expiry', 'The expiry date of the gift card', 'No'],
];

const H2 = ({ id, children }) => (
  <Typography id={`gc-help-${id}`} sx={{ fontSize: 24, fontWeight: 700, mt: 3, mb: 1.5, scrollMarginTop: 16 }}>
    {children}
  </Typography>
);
const H3 = ({ id, children }) => (
  <Typography id={`gc-help-${id}`} sx={{ fontSize: 19, fontWeight: 700, mt: 2.5, mb: 1, scrollMarginTop: 16 }}>
    {children}
  </Typography>
);
const P = ({ children }) => <Typography sx={{ fontSize: 16, mb: 1.5, lineHeight: 1.6 }}>{children}</Typography>;
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
const cellSx = { fontSize: 16, py: 0.5, px: 1, border: 'none' };
const ColumnTable = ({ rows }) => (
  <Table size="small" sx={{ mb: 2, width: 'auto' }}>
    <TableHead>
      <TableRow>
        <TableCell sx={{ ...cellSx, fontWeight: 700 }}>Column</TableCell>
        <TableCell sx={{ ...cellSx, fontWeight: 700, textAlign: 'center' }}>Description</TableCell>
        <TableCell sx={{ ...cellSx, fontWeight: 700, textAlign: 'center' }}>Required</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((r) => (
        <TableRow key={r[0]}>
          <TableCell sx={cellSx}>{r[0]}</TableCell>
          <TableCell sx={cellSx}>{r[1]}</TableCell>
          <TableCell sx={{ ...cellSx, textAlign: 'center' }}>{r[2]}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default function GiftCardsHelpDrawer({ open, onClose, initialSection = 'importing' }) {
  const [current, setCurrent] = useState(initialSection);
  const bodyRef = useRef(null);

  const goTo = (id, smooth = true) => {
    setCurrent(id);
    const el = bodyRef.current?.querySelector(`#gc-help-${id}`);
    if (el) el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  };

  // Reference opens the drawer on "How to Import Gift Cards" (the link's anchor).
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
          <H2 id="setup">Setting up and Selling Gift Cards</H2>
          <P>Gift cards in Shopfront use a uniquely generated code. Once a gift card has been fully redeemed its code can be used again on a new card.</P>

          <H3 id="payment">Creating the Gift Card Payment Method</H3>
          <P>Gift cards are redeemed through a payment method, so the first step is to create one.</P>
          <Ol items={[
            'Add a payment method the same way as any other payment method and set its type to Gift Card',
            'We recommend enabling "Default to Pay Exact"',
            'Make the payment method active on your register',
          ]} />

          <H3 id="selling">Selling a Gift Card</H3>
          <Ol items={[
            'Select the Gift Card sales key (by default it is under More Functions, or search for "Gift Card")',
            'In the Add Gift Card dialog enter the amount and the code of the card, then add it to the sale',
            'Complete the sale as normal',
          ]} />
          <P>If you do not want to use the default key you can create a separate Gift Card sales key.</P>

          <H3 id="redeeming">Redeeming a Gift Card</H3>
          <Ol items={[
            'Add the customer\'s items and select Finalise Sale',
            'Select the Gift Card payment method',
            'Enter the code of the gift card - the sale balance (or the remaining balance of the card) is used by default',
            'To pay a smaller amount enter it under "Amount to pay", then confirm',
          ]} />

          <H2 id="configuring">Configuring Gift Cards</H2>

          <H3 id="enabling">Enabling and Disabling Gift Cards</H3>
          <P>Gift cards are enabled per outlet. Go to Menu &gt; Setup &gt; General &gt; Outlets tab, find the Gift Cards section, toggle the setting and save.</P>

          <H3 id="expiry">Modifying Expiry</H3>
          <P>In the same Outlets tab you can set the default expiry amount and period for new gift cards, and choose whether staff may adjust the expiry manually when selling a card. Expired gift cards cannot be used in the Sell Screen.</P>

          <H3 id="receipts">Adding to Receipts</H3>
          <P>Gift card sale and redemption details can be added to your receipts. They only appear on the original print, not on reprints. See the receipt customisation article for the available fields.</P>

          <H3 id="sharing">Sharing Between Outlets</H3>
          <P>Go to Menu &gt; Setup &gt; General &gt; Company tab &gt; Outlets section and toggle "Share Gift Cards Between Outlets". Outlets cannot be partly shared - gift cards are either shared between all outlets or none.</P>

          <H2 id="viewing">Viewing Gift Card Details and Balances</H2>
          <P>Go to Menu &gt; Customer Management &gt; Gift Cards. By default only outstanding (current) gift cards are shown; use the Status filter to include redeemed or expired cards.</P>

          <H3 id="exporting">Exporting a List of Current Gift Cards to CSV</H3>
          <P>On the Gift Cards page press <i>Export Gift Cards</i>. The export contains the outstanding gift cards.</P>

          <H2 id="cancelling">Cancelling a Gift Card</H2>
          <P>Sales that sold or redeemed a gift card cannot be cancelled. Process a return instead.</P>
          <Ul items={[
            'To clear the balance of a card, pay for a sale with it',
            'To reverse a redemption, return the items and issue a new gift card for the redeemed amount',
            'Optionally create a "Void Gift Card" product with no tax and a 100% cost, then redeem the card against it so profit percentages in sales reports stay accurate',
          ]} />

          <H2 id="importing">How to Import Gift Cards</H2>
          <P>You can import gift cards without the need to sell them. This allows the gift cards to be instantly redeemable.</P>
          <P>To import gift cards via a CSV file:</P>
          <Ol items={[
            'Select the Menu icon',
            'Select Customer Management > Gift Cards',
            'Select Import Gift Cards',
            'Choose the file containing the Gift Card(s) you wish to import',
          ]} />
          <P>Your CSV file can contain the following columns:</P>
          <ColumnTable rows={IMPORT_COLUMNS} />
          <P><i>Notes:</i></P>
          <Ul italic items={[
            'Column order does not matter',
            'Columns are case sensitive',
            'All other columns present will be ignored',
            'Date must be YYYY-MM-DD format',
            'Gift card value can include the currency symbol (e.g. "$" and "€").',
          ]} />
        </Box>
      </Box>
    </Drawer>
  );
}
