import React, { useState, useEffect } from "react";
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  IconButton,
  Tabs,
  Tab,
  Autocomplete,
  Link,
} from "@mui/material";
import IsoPeriodHelpDrawer from '../../components/Customers/IsoPeriodHelpDrawer';
import {
  PersonOutlined as PersonIcon,
  ReceiptOutlined as ReceiptIcon,
  StarOutline as StarIcon,
  LocalOfferOutlined as LocalOfferIcon,
  AccountBalanceOutlined as AccountBalanceIcon,
  ArrowBackOutlined as ArrowBackIcon,
  SaveOutlined as SaveIcon,
  AddOutlined as AddIcon,
  DeleteOutline as DeleteIcon,
  InfoOutlined as InfoIcon,
  ReceiptLongOutlined as ReceiptTabIcon,
  BalanceOutlined as BalanceIcon,
} from "@mui/icons-material";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import customerGroupService from "../../services/customerGroupService";
import priceListService from "../../services/priceListService";
import outletService from "../../services/outletService";
import receiptTemplateService from "../../services/receiptTemplateService";
import statementTemplateService from "../../services/statementTemplateService";
import { useAuth } from "../../contexts/AuthContext";
import { useSelectedOutlet } from "../../contexts/SelectedOutletContext";
import PageSaveBar from '../../components/Common/PageSaveBar';

// ---- Shopfront reference styling ------------------------------------------
const FORM_WIDTH = 764;
const PAGE_PX = 3;
// Title, tabs and form share one centered column of FORM_WIDTH.
const COLUMN_SX = { maxWidth: FORM_WIDTH, mx: 'auto', width: '100%' };

const FIELD_SX = {
  width: '100%',
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: 16,
    minHeight: 42,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
  },
  '& .MuiAutocomplete-inputRoot.MuiOutlinedInput-root': { padding: '0 9px' },
  '& .MuiOutlinedInput-input': { height: 40, py: 0, boxSizing: 'border-box', fontSize: 16 },
  '& .MuiInputBase-input::placeholder': { color: '#808080', opacity: 1 },
};

// Option panel: bordered, no elevation, no grow animation, 56px rows, full-row blue highlight
const PANEL_PROPS = {
  paper: {
    sx: {
      borderRadius: '8px',
      border: '1px solid #171717',
      boxShadow: 'none',
      '& .MuiAutocomplete-listbox': { p: 0 },
      '& .MuiAutocomplete-option': {
        minHeight: 56,
        px: 2,
        fontSize: 16,
        color: '#313439',
        // !important: a global light-grey option tint (MUI's own focused colour)
        // otherwise won the background while the text stayed white, so the
        // hovered option ("Receipt") was unreadable.
        '&.Mui-focused, &[aria-selected="true"], &[aria-selected="true"].Mui-focused, &:hover': {
          backgroundColor: '#5ebbeb !important',
          color: '#f8f8f8',
        },
      },
    },
  },
};

const SWITCH_SX = {
  '& .MuiSwitch-track': { borderRadius: '24px', transition: 'background-color 150ms cubic-bezier(.4,0,.2,1)' },
  // Reference switch keeps a constant ON colour — override the base component's hover-darken so it stays #5ebbeb.
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track, &:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#5ebbeb' },
};

// Module scope on purpose: nesting these in the page would remount (and unfocus) inputs on every keystroke.
// Reference: the section icon hangs in the gutter LEFT of the column, so the
// heading text lines up with the page title and tabs; fields sit a little in.
const Section = ({ icon, title, first, children }) => (
  <Box sx={{ mt: first ? 0 : 4, pt: first ? 0 : 4, borderTop: first ? 'none' : '1px solid #e2e8f0' }}>
    <Box sx={{ position: 'relative', mb: 3 }}>
      {React.cloneElement(icon, { sx: { color: '#9e9e9e', fontSize: 22, position: 'absolute', left: -32, top: '50%', transform: 'translateY(-50%)' } })}
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, fontSize: 24, color: '#000' }}>
        {title}
      </Typography>
    </Box>
    <Box sx={{ pl: '4px' }}>{children}</Box>
  </Box>
);

