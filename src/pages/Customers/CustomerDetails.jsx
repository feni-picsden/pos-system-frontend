import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Grid,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Autocomplete,
  Collapse,
  Snackbar,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { format, isValid, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import {
  Person as PersonIcon,
  ContactMail as ContactIcon,
  Chat as SocialMediaIcon,
  AccountBalance as BillingIcon,
  LocalShipping as DeliveryIcon,
  Star as LoyaltyIcon,
  AccountBalance as AccountBalanceIcon,
  LocalOffer as SpecialPricingIcon,
  CardGiftcard as MiscellaneousIcon,
  SaveOutlined as SaveIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  RadioButtonChecked as StepActiveIcon,
  RadioButtonUnchecked as StepIcon,
  Check as CheckIcon,
} from "@mui/icons-material";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import customerService from "../../services/customerService";
import customerGroupService from "../../services/customerGroupService";
import priceListService from "../../services/priceListService";
import outletService from "../../services/outletService";
import { useAuth } from "../../contexts/AuthContext";
import ShopfrontSwitch from "../../components/Common/ShopfrontSwitch";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import PerformanceGraph from "../../components/Customers/PerformanceGraph";

// Reference edit-form section rail: exactly these six. Loyalty / Account / Special
// Pricing are NOT rail sections on the reference edit form (they live on the customer
// VIEW page tabs), so they are kept off the rail. Their edit controls still render as
// override cards below when "Override Customer Group" is on / the customer is ungrouped.
const SECTIONS = [
  { id: "general", label: "General Information", icon: <PersonIcon /> },
  { id: "contact", label: "Contact", icon: <ContactIcon /> },
  { id: "socialMedia", label: "Social Media", icon: <SocialMediaIcon /> },
  { id: "billingAddress", label: "Billing Address", icon: <BillingIcon /> },
  { id: "deliveryAddress", label: "Delivery Address", icon: <DeliveryIcon /> },
  { id: "miscellaneous", label: "Miscellaneous", icon: <MiscellaneousIcon /> },
];

const WIZARD_STEPS = 4;

// Reference dropdown panel: flush under the field, white, 1px black border, square-ish,
// no elevation and no grow animation; the selected row is blue text, not a tinted row.
const menuSurfaceSx = {
  borderRadius: "2px",
  border: "1px solid #000",
  boxShadow: "none",
  backgroundColor: "#fff",
};

const selectMenuProps = {
  transitionDuration: 0,
  anchorOrigin: { vertical: "bottom", horizontal: "left" },
  transformOrigin: { vertical: "top", horizontal: "left" },
  PaperProps: {
    sx: {
      ...menuSurfaceSx,
      "& .MuiMenuItem-root": { fontSize: 16, color: "#313439" },
      "& .MuiMenuItem-root.Mui-selected": {
        backgroundColor: "transparent",
        color: "#5ebbeb",
      },
      "& .MuiMenuItem-root.Mui-selected:hover, & .MuiMenuItem-root.Mui-selected.Mui-focusVisible": {
        backgroundColor: "rgba(94,187,235,0.08)",
      },
    },
  },
};

const autocompletePaperProps = {
  paper: {
    sx: {
      ...menuSurfaceSx,
      "& .MuiAutocomplete-option": { fontSize: 16, color: "#313439" },
      '& .MuiAutocomplete-option[aria-selected="true"]': {
        backgroundColor: "transparent",
        color: "#5ebbeb",
      },
      '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused': {
        backgroundColor: "rgba(94,187,235,0.08)",
        color: "#5ebbeb",
      },
    },
  },
};

// Reference form inputs: full card width, 53px tall, square, 1px solid #000, white.
const fieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 0,
    backgroundColor: "#fff",
    fontSize: 16,
    height: 53,
    "& .MuiOutlinedInput-notchedOutline": { border: "1px solid #000" },
    "&:hover .MuiOutlinedInput-notchedOutline": { border: "1px solid #000" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "2px solid #000" },
  },
};

const multilineFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: 0,
    backgroundColor: "#fff",
    fontSize: 16,
    "& .MuiOutlinedInput-notchedOutline": { border: "1px solid #000" },
    "&:hover .MuiOutlinedInput-notchedOutline": { border: "1px solid #000" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "2px solid #000" },
  },
};

// Wizard chrome (full-screen, animated gradient) — matches reference .creation-wizard.
const wizardBackgroundSx = {
  "@keyframes basic-background-change": {
    "0%": { backgroundPosition: "0% 0%" },
    "100%": { backgroundPosition: "100% 100%" },
  },
  background:
    "linear-gradient(to right bottom,#5da2ba,#2193b0,#283c86,#4bc0c8,#283c86,#2193b0)",
  backgroundSize: "1400% 1400%",
  animation: "basic-background-change 300s linear infinite alternate",
};

const wizardInputSx = {
  width: "100%",
  maxWidth: 868,
  "& .MuiOutlinedInput-root": {
    borderRadius: 0,
    backgroundColor: "#fff",
    fontSize: 16,
    height: 53,
    // :not(.Mui-error) so an invalid field keeps MUI's red outline instead of the black one.
    "&:not(.Mui-error) .MuiOutlinedInput-notchedOutline": { border: "1px solid #000" },
    "&:not(.Mui-error):hover .MuiOutlinedInput-notchedOutline": { border: "1px solid #000" },
    "&:not(.Mui-error).Mui-focused .MuiOutlinedInput-notchedOutline": { border: "1px solid #000" },
  },
};

const wizardControlSx = {
  color: "#f8f8f8",
  textTransform: "none",
  transition: "color 0.2s, opacity 0.2s",
  "&:hover": { backgroundColor: "transparent", opacity: 0.75 },
  "&.Mui-disabled": { color: "#f8f8f8", opacity: 0.4 },
};

// Reference section card: 500px, #f8f8f8, square, 0 0 30px shadow. The header row is a
// toggle — clicking it collapses the body to the header alone and turns the chevron right.
// Delivery field -> its billing counterpart, for the "Same as Billing Address" switch.
const DELIVERY_TO_BILLING = [
  ["deliveryStreet1", "billingStreet1"],
  ["deliveryStreet2", "billingStreet2"],
  ["deliverySuburb", "billingSuburb"],
  ["deliveryPostcode", "billingPostcode"],
  ["deliveryState", "billingState"],
  ["deliveryCountry", "billingCountry"],
];

