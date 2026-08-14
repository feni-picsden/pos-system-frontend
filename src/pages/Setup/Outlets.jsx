import React, { useState, useEffect, useRef } from "react";
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Tooltip,
  FormControl,
  Select,
  MenuItem,
  OutlinedInput,
} from "@mui/material";
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOutlined as ViewIcon,
  SaveOutlined as SaveIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import outletService from "../../services/outletService";
import registerService from "../../services/registerService";
import settingsService from "../../services/settingsService";
import MapLocationPicker from "../../components/MapLocationPicker";
import posLocalDb from "../../services/posLocalDb";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import ShopfrontSwitch from "../../components/Common/ShopfrontSwitch";

// Reference has no transitions on its action links.
const INSTANT = "all 0s ease";

const PRIMARY_BUTTON_SX = {
  bgcolor: "#5ebbeb",
  color: "#fff",
  textTransform: "none",
  boxShadow: "none",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  transition: INSTANT,
  "&:hover": { bgcolor: "#4aa9dd", boxShadow: "none" },
};

// Reference row action: green icon+text link, no underline, no bg, 0s transition.
const EDIT_LINK_SX = {
  color: "#32b643",
  textTransform: "none",
  fontWeight: 400,
  fontSize: 16,
  minWidth: 0,
  px: 1,
  py: 0,
  transition: INSTANT,
  "&:hover": { color: "#6dd77b", bgcolor: "transparent" },
};

const rowActionSx = (color) => ({
  color,
  textTransform: "none",
  fontWeight: 400,
  fontSize: 16,
  minWidth: 0,
  px: 1,
  py: 0,
  transition: INSTANT,
  "&:hover": { bgcolor: "transparent", opacity: 0.7 },
});

const FIELD_LABEL_SX = { mb: 0.5, fontWeight: 400, fontSize: 16, color: "#000" };

// Parity-system inputs: 42px, radius 8, #404040 1px outline, black 2px focused.
const FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    height: 42,
    borderRadius: "8px",
    fontSize: 16,
    bgcolor: "#fff",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "2px" },
  },
  "& .MuiOutlinedInput-input": { padding: "9px 16px", "&::placeholder": { color: "#808080", opacity: 1 } },
};

const MULTILINE_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    fontSize: 16,
    bgcolor: "#fff",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "2px" },
  },
};

const CANCEL_BUTTON_SX = {
  bgcolor: "#8a8d91",
  color: "#fff",
  textTransform: "none",
  borderRadius: "12px",
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  boxShadow: "none",
  transition: INSTANT,
  "&:hover": { bgcolor: "#76797d", boxShadow: "none" },
};

const EMPTY_PROFILE = {
  // Miscellaneous (per Shopfront docs): Allow | Warn | Prevent, default Allow.
  discountBelowCost: "Allow",
  useGlobalCost: true,
  businessNumber: "",
  hasKitchenScreen: false,
  logo: "",
  email: "",
  fax: "",
  phone: "",
  mobile: "",
  website: "",
  twitter: "",
  facebook: "",
  street1: "",
  street2: "",
  suburb: "",
  city: "",
  postcode: "",
  state: "",
  country: "",
};

const CONTACT_FIELDS = [
  ["email", "Email"],
  ["fax", "Fax"],
  ["phone", "Phone"],
  ["mobile", "Mobile"],
  ["website", "Website"],
  ["twitter", "Twitter"],
  ["facebook", "Facebook"],
];

const ADDRESS_FIELDS = [
  ["street1", "Street 1"],
  ["street2", "Street 2"],
  ["suburb", "Suburb"],
  ["city", "City"],
  ["postcode", "Postcode"],
  ["state", "State"],
  ["country", "Country"],
];

const EDITOR_TABS = ["General", "Contact", "Address", "Miscellaneous", "Integrations"];

// Structured address parts -> the single address column the rest of the app reads.
const composeAddress = (p) =>
  [p.street1, p.street2, p.suburb, [p.city, p.postcode].filter(Boolean).join(" "), p.state, p.country]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(", ");

