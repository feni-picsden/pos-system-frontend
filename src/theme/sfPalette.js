// Semantic colour tokens for the Crinit Shop UI, one set per theme mode.
//
// The pages were built against the reference with fixed colours (white panes,
// black text, #404040 input borders ...). Dark mode (Profile > Theme) needs the
// same roles in other colours, so every fixed colour a page used maps to a role
// here and the page reads the role instead:
//
//   sx={{ bgcolor: 'sf.pane', color: 'sf.text', borderColor: 'sf.border' }}
//
// MUI resolves 'sf.<role>' through theme.palette.sf (see buildTheme), so no
// hook is needed inside sx. Outside sx (recharts, style props, plain CSS-in-JS
// strings) use useTheme().palette.sf / sfOf(theme).
//
// Light values are the reference's own colours: light mode is pixel-identical
// to before. Dark values are measured off the reference's Force Dark Mode
// screenshots (Utilities > Barcodes + date-range picker, 18/11/2026).

export const SF_LIGHT = {
  // Surfaces
  page: '#ffffff',       // body / main background
  pane: '#f8f8f8',       // content pane, menus, popovers
  paneAlt: '#ebebeb',    // zebra row / secondary pane
  paper: '#ffffff',      // cards, table rows, dropdown papers
  input: '#ffffff',      // text fields / selects
  paperAlt: '#e8e8e8',   // hover on pane rows
  pressed: '#e0e0e0',    // active press
  chip: '#e5e5e5',       // filter chips
  headerBar: '#313439',  // top app bar (same in both modes)
  overlayHover: 'rgba(0,0,0,0.04)',
  overlayPress: 'rgba(0,0,0,0.05)',
  tableHead: '#5ebbeb',      // list table header bar
  onTableHead: '#ffffff',
  onPrimaryButton: '#ffffff', // text on the blue Apply / Save buttons
  rangeTint: '#e4f2fb',       // date-range picker in-range / hover tint
  dialogHead: '#fde8e8',      // delete-dialog light-red header
  dialogTitle: '#e33430',     // its "!" + title
  dialogBorder: '#000000',
  dialogCancel: '#8a8d91',
  dialogCancelHover: '#76797d',
  dialogDanger: '#e33430',
  dialogDangerHover: '#cc2f2a',
  onDialogDanger: '#ffffff',
  menuHover: '#5ebbeb',       // dropdown option hover (text #f8f8f8)
  menuSelectedText: '#00a6f4', // ticked / selected option text in list dropdowns
  // Product create / edit form
  formBand: '#eef3f8',        // blue-grey header band behind the tabs (light: as built today, see page)
  formPage: '#ffffff',        // form body
  formTab: '#ffffff',         // active tab
  // Buttons
  btnPrimary: '#5ebbeb',      // blue action button (Add Product / Save / Apply)
  onBtnPrimary: '#ffffff',
  btnSuccess: '#32b643',      // green action button (New Barcode / Add Loyalty Row)
  onBtnSuccess: '#ffffff',
  btnOutlineText: '#313439',  // outlined secondary button text (Import / Merge Products)
  btnOutlineBorder: '#404040',
  actionView: '#1c86f2',      // list row actions
  actionEdit: '#32b643',
  actionDelete: '#dc2626',
  // Product view
  rail: '#f8f8f8',            // right nav rail / top title bar
  railActive: '#5ebbeb',
  tableBorder: '#000000',     // in-widget grid lines
  revisionFrom: '#f8d7da',    // revision history "from" (removed) cells
  revisionTo: '#d4edda',      // "to" (added) cells
  bulkBar: '#5ebbeb',         // "N Selected" bottom bar
  onBulkBar: '#000000',
  bulkDanger: '#fb2c36',      // "Delete Selected" button on that bar
  bulkDangerHover: '#ff6467',
  onBulkDanger: '#ffffff',

  // Text
  text: '#000000',
  textStrong: '#171717',
  textSlate: '#313439',
  textMuted: '#676b72',
  textFaint: '#808080',  // placeholders
  textDim: '#a3a3a3',    // version lines, hints
  textSoft: '#737373',   // hover text in nav
  textGrey: 'rgb(112,112,112)',
  onAccent: '#ffffff',   // text on the #5ebbeb blue / coloured bars
  onAccentSoft: '#f8f8f8',

  // Lines
  border: '#404040',       // input border
  borderStrong: '#000000', // focused input / grid lines
  borderSlate: '#313439',
  borderLight: '#e0e0e0',
  divider: '#f0f0f0',
  dividerSoft: '#eeeeee',

  // Links
  link: '#0000ee',
  linkVisited: '#551a8b',

  // Date-range calendar
  calDay: '#33a3e0',
  calOutside: '#c4c4c4',
  calWeekday: '#737373',
  calTitle: '#000000',

  // Switch (ShopfrontSwitch)
  switchOff: '#a1a1a1',
  switchOffHover: '#737373',
  switchOn: '#5ebbeb',
  switchOnHover: '#4aa9dd',

  // Accent colours stay the same in both modes (brand / status)
  accent: '#5ebbeb',
  accentHover: '#4aa9dd',
  accentStrong: '#1c86f2',
  success: '#32b643',
  warning: '#f6993f',
  danger: '#e3342f',
  dangerText: '#dc2626',
  icon: '#136e9d',
};

