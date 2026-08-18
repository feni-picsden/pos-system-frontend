// Field definitions for Setup > General (Company tab). Data only - rendering
// lives in GeneralSettings.jsx. Section order and field titles follow the
// reference verbatim (docs/parity/settings-general-measured-2026-08-11.md).
// Options/descriptions/moreDescription/visibleWhen are brought to the reference
// vocabulary by the section work packages (company-general-sections,
// sellscreen-outlets-sections, datetime-currency-misc-sections).
// Field shape: { key, label, type ('select'|'toggle'|'text'|'number'|'custom'),
//   options: [{label, value}], default, description, moreDescription,
//   enabledLabel, disabledLabel, visibleWhen: (values)=>bool,
//   constraints: {min,max,step,required} }

// The reference lists every IANA zone (418 entries); the platform ships the
// same list, so no hardcoded table is needed.
const TIMEZONE_OPTIONS = (typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : ['Australia/Sydney']
).map((zone) => ({ label: zone, value: zone }));

// Shopfront's own format-token article, linked from Date/Time Format.
const FORMAT_TOKENS_URL = 'https://support.onshopfront.com/hc/en-us/articles/360024776851';

const SEARCH_LEVEL_OPTIONS = [
  { label: 'Full', value: 'full' },
  { label: 'English Tokenized', value: 'english' },
  { label: 'Strict', value: 'strict' },
  { label: 'Offload to Database', value: 'offload' }
];

// legacy blobs stored the display label ('Full', 'English Tokenized', ...)
const normalizeSearchLevel = (v) => {
  const value = String(v || '').toLowerCase();
  if (value === 'english' || value === 'english tokenized') return 'english';
  if (value === 'strict') return 'strict';
  if (value === 'offload' || value === 'offload to database') return 'offload';
  return 'full';
};