const SectionCard = ({ id, icon, title, collapsed, onToggle, children }) => (
  <Paper
    id={id}
    sx={{
      px: 2,
      py: 3,
      backgroundColor: "#f8f8f8",
      borderRadius: 0,
      boxShadow: "0 0 30px rgba(0,0,0,0.25)",
      width: 500,
      mb: 2,
      scrollMarginTop: "80px",
    }}
  >
    <Box
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      onClick={onToggle}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        pb: 1.5,
        borderBottom: "1px solid #e0e0e0",
        cursor: "pointer",
        color: "#313439",
        transition: "color 0.2s ease",
        "&:hover": { color: "#5ebbeb" },
      }}
    >
      {icon}
      <Typography sx={{ flex: 1, fontSize: "20.8px", color: "inherit" }}>{title}</Typography>
      <ExpandMoreIcon
        sx={{
          transition: "transform 0.2s ease",
          transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
        }}
      />
    </Box>
    <Collapse in={!collapsed} timeout={200}>
      <Box sx={{ pt: 2 }}>{children}</Box>
    </Collapse>
  </Paper>
);

const CustomerDetails = ({ modalWizardData, isModal, onClose, onSave } = {}) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { isSuperAdmin, getOutletId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [customerGroups, setCustomerGroups] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [visibleSections, setVisibleSections] = useState([]);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDisableOverride, setConfirmDisableOverride] = useState(false);
  // Reference "Same as Billing Address": ON hides the delivery block and the billing
  // address is written to the delivery fields on save.
  // ponytail: derived, not persisted — add a column only if a consumer must tell
  // "same as billing" apart from "no delivery address".
  const [sameAsBilling, setSameAsBilling] = useState(true);

  const toggleSection = (sectionId) =>
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));

  const fieldRefs = useRef({
    firstName: null,
    lastName: null,
    customerGroupId: null,
    outletId: null,
    emails: null,
    phone: null,
    mobile: null,
    priceListId: null,
    gender: null,
    accountLimit: null,
    loyaltyPoints: null,
    currentOwing: null,
  });

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    code: "",
    customerGroupId: "",
    outletId: null,

    emails: [""],
    phone: "",
    mobile: "",
    fax: "",
    allowMarketingEmails: "Not Specified",
    website: "",
    twitter: "",
    facebook: "",
    billingStreet1: "",
    billingStreet2: "",
    billingSuburb: "",
    billingPostcode: "",
    billingState: "",
    billingCountry: "",

    deliveryStreet1: "",
    deliveryStreet2: "",
    deliverySuburb: "",
    deliveryPostcode: "",
    deliveryState: "",
    deliveryCountry: "",
    loyaltyPoints: "0",
    accountLimit: "",
    currentOwing: "0",
    requireOrderReference: false,

    disablePromotions: false,
    priceListId: "",
    overrideCustomerGroup: false,

    businessNumber: "",
    birthday: null,
    gender: "",
    invoiceMessage: "",
    internalComments: "",
  });

  const isEditMode = !!id && id !== "new";
  const isNewMode =
    id === "new" ||
    ["/customers/new", "/customers/create-wizard"].includes(window.location.pathname) ||
    isModal;

  // The wizard already ran if we were handed its answers (/customers/create-wizard page,
  // or the sell-screen "+ Create New" pop-up wizard which opens this page in a modal).
  const wizardAlreadyAnswered =
    isModal || !!modalWizardData || !!location.state?.fromWizard;
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardDone, setWizardDone] = useState(false);
  const [wizardError, setWizardError] = useState("");
  // Live code-uniqueness feedback (reference shows a green check while typing).
  const [codeUnique, setCodeUnique] = useState(false);
  const codeCheckTimer = useRef(null);
  // Reference parity: wizard FINISH creates the customer and lands on the edit
  // page with a success toast; the toast state survives the navigate via router state.
  const [createdToast, setCreatedToast] = useState(false);
  useEffect(() => {
    if (location.state?.created) setCreatedToast(true);
  }, [location.state]);
  const showWizard = isNewMode && !isEditMode && !wizardAlreadyAnswered && !wizardDone;

  // Customer-level overrides are only on offer when the customer is not in a group, or the
  // group is explicitly overridden (Shopfront: "Override Customer Group").
  const showGroupOverrides = !formData.customerGroupId || !!formData.overrideCustomerGroup;

  const navigationItems = useMemo(
    () =>
      SECTIONS.filter(
        (s) => (!s.editOnly || isEditMode) && (!s.overrideOnly || showGroupOverrides)
      ),
    [isEditMode, showGroupOverrides]
  );

  useEffect(() => {
    if (isSuperAdmin()) {
      loadOutlets();
    }

    if (isEditMode) {
      loadCustomer();
    } else if (isNewMode) {
      // Check for wizard data from modal props first, then location state
      const wizardData = modalWizardData || (location.state?.fromWizard && location.state?.wizardData);
      if (wizardData) {
        setFormData(prev => {
          const updatedFormData = {
            ...prev,
            ...wizardData
          };
          return updatedFormData;
        });

        if (wizardData.outletId) {
          loadCustomerGroups(wizardData.outletId);
          loadPriceLists(wizardData.outletId);
        }
      } else {
        const firstNameFromUrl = searchParams.get("firstName");
        const lastNameFromUrl = searchParams.get("lastName");
        if (firstNameFromUrl) {
          setFormData((prev) => ({ ...prev, firstName: firstNameFromUrl }));
        }
        if (lastNameFromUrl) {
          setFormData((prev) => ({ ...prev, lastName: lastNameFromUrl }));
        }
      }
    }
  }, [id, isEditMode, isNewMode, searchParams, location.state, isSuperAdmin, modalWizardData, isModal]);

  useEffect(() => {
    const outletIdToUse = formData.outletId !== undefined ? formData.outletId : getOutletId();
    loadCustomerGroups(outletIdToUse);
    loadPriceLists(outletIdToUse);
  }, [formData.outletId]);

  // Scroll-spy: every section currently in the viewport lights up in the rail.
  useEffect(() => {
    if (showWizard || loading) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleSections((prev) => {
          const next = new Set(prev);
          entries.forEach((entry) => {
            if (entry.isIntersecting) next.add(entry.target.id);
            else next.delete(entry.target.id);
          });
          return Array.from(next);
        });
      },
      { rootMargin: "-72px 0px -20% 0px" }
    );

    navigationItems.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [showWizard, loading, navigationItems]);

  const loadOutlets = async () => {
    try {
      const response = await outletService.getAllOutlets();
      setOutlets(response.outlets || []);
    } catch (err) {
      console.error('Error loading outlets:', err);
    }
  };

  const loadCustomerGroups = async (selectedOutletId = null) => {
    try {
      const response = await customerGroupService.getCustomerGroups();
      if (response.customerGroups) {
        const outletIdToFilter = selectedOutletId || formData.outletId || getOutletId();
        let filtered = response.customerGroups;
        if (outletIdToFilter) {
          filtered = response.customerGroups.filter(
            (g) => (g.outletId === outletIdToFilter || g.outletId === null) && g.isActive
          );
        } else if (!isSuperAdmin()) {
          const userOutletId = getOutletId();
          filtered = response.customerGroups.filter(
            (g) => (g.outletId === userOutletId || g.outletId === null) && g.isActive
          );
        } else {
          filtered = response.customerGroups.filter(g => g.isActive);
        }
        setCustomerGroups(filtered);
      } else {
        setCustomerGroups([]);
      }
    } catch (err) {
      console.error("Error loading customer groups:", err);
      setCustomerGroups([]);
    }
  };

  const loadPriceLists = async (selectedOutletId = null) => {
    try {
      const response = await priceListService.getPriceLists();
      if (response.priceLists) {
        const outletIdToFilter = selectedOutletId || formData.outletId || getOutletId();

        let filtered = response.priceLists;
        if (outletIdToFilter) {
          filtered = response.priceLists.filter(
            (p) => (p.outletId === outletIdToFilter || p.outletId === null) && p.isActive
          );
        } else if (!isSuperAdmin()) {
          const userOutletId = getOutletId();
          filtered = response.priceLists.filter(
            (p) => (p.outletId === userOutletId || p.outletId === null) && p.isActive
          );
        } else {
          filtered = response.priceLists.filter(p => p.isActive);
        }
        setPriceLists(filtered);
      } else {
        setPriceLists([]);
      }
    } catch (err) {
      console.error("Error loading price lists:", err);
      setPriceLists([]);
    }
  };

  const loadCustomer = async () => {
    try {
      setLoading(true);
      const response = await customerService.getCustomer(id);
      const customer = response.customer;

      setFormData({
        firstName: customer.firstName || "",
        lastName: customer.lastName || "",
        company: customer.company || "",
        code: customer.code || "",
        customerGroupId: customer.customerGroupId || "",
        outletId: customer.outletId || null,
        emails: customer.emails || [""],
        phone: customer.phone || "",
        mobile: customer.mobile || "",
        fax: customer.fax || "",
        allowMarketingEmails: customer.allowMarketingEmails || "Not Specified",
        website: customer.website || "",
        twitter: customer.twitter || "",
        facebook: customer.facebook || "",
        billingStreet1: customer.billingStreet1 || "",
        billingStreet2: customer.billingStreet2 || "",
        billingSuburb: customer.billingSuburb || "",
        billingPostcode: customer.billingPostcode || "",
        billingState: customer.billingState || "",
        billingCountry: customer.billingCountry || "",
        deliveryStreet1: customer.deliveryStreet1 || "",
        deliveryStreet2: customer.deliveryStreet2 || "",
        deliverySuburb: customer.deliverySuburb || "",
        deliveryPostcode: customer.deliveryPostcode || "",
        deliveryState: customer.deliveryState || "",
        deliveryCountry: customer.deliveryCountry || "",
        loyaltyPoints: customer.loyaltyPoints || "0",
        accountLimit: customer.accountLimit || "",
        currentOwing: customer.currentOwing || "0",
        requireOrderReference: customer.requireOrderReference || false,
        disablePromotions: customer.disablePromotions || false,
        priceListId: customer.priceListId || "",
        // Persisted flag wins; the derivation is only a fallback for rows written before the
        // column was populated, so those never open with the override sections hidden.
        overrideCustomerGroup:
          customer.overrideCustomerGroup ??
          !!(
            customer.priceListId ||
            customer.disablePromotions ||
            customer.accountLimit ||
            customer.requireOrderReference
          ),
        businessNumber: customer.businessNumber || "",
        // parseISO reads 'YYYY-MM-DD' as LOCAL midnight; new Date() would read it as UTC and
        // shift the displayed day. Stored value is date-only, so slice tolerates legacy stamps.
        birthday: customer.birthday ? parseISO(String(customer.birthday).slice(0, 10)) : null,
        gender: customer.gender || "",
        invoiceMessage: customer.invoiceMessage || "",
        internalComments: customer.internalComments || "",
      });

      // No stored flag, so derive it: every delivery field either blank or equal to its
      // billing counterpart means "same as billing".
      setSameAsBilling(
        DELIVERY_TO_BILLING.every(([delivery, billing]) => {
          const value = customer[delivery] || "";
          return value === "" || value === (customer[billing] || "");
        })
      );

      setError("");
    } catch (err) {
      setError("Failed to load customer");
      console.error("Error loading customer:", err);
    } finally {
      setLoading(false);
    }
  };

  // Reference requires only the customer's name. Everything else is optional and is
  // only checked for FORMAT when the user actually filled it in.
  // A last name is optional here AND in the API validator — one contract, so the wizard
  // can never walk the user to a dead end the full form then rejects.
  const validateField = (fieldName, value) => {
    const errors = { ...fieldErrors };

    switch (fieldName) {
      case 'firstName':
        if (!value.trim()) {
          errors.firstName = "First name is required";
        } else {
          delete errors.firstName;
        }
        break;

      case 'outletId':
        if (isSuperAdmin() && !value) {
          errors.outletId = "Please select an outlet for this customer";
        } else {
          delete errors.outletId;
        }
        break;

      case 'emails': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const filledEmails = value.filter((email) => email.trim() !== "");
        if (filledEmails.some((email) => !emailRegex.test(email))) {
          errors.emails = "Please enter valid email addresses";
        } else {
          delete errors.emails;
        }
        break;
      }

      case 'accountLimit':
        if (value && isNaN(parseFloat(value))) {
          errors.accountLimit = "Account limit must be a valid number";
        } else {
          delete errors.accountLimit;
        }
        break;

      case 'loyaltyPoints':
        // Whole numbers only — the same rule the API declares. Without this the
        // parseInt() in handleSave silently threw the fraction away.
        if (value && !/^\d+$/.test(String(value).trim())) {
          errors.loyaltyPoints = "Loyalty points must be a whole number of 0 or more";
        } else {
          delete errors.loyaltyPoints;
        }
        break;

      case 'currentOwing':
        if (value && isNaN(parseFloat(value))) {
          errors.currentOwing = "Current owing must be a valid number";
        } else {
          delete errors.currentOwing;
        }
        break;

      default:
        break;
    }

    setFieldErrors(errors);
    return !errors[fieldName];
  };

  const scrollToFirstError = (errors) => {
    const fieldOrder = [
      'firstName',
      'lastName',
      'customerGroupId',
      'outletId',
      'emails',
      'phone',
      'mobile',
      'priceListId',
      'gender',
      'accountLimit',
      'loyaltyPoints',
      'currentOwing'
    ];

    for (const fieldName of fieldOrder) {
      if (errors[fieldName] && fieldRefs.current[fieldName]) {
        fieldRefs.current[fieldName].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        if (fieldName === 'firstName' || fieldName === 'lastName' ||
            fieldName === 'phone' || fieldName === 'mobile' ||
            fieldName === 'accountLimit' || fieldName === 'loyaltyPoints' ||
            fieldName === 'currentOwing') {
          setTimeout(() => {
            fieldRefs.current[fieldName].focus();
          }, 500);
        }
        break;
      }
    }
  };

  const validateForm = () => {
    const errors = {};
    let mainErrorMessage = "";

    if (!formData.firstName.trim()) {
      mainErrorMessage = "Please give the customer a name";
      errors.firstName = "First name is required";
    }

    if (isSuperAdmin() && !formData.outletId) {
      mainErrorMessage = "Please select an outlet for this customer";
      errors.outletId = "Please select an outlet for this customer";
    }

    const filledEmails = formData.emails.filter((email) => email.trim() !== "");
    if (filledEmails.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (filledEmails.some((email) => !emailRegex.test(email))) {
        if (!mainErrorMessage) mainErrorMessage = "Please enter valid email addresses";
        errors.emails = "Please enter valid email addresses";
      }
    }

    if (formData.accountLimit && isNaN(parseFloat(formData.accountLimit))) {
      if (!mainErrorMessage) mainErrorMessage = "Account limit must be a valid number";
      errors.accountLimit = "Account limit must be a valid number";
    }

    if (formData.loyaltyPoints && !/^\d+$/.test(String(formData.loyaltyPoints).trim())) {
      const message = "Loyalty points must be a whole number of 0 or more";
      if (!mainErrorMessage) mainErrorMessage = message;
      errors.loyaltyPoints = message;
    }

    if (formData.currentOwing && isNaN(parseFloat(formData.currentOwing))) {
      if (!mainErrorMessage) mainErrorMessage = "Current owing must be a valid number";
      errors.currentOwing = "Current owing must be a valid number";
    }

    setFieldErrors(errors);
    setError(mainErrorMessage);

    if (Object.keys(errors).length > 0) {
      scrollToFirstError(errors);
    }

    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field, value) => {
    if (error) {
      setError("");
    }

    if (field === 'outletId') {
      const newOutletId = value;
      setFormData(prev => ({
        ...prev,
        outletId: newOutletId,
        customerGroupId: '',
        priceListId: ''
      }));
      loadCustomerGroups(newOutletId);
      loadPriceLists(newOutletId);
      validateField('outletId', newOutletId);
      return;
    }

    if (field === 'overrideCustomerGroup' && !value && formData.overrideCustomerGroup) {
      // Reference gates the true -> false flip behind a confirmation.
      setConfirmDisableOverride(true);
      return;
    }

    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === 'emails') {
      validateField('emails', value);
    } else {
      validateField(field, value);
    }
  };

  // Debounced live check: green check appears when the typed code is unused in
  // this outlet (codes are unique per outlet, matching the Save-time rule).
  const checkCodeUnique = (raw) => {
    const code = String(raw || "").trim();
    clearTimeout(codeCheckTimer.current);
    if (!code) {
      setCodeUnique(false);
      return;
    }
    codeCheckTimer.current = setTimeout(async () => {
      try {
        const res = await customerService.getCustomers(
          { search: code },
          { silent: true, skipOutletScope: true, noCache: true }
        );
        const clash = (res.customers || []).some(
          (c) =>
            String(c.code || "").toLowerCase() === code.toLowerCase() &&
            String(c.id) !== String(id) &&
            String(c.outletId ?? "") === String(formData.outletId ?? "")
        );
        setCodeUnique(!clash);
      } catch {
        setCodeUnique(false);
      }
    }, 400);
  };

  const handleFieldBlur = (field, value) => {
    if (field === 'emails') {
      validateField('emails', value);
    } else {
      validateField(field, value);
    }
  };

  const handleEmailChange = (index, value) => {
    if (error) {
      setError("");
    }

    const newEmails = [...formData.emails];
    newEmails[index] = value;
    setFormData((prev) => ({ ...prev, emails: newEmails }));

    validateField('emails', newEmails);
  };

  const handleAddEmail = () => {
    setFormData((prev) => ({ ...prev, emails: [...prev.emails, ""] }));
  };

  const handleRemoveEmail = (index) => {
    const newEmails = formData.emails.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, emails: newEmails.length > 0 ? newEmails : [""] }));
  };

  const handleScrollToSection = (sectionId) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    // Deterministic window scroll (the page scrolls on the window, not an inner
    // container). 80px offset clears the 64px sticky header, matching scrollMarginTop.
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const handleSave = async () => {
    setError("");
    setFieldErrors({});

    if (!validateForm()) {
      return;
    }

    setSaveLoading(true);

    // Optional id/enum fields must be omitted (not ""), the API validates them as int/enum.
    const dataToSend = {
      ...formData,
      outletId: formData.outletId || null,
      customerGroupId: formData.customerGroupId || undefined,
      priceListId: formData.priceListId || undefined,
      gender: formData.gender || undefined,
      loyaltyPoints: parseInt(formData.loyaltyPoints, 10) || 0,
      // "Same as Billing Address" is a UI affordance, not a stored flag: copy the billing
      // address across so every downstream consumer still reads a real delivery address.
      ...(sameAsBilling
        ? Object.fromEntries(
            DELIVERY_TO_BILLING.map(([delivery, billing]) => [delivery, formData[billing]])
          )
        : {}),
      // Local calendar day — toISOString() would store the previous day east of UTC.
      birthday: isValid(formData.birthday) ? format(formData.birthday, 'yyyy-MM-dd') : null
    };

    try {
      let savedCustomer;
      if (isEditMode) {
        await customerService.updateCustomer(id, dataToSend);
        savedCustomer = { id, ...dataToSend };
      } else {
        const response = await customerService.createCustomer(dataToSend);
        savedCustomer = response.customer;
      }

      // In modal mode hand the saved customer back and close: leaving the (still create-mode)
      // form mounted lets a second Save create a duplicate customer.
      if (isModal) {
        if (onSave) onSave(savedCustomer);
        if (onClose) onClose();
      } else {
        navigate("/customers");
      }
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${isEditMode ? "update" : "create"} customer`);
      console.error(`Error ${isEditMode ? "updating" : "creating"} customer:`, err);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    if (isModal && onClose) {
      onClose();
    } else {
      navigate("/customers");
    }
  };

  const selectedGroup = customerGroups.find((g) => g.id === formData.customerGroupId) || null;

  if (loading) {
    return null;
  }

  /* ---------------------------------------------------------------- wizard */

  if (showWizard) {
    const canAdvance = formData.firstName.trim() !== "" && !fieldErrors.emails;
    const finishWizard = () => setWizardDone(true);
    // Reference semantics: completing the 4 wizard questions CREATES the
    // customer immediately and lands on its edit page (no full form first).
    const createFromWizard = async () => {
      if (isSuperAdmin() && !formData.outletId) {
        setWizardStep(1);
        setWizardError("Please select an outlet for this customer");
        return;
      }
      setWizardError("");
      setSaveLoading(true);
      try {
        const response = await customerService.createCustomer({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName || "",
          code: formData.code || undefined,
          emails: (formData.emails || []).map((e) => e.trim()).filter(Boolean),
          customerGroupId: formData.customerGroupId || undefined,
          outletId: formData.outletId || null,
          loyaltyPoints: 0,
        });
        navigate(`/customers/${response.customer.id}/edit`, { state: { created: true } });
      } catch (err) {
        setWizardError(err.response?.data?.error || "Failed to create customer");
      } finally {
        setSaveLoading(false);
      }
    };
    const goNext = () => {
      if (!canAdvance) return;
      return wizardStep === WIZARD_STEPS - 1 ? createFromWizard() : setWizardStep((s) => s + 1);
    };

    const wizardQuestions = [
      {
        question: "What is the customer's name?",
        content: (
          <>
            <TextField
              autoFocus
              fullWidth
              placeholder="First Name (required)"
              value={formData.firstName}
              onChange={(e) => handleInputChange("firstName", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdvance && goNext()}
              sx={{ ...wizardInputSx, mb: 2 }}
            />
            <TextField
              fullWidth
              placeholder="Last Name"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canAdvance && goNext()}
              sx={wizardInputSx}
            />
          </>
        ),
      },
      {
        question: `Which group does ${formData.firstName || "the customer"} belong to?`,
        content: (
          <>
            {isSuperAdmin() && (
              <FormControl sx={{ ...wizardInputSx, mb: 2 }}>
                <Select
                  displayEmpty
                  value={formData.outletId || ""}
                  onChange={(e) =>
                    handleInputChange("outletId", e.target.value === "" ? null : e.target.value)
                  }
                >
                  <MenuItem value="">
                    <em>Select an outlet</em>
                  </MenuItem>
                  {outlets.map((outlet) => (
                    <MenuItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <Autocomplete
              options={customerGroups}
              getOptionLabel={(option) => option.name || ""}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={selectedGroup}
              onChange={(_, option) => handleInputChange("customerGroupId", option ? option.id : "")}
              sx={wizardInputSx}
              renderInput={(params) => (
                <TextField {...params} placeholder="Search customer groups" />
              )}
            />
          </>
        ),
      },
      {
        question: `What code would you like to allocate to ${formData.firstName || "the customer"}?`,
        content: (
          <TextField
            fullWidth
            placeholder="Code"
            value={formData.code}
            onChange={(e) => handleInputChange("code", e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goNext()}
            sx={wizardInputSx}
          />
        ),
      },
      {
        question: `What is ${formData.firstName || "the customer"}'s email?`,
        content: (
          <TextField
            fullWidth
            type="email"
            placeholder="Email"
            value={formData.emails[0] || ""}
            onChange={(e) => handleEmailChange(0, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goNext()}
            sx={wizardInputSx}
            error={!!fieldErrors.emails}
            helperText={fieldErrors.emails}
          />
        ),
      },
    ];

    return (
      <Box
        className="creation-wizard"
        sx={{
          ...wizardBackgroundSx,
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          p: 4,
        }}
      >
        <Box
          onClick={handleCancel}
          sx={{
            position: "absolute",
            top: 24,
            right: 32,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            color: "#f8f8f8",
            fontSize: "19.2px",
            cursor: "pointer",
            transition: "color 0.2s, opacity 0.2s",
            "&:hover": { opacity: 0.75 },
          }}
        >
          <CloseIcon sx={{ fontSize: "19.2px" }} />
          CANCEL
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1.5, color: "#f8f8f8" }}>
          {Array.from({ length: WIZARD_STEPS }, (_, step) => (
            <Box
              key={step}
              onClick={() => (step === 0 || canAdvance) && setWizardStep(step)}
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                "& svg": { transition: "font-size 0.2s" },
              }}
            >
              {step === wizardStep ? (
                <StepActiveIcon sx={{ fontSize: "20.8px" }} />
              ) : (
                <StepIcon sx={{ fontSize: "16px" }} />
              )}
            </Box>
          ))}
        </Box>

        <Typography sx={{ color: "#f8f8f8", fontSize: 32, fontWeight: 500, mt: 2, mb: 6 }}>
          Create Customer
        </Typography>

        <Box sx={{ flex: 1, width: "100%", maxWidth: 868 }}>
          <Typography sx={{ color: "#f8f8f8", fontSize: 34, fontWeight: 400, mb: 3 }}>
            {wizardQuestions[wizardStep].question}
          </Typography>
          {wizardQuestions[wizardStep].content}
          {wizardError && (
            <Typography sx={{ color: "#ffb4b4", fontSize: 18, mt: 2 }}>{wizardError}</Typography>
          )}
        </Box>

        <Box
          sx={{
            width: "100%",
            maxWidth: 868,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => setWizardStep((s) => s - 1)}
            sx={{ ...wizardControlSx, fontSize: "17.6px", visibility: wizardStep === 0 ? "hidden" : "visible" }}
          >
            PREVIOUS
          </Button>

          <Button onClick={finishWizard} sx={{ ...wizardControlSx, fontSize: "17.6px" }}>
            SKIP
          </Button>

          <Button
            endIcon={wizardStep === WIZARD_STEPS - 1 ? <CheckIcon /> : <ArrowForwardIcon />}
            onClick={goNext}
            disabled={!canAdvance || saveLoading}
            sx={{ ...wizardControlSx, fontSize: "17.6px" }}
          >
            {wizardStep === WIZARD_STEPS - 1 ? "FINISH" : "NEXT"}
          </Button>
        </Box>
      </Box>
    );
  }

  /* ------------------------------------------------------------------ form */

  const sectionProps = (sectionId) => ({
    id: sectionId,
    collapsed: !!collapsedSections[sectionId],
    onToggle: () => toggleSection(sectionId),
  });

  return (
    <Box sx={{ display: "flex" }}>
      <Paper
        sx={{
          width: 250,
          height: "100%",
          p: 1,
          backgroundColor: "#fff",
          borderRadius: 0,
          boxShadow: "none",
          paddingBottom: "100px",
          position: "fixed",
        }}
      >
        <List>
          {navigationItems.map((item) => {
            const inView = visibleSections.includes(item.id);
            return (
              <ListItem
                key={item.id}
                button
                onClick={() => handleScrollToSection(item.id)}
                sx={{
                  backgroundColor: inView ? "#e6f2fb" : "transparent",
                  color: "#313439",
                  borderRadius: 0,
                  transition: "color 0.2s ease",
                  "&:hover": {
                    backgroundColor: inView ? "#e6f2fb" : "transparent",
                    color: "#5ebbeb",
                  },
                }}
              >
                <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  sx={{
                    "& .MuiTypography-root": {
                      fontWeight: 400,
                      fontSize: "20.8px",
                      color: "inherit",
                      transition: "color 0.2s ease",
                    },
                  }}
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>

      <Box
        className="edit-page-content"
        sx={{
          flex: 1,
          ml: "250px",
          backgroundColor: "#676b72",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            backgroundColor: "#fff",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
          }}
        >
          <Typography sx={{ fontSize: "20.8px", color: "#313439" }}>
            {`${formData.firstName} ${formData.lastName}`.trim()}
          </Typography>
          <IconButton
            aria-label="Close"
            onClick={handleCancel}
            sx={{
              position: "absolute",
              right: 16,
              width: 36,
              height: 36,
              border: "1px solid #313439",
              color: "#313439",
              transition: "color 0.2s ease, border-color 0.2s ease",
              "&:hover": {
                backgroundColor: "transparent",
                color: "#5ebbeb",
                borderColor: "#5ebbeb",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            p: 3,
            pb: "160px",
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 3, width: 500 }} onClose={() => setError("")}>
              {error}
            </Alert>
          )}

          <SectionCard {...sectionProps("general")} icon={<PersonIcon />} title="General Information">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  ref={(el) => (fieldRefs.current.firstName = el)}
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  onBlur={(e) => handleFieldBlur("firstName", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                  error={!!fieldErrors.firstName}
                  helperText={fieldErrors.firstName}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  ref={(el) => (fieldRefs.current.lastName = el)}
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  onBlur={(e) => handleFieldBlur("lastName", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                  error={!!fieldErrors.lastName}
                  helperText={fieldErrors.lastName}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Company"
                  value={formData.company}
                  onChange={(e) => handleInputChange("company", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Code"
                  value={formData.code}
                  onChange={(e) => {
                    handleInputChange("code", e.target.value);
                    checkCodeUnique(e.target.value);
                  }}
                  fullWidth
                  sx={fieldSx}
                  InputProps={{
                    endAdornment: codeUnique ? (
                      <CheckIcon sx={{ color: "#16a34a" }} />
                    ) : null,
                  }}
                />
              </Grid>
              {isSuperAdmin() && (
                <Grid item xs={12}>
                  <FormControl fullWidth sx={fieldSx} error={!!fieldErrors.outletId}>
                    <InputLabel>Outlet</InputLabel>
                    <Select
                      ref={(el) => (fieldRefs.current.outletId = el)}
                      value={formData.outletId || ''}
                      onChange={(e) => {
                        handleInputChange('outletId', e.target.value === '' ? null : e.target.value);
                      }}
                      onBlur={(e) => handleFieldBlur('outletId', e.target.value === '' ? null : e.target.value)}
                      label="Outlet"
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value="">
                        <em>Select an outlet</em>
                      </MenuItem>
                      {outlets.map((outlet) => (
                        <MenuItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldErrors.outletId && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                        {fieldErrors.outletId}
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <Autocomplete
                  options={customerGroups}
                  getOptionLabel={(option) => option.name || ""}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={selectedGroup}
                  onChange={(_, option) =>
                    handleInputChange("customerGroupId", option ? option.id : "")
                  }
                  sx={fieldSx}
                  componentsProps={autocompletePaperProps}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      ref={(el) => (fieldRefs.current.customerGroupId = el)}
                      label="Customer Group"
                      placeholder="Search customer groups"
                    />
                  )}
                />
              </Grid>
              {!!formData.customerGroupId && (
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <ShopfrontSwitch
                        checked={formData.overrideCustomerGroup}
                        onChange={(e) =>
                          handleInputChange("overrideCustomerGroup", e.target.checked)
                        }
                      />
                    }
                    label="Override Customer Group"
                    sx={{ gap: 1.5, ml: 0 }}
                  />
                </Grid>
              )}
            </Grid>
          </SectionCard>

          <SectionCard {...sectionProps("contact")} icon={<ContactIcon />} title="Contact">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography variant="body2" sx={{ color: "#676b72" }}>
                    Emails
                  </Typography>
                  <Box
                    component="button"
                    type="button"
                    onClick={handleAddEmail}
                    sx={{
                      border: 0,
                      p: 0,
                      background: "none",
                      font: "inherit",
                      fontSize: "13px",
                      color: "#676b72",
                      cursor: "pointer",
                      transition: "color 0.2s ease",
                      "&:hover": { color: "#5ebbeb" },
                    }}
                  >
                    Add +
                  </Box>
                </Box>
                {formData.emails.map((email, index) => (
                  <Box key={index} sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                    <TextField
                      ref={index === 0 ? (el) => (fieldRefs.current.emails = el) : null}
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      onBlur={() => handleFieldBlur("emails", formData.emails)}
                      fullWidth
                      sx={fieldSx}
                      placeholder="Enter email address"
                      error={!!fieldErrors.emails && index === 0}
                      helperText={fieldErrors.emails && index === 0 ? fieldErrors.emails : ""}
                    />
                    <IconButton
                      aria-label="Remove email"
                      onClick={() => handleRemoveEmail(index)}
                      disabled={formData.emails.length === 1}
                      sx={{
                        flexShrink: 0,
                        width: 53,
                        height: 53,
                        borderRadius: 0,
                        border: "1px solid #000",
                        backgroundColor: "#fff",
                        color: "#313439",
                        transition: "color 0.2s ease, border-color 0.2s ease",
                        "&:hover": {
                          backgroundColor: "#fff",
                          color: "#5ebbeb",
                          borderColor: "#5ebbeb",
                        },
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                ))}
              </Grid>
              <Grid item xs={12}>
                <TextField
                  ref={(el) => (fieldRefs.current.phone = el)}
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  ref={(el) => (fieldRefs.current.mobile = el)}
                  label="Mobile"
                  value={formData.mobile}
                  onChange={(e) => handleInputChange("mobile", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Fax"
                  value={formData.fax}
                  onChange={(e) => handleInputChange("fax", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth sx={fieldSx}>
                  <InputLabel>Allow Marketing Emails</InputLabel>
                  <Select
                    value={formData.allowMarketingEmails}
                    onChange={(e) => handleInputChange("allowMarketingEmails", e.target.value)}
                    label="Allow Marketing Emails"
                    MenuProps={selectMenuProps}
                  >
                    {/* Values stay Yes/No/Not Specified — the API validates that enum. */}
                    <MenuItem value="Yes">Opted In</MenuItem>
                    <MenuItem value="No">Opted Out</MenuItem>
                    <MenuItem value="Not Specified">Not Specified</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard {...sectionProps("socialMedia")} icon={<SocialMediaIcon />} title="Social Media">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Website"
                  value={formData.website}
                  onChange={(e) => handleInputChange("website", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Twitter"
                  value={formData.twitter}
                  onChange={(e) => handleInputChange("twitter", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Facebook"
                  value={formData.facebook}
                  onChange={(e) => handleInputChange("facebook", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard {...sectionProps("billingAddress")} icon={<BillingIcon />} title="Billing Address">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Street Address 1"
                  value={formData.billingStreet1}
                  onChange={(e) => handleInputChange("billingStreet1", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Street Address 2"
                  value={formData.billingStreet2}
                  onChange={(e) => handleInputChange("billingStreet2", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Suburb"
                  value={formData.billingSuburb}
                  onChange={(e) => handleInputChange("billingSuburb", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Postcode / ZIP Code"
                  value={formData.billingPostcode}
                  onChange={(e) => handleInputChange("billingPostcode", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="State / Province"
                  value={formData.billingState}
                  onChange={(e) => handleInputChange("billingState", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Country"
                  value={formData.billingCountry}
                  onChange={(e) => handleInputChange("billingCountry", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
            </Grid>
          </SectionCard>

          <SectionCard {...sectionProps("deliveryAddress")} icon={<DeliveryIcon />} title="Delivery Address">
            <FormControlLabel
              control={
                <ShopfrontSwitch
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                />
              }
              label="Same as Billing Address"
              sx={{ gap: 1.5, ml: 0, mb: sameAsBilling ? 0 : 2 }}
            />
            {sameAsBilling ? (
              <Typography variant="body2" sx={{ color: "#676b72" }}>
                The delivery address will be the same as the billing address
              </Typography>
            ) : (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Street Address 1"
                  value={formData.deliveryStreet1}
                  onChange={(e) => handleInputChange("deliveryStreet1", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Street Address 2"
                  value={formData.deliveryStreet2}
                  onChange={(e) => handleInputChange("deliveryStreet2", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Suburb"
                  value={formData.deliverySuburb}
                  onChange={(e) => handleInputChange("deliverySuburb", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Postcode / ZIP Code"
                  value={formData.deliveryPostcode}
                  onChange={(e) => handleInputChange("deliveryPostcode", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="State / Province"
                  value={formData.deliveryState}
                  onChange={(e) => handleInputChange("deliveryState", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Country"
                  value={formData.deliveryCountry}
                  onChange={(e) => handleInputChange("deliveryCountry", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
            </Grid>
            )}
          </SectionCard>

          {showGroupOverrides && (
            <SectionCard {...sectionProps("loyalty")} icon={<LoyaltyIcon />} title="Loyalty">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    ref={(el) => (fieldRefs.current.loyaltyPoints = el)}
                    label="Loyalty Points"
                    value={formData.loyaltyPoints}
                    onChange={(e) => handleInputChange("loyaltyPoints", e.target.value)}
                    onBlur={(e) => handleFieldBlur("loyaltyPoints", e.target.value)}
                    fullWidth
                    sx={fieldSx}
                    type="number"
                    error={!!fieldErrors.loyaltyPoints}
                    helperText={fieldErrors.loyaltyPoints}
                  />
                </Grid>
              </Grid>
            </SectionCard>
          )}

          {isEditMode && showGroupOverrides && (
            <SectionCard {...sectionProps("account")} icon={<AccountBalanceIcon />} title="Account">
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    ref={(el) => (fieldRefs.current.accountLimit = el)}
                    label="Account Limit"
                    value={formData.accountLimit}
                    onChange={(e) => handleInputChange("accountLimit", e.target.value)}
                    onBlur={(e) => handleFieldBlur("accountLimit", e.target.value)}
                    fullWidth
                    sx={fieldSx}
                    type="number"
                    placeholder="$ Unlimited"
                    error={!!fieldErrors.accountLimit}
                    helperText={fieldErrors.accountLimit}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    ref={(el) => (fieldRefs.current.currentOwing = el)}
                    label="Current Owing"
                    value={formData.currentOwing}
                    onChange={(e) => handleInputChange("currentOwing", e.target.value)}
                    onBlur={(e) => handleFieldBlur("currentOwing", e.target.value)}
                    fullWidth
                    sx={fieldSx}
                    type="number"
                    error={!!fieldErrors.currentOwing}
                    helperText={fieldErrors.currentOwing}
                    InputProps={{ readOnly: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <ShopfrontSwitch
                        checked={formData.requireOrderReference}
                        onChange={(e) => handleInputChange("requireOrderReference", e.target.checked)}
                      />
                    }
                    label="Require Order Reference"
                    sx={{ gap: 1.5, ml: 0 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: "#676b72" }}>
                    Performance Trend (Current Owing)
                  </Typography>
                  <PerformanceGraph
                    currentOwing={formData.currentOwing}
                    accountLimit={formData.accountLimit}
                  />
                </Grid>
              </Grid>
            </SectionCard>
          )}

          {showGroupOverrides && (
            <SectionCard
              {...sectionProps("specialPricing")}
              icon={<SpecialPricingIcon />}
              title="Special Pricing"
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <ShopfrontSwitch
                        checked={formData.disablePromotions}
                        onChange={(e) => handleInputChange("disablePromotions", e.target.checked)}
                      />
                    }
                    label="Disable Promotions"
                    sx={{ gap: 1.5, ml: 0 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth sx={fieldSx}>
                    <InputLabel>Price List</InputLabel>
                    <Select
                      ref={(el) => (fieldRefs.current.priceListId = el)}
                      value={formData.priceListId}
                      onChange={(e) => handleInputChange("priceListId", e.target.value)}
                      label="Price List"
                      MenuProps={selectMenuProps}
                    >
                      <MenuItem value="">
                        <em>No price list</em>
                      </MenuItem>
                      {priceLists.map((priceList) => (
                        <MenuItem key={priceList.id} value={priceList.id}>
                          {priceList.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </SectionCard>
          )}

          <SectionCard {...sectionProps("miscellaneous")} icon={<MiscellaneousIcon />} title="Miscellaneous">
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Business Number"
                  value={formData.businessNumber}
                  onChange={(e) => handleInputChange("businessNumber", e.target.value)}
                  fullWidth
                  sx={fieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                {/* enGB => the reference's AU dd/MM/yyyy mask; the adapter defaults to en-US. */}
                <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
                  <DatePicker
                    label="Birthday"
                    value={formData.birthday}
                    onChange={(newValue) => handleInputChange("birthday", newValue)}
                    renderInput={(params) => (
                      <TextField {...params} fullWidth sx={fieldSx} />
                    )}
                    maxDate={new Date()}
                    openTo="year"
                    views={['year', 'month', 'day']}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth sx={fieldSx}>
                  <InputLabel>Gender</InputLabel>
                  <Select
                    ref={(el) => (fieldRefs.current.gender = el)}
                    value={formData.gender}
                    onChange={(e) => handleInputChange("gender", e.target.value)}
                    label="Gender"
                    MenuProps={selectMenuProps}
                  >
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    {/* "Not Specified" clears the field: the API enum is male|female|other only. */}
                    <MenuItem value="">Not Specified</MenuItem>
                    {formData.gender === "other" && <MenuItem value="other">Other</MenuItem>}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Invoice and Statement Message"
                  value={formData.invoiceMessage}
                  onChange={(e) => handleInputChange("invoiceMessage", e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  sx={multilineFieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Comments (Internal)"
                  value={formData.internalComments}
                  onChange={(e) => handleInputChange("internalComments", e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  sx={multilineFieldSx}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Box>
      </Box>

      <Button
        onClick={handleSave}
        disabled={saveLoading}
        startIcon={<SaveIcon sx={{ fontSize: "32px !important" }} />}
        sx={{
          position: "fixed",
          right: 32,
          bottom: 32,
          zIndex: 10,
          width: 288,
          height: 72,
          borderRadius: 0,
          border: "1px solid #5ebbeb",
          boxShadow: "none",
          fontSize: 32,
          fontWeight: 400,
          textTransform: "none",
          backgroundColor: "#5ebbeb",
          color: "#f8f8f8",
          transition: "background 0.2s ease, color 0.2s ease",
          "&:hover": {
            boxShadow: "none",
            backgroundColor: "#f8f8f8",
            color: "#5ebbeb",
          },
          "&.Mui-disabled": {
            backgroundColor: "#5ebbeb",
            color: "#f8f8f8",
            opacity: 0.6,
          },
        }}
      >
        Save
      </Button>

      <ConfirmDeleteDialog
        open={confirmDisableOverride}
        title="Disable Customer Group Override"
        message="Are you sure you want to disable Override Customer Group? Your Price Lists, Loyalty and Account Limits may be reset"
        confirmText="Disable"
        onCancel={() => setConfirmDisableOverride(false)}
        onConfirm={() => {
          setConfirmDisableOverride(false);
          // ponytail: the override values stay on the record but are ignored while the flag is
          // off (getEffectiveCustomerSettings), so nothing is cleared — flip them back on and
          // the previous price list / limits are still there.
          setFormData((prev) => ({ ...prev, overrideCustomerGroup: false }));
        }}
      />

      <Snackbar
        open={createdToast}
        autoHideDuration={4000}
        onClose={() => setCreatedToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message="Successfully created customer"
      />
    </Box>
  );
};

export default CustomerDetails;