const Outlets = () => {
  const [outlets, setOutlets] = useState([]);
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    description: "",
    registerIds: [],
    metcashCustomerId: "",
    metcashState: "",
    metcashPillar: "",
    outletLatitude: null,
    outletLongitude: null,
    allowedRadius: null,
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Full-page editor state (reference edits an outlet on a page, not a modal)
  const [editingOutlet, setEditingOutlet] = useState(null);
  const [editTab, setEditTab] = useState(0);
  const [editData, setEditData] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchOutlets();
    fetchRegisters();
  }, []);

  // Keep local state and the IDB cache in lockstep after a mutation we already
  // know succeeded — never depend on an immediate refetch (transient 401/503
  // used to resurrect deleted rows).
  const applyOutlets = async (next) => {
    setOutlets(next);
    await posLocalDb.putStoreAll("outlets", next);
  };

  const fetchOutlets = async () => {
    await posLocalDb.init();
    const cached = await posLocalDb.getStoreAll("outlets");
    if (cached.length > 0) {
      setOutlets(cached);
      setLoading(false);
      const stale = await posLocalDb.isStoreStale("outlets");
      if (stale) {
        outletService
          .getAllOutlets()
          .then(async (r) => {
            const items = r.outlets || [];
            await posLocalDb.putStoreAll("outlets", items);
            setOutlets(items);
          })
          .catch(() => {});
      }
      return;
    }
    try {
      setLoading(true);
      const response = await outletService.getAllOutlets();
      const items = response.outlets || [];
      await posLocalDb.putStoreAll("outlets", items);
      setOutlets(items);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch outlets");
    } finally {
      setLoading(false);
    }
  };

  const fetchRegisters = async () => {
    await posLocalDb.init();
    const cached = await posLocalDb.getStoreAll("registers");
    if (cached.length > 0) {
      setRegisters(cached);
      const stale = await posLocalDb.isStoreStale("registers");
      if (stale) {
        registerService
          .list()
          .then(async (data) => {
            const items = Array.isArray(data) ? data : [];
            await posLocalDb.putStoreAll("registers", items);
            setRegisters(items);
          })
          .catch(() => {});
      }
      return;
    }
    try {
      const data = await registerService.list();
      const items = Array.isArray(data) ? data : [];
      await posLocalDb.putStoreAll("registers", items);
      setRegisters(items);
    } catch (err) {
      console.error("Failed to fetch registers:", err);
    }
  };

  // ─── Add dialog (local-only feature, kept) ────────────────────────────────

  const handleOpenDialog = () => {
    setFormData({
      name: "",
      code: "",
      address: "",
      description: "",
      registerIds: [],
      metcashCustomerId: "",
      metcashState: "",
      metcashPillar: "",
      outletLatitude: null,
      outletLongitude: null,
      allowedRadius: null,
    });
    setFormErrors({});
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setFormErrors({});
  };

  const handleSubmit = async () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.code.trim()) errors.code = "Code is required";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      const response = await outletService.createOutlet(formData);
      const created = {
        ...(response.outlet || {}),
        _count: { user_outlets: 0 },
        registers: registers
          .filter((r) => formData.registerIds.includes(r.id))
          .map(({ id, name, code, isActive, status }) => ({ id, name, code, isActive, status })),
      };
      await applyOutlets([created, ...outlets]);
      handleCloseDialog();
    } catch (err) {
      setFormErrors({ general: err.response?.data?.error || "Failed to save outlet" });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Full-page editor (reference: General / Contact / Address tabs) ──────

  const openEditor = async (outlet) => {
    setEditingOutlet(outlet);
    setEditTab(0);
    setEditErrors({});
    const base = {
      name: outlet.name || "",
      code: outlet.code || "",
      description: outlet.description || "",
      registerIds: outlet.registers?.map((r) => r.id) || [],
      metcashCustomerId: outlet.metcashCustomerId || "",
      metcashState: outlet.metcashState || "",
      metcashPillar: outlet.metcashPillar || "",
      outletLatitude: outlet.outletLatitude || null,
      outletLongitude: outlet.outletLongitude || null,
      allowedRadius: outlet.allowedRadius || null,
      ...EMPTY_PROFILE,
      street1: outlet.address || "",
    };
    setEditData(base);
    // Extended profile (contact / structured address / logo) lives in the
    // generic settings store — the outlet table has no columns for it.
    try {
      // Canonical key uses underscores; older saves used hyphens - read both.
      let res;
      try {
        res = await settingsService.getSetting(`outlet_profile_${outlet.id}`);
      } catch {
        res = await settingsService.getSetting(`outlet-profile-${outlet.id}`);
      }
      const profile = res?.setting?.value;
      if (profile && typeof profile === "object") {
        setEditData((prev) => ({ ...prev, ...profile }));
      }
    } catch {
      // 404 = no profile saved yet
    }
  };

  const closeEditor = () => {
    setEditingOutlet(null);
    setEditData(null);
    setEditErrors({});
  };

  const setField = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 500 * 1024) {
      setEditErrors((prev) => ({ ...prev, general: "Logo must be smaller than 500KB" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditData((prev) => ({ ...prev, logo: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSaveEditor = async () => {
    const errors = {};
    if (!editData.name.trim()) errors.name = "Name is required";
    if (!editData.code.trim()) errors.code = "Code is required";
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      setEditTab(0);
      return;
    }

    const composed = composeAddress(editData);
    const payload = {
      name: editData.name,
      code: editData.code,
      address: composed || editingOutlet.address || "",
      description: editData.description,
      registerIds: editData.registerIds,
      metcashCustomerId: editData.metcashCustomerId,
      metcashState: editData.metcashState,
      metcashPillar: editData.metcashPillar,
      outletLatitude: editData.outletLatitude,
      outletLongitude: editData.outletLongitude,
      allowedRadius: editData.allowedRadius,
    };
    const profile = Object.fromEntries(Object.keys(EMPTY_PROFILE).map((k) => [k, editData[k]]));

    try {
      setSaving(true);
      const response = await outletService.updateOutlet(editingOutlet.id, payload);
      try {
        await settingsService.updateSetting(
          `outlet_profile_${editingOutlet.id}`,
          profile,
          "outlet",
          `Contact and address profile for outlet ${editingOutlet.id}`
        );
      } catch (profileErr) {
        console.error("Failed to save outlet profile:", profileErr);
      }
      const updated = {
        ...editingOutlet,
        ...(response.outlet || {}),
        _count: editingOutlet._count,
        registers: registers
          .filter((r) => editData.registerIds.includes(r.id))
          .map(({ id, name, code, isActive, status }) => ({ id, name, code, isActive, status })),
      };
      await applyOutlets(outlets.map((o) => (o.id === updated.id ? updated : o)));
      closeEditor();
    } catch (err) {
      setEditErrors({ general: err.response?.data?.error || "Failed to save outlet" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete (shared confirm dialog, deterministic row removal) ────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await outletService.deleteOutlet(deleteTarget.id);
      // Remove the row locally + in IDB right away instead of refetching —
      // a transient GET failure must not resurrect a deleted outlet.
      await applyOutlets(outlets.filter((o) => o.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete outlet");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  // ─── Full-page outlet editor ──────────────────────────────────────────────

  if (editingOutlet && editData) {
    const fieldBlock = (key, label, props = {}) => (
      <Box key={key} sx={{ mb: 2 }}>
        <Typography sx={FIELD_LABEL_SX}>{label}</Typography>
        <TextField
          fullWidth
          value={editData[key] ?? ""}
          onChange={setField(key)}
          error={!!editErrors[key]}
          helperText={editErrors[key]}
          sx={FIELD_SX}
          {...props}
        />
      </Box>
    );

    return (
      <Box sx={{ p: 3, pb: 12 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Button
            disableRipple
            onClick={closeEditor}
            sx={{ minWidth: 0, color: "#313439", transition: INSTANT, "&:hover": { bgcolor: "rgba(0,0,0,0.05)" } }}
            aria-label="Back to outlets"
          >
            <ArrowBackIcon />
          </Button>
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: "#000" }}>
            Editing {editingOutlet.name}
          </Typography>
        </Box>

        {editErrors.general && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {editErrors.general}
          </Alert>
        )}

        <Box sx={{ display: "flex" }}>
          {EDITOR_TABS.map((tab, i) => (
            <Box
              key={tab}
              component="button"
              type="button"
              onClick={() => setEditTab(i)}
              sx={{
                height: 56,
                px: 4,
                border: 0,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: editTab === i ? 700 : 400,
                color: "#313439",
                bgcolor: editTab === i ? "#fff" : "transparent",
                borderRadius: "8px 8px 0 0",
                transition: INSTANT,
              }}
            >
              {tab}
            </Box>
          ))}
        </Box>

        <Box sx={{ bgcolor: "#fff", borderRadius: "0 8px 8px 8px", p: 3, maxWidth: editTab === 4 ? "none" : 560 }}>
          {editTab === 0 && (
            <>
              {fieldBlock("name", "Name", { required: true })}
              {fieldBlock("code", "Outlet Code", { required: true })}
              {fieldBlock("businessNumber", "Business Number")}

              <Box sx={{ mb: 2 }}>
                <Typography sx={FIELD_LABEL_SX}>Has Kitchen Screen</Typography>
                <Box sx={{ display: "flex", alignItems: "center", height: 42 }}>
                  <ShopfrontSwitch
                    checked={!!editData.hasKitchenScreen}
                    onChange={(e) => setEditData((prev) => ({ ...prev, hasKitchenScreen: e.target.checked }))}
                  />
                  <Typography sx={{ ml: 1.5, fontSize: 14, color: "#676b72" }}>
                    This Outlet is not allowed to use Kitchen Screens
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography sx={FIELD_LABEL_SX}>Logo</Typography>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  style={{ display: "none" }}
                />
                <Box
                  onClick={() => logoInputRef.current?.click()}
                  sx={{
                    width: 240,
                    height: 120,
                    bgcolor: "#f7f7f7",
                    border: "1px dashed #d9d9d9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    mb: 1,
                    overflow: "hidden",
                  }}
                >
                  {editData.logo ? (
                    <Box component="img" src={editData.logo} alt="Outlet logo" sx={{ maxWidth: "100%", maxHeight: "100%" }} />
                  ) : (
                    <Typography sx={{ fontSize: 16, color: "#676b72" }}>Select Image</Typography>
                  )}
                </Box>
                {editData.logo && (
                  <Button
                    disableRipple
                    onClick={() => setEditData((prev) => ({ ...prev, logo: "" }))}
                    sx={{
                      textTransform: "none",
                      minWidth: 0,
                      px: 0,
                      fontWeight: 400,
                      fontSize: 16,
                      color: "#313439",
                      transition: INSTANT,
                      "&:hover": { bgcolor: "transparent", opacity: 0.7 },
                    }}
                  >
                    Remove Image
                  </Button>
                )}
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography sx={FIELD_LABEL_SX}>Description</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={editData.description}
                  onChange={setField("description")}
                  sx={MULTILINE_FIELD_SX}
                />
              </Box>
            </>
          )}

          {editTab === 1 && CONTACT_FIELDS.map(([key, label]) => fieldBlock(key, label))}

          {editTab === 2 && ADDRESS_FIELDS.map(([key, label]) => fieldBlock(key, label))}

          {editTab === 3 && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography sx={FIELD_LABEL_SX}>Discounting Below Cost Behaviour</Typography>
                <FormControl fullWidth>
                  <Select
                    value={editData.discountBelowCost || "Allow"}
                    onChange={setField("discountBelowCost")}
                    sx={{ height: 42, borderRadius: "8px", fontSize: 16, "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" } }}
                  >
                    <MenuItem value="Allow">Allow</MenuItem>
                    <MenuItem value="Warn">Warn</MenuItem>
                    <MenuItem value="Prevent">Prevent</MenuItem>
                  </Select>
                </FormControl>
                <Typography sx={{ mt: 0.5, fontSize: 14, color: "#676b72" }}>
                  Allow permits selling below cost, Warn shows a warning that authorised users can
                  override, Prevent forces the price back up to at least cost
                </Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography sx={FIELD_LABEL_SX}>Use Global Cost</Typography>
                <Box sx={{ display: "flex", alignItems: "center", height: 42 }}>
                  <ShopfrontSwitch
                    checked={!!editData.useGlobalCost}
                    onChange={(e) => setEditData((prev) => ({ ...prev, useGlobalCost: e.target.checked }))}
                  />
                  <Typography sx={{ ml: 1.5, fontSize: 14, color: "#676b72" }}>
                    Share product costs globally across outlets instead of maintaining individual costs
                  </Typography>
                </Box>
              </Box>
            </>
          )}

          {editTab === 4 && (
            <>
              <Box sx={{ mb: 3, maxWidth: 720 }}>
                <MapLocationPicker
                  latitude={editData.outletLatitude}
                  longitude={editData.outletLongitude}
                  radius={editData.allowedRadius}
                  onLocationChange={(lat, lng) =>
                    setEditData((prev) => ({ ...prev, outletLatitude: lat, outletLongitude: lng }))
                  }
                  onRadiusChange={(radius) => setEditData((prev) => ({ ...prev, allowedRadius: radius }))}
                  height={350}
                />
              </Box>

              <Box sx={{ mb: 2, maxWidth: 560 }}>
                <Typography sx={FIELD_LABEL_SX}>Registers</Typography>
                <FormControl fullWidth>
                  <Select
                    multiple
                    value={editData.registerIds}
                    onChange={setField("registerIds")}
                    input={<OutlinedInput sx={{ minHeight: 42, borderRadius: "8px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" } }} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => {
                          const register = registers.find((r) => r.id === value);
                          return <Chip key={value} label={register?.name || `Register ${value}`} size="small" />;
                        })}
                      </Box>
                    )}
                  >
                    {registers.map((register) => (
                      <MenuItem key={register.id} value={register.id}>
                        {register.name} ({register.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ maxWidth: 560 }}>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#313439", mb: 2 }}>
                  Metcash Integration
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography sx={FIELD_LABEL_SX}>Customer ID</Typography>
                  <TextField
                    fullWidth
                    value={editData.metcashCustomerId}
                    onChange={setField("metcashCustomerId")}
                    helperText="Contact Shopfront or your BDM for this information"
                    sx={FIELD_SX}
                  />
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography sx={FIELD_LABEL_SX}>State</Typography>
                  <FormControl fullWidth>
                    <Select
                      value={editData.metcashState}
                      onChange={setField("metcashState")}
                      displayEmpty
                      sx={{ height: 42, borderRadius: "8px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" } }}
                    >
                      <MenuItem value="">
                        <em>Select...</em>
                      </MenuItem>
                      {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map((s) => (
                        <MenuItem key={s} value={s}>
                          {s}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography sx={FIELD_LABEL_SX}>Pillar</Typography>
                  <FormControl fullWidth>
                    <Select
                      value={editData.metcashPillar}
                      onChange={setField("metcashPillar")}
                      displayEmpty
                      sx={{ height: 42, borderRadius: "8px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" } }}
                    >
                      <MenuItem value="">
                        <em>Select...</em>
                      </MenuItem>
                      {["Cellarbrations", "IGA", "Foodland", "Other"].map((p) => (
                        <MenuItem key={p} value={p}>
                          {p}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>
            </>
          )}
        </Box>

        {/* Floating Save, bottom-right, per reference editor */}
        <Button
          variant="contained"
          disableRipple
          disableElevation
          startIcon={<SaveIcon />}
          onClick={handleSaveEditor}
          disabled={saving}
          sx={{ ...PRIMARY_BUTTON_SX, position: "fixed", bottom: 24, right: 24, zIndex: 1200 }}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </Box>
    );
  }

  // ─── List view ────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: "#000" }}>
          Registers &amp; Outlets
        </Typography>
        <Button
          variant="contained"
          disableRipple
          disableElevation
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
          sx={PRIMARY_BUTTON_SX}
        >
          Add Outlet
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table sx={{ borderCollapse: "collapse" }}>
          <TableHead>
            {/* Reference renders this header row 0px high (visually hidden) */}
            <TableRow sx={{ "& th": { height: 0, p: 0, border: 0, fontSize: 0, lineHeight: 0, overflow: "hidden" } }}>
              <TableCell>Name</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              "& td": { border: "1px solid #000", padding: "16px", fontSize: 16, color: "#000" },
              "& tr": { transition: INSTANT },
              "& tr:hover": { bgcolor: "rgb(223,223,223)" },
            }}
          >
            {outlets.map((outlet) => (
                <React.Fragment key={outlet.id}>
                  {/* Outlet header row: bold 24px name on #f8f8f8, per reference grouping */}
                  <TableRow sx={{ bgcolor: "#f8f8f8", height: 62 }}>
                    <TableCell>
                      <Typography sx={{ fontSize: 24, fontWeight: 700, color: "#000" }}>{outlet.name}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                          disableRipple
                          startIcon={<ViewIcon />}
                          onClick={() => navigate(`/outlets/${outlet.id}`)}
                          sx={rowActionSx("#0084d1")}
                        >
                          View
                        </Button>
                        <Button
                          disableRipple
                          startIcon={<EditIcon />}
                          onClick={() => openEditor(outlet)}
                          sx={EDIT_LINK_SX}
                        >
                          Edit
                        </Button>
                        <Tooltip
                          title={
                            outlet._count?.user_outlets > 0
                              ? "Cannot delete: this outlet has assigned users"
                              : ""
                          }
                        >
                          <span>
                            <Button
                              disableRipple
                              startIcon={<DeleteIcon />}
                              onClick={() => setDeleteTarget(outlet)}
                              disabled={outlet._count?.user_outlets > 0}
                              sx={rowActionSx("#e33430")}
                            >
                              Delete
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {/* Register child rows nested under their outlet, per reference */}
                  {(outlet.registers || []).map((register) => (
                    <TableRow key={`register-${register.id}`} sx={{ height: 52 }}>
                      <TableCell>{register.name}</TableCell>
                      <TableCell align="right">
                        <Button
                          disableRipple
                          startIcon={<EditIcon />}
                          onClick={() => navigate("/registers")}
                          sx={EDIT_LINK_SX}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add dialog (local-only feature, kept) */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "8px" } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#313439" }}>Add New Outlet</DialogTitle>
        <DialogContent
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "8px",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "2px" },
            },
          }}
        >
          <Box sx={{ pt: 1 }}>
            {formErrors.general && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.general}
              </Alert>
            )}
            <TextField
              fullWidth
              label="Outlet Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={!!formErrors.name}
              helperText={formErrors.name}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Outlet Code"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              error={!!formErrors.code}
              helperText={formErrors.code}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              margin="normal"
              multiline
              rows={2}
            />
            <TextField
              fullWidth
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
              multiline
              rows={2}
            />

            <Box sx={{ mt: 3, mb: 2 }}>
              <MapLocationPicker
                latitude={formData.outletLatitude}
                longitude={formData.outletLongitude}
                radius={formData.allowedRadius}
                onLocationChange={(lat, lng) => {
                  setFormData({ ...formData, outletLatitude: lat, outletLongitude: lng });
                }}
                onRadiusChange={(radius) => {
                  setFormData({ ...formData, allowedRadius: radius });
                }}
                height={350}
              />
            </Box>

            <Box sx={{ mt: 2 }}>
              <Typography sx={FIELD_LABEL_SX}>Registers</Typography>
              <FormControl fullWidth>
                <Select
                  multiple
                  value={formData.registerIds}
                  onChange={(e) => setFormData({ ...formData, registerIds: e.target.value })}
                  input={<OutlinedInput />}
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {selected.map((value) => {
                        const register = registers.find((r) => r.id === value);
                        return <Chip key={value} label={register?.name || `Register ${value}`} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {registers.map((register) => (
                    <MenuItem key={register.id} value={register.id}>
                      {register.name} ({register.code})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#313439", mb: 1 }}>
                Metcash Integration
              </Typography>
              <TextField
                fullWidth
                label="Customer ID"
                value={formData.metcashCustomerId}
                onChange={(e) => setFormData({ ...formData, metcashCustomerId: e.target.value })}
                margin="normal"
                helperText="Contact Shopfront or your BDM for this information"
              />
              <Box sx={{ mt: 2 }}>
                <Typography sx={FIELD_LABEL_SX}>State</Typography>
                <FormControl fullWidth>
                  <Select
                    value={formData.metcashState}
                    onChange={(e) => setFormData({ ...formData, metcashState: e.target.value })}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>Select...</em>
                    </MenuItem>
                    {["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].map((s) => (
                      <MenuItem key={s} value={s}>
                        {s}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ mt: 2 }}>
                <Typography sx={FIELD_LABEL_SX}>Pillar</Typography>
                <FormControl fullWidth>
                  <Select
                    value={formData.metcashPillar}
                    onChange={(e) => setFormData({ ...formData, metcashPillar: e.target.value })}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>Select...</em>
                    </MenuItem>
                    {["Cellarbrations", "IGA", "Foodland", "Other"].map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disableRipple onClick={handleCloseDialog} disabled={submitting} sx={CANCEL_BUTTON_SX}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableRipple
            disableElevation
            onClick={handleSubmit}
            disabled={submitting}
            sx={PRIMARY_BUTTON_SX}
          >
            {submitting ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete Outlet"
        message={`Are you sure you want to delete outlet "${deleteTarget?.name || ""}"?`}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default Outlets;