// ISO 8601 period (P30D, P2W, P1M, P1Y2M3DT4H) → "30 days" etc.; null if invalid.
const ISO_PERIOD_RE = /^P(?!$)(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?=\d)(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;
const PERIOD_UNITS = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];
const describePeriod = (value) => {
  const m = ISO_PERIOD_RE.exec(String(value || '').trim());
  if (!m) return null;
  const parts = m.slice(1).map((n, i) => (n == null ? null : `${parseInt(n, 10)} ${PERIOD_UNITS[i]}${parseInt(n, 10) === 1 ? '' : 's'}`)).filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const Field = ({ label, help, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#313439' }}>{label}</Typography>
    {help && <Typography sx={{ fontSize: 14, color: '#676b72', mb: 1 }}>{help}</Typography>}
    {children}
  </Box>
);

// Toggle + live status caption to its right (reference describes the resulting behaviour, not the switch)
const ToggleField = ({ label, help, checked, onChange, onText, offText }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#313439' }}>{label}</Typography>
    {help && <Typography sx={{ fontSize: 14, color: '#676b72' }}>{help}</Typography>}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
      <ShopfrontSwitch sx={SWITCH_SX} checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <Typography sx={{ fontSize: 14, color: '#676b72' }}>{checked ? onText : offText}</Typography>
    </Box>
  </Box>
);

// Typeahead combobox: filters as you type, clear "x" on a selected value, no "None" row.
const SearchSelect = ({ value, options, onChange, placeholder }) => (
  <Autocomplete
    options={options}
    value={options.find((o) => String(o.value) === String(value)) || null}
    onChange={(event, option) => onChange(option ? option.value : '')}
    getOptionLabel={(o) => o?.label || ''}
    isOptionEqualToValue={(o, v) => String(o.value) === String(v.value)}
    componentsProps={PANEL_PROPS}
    renderInput={(params) => <TextField {...params} placeholder={placeholder} sx={FIELD_SX} />}
  />
);

const CustomerGroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isTrueSuperAdmin, getOutletId } = useAuth();
  // Outlet rule: navbar outlet set → the group is stored there and the Outlet
  // picker is hidden; All Outlets → the picker is shown and required.
  const { selectedOutletId: headerOutletId } = useSelectedOutlet();
  const headerOutlet = headerOutletId != null && headerOutletId !== '' ? Number(headerOutletId) : null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [priceLists, setPriceLists] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [receiptTemplates, setReceiptTemplates] = useState([]);
  const [statementTemplates, setStatementTemplates] = useState([]);
  const [creditTerms, setCreditTerms] = useState([]);
  const [isoHelpOpen, setIsoHelpOpen] = useState(false);
  const [tab, setTab] = useState(0);

  const [formData, setFormData] = useState({
    // General Information
    name: "",
    description: "",
    isActive: true,
    outletId: null,

    // Receipt Settings
    defaultReceiptType: "",
    emailReceiptTemplate: "",
    autoPrintReceipt: false,
    autoPrintParkedReceipt: false,
    autoEmailReceipt: false,

    // Loyalty Settings
    loyaltyEnabled: false,
    loyaltyPointsRate: "",
    loyaltyRedemptionRate: "",

    // Special Pricing
    specialPricingEnabled: false,
    discountPercentage: "",
    disablePromotions: false,
    priceListId: "",

    // Account Sales
    allowAccountSales: false,
    accountLimit: "",
    paymentReceiptTemplate: "",
    statementTemplate: "",
    autoPrintPaymentReceipt: false,
    requireOrderReference: false,
    creditTerms: [],
  });

  const isEditMode = !!id && id !== "new";
  const isNewMode = id === "new" || window.location.pathname === "/customers/groups/new";

  useEffect(() => {
    loadPriceLists(); // Initial load with default filtering
    loadReceiptTemplates(); // Load receipt templates for account sales
    loadStatementTemplates(); // Statement templates live in localStorage, not the receipt-templates API
    if (isTrueSuperAdmin()) {
      loadOutlets();
    }
    if (isEditMode) {
      loadCustomerGroup();
    } else if (isNewMode) {
      // Set the name and outletId from URL parameters if available
      const nameFromUrl = searchParams.get("name");
      const outletIdFromUrl = searchParams.get("outletId");

      if (nameFromUrl) {
        setFormData((prev) => ({ ...prev, name: nameFromUrl }));
      }

      // Set outletId based on URL parameter or user's outlet
      let finalOutletId = null;
      if (outletIdFromUrl && outletIdFromUrl !== '') {
        finalOutletId = parseInt(outletIdFromUrl);
      } else if (!isTrueSuperAdmin()) {
        // For regular users, use their assigned outlet
        finalOutletId = getOutletId();
      } else if (headerOutlet != null) {
        // Super admin working in a navbar outlet: the group lands there.
        finalOutletId = headerOutlet;
      }
      // For super admin on All Outlets, keep it null (they pick in the form)

      setFormData((prev) => ({ ...prev, outletId: finalOutletId }));
    }
  }, [id, isEditMode, isNewMode, searchParams, isTrueSuperAdmin, getOutletId, headerOutlet]);

  useEffect(() => {
    if (formData.outletId !== undefined) {
      loadPriceLists(formData.outletId);
    }
  }, [formData.outletId]);

  const loadOutlets = async () => {
    try {
      const response = await outletService.getAllOutlets();
      setOutlets(response.outlets || []);
    } catch (err) {
      console.error("Error loading outlets:", err);
    }
  };

  const loadReceiptTemplates = async () => {
    try {
      // Load all receipt templates (we'll filter by type in the UI)
      const response = await receiptTemplateService.getTemplates();
      setReceiptTemplates(response.templates || []);
    } catch (err) {
      console.error("Error loading receipt templates:", err);
    }
  };

  const loadStatementTemplates = async () => {
    try {
      const response = await statementTemplateService.getTemplates();
      setStatementTemplates(response.templates || []);
    } catch (err) {
      console.error("Error loading statement templates:", err);
    }
  };

  const loadPriceLists = async (selectedOutletId = null) => {
    try {
      // Get all price lists first
      const response = await priceListService.getPriceLists();

      if (response.priceLists) {
        let filteredPriceLists = response.priceLists;

        // Filter based on the selected outlet or user's outlet
        const outletIdToFilter = selectedOutletId || formData.outletId || getOutletId();

        if (outletIdToFilter) {
          // Show price lists from the selected outlet or global ones
          filteredPriceLists = response.priceLists.filter(
            priceList => (priceList.outletId === outletIdToFilter || priceList.outletId === null) && priceList.isActive
          );
        } else if (!isTrueSuperAdmin()) {
          // For non-super admin users, filter by their assigned outlet
          const userOutletId = getOutletId();
          filteredPriceLists = response.priceLists.filter(
            priceList => (priceList.outletId === userOutletId || priceList.outletId === null) && priceList.isActive
          );
        } else {
          // For super admin with no outlet selected, show all active price lists
          filteredPriceLists = response.priceLists.filter(priceList => priceList.isActive);
        }

        setPriceLists(filteredPriceLists);
      } else {
        setPriceLists([]);
      }
    } catch (err) {
      console.error("Error loading price lists:", err);
      setPriceLists([]);
    }
  };

  const loadCustomerGroup = async () => {
    try {
      setLoading(true);
      const response = await customerGroupService.getCustomerGroup(id);
      const group = response.customerGroup;

      setFormData({
        name: group.name || "",
        description: group.description || "",
        isActive: group.isActive !== undefined ? group.isActive : true,
        outletId: group.outletId || null,
        defaultReceiptType: group.defaultReceiptType || "",
        emailReceiptTemplate: group.emailReceiptTemplate || "",
        autoPrintReceipt: group.autoPrintReceipt || false,
        autoPrintParkedReceipt: group.autoPrintParkedReceipt || false,
        autoEmailReceipt: group.autoEmailReceipt || false,
        loyaltyEnabled: group.loyaltyEnabled || false,
        loyaltyPointsRate: group.loyaltyPointsRate || "",
        loyaltyRedemptionRate: group.loyaltyRedemptionRate || "",
        specialPricingEnabled: group.specialPricingEnabled || false,
        discountPercentage: group.discountPercentage || "",
        disablePromotions: group.disablePromotions || false,
        priceListId: group.priceListId || "",
        allowAccountSales: group.allowAccountSales || false,
        accountLimit: group.accountLimit || "",
        paymentReceiptTemplate: group.paymentReceiptTemplate || "",
        statementTemplate: group.statementTemplate || "",
        autoPrintPaymentReceipt: group.autoPrintPaymentReceipt || false,
        requireOrderReference: group.requireOrderReference || false,
        creditTerms: group.creditTerms || [],
      });

      // Load credit terms if they exist
      if (group.creditTerms && Array.isArray(group.creditTerms)) {
        setCreditTerms(group.creditTerms);
      }

      setError("");
    } catch (err) {
      setError("Failed to load customer group");
      console.error("Error loading customer group:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError("Customer group name is required");
      setTab(0);
      return;
    }

    // Validate outlet selection for super admin
    if (creditTerms.some((t) => t.duration && !describePeriod(t.duration))) {
      setTab(2);
      setError("Credit Terms: every period must be a valid ISO 8601 duration (e.g. P30D)");
      return;
    }

    if (isNewMode && isTrueSuperAdmin() && headerOutlet == null && !formData.outletId) {
      setError("Please select an outlet for this customer group");
      return;
    }

    setSaveLoading(true);
    setError("");

    // Clean the data before sending to API
    const cleanedData = {
      ...formData,
      // Convert empty strings to null for numeric fields
      loyaltyPointsRate: formData.loyaltyPointsRate === '' ? null : formData.loyaltyPointsRate,
      loyaltyRedemptionRate: formData.loyaltyRedemptionRate === '' ? null : formData.loyaltyRedemptionRate,
      discountPercentage: formData.discountPercentage === '' ? null : formData.discountPercentage,
      accountLimit: formData.accountLimit === '' || formData.accountLimit === 'Unlimited' ? null : parseFloat(formData.accountLimit) || null,
      // Convert empty strings to null for string fields
      defaultReceiptType: formData.defaultReceiptType === '' ? null : formData.defaultReceiptType,
      emailReceiptTemplate: formData.emailReceiptTemplate === '' ? null : formData.emailReceiptTemplate,
      paymentReceiptTemplate: formData.paymentReceiptTemplate === '' ? null : formData.paymentReceiptTemplate,
      statementTemplate: formData.statementTemplate === '' ? null : formData.statementTemplate,
      priceListId: formData.priceListId === '' ? null : formData.priceListId,
      // Include credit terms
      // Empty rows are dropped; label is the readable period ("30 days") the statement prints.
      creditTerms: creditTerms
        .filter((t) => describePeriod(t.duration))
        .map((t) => ({ duration: t.duration, label: describePeriod(t.duration) })),
      // Ensure outletId is properly set
      outletId: formData.outletId || headerOutlet || null,
    };

    try {
      if (isEditMode) {
        await customerGroupService.updateCustomerGroup(id, cleanedData);
      } else {
        // Create new customer group
        await customerGroupService.createCustomerGroup(cleanedData);
      }
      navigate("/customers/groups");
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to save customer group";
      setError(errorMessage);
      console.error("Error saving customer group:", err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    navigate("/customers/groups");
  };

  if (loading) {
    return <PageLoader />;
  }

  const priceListOptions = priceLists.map((p) => ({ label: p.name, value: p.id }));
  // Value coerced to String: the backing columns are String?, so the stored id and the
  // option value must both be strings for the Autocomplete's strict === match on reload.
  const paymentReceiptOptions = receiptTemplates
    .filter((t) => t.for === 'Payment' || t.type === 'Payment')
    .map((t) => ({ label: t.name, value: String(t.id) }));
  // Default (printed) receipt = sale-type templates that aren't the email-only format.
  const receiptOptions = receiptTemplates
    .filter((t) => t.for === 'Sale' && t.type !== 'Email Receipt')
    .map((t) => ({ label: t.name, value: String(t.id) }));
  const emailReceiptOptions = receiptTemplates
    .filter((t) => t.type === 'Email Receipt' || t.for === 'Email')
    .map((t) => ({ label: t.name, value: String(t.id) }));
  // Statement templates come from /statement-templates, not the receipt-templates API.
  const statementOptions = statementTemplates
    .filter((t) => t.id != null)
    .map((t) => ({ label: t.name, value: String(t.id) }));

  const tabSx = {
    minHeight: 56,
    height: 56,
    textTransform: 'none',
    fontSize: 15,
    fontWeight: 400,
    gap: 1,
    px: 3,
    color: '#313439',
    '& .MuiTab-iconWrapper': { mr: 0 },
    borderRadius: '8px 8px 0 0',
    transition: 'color 150ms cubic-bezier(.4,0,.2,1), background-color 150ms cubic-bezier(.4,0,.2,1)',
    '&.Mui-selected': { color: '#313439', bgcolor: '#fff', boxShadow: '0 -2px 6px rgba(0,0,0,0.08)' },
  };

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100%' }}>
      {/* Sticky header band + tabs */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 3 }}>
        <Box
          sx={{
            bgcolor: '#e2e8f0',
            px: PAGE_PX,
            pt: '48px',
          }}
        >
          <Box sx={{ ...COLUMN_SX, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Typography sx={{ fontSize: 20, color: '#313439' }}>
            {isEditMode ? 'Editing ' : 'Creating '}
            <b>{formData.name || 'Customer Group'}</b>
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Outlet lives outside the form surface — the reference form has no Outlet field,
                but a super admin still has to pick one for the group to be saved. */}
            {/* Create only: the update route ignores outletId, so on Edit the picker
                changed nothing — the list's Outlet column shows the group's outlet. */}
            {isNewMode && isTrueSuperAdmin() && headerOutlet == null && (
              <FormControl sx={{ minWidth: 220, ...FIELD_SX }}>
                <Select
                  value={formData.outletId || ''}
                  onChange={(e) => handleInputChange("outletId", e.target.value === '' ? null : e.target.value)}
                  displayEmpty
                  sx={{ height: 42, borderRadius: '8px' }}
                >
                  <MenuItem value="">Select an outlet</MenuItem>
                  {outlets.map((outlet) => (
                    <MenuItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
          </Box>
        </Box>

        {/* Cancel and Save were in the header row above, which scrolls away on the
            longer tabs. They move together so the pair stays side by side. */}
        <PageSaveBar
          onSave={handleSave}
          saving={saveLoading}
          onCancel={handleCancel}
        />

        <Box sx={{ bgcolor: '#e2e8f0', px: PAGE_PX, pt: '40px' }}>
          <Box sx={COLUMN_SX}>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            TabIndicatorProps={{ sx: { display: 'none' } }}
            sx={{ minHeight: 56, '& .MuiTab-root': tabSx }}
          >
            <Tab label="General" icon={<InfoIcon sx={{ fontSize: 18 }} />} iconPosition="start" disableRipple />
            <Tab label="Receipts" icon={<ReceiptTabIcon sx={{ fontSize: 18 }} />} iconPosition="start" disableRipple />
            <Tab label="Account Sales" icon={<BalanceIcon sx={{ fontSize: 18 }} />} iconPosition="start" disableRipple />
          </Tabs>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: PAGE_PX, pt: '64px', pb: 4 }}>
        <Box sx={COLUMN_SX}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          {/* ---------------- General ---------------- */}
          {tab === 0 && (
            <>
              <Section icon={<PersonIcon />} title="General" first>
                <Field label="Name" help="The name of the Customer Group">
                  <TextField
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                    sx={FIELD_SX}
                  />
                </Field>
              </Section>

              <Section icon={<StarIcon />} title="Loyalty">
                <ToggleField
                  label="Loyalty Enabled"
                  checked={formData.loyaltyEnabled}
                  onChange={(v) => handleInputChange("loyaltyEnabled", v)}
                  onText="Loyalty is enabled"
                  offText="Loyalty is disabled"
                />
              </Section>

              <Section icon={<LocalOfferIcon />} title="Special Pricing">
                <ToggleField
                  label="Disable Promotions"
                  checked={formData.disablePromotions}
                  onChange={(v) => handleInputChange("disablePromotions", v)}
                  onText="Cannot receive promotional pricing"
                  offText="Can receive promotional pricing"
                />
                <Field label="Price List" help="The custom pricing that applies to customers in this group">
                  <SearchSelect
                    value={formData.priceListId}
                    options={priceListOptions}
                    onChange={(v) => handleInputChange("priceListId", v)}
                    placeholder="Select Price List..."
                  />
                </Field>
              </Section>
            </>
          )}

          {/* ---------------- Receipts ---------------- */}
          {tab === 1 && (
            <Section icon={<ReceiptIcon />} title="Receipts" first>
              <Field
                label="Default Receipt"
                help="The receipt that should be printed instead of the register's default receipt"
              >
                <SearchSelect
                  value={formData.defaultReceiptType}
                  options={receiptOptions}
                  onChange={(v) => handleInputChange("defaultReceiptType", v)}
                  placeholder="Select Default Receipt..."
                />
              </Field>

              <Field
                label="Email Receipt"
                help="The email receipt that should be sent instead of the register's default template"
              >
                <SearchSelect
                  value={formData.emailReceiptTemplate}
                  options={emailReceiptOptions}
                  onChange={(v) => handleInputChange("emailReceiptTemplate", v)}
                  placeholder="Select Email Receipt..."
                />
              </Field>

              <ToggleField
                label="Auto Print Receipt"
                checked={formData.autoPrintReceipt}
                onChange={(v) => handleInputChange("autoPrintReceipt", v)}
                onText="Sale receipts will be printed automatically"
                offText="Sale receipts will not be printed automatically"
              />
              <ToggleField
                label="Auto Print Parked Receipt"
                checked={formData.autoPrintParkedReceipt}
                onChange={(v) => handleInputChange("autoPrintParkedReceipt", v)}
                onText="Parked sale receipts will be printed automatically"
                offText="Parked sale receipts will not be printed automatically"
              />
              <ToggleField
                label="Auto Email Receipt"
                checked={formData.autoEmailReceipt}
                onChange={(v) => handleInputChange("autoEmailReceipt", v)}
                onText="Sale receipts will be emailed automatically"
                offText="Sale receipts will not be emailed automatically"
              />
            </Section>
          )}

          {/* ---------------- Account Sales ---------------- */}
          {tab === 2 && (
            <Section icon={<AccountBalanceIcon />} title="Account Sales" first>
              <ToggleField
                label="Allow Account Sales"
                checked={formData.allowAccountSales}
                onChange={(v) => handleInputChange("allowAccountSales", v)}
                onText="Customers can complete sales on account"
                offText="Customers cannot complete sales on account"
              />

              {formData.allowAccountSales && (
                <>
                  <Field label="Account Limit" help="The credit limit for all members of this group. Leave empty for unlimited.">
                    <TextField
                      value={formData.accountLimit}
                      onChange={(e) => handleInputChange("accountLimit", e.target.value)}
                      placeholder="Unlimited"
                      sx={FIELD_SX}
                    />
                  </Field>

                  <Field label="Payment Receipt" help="The receipt that should be printed when a payment is made">
                    <SearchSelect
                      value={formData.paymentReceiptTemplate || ''}
                      options={paymentReceiptOptions}
                      onChange={(v) => handleInputChange("paymentReceiptTemplate", v)}
                      placeholder="Select Payment Receipt..."
                    />
                  </Field>

                  <Field label="Statement Template" help="The template used when generating statements for this group">
                    <SearchSelect
                      value={formData.statementTemplate || ''}
                      options={statementOptions}
                      onChange={(v) => handleInputChange("statementTemplate", v)}
                      placeholder="Select Statement Template..."
                    />
                  </Field>

                  <ToggleField
                    label="Auto Print Payment Receipt"
                    checked={formData.autoPrintPaymentReceipt}
                    onChange={(v) => handleInputChange("autoPrintPaymentReceipt", v)}
                    onText="Payment receipts will be printed automatically"
                    offText="Payment receipts will not be printed automatically"
                  />
                  <ToggleField
                    label="Require Order Reference"
                    checked={formData.requireOrderReference}
                    onChange={(v) => handleInputChange("requireOrderReference", v)}
                    onText="A reference is requested when the customer is added to a sale"
                    offText="No reference is requested when the customer is added to a sale"
                  />

                  {/* Reference: one ISO 8601 period per row (placeholder "Invalid Period"),
                      red outlined delete, full-width green "+ Add Credit Term". */}
                  <Box sx={{ mb: 3 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#000' }}>
                      Credit Terms
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: '#313439', mb: 2 }}>
                      Specifies the time periods displayed with the amount of money owing during each period (e.g. 7 days, 30 days).{' '}
                      <Link
                        component="button"
                        type="button"
                        onClick={() => setIsoHelpOpen(true)}
                        sx={{ fontSize: 14, color: 'rgb(0,0,238)', textDecorationColor: 'rgb(0,0,238)', verticalAlign: 'baseline', textAlign: 'left' }}
                      >
                        It must be formatted as an ISO 8601 duration.
                      </Link>
                    </Typography>

                    {creditTerms.map((term, index) => {
                      const human = describePeriod(term.duration);
                      const invalid = !!term.duration && !human;
                      return (
                        <Box key={index} sx={{ display: 'flex', gap: 0.5, mb: 1, alignItems: 'center' }}>
                          <TextField
                            value={term.duration || ''}
                            onChange={(e) => {
                              const duration = e.target.value.toUpperCase();
                              const updated = [...creditTerms];
                              updated[index] = { ...updated[index], duration, label: describePeriod(duration) || '' };
                              setCreditTerms(updated);
                            }}
                            placeholder="Invalid Period"
                            error={invalid}
                            InputProps={{
                              endAdornment: term.duration ? (
                                <Typography sx={{ fontSize: 14, color: invalid ? '#e33430' : '#676b72', whiteSpace: 'nowrap', pl: 1 }}>
                                  {human || 'Invalid Period'}
                                </Typography>
                              ) : null,
                            }}
                            sx={{ ...FIELD_SX, flex: 1, '& .MuiOutlinedInput-root': { ...FIELD_SX['& .MuiOutlinedInput-root'], pr: '14px' } }}
                          />
                          <IconButton
                            onClick={() => setCreditTerms(creditTerms.filter((_, i) => i !== index))}
                            title="Remove credit term"
                            disableRipple
                            sx={{ width: 48, height: 42, borderRadius: '8px', border: '1px solid #e33430', color: '#e33430', '&:hover': { bgcolor: 'rgba(227,52,48,0.06)' } }}
                          >
                            <DeleteIcon sx={{ fontSize: 22 }} />
                          </IconButton>
                        </Box>
                      );
                    })}

                    <Button
                      fullWidth
                      disableRipple
                      startIcon={<AddIcon />}
                      onClick={() => setCreditTerms([...creditTerms, { label: '', duration: '' }])}
                      sx={{
                        height: 42,
                        borderRadius: '8px',
                        border: '1px solid #16a34a',
                        color: '#16a34a',
                        fontWeight: 700,
                        fontSize: 16,
                        textTransform: 'none',
                        '&:hover': { bgcolor: 'rgba(22,163,74,0.05)', borderColor: '#16a34a' },
                        '&:focus-visible': { border: '2px solid #000' },
                      }}
                    >
                      Add Credit Term
                    </Button>
                  </Box>
                  <IsoPeriodHelpDrawer open={isoHelpOpen} onClose={() => setIsoHelpOpen(false)} />
                </>
              )}
            </Section>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CustomerGroupDetails;
