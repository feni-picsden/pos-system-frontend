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
} from "@mui/material";
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
} from "@mui/icons-material";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import customerGroupService from "../../services/customerGroupService";
import priceListService from "../../services/priceListService";
import outletService from "../../services/outletService";
import receiptTemplateService from "../../services/receiptTemplateService";
import statementTemplateService from "../../services/statementTemplateService";
import { useAuth } from "../../contexts/AuthContext";

// ---- Shopfront reference styling ------------------------------------------
const FORM_WIDTH = 764;

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
        '&.Mui-focused, &[aria-selected="true"], &[aria-selected="true"].Mui-focused': {
          backgroundColor: '#5ebbeb',
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

const btnSx = (bg, hover) => ({
  bgcolor: bg,
  color: '#fff',
  height: 42,
  px: 3,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: hover, boxShadow: 'none' },
});

// Module scope on purpose: nesting these in the page would remount (and unfocus) inputs on every keystroke.
const Section = ({ icon, title, first, children }) => (
  <Box sx={{ mt: first ? 0 : 4, pt: first ? 0 : 4, borderTop: first ? 'none' : '1px solid #e2e8f0' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
      {React.cloneElement(icon, { sx: { color: '#5ebbeb' } })}
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, fontSize: 20, color: '#313439' }}>
        {title}
      </Typography>
    </Box>
    {children}
  </Box>
);

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
  const { isSuperAdmin, getOutletId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [priceLists, setPriceLists] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [receiptTemplates, setReceiptTemplates] = useState([]);
  const [statementTemplates, setStatementTemplates] = useState([]);
  const [creditTerms, setCreditTerms] = useState([]);
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
    if (isSuperAdmin()) {
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
      } else if (!isSuperAdmin()) {
        // For regular users, use their assigned outlet
        finalOutletId = getOutletId();
      }
      // For super admin with no outletId in URL, keep it as null (they can select in the form)

      setFormData((prev) => ({ ...prev, outletId: finalOutletId }));
    }
  }, [id, isEditMode, isNewMode, searchParams, isSuperAdmin, getOutletId]);

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
        } else if (!isSuperAdmin()) {
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
    if (isSuperAdmin() && !formData.outletId) {
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
      creditTerms: creditTerms,
      // Ensure outletId is properly set
      outletId: formData.outletId || null,
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
  // Statement templates come from the localStorage statement store, not the receipt-templates API.
  const statementOptions = statementTemplates
    .map((t) => ({ label: t.name, value: String(t.id) }));

  const tabSx = {
    minHeight: 56,
    height: 56,
    textTransform: 'none',
    fontSize: 16,
    fontWeight: 700,
    color: '#676b72',
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
            px: 3,
            pt: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: 20, color: '#313439' }}>
            {isEditMode ? 'Editing ' : 'Creating '}
            <b>{formData.name || 'Customer Group'}</b>
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Outlet lives outside the form surface — the reference form has no Outlet field,
                but a super admin still has to pick one for the group to be saved. */}
            {isSuperAdmin() && (
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
            <Button startIcon={<ArrowBackIcon />} onClick={handleCancel} sx={btnSx('#676b72', '#585c62')}>
              Cancel
            </Button>
            <Button
              startIcon={saveLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saveLoading}
              sx={btnSx('#5ebbeb', '#4aa9dd')}
            >
              Save
            </Button>
          </Box>
        </Box>

        <Box sx={{ bgcolor: '#e2e8f0', px: 3 }}>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            TabIndicatorProps={{ sx: { display: 'none' } }}
            sx={{ minHeight: 56, '& .MuiTab-root': tabSx }}
          >
            <Tab label="General" disableRipple />
            <Tab label="Receipts" disableRipple />
            <Tab label="Account Sales" disableRipple />
          </Tabs>
        </Box>
      </Box>

      <Box sx={{ px: 3, py: 4 }}>
        <Box sx={{ maxWidth: FORM_WIDTH, mx: 'auto' }}>
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

                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#313439' }}>
                        Credit Terms
                      </Typography>
                      <Button
                        startIcon={<AddIcon />}
                        onClick={() => setCreditTerms([...creditTerms, { label: '', duration: '' }])}
                        sx={btnSx('#5ebbeb', '#4aa9dd')}
                      >
                        Add
                      </Button>
                    </Box>
                    <Typography sx={{ fontSize: 14, color: '#676b72', mb: 2 }}>
                      It must be formatted as an ISO 8601 duration (e.g., P15D for 15 days, P30D for 30 days)
                    </Typography>

                    {creditTerms.map((term, index) => (
                      <Box key={index} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                        <TextField
                          value={term.label || ''}
                          onChange={(e) => {
                            const updated = [...creditTerms];
                            updated[index] = { ...updated[index], label: e.target.value };
                            setCreditTerms(updated);
                          }}
                          placeholder="e.g., 15 days"
                          sx={{ ...FIELD_SX, flex: 1 }}
                        />
                        <TextField
                          value={term.duration || ''}
                          onChange={(e) => {
                            const updated = [...creditTerms];
                            updated[index] = { ...updated[index], duration: e.target.value };
                            setCreditTerms(updated);
                          }}
                          placeholder="P15D"
                          sx={{ ...FIELD_SX, flex: 1 }}
                        />
                        <IconButton
                          onClick={() => setCreditTerms(creditTerms.filter((_, i) => i !== index))}
                          sx={{ color: '#dc2626' }}
                          title="Remove credit term"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    ))}

                    {creditTerms.length === 0 && (
                      <Typography sx={{ fontSize: 14, color: '#676b72', fontStyle: 'italic' }}>
                        No credit terms configured
                      </Typography>
                    )}
                  </Box>
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