export const SF_DARK = {
  page: '#121212',
  pane: '#232323',
  paneAlt: '#2b2b2b',
  paper: '#232323',
  input: '#121212',
  paperAlt: '#303030',
  pressed: '#3a3a3a',
  chip: '#3a3a3a',
  headerBar: '#313439',
  overlayHover: 'rgba(255,255,255,0.08)',
  overlayPress: 'rgba(255,255,255,0.10)',
  tableHead: '#333333',       // reference dark: dark-grey bar, blue text
  onTableHead: '#5ebbeb',
  onPrimaryButton: '#232323', // reference dark: dark text on the blue button
  rangeTint: '#1f3a4a',
  dialogHead: '#82181a',      // reference dark delete dialog: dark-red header
  dialogTitle: '#ff6467',
  dialogBorder: '#232323',
  dialogCancel: '#3a3a3a',
  dialogCancelHover: '#4a4a4a',
  dialogDanger: '#ffa2a2',
  dialogDangerHover: '#ffb8b8',
  onDialogDanger: '#7a1f1f',
  menuHover: '#0084d1',
  menuSelectedText: '#00a6f4',
  formBand: '#314158',
  formPage: '#202020',
  formTab: '#202020',
  btnPrimary: '#5ebbeb',
  onBtnPrimary: '#232323',
  btnSuccess: '#7bf1a8',
  onBtnSuccess: '#232323',
  btnOutlineText: '#d4d4d4',
  btnOutlineBorder: '#a1a1a1',
  actionView: '#74d4ff',
  actionEdit: '#7bf1a8',
  actionDelete: '#ffa2a2',
  rail: '#232323',
  railActive: '#5ebbeb',
  tableBorder: '#333333',
  revisionFrom: '#492625',
  revisionTo: '#264029',
  bulkBar: '#333333',
  onBulkBar: '#f8f8f8',
  bulkDanger: '#ffa2a2',
  bulkDangerHover: '#ffb8b8',
  onBulkDanger: '#232323',

  text: '#f8f8f8',
  textStrong: '#f8f8f8',
  textSlate: '#d4d4d4',
  textMuted: '#a0a4aa',
  textFaint: '#757575',
  textDim: '#6e6e6e',
  textSoft: '#b5b9bf',
  textGrey: '#a0a4aa',
  onAccent: '#ffffff',
  onAccentSoft: '#f8f8f8',

  border: '#a1a1a1',
  borderStrong: '#2b7fff',  // reference dark: focused field turns blue
  borderSlate: '#5a5a5a',
  borderLight: '#333333',
  divider: '#2f2f2f',
  dividerSoft: '#343434',

  link: '#4ca0f5',
  linkVisited: '#b28cea',

  calDay: '#74d4ff',
  calOutside: '#424242',
  calWeekday: '#5e5e5e',
  calTitle: '#d4d4d4',

  switchOff: '#404040',
  switchOffHover: '#555555',
  switchOn: '#193cb8',
  switchOnHover: '#2149c9',

  accent: '#5ebbeb',
  accentHover: '#4aa9dd',
  accentStrong: '#1c86f2',
  success: '#32b643',
  warning: '#f6993f',
  danger: '#e3342f',
  dangerText: '#ffa2a2',
  icon: '#5ebbeb',
};

export const sfTokens = (mode) => (mode === 'dark' ? SF_DARK : SF_LIGHT);

// theme.palette.sf, with a light fallback for anything rendered outside the ThemeProvider.
export const sfOf = (theme) => (theme && theme.palette && theme.palette.sf) || SF_LIGHT;

// Picks a value by mode inside an sx function: sx={{ color: byMode('#000', '#fff') }}
export const byMode = (light, dark) => (theme) => (theme.palette.mode === 'dark' ? dark : light);
