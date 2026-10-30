import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  IconButton,
  Link,
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
  OpenInNew as OpenIcon,
} from '@mui/icons-material';

// Reference: "Looking for the file format? Click here." in the Import Customers
// dialog opens the help article "Customer Management" in a right-hand drawer
// (title, "Open externally" link, < > section paging, Close). Content:
// support.onshopfront.com article 115003820631.

const ARTICLE_URL = 'https://support.onshopfront.com/hc/en-us/articles/115003820631-Customer-Management';

const SECTIONS = [
  'creating', 'groups', 'adding', 'emailing', 'assigning', 'pricelists', 'merging', 'exporting', 'importing', 'faq',
];

const IMPORT_COLUMNS = [
  ['first_name', 'The first name of the customer', 'Yes'],
  ['last_name', 'The last name of the customer', 'No'],
  ['customer_group_id', 'The UUID of the customer group', 'No'],
  ['delivery_address_street_1', 'Delivery address line 1', 'No'],
  ['delivery_address_street_2', 'Delivery address line 2', 'No'],
  ['delivery_address_suburb', 'Delivery suburb', 'No'],
  ['delivery_address_city', 'Delivery city', 'No'],
  ['delivery_address_postcode', 'Delivery postcode', 'No'],
  ['delivery_address_state', 'Delivery state', 'No'],
  ['delivery_address_country', 'Delivery country', 'No'],
  ['billing_address_street_1', 'Billing address line 1', 'No'],
  ['billing_address_street_2', 'Billing address line 2', 'No'],
  ['billing_address_suburb', 'Billing suburb', 'No'],
  ['billing_address_city', 'Billing city', 'No'],
  ['billing_address_postcode', 'Billing postcode', 'No'],
  ['billing_address_state', 'Billing state', 'No'],
  ['billing_address_country', 'Billing country', 'No'],
  ['email', 'Email address', 'No'],
  ['fax', 'Fax number', 'No'],
  ['phone', 'Phone number', 'No'],
  ['mobile', 'Mobile number', 'No'],
  ['website', 'Website', 'No'],
  ['twitter', 'Twitter profile', 'No'],
  ['facebook', 'Facebook profile', 'No'],
  ['code', 'A code to quickly find the customer', 'No'],
  ['company', 'Company name', 'No'],
  ['business_number', 'Business number (e.g. ABN)', 'No'],
  ['birthday', 'Date of birth', 'No'],
  ['loyalty_points', 'Loyalty point balance', 'No'],
];

const GROUP_FIELDS = [
  ['Name', 'The name of the customer group'],
  ['Default Receipt', 'The receipt template used for the group'],
  ['Email Receipt', 'The email receipt template used for the group'],
  ['Auto Print Receipt', 'Automatically print sales receipts'],
  ['Auto Print Parked Receipt', 'Automatically print parked sale receipts'],
  ['Auto Email Receipt', 'Automatically email sales receipts'],
  ['Loyalty Enabled', 'Whether members earn loyalty'],
  ['Disable Promotions', 'Excludes members from promotions'],
  ['Customer Group Price List', 'The price list applied to the whole group'],
  ['Allow Account Sales', 'Lets members buy on account without immediate payment'],
  ['Account Limit', 'Spending cap for the group (unlimited by default)'],
  ['Payment Receipt', 'The receipt template for payments'],
  ['Statement Template', 'The statement template for the group'],
  ['Auto Print Payment Receipt', 'Automatically print payment receipts'],
  ['Require Order Reference', 'Prompts for a reference when the customer is added to a sale'],
  ['Credit Terms', 'Payment terms (ISO 8601 duration)'],
];

const PRICE_RULES = [
  ['Add All Categories', 'Adds every category so each can be discounted individually'],
  ['Add Fallback Rule', 'Covers products not included in any other rule'],
  ['Exclude from Price List', 'Removes products or categories from the fallback rule'],
  ['Override', 'Replaces the prices with the prices you specify'],
  ['Discount by % / $', 'Reduces the item price by a percentage or amount'],
  ['Discount Total by % / $', 'Reduces the sale total by a percentage or amount'],
  ['Cost + % / $', 'Adds a percentage or amount to cost'],
  ['Last Cost + % / $', 'Adds a percentage or amount to last cost'],
  ['Minimum Price', 'The lowest price the rule may produce'],
  ['Allow Higher Price', 'Permits prices above everyday pricing; when off the cheaper price is used'],
];