export const COMPANY_SECTIONS = [
  {
    // STORE-ONLY section except teamMessage (banner wired by enforcement-wiring).
    // Labels/descriptions/options/moreDescription verbatim from MEAS M1;
    // truncated MEAS captures keep only the captured opening text.
    key: 'general',
    label: 'General',
    fields: [
      {
        key: 'useQuantityRate',
        label: 'Use Quantity Rate',
        type: 'select',
        default: false,
        description: 'Determines how products should be sold after they have passed the previous price point.',
        moreDescription: '**Use quantity rate** determines how products should be sold after they have passed the previous price point. **Quantity Rate** works by taking the best “price rate” for the product which it is equal to or past… **High Mix Price** works by incrementally adding the previous price points until we reach the purchase quantity.\n\nShopfront will still calculate the best price for the customer by looking at all price points that are equal to or below the purchase quantity.',
        options: [
          { label: 'High Mix Price', value: false },
          { label: 'Quantity Rate', value: true }
        ]
      },
      {
        key: 'familyPriceDistributionMethod',
        label: 'Family Price Distribution Method',
        type: 'select',
        description: 'Determines how the price is distributed between family products.',
        moreDescription: "When running on **High Mix Price**, the **Family Price Distribution Method** controls how prices are distributed between a family of products. The **Match Price Point** option attempts to distribute the prices as close as it can to the product's purchase quantity… The **Evenly** option spreads the price evenly across all products in the family… For more information and examples, please check out our support article.",
        options: [
          { label: 'Match Price Points', value: 'Match Price Points' },
          { label: 'Evenly', value: 'Evenly' }
        ],
        // legacy stored value 'Proportional' displays (and re-saves) as "Evenly"
        normalize: (v) => (v === 'Proportional' ? 'Evenly' : v)
      },
      {
        key: 'priceRoundingMode',
        label: 'Price Rounding Mode',
        type: 'select',
        description: "Determines how the product's sell price should be distributed when there are too many decimal places.",
        moreDescription: "The **Price Rounding Mode** determines whether a product's sell price should be distributed or rounded when the number of decimal places of the calculated sell price exceeds the currency's number of decimal places.",
        options: [
          { label: 'Redistribute', value: 'Redistribute' },
          { label: 'Round', value: 'Round' }
        ],
        // legacy stored '' displays as the reference default (Redistribute)
        // but stays unsaved until the user touches the control
        normalize: (v) => v || 'Redistribute'
      },
      {
        key: 'costCalculationMethod',
        label: 'Cost Calculation Method',
        type: 'select',
        description: 'Determines how profit is calculated after you complete a sale.',
        moreDescription: 'The **Cost calculation method** determines how profit is calculated after you complete a sale. In Shopfront, there are three ways to do this. **Last Cost** is the simplest method to use, however it is the least accurate…',
        options: [
          { label: 'Last Cost', value: 'Last Cost' },
          { label: 'Mixed Mode', value: 'Mixed Mode' },
          { label: 'Average Cost', value: 'Average Cost' }
        ],
        // legacy stored 'Average' maps to "Average Cost"
        normalize: (v) => (v === 'Average' ? 'Average Cost' : v)
      },
      {
        key: 'profitabilityDisplay',
        label: 'Profitability Display',
        type: 'select',
        description: 'Determine how expected and received profit is displayed.',
        // measured verbatim from the reference panel 2026-08-17
        moreDescription: 'Shopfront supports showing expected and received profit in two ways, **Gross Profit Margin** and **Markup**.\n\n**Gross Profit Margin** is typically used by the liquor industry in Australia and is calculated using the following formula:\n\n(sell - cost) / sell * 100\n\n**Markup** is typically used by the fashion industry in Australia and is calculated using the following formula:\n\n(sell - cost) / cost * 100',
        options: [
          { label: 'Gross Profit Margin', value: 'Gross Profit Margin' },
          { label: 'Markup', value: 'Markup' }
        ]
      },
      {
        key: 'setPricesBasedOn',
        label: 'Set Prices Based On',
        type: 'select',
        default: 'Cost Calculation Method',
        description: 'Determine which cost you would like to see when setting your prices and displaying your profitability.',
        // measured verbatim from the reference panel 2026-08-17
        moreDescription: 'Select which cost you would like to see when setting your prices and displaying your profitability, by default this is set to **Cost Calculation Method** which will display the same profit when setting a price as what is calculated when performing a sale.\n\nThis does not affect how Shopfront calculates the cost for sales.\n\nFor example, if you have your cost calculation method set to **Average Cost** and your have a last cost of $20 and an average cost of $18, the following costs will be shown when editing prices:\n\n• **Cost Calculation Method**: Average Cost ($18)\n• **Last Cost**: Last Cost ($20)\n• **Highest Cost**: Last Cost ($20)',
        options: [
          { label: 'Cost Calculation Method', value: 'Cost Calculation Method' },
          { label: 'Last Cost', value: 'Last Cost' },
          { label: 'Highest Cost', value: 'Highest Cost' }
        ],
        // legacy stored 'Average' maps to "Cost Calculation Method"
        normalize: (v) => (v === 'Average' ? 'Cost Calculation Method' : v)
      },
      {
        key: 'useComponentsAndPackages',
        label: 'Use Components and Packages',
        type: 'toggle',
        description: 'Determine whether Components and Packages can be used.',
        moreDescription: '**Components** and **Packages** are ways to sell products within other products, they are similar to basket products however they allow for modification of the product during the sale. **Components** and **Packages** are typically used by stores selling hospitality products such as food.',
        disabledLabel: "Shopfront won't have the ability to create Components and Packages"
      },
      {
        key: 'productsCanHaveWeight',
        label: 'Products Can Have Weight',
        type: 'toggle',
        description: 'Determines whether products can be sold as weight instead of individual items.',
        moreDescription: "If you use scales in your store to measure products (such as fruit and vegetables), you can enable the **Products can have weight** toggle which will allow you to mark products as available to be weighed. You'll also need to configure your scales to work with Shopfront. More information can be found in our support article.",
        disabledLabel: "Products aren't sold by weight"
      },
      {
        // stored key keeps its historical typo - live blobs and consumers use it
        key: 'useBarocodeTemplates',
        label: 'Use Barcode Templates',
        type: 'toggle',
        description: 'Determines whether Barcode Templates will be enabled in Shopfront.',
        moreDescription: 'If you have barcodes that embed other information (such as price or quantity), you can use **Barcode Templates**. Typically having Delicatessen scales or selling Lotto tickets requires the use of **Barcode Templates**.',
        disabledLabel: "Shopfront won't handle Barcode Templates"
      },
      {
        key: 'sellCases',
        label: 'Sell Cases',
        type: 'toggle',
        description: 'If you buy and sell items in cases greater than one, then this allows Shopfront to manage your inventory in cases and items instead of just in items.',
        moreDescription: null,
        enabledLabel: 'Shopfront can manage inventory in Cases and Items'
      },
      {
        key: 'crossPromotionCount',
        label: 'Cross promotion count',
        type: 'toggle',
        description: 'Determines whether products that are on promotion, but not active on that promotion should count towards the quantity of the promotion.',
        // MEAS captured only the closing sentence of the 827-ch body
        moreDescription: 'Enabling **Cross promotion count** makes promotion calculation significantly quicker.',
        enabledLabel: 'Quantity counts across promotions'
      },
      {
        key: 'teamMessage',
        label: 'Team Message',
        type: 'text',
        description: 'The team message appears at the top of the screen next to the Shopfront logo for all users to see',
        moreDescription: null
      },
      {
        key: 'hoursUntilPriceChanges',
        label: 'Price Activation Time',
        type: 'number',
        default: 0,
        description: 'How many hours until price changes will take effect.',
        moreDescription: "When this setting is greater than zero, price changes won't take effect until that many hours have passed. You can also force price changes to take effect earlier by using the **Future Prices** page under the **Utilities** section in the **Menu**."
      },
      {
        key: 'activatePricesAfterPrinting',
        label: 'Activate Prices After Printing',
        type: 'toggle',
        default: false,
        // MEAS exposed no separate short description for this field
        moreDescription: "When using the new shelf tickets with future prices, enabling this setting allows you to automatically have tickets activate instead of needing to wait for their activation time or manually activating them. Future prices will still automatically activate when the time for activation is reached even if they haven't been printed yet. If enabled, prices may take a minute to activate after being printed.",
        visibleWhen: (v) => Number(v.hoursUntilPriceChanges) > 0
      }
    ]
  },
  {
    // STORE-ONLY section (app-wide terminology substitution out of scope)
    key: 'generalDisplay',
    label: 'General Display',
    fields: [
      {
        key: 'singleText',
        label: '"Single" Text',
        type: 'text',
        default: 'Item',
        description: "Determine what should be used instead of 'Single' throughout Shopfront.",
        moreDescription: 'The text to use instead of the word Single throughout Shopfront (invoices, reporting, products, etc). Suggestions include item and product or an industry / company specific term. We would suggest capitalising the first letter if it is possible for it to have a capital letter.'
      },
      {
        key: 'caseText',
        label: '"Case" Text',
        type: 'text',
        default: 'Case',
        description: "Determine what should be used instead of 'Case' throughout Shopfront.",
        moreDescription: 'The text to use instead of the word Case throughout Shopfront (such as the term **Case Quantity**). Suggestions include carton and box or an industry / company specific term. We would suggest capitalising the first letter if it is possible for it to have a capital letter.'
      }
    ]
  },
  {
    // STORE-ONLY except the auto-logout trio (idle timer wired by enforcement-wiring)
    key: 'login',
    label: 'Login',
    fields: [
      {
        key: 'signInType',
        label: 'Login Type',
        type: 'select',
        description: 'Determines how the login screen should be presented.',
        moreDescription: 'This determines how the login screen should be presented, and whether the user will have to type in their username or select it from a list. Selecting a username provides obscurity but not security. Shopfront provides the same level of security to both selecting a username and typing in a username.',
        options: [
          { label: 'Type username', value: 'Type username' },
          { label: 'Select user', value: 'Select user' }
        ],
        // legacy reference-vocabulary stored values map to our stored labels
        normalize: (v) => (v === 'type' ? 'Type username' : v === 'click' ? 'Select user' : v)
      },
      {
        key: 'maskUsername',
        label: 'Mask Username',
        type: 'toggle',
        description: 'Whether the username should be hidden behind.',
        moreDescription: 'This allows you to hide your username when typing it in behind a password input. Enabling this toggle provides obscurity but not security. Shopfront provides the same level of security to both masked and unmasked usernames.',
        disabledLabel: 'Username will be in plaintext'
      },
      {
        key: 'requirePassword',
        label: 'Require Password',
        type: 'toggle',
        default: true,
        description: 'Whether passwords are required after the first log in for the day.',
        moreDescription: 'Disabling this toggle prevent Shopfront from requiring a password after the first login for the day. Having require password disabled is less secure than requiring a password as it only requires one password to be compromised to gain full access to the system. When logging in without requiring a password, Shopfront uses an internal “one-time” password to log in that expires after a short time after the last login. For effective security, Shopfront would highly recommend requiring passwords on all login attempts.',
        enabledLabel: 'Password is always required'
      },
      {
        key: 'requirePasswordFirstLogin',
        label: 'Require Password on First Login of the Day for Each User',
        type: 'toggle',
        default: false,
        // schema-recovered field: no stamp/moreDescription exists in the reference
        description: 'Whether passwords are required for the first log in for the day.',
        moreDescription: null,
        visibleWhen: (v) => v.requirePassword === false
      },
      {
        key: 'generalAutoLogoutTime',
        label: 'General Auto Logout Time (in seconds)',
        type: 'number',
        default: 7200,
        constraints: { min: 60, max: 7200 },
        description: 'The amount of time until Shopfront automatically logs you out without interaction on all pages.',
        moreDescription: 'The amount of time until Shopfront automatically logs you out on all pages. Shopfront counts this from the time of the last activity including mouse clicks and keyboard presses. This affects all pages, the sell screen can be specifically overridden by specifying the time in the **Sell screen Auto Logout Time (in seconds)** setting. This has a minimum value of one minute (60 seconds) and a maximum value of two hours (7,200 seconds).'
      },
      {
        key: 'autoLogoutTime',
        label: 'Sell Screen Auto Logout Time (in seconds)',
        type: 'number',
        default: 0,
        description: "The amount of time until Shopfront automatically logs you out without interaction when you're on the sell screen.",
        moreDescription: "The amount of time until Shopfront automatically logs you out when you're on the sell screen… This does not affect other pages other than the sell screen…"
      },
      {
        key: 'autoLogoutDuringSale',
        label: 'Auto Logout During Sale',
        type: 'toggle',
        description: 'Whether to automatically log out while a sale is in progress.',
        // measured verbatim from the reference panel 2026-08-17
        moreDescription: 'Whether to automatically log out while a sale is in progress. If enabled Shopfront will log out the user once the amount of time specified in **Auto logout time** has passed even if a sale exists on the sell screen.\n\nThe sale won\'t be lost, once the user has logged back in the sale will be visible again.\n\nThis only affects the **Sell screen Auto Logout Time (in seconds)** setting.',
        disabledLabel: 'Active sales prevent auto logout'
      }
    ]
  },
  {
    // STORE-ONLY: the first five toggles (behavior wiring out of scope);
    // the reason/note/invoice fields are wired by enforcement-wiring and
    // allowCashOutWithoutSale is already enforced on the sell screen.
    // Labels/descriptions/helper labels/moreDescription verbatim from MEAS M2
    // (including the reference's sic labels - see per-field comments).
    key: 'sellScreen',
    label: 'Sell Screen / Register',
    fields: [
      {
        key: 'showProductDetailsOnAdd',
        label: 'Show Product Details When a Product is Added to the Sale',
        type: 'toggle',
        description: 'Whether product details should be shown when a product is added to the sale.',
        moreDescription: "When enabled, the product details will be automatically shown whenever a product is added to the sell screen (e.g. barcode scanned, sale key pressed, product searched). This is the same as pressing the product's name during the sale.",
        enabledLabel: 'Display product details',
        disabledLabel: 'Add to sale directly'
      },
      {
        // reference title has this grammar (missing "When") - kept verbatim
        key: 'displayCustomerDetailsOnAdd',
        label: 'Display Customer Details a Customer is Added to the Sale',
        type: 'toggle',
        description: "Whether the customer's details should be shown when they are added to the sale.",
        moreDescription: "When enabled, this will overlay the sale with the customer view screen once a customer has been added. This is the same as pressing the customer's name during the sale.",
        enabledLabel: 'Display customer details',
        disabledLabel: 'Add customer directly to sale'
      },
      {
        key: 'preventBlurOnFocusLoss',
        label: 'Prevent Blur on Focus Loss on Sell Screen',
        type: 'toggle',
        description: 'Whether an overlay is shown when the sell screen loses focus.',
        moreDescription: "When disabled and focus has been removed from the sell screen (e.g. to use Windows) an overlay will appear to notify you that focus has been removed and you'll need to tap the screen to continue to use Shopfront.\n\nYou'll still need to return focus to Shopfront to use it, the overlay just lets you know that focus has been lost.",
        enabledLabel: 'Ignore losing focus',
        disabledLabel: 'Show focus loss'
      },
      {
        key: 'keepSelectProductPopupOpen',
        label: 'Keep Select Product Popup Open',
        type: 'toggle',
        description: 'Whether the display all products sale key remains open after selecting an item and adding it to the sell screen.',
        // missing space after the "Classification" bold marker is verbatim
        // from the reference's source markup
        moreDescription: 'Enabling this toggle will ensure that the **Display all Products in Classification**and **Display a list of Components** sale keys will remain open after adding a product rather than closing the dialog.',
        enabledLabel: 'Select products remains open',
        disabledLabel: 'Select products automatically closes'
      },
      {
        key: 'makeSelectProductPopupPaginated',
        label: 'Make Select Product Popup Paginated by Default',
        type: 'toggle',
        description: 'Whether the display all products sale key should be paginated or a continuous list by default.',
        moreDescription: 'When enabled, this will make the **Display all Products in Classification** and the **Display a list of Components** sale keys appear as paginated by default instead of a list. The functionality can still be changed while the sale key is open.',
        enabledLabel: 'Select products is paginated',
        disabledLabel: 'Select products is a continuous list'
      },
      {
        key: 'discountsRequireReason',
        label: 'Discounts Require Reason',
        type: 'toggle',
        // "provided" is verbatim from the reference
        description: 'Whether users are forced to provided a reason when a discount is applied.',
        moreDescription: 'Forces the user to provide a reason when they discount a product or the sale. If using an integration that creates sales, this does *not* require that the integration adds a reason for overriding the price.',
        enabledLabel: 'Force a reason to be provided',
        disabledLabel: "Don't require a reason"
      },
      {
        // string[] in the company blob, edited via the Edit Reasons slide-over
        key: 'predefinedDiscountReasons',
        label: 'Predefined Discount Reasons',
        type: 'custom',
        // "a user to select" is verbatim from the reference
        description: 'The list of reasons a user to select to determine why a sale can be discounted.',
        visibleWhen: (v) => v.discountsRequireReason === true
      },
      {
        key: 'refundsRequireReason',
        label: 'Refunds Require Reason',
        type: 'toggle',
        description: 'Whether users are forced to provide a reason when a product is refunded.',
        moreDescription: 'Forces the user to provide a reason when they refund a product. This is any time a negative quantity appears in the sale, not just when the sale total price is negative. If using an integration that creates sales, this does require that the integration adds a reason for providing a refund.',
        enabledLabel: 'Force a reason to be provided',
        disabledLabel: "Don't require a reason"
      },
      {
        key: 'requireReasonForCashDrawer',
        label: 'Require reason when opening the cash drawer',
        type: 'toggle',
        // no trailing period - verbatim
        description: 'Forces the user to provide a reason when they open the cash drawer',
        enabledLabel: 'Force a reason to be provided',
        disabledLabel: "Don't require a reason"
      },
      {
        // string[] in the company blob, edited via the Edit Reasons slide-over
        key: 'predefinedCashDrawerReasons',
        label: 'Predefined Cash Drawer Reasons',
        type: 'custom',
        description: 'The list of reasons a user to select to determine why the cash drawer was opened',
        visibleWhen: (v) => v.requireReasonForCashDrawer === true
      },
      {
        // backed by the cash_out_reasons row (cash-drawer-reasons API), NOT the blob
        key: 'predefinedCashOutReasons',
        label: 'Predefined Cash Out Reasons',
        type: 'custom',
        // reference says "added" even for cash OUT - verbatim
        description: 'The list of reasons a user to select to determine why cash was added to the drawer'
      },
      {
        // backed by the cash_in_reasons row (cash-drawer-reasons API), NOT the blob
        key: 'predefinedCashInReasons',
        label: 'Predefined Cash In Reasons',
        type: 'custom',
        description: 'The list of reasons a user to select to determine why cash was added to the drawer'
      },
      {
        key: 'allowCashOutWithoutSale',
        label: 'Allow cash out without sale',
        type: 'toggle',
        default: true,
        description: 'Whether cash out can be provided without paying for products in a sale.',
        moreDescription: 'When enabled this allows providing cash out without paying for any products when a payment method which supports cash out is selected from the sales keys.',
        // "Can provided" is verbatim from the reference
        enabledLabel: 'Can provided cash out anytime',
        disabledLabel: 'Cash out must have a sale'
      },
      {
        key: 'requireNoteOnParkedSale',
        label: 'Require Note on Parked Sale',
        type: 'toggle',
        description: 'Forces the user to add a note when they park / hold a sale.',
        enabledLabel: 'Parked sales require notes',
        disabledLabel: "Parked sales don't need notes"
      },
      {
        key: 'invoiceNumberLength',
        label: 'Invoice number length',
        type: 'number',
        default: 8,
        constraints: { min: 0, max: 20, step: 1, required: true },
        description: 'The minimum length for an invoice number, if your store has not reached the length specified the invoice number will be padded with zeros.',
        moreDescription: 'The minimum length for an invoice number, if your store has not reached the length specified the invoice number will be padded with zeros.\n\nExample, **Invoice number length** is set to eight and the **Current invoice number** is 1234 - the invoice number will end up being 00001234.'
      }
    ]
  },
  {
    // Company > Outlets SECTION (the local Outlets tab is separate and untouched).
    // shareGiftCardsBetweenOutlets is STORE-ONLY (no outlet gate in the redeem
    // flow); shareParkedSalesBetweenOutlets is wired by enforcement-wiring.
    // Neither field has a More Info button in the reference.
    key: 'outlets',
    label: 'Outlets',
    fields: [
      {
        key: 'shareParkedSalesBetweenOutlets',
        label: 'Share Parked Sales Between Outlets',
        type: 'toggle',
        default: true,
        description: "When enabled, all parked sales will appear in all Outlet's **Parked Sales** sell screen option tab.",
        enabledLabel: 'Parked sales shared between outlets',
        disabledLabel: 'Parked sales unique per outlet'
      },
      {
        key: 'shareGiftCardsBetweenOutlets',
        label: 'Share Gift Cards Between Outlets',
        type: 'toggle',
        default: true,
        description: 'When enabled, all gift cards will be available to use in all Outlets. When disabled, the gift card must be redeemed at the Outlet it was purchased at.',
        enabledLabel: 'Gift cards shared between outlets',
        disabledLabel: 'Gift cards unique per outlet'
      }
    ]
  },
  {
    // STORE-ONLY: timezone + startOfWeek (nothing reads them yet).
    // dateFormat / timeFormat are rendered by the custom control in
    // GeneralSettings.jsx (dropdown + live "Example") and consumed by
    // utils/dateFormat.js. Labels/descriptions/options verbatim from MEAS M3.
    key: 'dateTime',
    label: 'Date & Time',
    fields: [
      {
        key: 'timezone',
        label: 'Timezone',
        type: 'select',
        // the reference control is an editable, filterable combobox
        searchable: true,
        default: 'Australia/Sydney',
        description: 'The timezone that all times should be shown in. Shopfront internally stores all times as UTC so timezones can be changed and all historical data will reflect the new timezone.',
        moreDescription: null,
        options: TIMEZONE_OPTIONS
      },
      {
        key: 'dateFormat',
        label: 'Date Format',
        type: 'custom',
        default: 'DD/MM/YYYY',
        constraints: { required: true },
        // the reference ends the sentence with the tokens hyperlink, no period
        description: 'The formatting used for dates around Shopfront',
        link: { text: 'View the tokens here', href: FORMAT_TOKENS_URL },
        moreDescription: null,
        options: [
          { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
          { label: 'DD-MM-YYYY', value: 'DD-MM-YYYY' },
          { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
        ]
      },
      {
        key: 'timeFormat',
        label: 'Time Format',
        type: 'custom',
        default: 'HH:mm:ss',
        constraints: { required: true },
        // "around the Shopfront" is verbatim from the reference
        description: 'The formatting used for times around the Shopfront',
        link: { text: 'View the tokens here', href: FORMAT_TOKENS_URL },
        moreDescription: null,
        options: [
          { label: 'HH:mm:ss', value: 'HH:mm:ss' },
          { label: 'h:mm:ssa', value: 'h:mm:ssa' },
          { label: 'H:mm:ss', value: 'H:mm:ss' },
          { label: 'hh:mm:ss a', value: 'hh:mm:ss a' }
        ]
      },
      {
        key: 'startOfWeek',
        label: 'Start of the Week',
        type: 'select',
        default: 'monday',
        description: 'The day of the week that the week starts on, this changes all calendars and reports to use this day as the start of the week.',
        moreDescription: 'The day of the week that the week starts on, this changes all calendars and reports to use this day as the start of the week. Internally Shopfront uses the start of the week as a Sunday.\nShopfront recommends using either Sunday or Monday as the start of the week.',
        options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          .map((day) => ({ label: day, value: day.toLowerCase() })),
        // legacy blobs stored the capitalised day name
        normalize: (v) => String(v || 'monday').toLowerCase()
      }
    ]
  },
  {
    // roundTo / currencyCode / numberLocale are wired by enforcement-wiring
    // (FinalizeSaleDialog rounding + utils/currency.js). MEAS M3 verbatim.
    key: 'currency',
    label: 'Currency',
    fields: [
      {
        key: 'roundTo',
        label: 'Round To',
        type: 'number',
        default: 0.05,
        // the reference schema only constrains the minimum
        constraints: { min: 1e-7 },
        // no trailing period - verbatim
        description: 'The minimum denomination to round any payment method that has **Use Rounding** enabled',
        moreDescription: "The minimum denomination to round any payment method that has **Use Rounding** enabled. For Australia this is 0.05 as five cents is the minimum denomination. For countries that don't use a fractional currency, this should be set to 1."
      },
      {
        key: 'currencyCode',
        label: 'Currency Code',
        type: 'select',
        default: 'AUD',
        description: 'This determines how currency should be displayed in your store.',
        moreDescription: 'This determines how currency should be displayed in your store, if your currency code is not on this list, please contact Shopfront so we can add support for it.',
        options: [
          { label: 'Australian Dollars (AUD)', value: 'AUD' },
          { label: 'Baht (THB)', value: 'THB' },
          { label: 'Columbian Peso (COP)', value: 'COP' },
          { label: 'Euro (EUR)', value: 'EUR' },
          { label: 'Hong Kong Dollar (HKD)', value: 'HKD' },
          { label: 'Indian Rupee (INR)', value: 'INR' },
          { label: 'New Zealand Dollars (NZD)', value: 'NZD' },
          { label: 'Pound Sterling (GBP)', value: 'GBP' },
          { label: 'Rupiah (IDR)', value: 'IDR' },
          { label: 'US Dollars (USD)', value: 'USD' },
          { label: 'Vatu (VUV)', value: 'VUV' },
          { label: 'Yen (JPY)', value: 'JPY' },
          { label: 'Yuan Renminbi (CNY)', value: 'CNY' }
        ],
        // legacy blobs stored the display label ("Australian Dollars (AUD)")
        normalize: (v) => (String(v || '').match(/\(([A-Z]{3})\)/)?.[1] || v || 'AUD')
      },
      {
        key: 'numberLocale',
        label: 'Number Locale',
        type: 'text',
        default: '',
        placeholder: 'en-AU',
        // "to use format" is verbatim from the reference
        description: 'This determines the format to use format the currency in your store. BCP 47 format [language-country].',
        moreDescription: "This determines the format to use format the currency in your store, it's used alongside the **Currency Code** for when multiple formats may exist for a single currency.\nFor Australia this is en-AU."
      }
    ]
  },
  {
    // STORE-ONLY section: our search runs off IndexedDB with a fixed strategy.
    // More Info bodies render each option name bold followed by its definition,
    // matching the reference's term/definition runs.
    key: 'search',
    label: 'Search',
    fields: [
      {
        key: 'customerSearchLevel',
        label: 'Customer Search Level',
        type: 'select',
        default: 'full',
        description: 'This customises how in-depth the search is in Shopfront for customers.',
        moreDescription: "This customises how in-depth the search is in Shopfront for customers. Typically you will leave it on the default value of **Full**.\nA page refresh is required after changing this setting for it to take effect.\n**Full** Search from anywhere within the string in any order. Works with any language. Has the highest memory usage.\n**English Tokenized** Similar to **Full** except it only works with English, any non-English characters aren't able to get searched for. Has a moderate amount of memory usage.\n**Strict** Can only search from the beginning of words. Works with any language. Has the lowest memory usage of any in-memory search option.\n**Offload to Database** Offloads the search to the local database instead of searching within memory, reduces search performance (as it requires a lookup to the database) however uses next to no memory.",
        options: SEARCH_LEVEL_OPTIONS,
        normalize: normalizeSearchLevel
      },
      {
        key: 'productSearchLevel',
        label: 'Product Search Level',
        type: 'select',
        default: 'full',
        description: 'This customises how in-depth the search is in Shopfront for products.',
        moreDescription: "This customises how in-depth the search is in Shopfront for products. Typically you will leave it on the default value of **Full**.\nA page refresh is required after changing this setting for it to take effect.\n**Full** Search from anywhere within the string in any order. Works with any language. Has the highest memory usage.\n**English Tokenized** Similar to **Full** except it only works with English, any non-English characters aren't able to get searched for. Has a moderate amount of memory usage.\n**Strict** Has the lowest memory usage. Can only search from the beginning of words. Works with any language.\n**Offload to Database** Offloads the search to the local database instead of searching within memory, reduces search performance (as it requires a lookup to the database) however uses next to no memory.",
        options: SEARCH_LEVEL_OPTIONS,
        normalize: normalizeSearchLevel
      },
      {
        key: 'searchCacheSaveLocation',
        label: 'Search Cache Save Location',
        type: 'select',
        default: 'indexeddb',
        // no trailing period - verbatim
        description: 'This determines where we should save the search cache for each device',
        moreDescription: 'This determines where we should save the search cache for each device. Typically it\'s best to leave this as "Local Database" as it allows the cache to be reused between page reloads. However if you have a slow hard drive or need extra hard drive space, this can be set to none which will recalculate the cache on the first page load of the day.',
        options: [
          { label: 'Local Database', value: 'indexeddb' },
          { label: "Don't Cache", value: 'none' }
        ],
        // legacy blobs stored the display label (or nothing at all)
        normalize: (v) => (v === 'None' || v === 'none' ? 'none' : 'indexeddb')
      }
    ]
  },
  {
    // STORE-ONLY: we have no Metcash host file importer.
    key: 'integrations',
    label: 'Integrations',
    fields: [
      {
        // stored key keeps its historical typo - live blobs and consumers use it
        key: 'metacashHostFileIntegration',
        label: 'Metcash Host File Integration',
        type: 'toggle',
        default: true,
        description: 'This enables basic Metcash host file integration support, including mapping of MSC. Additional settings can be enabled and disabled for more in-depth integration.',
        moreDescription: null,
        enabledLabel: 'Shopfront is connected to the Host File',
        disabledLabel: "Shopfront doesn't use the Host File"
      }
    ]
  },
  {
    // defaultSaleKeys is already enforced; saleKeysPosition and the statement
    // reply-to email are wired by enforcement-wiring; the rest are STORE-ONLY.
    key: 'miscellaneous',
    label: 'Miscellaneous',
    fields: [
      {
        key: 'defaultSaleKeys',
        label: 'Default Sale Keys',
        type: 'custom',
        description: 'Which sale key folder to use as the default set of keys, this can be overridden on an Outlet, Register and User level.'
      },
      {
        key: 'saleKeysPosition',
        label: 'Sale Keys Position',
        type: 'select',
        default: 'left',
        // no trailing period - verbatim
        description: 'Show sale keys on the left-hand side or right-hand side of the sell screen',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' }
        ],
        // legacy blobs stored 'Left'/'Right'/'Top'/'Bottom'/'' - only the two
        // reference positions exist, everything else falls back to left
        normalize: (v) => (String(v || '').toLowerCase() === 'right' ? 'right' : 'left')
      },
      {
        // key kept, reference title differs
        key: 'getNotificationOnProductCreation',
        label: 'Price Change Notifications',
        type: 'toggle',
        default: false,
        // "Outlet's" is verbatim from the reference
        description: "When enabled, this will create an internal Shopfront notification for all Outlet's whenever a price has been changed or a product has been created.",
        moreDescription: null,
        enabledLabel: 'Receive Notifications',
        disabledLabel: 'Ignore Notifications'
      },
      {
        key: 'globalStatementReplyToEmail',
        label: 'Global Statement "Reply To" Email',
        type: 'text',
        inputType: 'email',
        description: 'The email address to use as the **Reply To** address when sending statements.',
        moreDescription: 'The email address to use as the **Reply To** address when sending statements.\nThis can be overridden by each statement.'
      },
      {
        key: 'showAverageCostOnPriceEditor',
        label: 'Show Average Cost on Price Editor When Editing Orders',
        type: 'toggle',
        default: false,
        description: 'When receiving and sending orders and this toggle is enabled, the price editor (when the product line has been expanded) will show the new average cost.',
        moreDescription: 'When receiving and sending orders and this toggle is enabled, the price editor (when the product line has been expanded) will show the new average cost. If disabled, this will show the new last cost.\nThis setting has no effect when **Cost calculation method** is set to **Last Cost**.',
        enabledLabel: 'Order prices use average cost',
        disabledLabel: 'Order prices use current cost'
      },
      {
        key: 'defaultNewUsersReportingAccessAllOutlets',
        label: 'Default New Users to Reporting Access for All Outlets',
        type: 'toggle',
        default: true,
        description: 'Whether creating new users should default to them receiving reporting access to all Outlets.',
        moreDescription: "When enabled, this will set the *Enable Reporting for All Outlets* toggle to true in the user create dialog.\nThis doesn't have an effect on user permissions and users without permissions to run reports won't be able to.\nYou can always change the Outlets users have reporting access to by modifying them.",
        enabledLabel: 'Automatically provide all outlet access',
        disabledLabel: 'Automatically provide no outlet access'
      },
      {
        key: 'debugLoggingLevel',
        label: 'Debug Logging Level',
        type: 'select',
        default: 'normal',
        description: 'The level of logging to record in the local database.',
        moreDescription: 'The level of logging to record in the local database. This only affects what data Shopfront can retrieve when getting bug diagnostics out of your computer.\nIncreasing the level of logging can assist Shopfront with debugging issues you report, however it may reduce the speed of Shopfront on some devices.\nNo matter which level is selected, logs are only stored for 7 days before being removed.',
        options: [
          { label: 'Essential', value: 'essential' },
          { label: 'Normal', value: 'normal' },
          { label: 'Verbose', value: 'verbose' }
        ],
        // legacy blobs stored None/Error/Warning/Info/Debug/'' - none of which
        // exist in the reference; they all land on the default level
        normalize: (v) => (['essential', 'verbose'].includes(String(v).toLowerCase())
          ? String(v).toLowerCase()
          : 'normal')
      }
    ]
  }
];

// Static search index of the local-only tabs (fields hand-listed from the
// current JSX) so "Search Settings..." always covers every tab.
const local = (tab, tabIndex, sectionLabel, labels) =>
  labels.map((fieldLabel) => ({ tab, tabIndex, sectionLabel, fieldLabel }));

export const LOCAL_TAB_FIELDS = [
  ...local('Company', 0, 'Local settings', ['Default Sale Keys by Outlet']),
  ...local('Outlets', 1, 'General', ['Email receipt template', 'Outlet email']),
  ...local('Outlets', 1, 'Gift Cards', [
    'Enable gift cards', 'Default expiry amount', 'Default expiry period', 'Can manually adjust expiry'
  ]),
  ...local('Outlets', 1, 'Transfers', ['Update last cost when receiving transfers']),
  ...local('Outlets', 1, 'Metcash Integration', [
    'B2B Account (leave blank for default)', 'B2B Password (leave blank for default)',
    'Customer ID', 'State', 'Pillar', 'Import Promotions', 'Import Buying Periods'
  ]),
  ...local('Outlets', 1, 'Miscellaneous', ['Discounting Below Cost Behaviour']),
  ...local('Registers', 2, 'General', [
    'Safe drop alert amount', 'Default Receipt Template'
  ]),
  ...local('Registers', 2, 'Sell Screen', [
    'Login after sale', 'Never open cash drawer', 'Print receipt on refund',
    'Use Tyro integrated receipts', 'Consolidate products', 'Allow training mode to be toggled',
    'Require note on register closure with discrepancy', 'Run promotion calculation in a dedicated thread'
  ]),
  ...local('Registers', 2, 'Customer Display', [
    'Customer display template', 'Open customer display when register opens', 'Customer display mode'
  ]),
  ...local('Registers', 2, 'Invoices', [
    'Offline invoice suffix', 'Invoice Number Mode',
    'Invoice max number (until next invoice batch requested)'
  ]),
  ...local('Users', 3, 'Miscellaneous', ['Sale Keys', 'Sale Keys Position'])
];

// Legacy blobs hold display labels ("Australian Dollars (AUD)", "Monday") and
// blanks. Applying `normalize` at render only fixed the pixels: state kept the
// raw value, the next save wrote it back, and every consumer outside this page
// read the raw value from the shared cache. Normalise on LOAD instead.
export const normalizeCompanySettings = (values = {}) => {
  const out = { ...values };
  for (const section of COMPANY_SECTIONS) {
    for (const field of section.fields) {
      if (field.normalize && field.key in out) out[field.key] = field.normalize(out[field.key]);
    }
  }
  return out;
};

// Number/required constraints by key, for clamping on blur - the DOM min/max
// only stops spinner clicks, typing and paste sail straight past it.
export const COMPANY_CONSTRAINTS = Object.fromEntries(
  COMPANY_SECTIONS.flatMap((section) =>
    section.fields
      .filter((f) => f.constraints)
      .map((f) => [f.key, { ...f.constraints, type: f.type, fallback: f.default }])
  )
);