const H1 = ({ children }) => <Typography sx={{ fontSize: 32, fontWeight: 700, mb: 1 }}>{children}</Typography>;
const H2 = ({ id, children }) => (
  <Typography id={`cm-help-${id}`} sx={{ fontSize: 28, fontWeight: 700, mt: 4, mb: 1.5, scrollMarginTop: 16 }}>
    {children}
  </Typography>
);
const H3 = ({ children }) => <Typography sx={{ fontSize: 20, fontWeight: 700, mt: 2.5, mb: 1 }}>{children}</Typography>;
const P = ({ children, italic = false }) => (
  <Typography sx={{ fontSize: 17, mb: 1.5, lineHeight: 1.6, fontStyle: italic ? 'italic' : 'normal' }}>{children}</Typography>
);
const Ol = ({ items }) => (
  <Box component="ol" sx={{ pl: 3, mb: 1.5, '& li': { fontSize: 17, lineHeight: 1.7, mb: 0.5 } }}>
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </Box>
);
const Ul = ({ items }) => (
  <Box component="ul" sx={{ pl: 3, mb: 1.5, '& li': { fontSize: 17, lineHeight: 1.7 } }}>
    {items.map((it, i) => <li key={i}>{it}</li>)}
  </Box>
);
const cellSx = { fontSize: 16, py: 0.75, px: 1, border: '1px solid #ddd' };
const ColumnTable = ({ rows, headers }) => (
  <Table size="small" sx={{ mb: 2, width: 'auto' }}>
    <TableHead>
      <TableRow>
        {headers.map((h) => <TableCell key={h} sx={{ ...cellSx, fontWeight: 700 }}>{h}</TableCell>)}
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((r) => (
        <TableRow key={r[0]}>
          {r.map((c, i) => <TableCell key={i} sx={cellSx}>{c}</TableCell>)}
        </TableRow>
      ))}
    </TableBody>
  </Table>
);

export default function CustomersHelpDrawer({ open, onClose, initialSection = 'importing' }) {
  const [current, setCurrent] = useState(initialSection);
  const bodyRef = useRef(null);

  const goTo = (id, smooth = true) => {
    setCurrent(id);
    const el = bodyRef.current?.querySelector(`#cm-help-${id}`);
    if (el) el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
  };
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => goTo(initialSection, false), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSection]);
  const idx = SECTIONS.indexOf(current);
  const prev = () => idx > 0 && goTo(SECTIONS[idx - 1]);
  const next = () => idx < SECTIONS.length - 1 && goTo(SECTIONS[idx + 1]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 1400 }}
      PaperProps={{ sx: { width: 'min(770px, 100vw)', display: 'flex', flexDirection: 'column', boxShadow: 'none' } }}
    >
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
        <H1>Customer Management</H1>
        <Typography sx={{ fontSize: 16, color: '#444', mb: 2 }}>
          5 months ago ·{' '}
          <Link href={ARTICLE_URL} target="_blank" rel="noopener noreferrer" sx={{ color: 'rgb(0,0,238)', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            Open externally <OpenIcon sx={{ fontSize: 16 }} />
          </Link>
        </Typography>

        <H2 id="creating">Creating Customers</H2>
        <P>Creating customers within Shopfront allows for various functions, such as account sales, loyalty, promotions, customer history and price lists.</P>
        <P italic>Note: Before creating customers, you may wish to set up customer groups such as loyalty customers and account customers. This article also provides information about creating customer groups.</P>
        <P>To create your customers, follow the steps below. If you have a sales key icon created, you can also create customers from the register:</P>
        <Ol items={[
          'Select the Menu icon',
          'Select Customer Management',
          'Select Customers',
          'To create a new customer, select the Add Customer icon in the top left corner of the screen.',
          'Please fill in the customer\'s name either using the creation wizard or selecting skip to create the customer from the form.',
          'You\'ll need to select the appropriate customer group to ensure the customer has the desired functions.',
          'Once you have completed filling in the relevant details for your customer, select Save Customer.',
        ]} />
        <P italic>Note: You can tailor the Customer Creation Wizard so that your team is only entering the fields you need.</P>

        <H2 id="groups">Creating Customer Groups</H2>
        <P>Customer groups organise customers for reporting, unlock features such as account sales, and apply special pricing. To create one go to Menu &gt; Customer Management &gt; Customer Groups, select Add Customer Group, complete the fields and save.</P>
        <ColumnTable headers={['Field', 'Description']} rows={GROUP_FIELDS} />

        <H2 id="adding">Adding a Customer to the Current Sale</H2>
        <P>Customers can be added before, during or after scanning products.</P>
        <Ul items={[
          'Using the search bar: type the customer\'s name and select the correct result.',
          'Using Add Customer: open the key, search for the customer and select them. A new customer can also be created from this window and is applied to the sale when you finish.',
          'Removing a customer: click the cross beside the customer\'s name.',
        ]} />

        <H2 id="emailing">Emailing Receipts to Customers</H2>
        <P>Receipts can be emailed from the sell screen, sent automatically to certain customers and customised with templates.</P>
        <H3>Setting Up Email Receipt Templates</H3>
        <P>Go to Menu &gt; Setup &gt; Receipts. You can create unlimited templates, but only one default email template per store (customer groups can override it). Select Email Receipt as the type when creating a template.</P>
        <H3>Changing the Default Email Receipt Template</H3>
        <P>Go to Setup &gt; General &gt; Outlets, select the outlet, choose the Email Receipt Template under General and save.</P>
        <H3>Changing the Reply-To Email Address</H3>
        <P>Set per outlet under Setup &gt; General &gt; Outlets in the Outlet Email field. Emails still send from a generic no-reply address, replies go to your chosen address.</P>
        <H3>Customising Email Settings for Customer Groups</H3>
        <P>Open the group under Customer Management &gt; Customer Groups and press Edit. Set an email template (blank uses the outlet default) and choose whether receipts are emailed automatically.</P>
        <H3>Emailing a Receipt From the Sell Screen</H3>
        <P>After a sale select Email, enter the recipient's address and send. Any address can be used.</P>
        <H3>Emailing a Receipt From Sales History / Parked Sales</H3>
        <P>Find the sale (Menu &gt; Register &gt; Sales History, or the Parked Sales key), expand it and use Email Receipt. Emails are queued, so delivery may take several minutes.</P>

        <H2 id="assigning">Assigning a Customer to a Previous Sale</H2>
        <P>Go to Menu &gt; Register &gt; Sales History, select the sale, choose Assign Customer, search for the customer and confirm. Loyalty points and the customer's history update once assigned.</P>

        <H2 id="pricelists">Creating and Editing Price Lists</H2>
        <P>Price lists apply separate prices to chosen products for customer groups or individual customers outside a group.</P>
        <H3>How to Create a Price List</H3>
        <P>Go to Menu &gt; Customer Management &gt; Price Lists, add a price list, name it, create it, set the pricing rules and save.</P>
        <H3>How to Edit Price Lists</H3>
        <ColumnTable headers={['Option', 'Description']} rows={PRICE_RULES} />
        <P italic>Note: a Cost + % price does not mean the GP% will match that percentage.</P>
        <H3>Applying a Price List to a Customer Group</H3>
        <P>Go to Customer Groups, edit the group, scroll to Special Pricing, select a price list and save.</P>
        <H3>Applying a Price List to a Customer</H3>
        <P>Go to Customer Management &gt; Customers, find the customer and press Edit. If the customer is in a group, enable Override Customer Group. Under Special Pricing select a price list and save.</P>

        <H2 id="merging">Merging Customers</H2>
        <P>Use this to combine duplicate customers - sales, loyalty points and outstanding balances are merged. Go to Customer Management &gt; Customers &gt; Merge Customers, add the customers to merge, choose which details to keep, select Complete and confirm.</P>
        <P italic>Merging cannot be reversed.</P>

        <H2 id="exporting">Exporting Customer Details</H2>
        <P>Go to Customer Management &gt; Customers &gt; Export Customers.</P>
        <Ul items={[
          'Simple includes name, company, code, birthday, email addresses, phone number and the marketing email preference.',
          'Full includes all details, plus current loyalty points and amounts owing.',
        ]} />
        <H3>Allow Marketing Emails</H3>
        <ColumnTable headers={['Preference', 'CSV Value']} rows={[['Opted In', '1'], ['Opted Out', '0'], ['Not Specified', 'Blank']]} />

        <H2 id="importing">Importing Customers</H2>
        <P>Imports create new customers only - they cannot update existing customers. Go to Customer Management &gt; Customers &gt; Import Customers, choose the CSV file and import.</P>
        <P>Your CSV file can contain the following columns:</P>
        <ColumnTable headers={['Column', 'Description', 'Required']} rows={IMPORT_COLUMNS} />
        <Ul items={[
          'Column order does not matter',
          'Columns are case sensitive',
          'All other columns present will be ignored',
        ]} />

        <H2 id="faq">Commonly Asked Questions</H2>
        <H3>Why isn't my higher price activating?</H3>
        <P>With Allow Higher Price on, an override may fail if no single-item price exists. Create a single price even if you only sell multipacks.</P>
        <H3>Why doesn't my Cost + % price apply as expected?</H3>
        <P>When Live Profit is active the displayed cost includes promotional rebates; price lists do not include those rebates in the sell price calculation.</P>
        <H3>How do I add a customer as a sales key?</H3>
        <P>Under Setup &gt; Sales Keys add a key to a folder, apply the "Add Customer to the Sale" action, select the customer and save.</P>
        <H3>Can I create customers from the sell screen?</H3>
        <P>Yes - through the Add Customer button (then Create New) or the Create Customer key under More Functions. The new customer is added to the sale automatically.</P>
      </Box>
    </Drawer>
  );
}
