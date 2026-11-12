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
  LocalOfferOutlined as GeneralTabIcon,
  FaxOutlined as ContactTabIcon,
  BadgeOutlined as AddressTabIcon,
  TuneOutlined as MiscTabIcon,
  ExtensionOutlined as IntegrationsTabIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import apiClient from "../../services/apiClient";
import outletService from "../../services/outletService";
import registerService from "../../services/registerService";
import settingsService from "../../services/settingsService";
import MapLocationPicker from "../../components/MapLocationPicker";
import posLocalDb from "../../services/posLocalDb";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import ShopfrontSwitch from "../../components/Common/ShopfrontSwitch";
import { useSelectedOutlet } from "../../contexts/SelectedOutletContext";
import { clearOutletProfileCache } from "../../utils/outletReceiptProfile";

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
  // Primary Ticketing Price Set (id as string; "" = none / Default).
  primaryTicketingPriceSetId: "",
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

// Reference editor tabs (General / Contact / Address) + our extra sections in the same style.
const EDITOR_TABS = [
  { label: "General", Icon: GeneralTabIcon },
  { label: "Contact", Icon: ContactTabIcon },
  { label: "Address", Icon: AddressTabIcon },
  { label: "Miscellaneous", Icon: MiscTabIcon },
  { label: "Integrations", Icon: IntegrationsTabIcon },
];

// Fixed app bar height (DashboardLayout HEADER_HEIGHT): the sticky tab row sits under it.
const APP_BAR_HEIGHT = 50;
const BAND_BG = "#e2e8f0";
const EDITOR_COLUMN = 764;

// Reference editor fields: bold label above a full-width 42px input, 1px dark border, 6px corners.
const EDITOR_LABEL_SX = { mb: 0.75, fontWeight: 700, fontSize: 16, color: "#000" };
const EDITOR_FIELD_SX = {
  "& .MuiOutlinedInput-root": {
    height: 42,
    borderRadius: "6px",
    fontSize: 16,
    bgcolor: "#fff",
    "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#000", borderWidth: "2px" },
  },
  "& .MuiOutlinedInput-input": { padding: "9px 12px" },
};
const EDITOR_SELECT_SX = {
  height: 42,
  borderRadius: "6px",
  fontSize: 16,
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040", borderWidth: "1px" },
  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" },
};
// ~70px field-to-field rhythm (label + 42px input + gap).
const EDITOR_ROW_SX = { mb: 2 };

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
  // editData as loaded (same async merges) - Save is pale until they differ.
  const [editBaseline, setEditBaseline] = useState(null);
  const [priceSets, setPriceSets] = useState([]);
  // Header band scrolled away -> the tab row is stuck to the top.
  const [tabsStuck, setTabsStuck] = useState(false);
  const bandSentinelRef = useRef(null);
  // The edited outlet's full outlet_settings blob ({ outletId, blob }), loaded
  // with the editor so Discounting Below Cost Behaviour saves without wiping
  // the other outlet settings. null = not loaded.
  const outletSettingsRef = useRef(null);
  // Register ids the editor opened with (sorted) - only a real change is sent.
  const initialRegisterIdsRef = useRef([]);
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Per-outlet "Add Register" dialog + register delete
  const [registerDialogOutlet, setRegisterDialogOutlet] = useState(null);
  const [registerForm, setRegisterForm] = useState({ name: "", code: "", isActive: true, isDefault: false });
  const [registerErrors, setRegisterErrors] = useState({});
  const [registerSaving, setRegisterSaving] = useState(false);
  const [registerDeleteTarget, setRegisterDeleteTarget] = useState(null);
  const [registerDeleting, setRegisterDeleting] = useState(false);


  useEffect(() => {
    fetchOutlets();
    fetchRegisters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch a 1px sentinel at the bottom of the header band: once it scrolls
  // under the app bar, the tab row is stuck and the active tab gets its outline.
  const editorOpen = !!(editingOutlet && editData);
  useEffect(() => {
    const el = bandSentinelRef.current;
    if (!editorOpen || !el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setTabsStuck(!entry.isIntersecting && entry.boundingClientRect.top < APP_BAR_HEIGHT + 1),
      { rootMargin: `-${APP_BAR_HEIGHT}px 0px 0px 0px`, threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [editorOpen]);

  // Deep link: /settings/registers-outlets?editOutlet=<id> (Setup > General >
  // Registers tab "Edit" on an outlet row) opens this page's outlet editor.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkedOutletId = searchParams.get("editOutlet");
  useEffect(() => {
    if (!deepLinkedOutletId || outlets.length === 0) return;
    const target = outlets.find((o) => String(o.id) === String(deepLinkedOutletId));
    if (!target) return;
    openEditor(target);
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedOutletId, outlets]);

  // This page holds EVERY outlet (?all=true). The IndexedDB "outlets" store is the
  // navbar's list of the user's ASSIGNED outlets, so this page must never read or
  // fill it: reading it showed only the assigned outlets here (a new, unassigned
  // outlet vanished after a reload), and filling it put every outlet into the
  // navbar selector. After a mutation the shared store is dropped and the navbar
  // re-pulls its own list.
  const { refreshOutlets } = useSelectedOutlet() || {};
  const syncNavbarOutlets = async () => {
    apiClient.bustCache("/outlets");
    await posLocalDb.invalidateStore("outlets").catch(() => {});
    if (refreshOutlets) refreshOutlets().catch(() => {});
  };
  // Local state follows a mutation we already know succeeded — never depend on
  // an immediate refetch (transient 401/503 used to resurrect deleted rows).
  const applyOutlets = async (next) => {
    setOutlets(next);
    await syncNavbarOutlets();
  };

  const fetchOutlets = async () => {
    try {
      setLoading(true);
      const response = await outletService.getEveryOutlet();
      setOutlets(response.outlets || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch outlets");
    } finally {
      setLoading(false);
    }
  };

  // Registers & Outlets edits ANY outlet's register assignments, so the
  // register list must hold every register - never the navbar-scoped list.
  // (A scoped list once rebuilt an outlet's cached `registers` as [] and the
  // next save unassigned all of that outlet's registers.)
  const listAllRegisters = async () => {
    const res = await apiClient.get("/registers?all=true", { skipOutletScope: true, noCache: true });
    return res.data?.registers || [];
  };

  // Same for registers: the IndexedDB "registers" store is the navbar-scoped list
  // other pages read, so the full list here stays in page state only.
  const fetchRegisters = async () => {
    try {
      const data = await listAllRegisters();
      setRegisters(Array.isArray(data) ? data : []);
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

    if (submitting) return; // double click / Enter repeat
    try {
      setSubmitting(true);
      const response = await outletService.createOutlet({
        ...formData,
        name: formData.name.trim(),
        code: formData.code.trim(),
      });
      const movedIds = formData.registerIds;
      const created = {
        ...(response.outlet || {}),
        _count: { user_outlets: 0 },
        registers: registers
          .filter((r) => movedIds.includes(r.id))
          .map(({ id, name, code, isActive, status }) => ({ id, name, code, isActive, status })),
      };
      // Registers picked here MOVE from their old outlet - drop them there too.
      await applyOutlets([
        created,
        ...outlets.map((o) => ({ ...o, registers: (o.registers || []).filter((r) => !movedIds.includes(r.id)) })),
      ]);
      if (movedIds.length) refreshFromServer().catch(() => {});
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
      // Server-side assignment list; the live register list is the fallback so
      // a cached outlet row without `registers` never starts the editor empty.
      registerIds: Array.isArray(outlet.registers)
        ? outlet.registers.map((r) => r.id)
        : registers.filter((r) => r.outletId === outlet.id).map((r) => r.id),
      metcashCustomerId: outlet.metcashCustomerId || "",
      metcashState: outlet.metcashState || "",
      metcashPillar: outlet.metcashPillar || "",
      outletLatitude: outlet.outletLatitude ?? null,
      outletLongitude: outlet.outletLongitude ?? null,
      allowedRadius: outlet.allowedRadius ?? null,
      ...EMPTY_PROFILE,
      // The outlet row's own email / phone columns seed the profile copy.
      email: outlet.email || "",
      phone: outlet.phone || "",
      street1: outlet.address || "",
    };
    setEditData(base);
    setEditBaseline(base);
    initialRegisterIdsRef.current = [...base.registerIds].sort((a, b) => a - b);
    // Primary Ticketing Price Set choices: this outlet's price sets + global ones.
    apiClient
      .get("/price-sets", { params: { outletId: outlet.id }, noCache: true })
      .then((r) => {
        const rows = r.data?.priceSets || [];
        setPriceSets(rows.filter((ps) => ps.outletId == null || ps.outletId === outlet.id));
      })
      .catch(() => setPriceSets([]));
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
        // Blank profile email/phone don't hide the outlet row's own columns.
        const merged = (prev) => ({
          ...prev,
          ...profile,
          email: profile.email || prev.email,
          phone: profile.phone || prev.phone,
        });
        setEditData(merged);
        setEditBaseline(merged);
      }
    } catch {
      // 404 = no profile saved yet
    }
    // "Discounting Below Cost Behaviour" lives in the outlet's outlet_settings
    // blob (what the sell screen and Setup > General > Outlets use), NOT in the
    // profile blob. Read it after the profile so a stale profile copy loses.
    outletSettingsRef.current = null;
    try {
      const os = await settingsService.getOutletSettings(outlet.id);
      if (os && !os.fromFallback) {
        const { _updatedAt, ...blob } = os.settings || {};
        outletSettingsRef.current = { outletId: outlet.id, blob };
        const v = blob.discountingBelowCostBehaviour;
        // 'Block' was this app's old name for Prevent.
        // _belowCostLoaded is UI-only (the profile save writes EMPTY_PROFILE keys only).
        const withBelowCost = (prev) => ({ ...prev, discountBelowCost: v === "Block" ? "Prevent" : (v || "Allow"), _belowCostLoaded: true });
        setEditData(withBelowCost);
        setEditBaseline(withBelowCost);
      }
    } catch (err) {
      console.error("Failed to load outlet settings:", err);
    }
  };

  const closeEditor = () => {
    setEditingOutlet(null);
    setEditData(null);
    setEditBaseline(null);
    setEditErrors({});
  };

  // Save stays pale until something actually changed.
  const editDirty = !!editData && !!editBaseline && JSON.stringify(editData) !== JSON.stringify(editBaseline);

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
    const email = (editData.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address";
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      setEditTab(errors.name || errors.code ? 0 : 1);
      return;
    }

    const composed = composeAddress(editData);
    // Register assignments travel as a DELTA, and only when the user changed
    // them: the backend unassigns only registers that are in this outlet AND
    // listed, so a stale or partial list can never detach another register.
    const initialIds = initialRegisterIdsRef.current || [];
    const nextIds = editData.registerIds || [];
    const assignRegisterIds = nextIds.filter((id) => !initialIds.includes(id));
    const unassignRegisterIds = initialIds.filter((id) => !nextIds.includes(id));
    const registersChanged = assignRegisterIds.length > 0 || unassignRegisterIds.length > 0;
    const payload = {
      name: editData.name.trim(),
      code: editData.code.trim(),
      address: composed || editingOutlet.address || "",
      description: editData.description,
      // The outlet row's own contact columns (receipts / emails read them).
      email,
      phone: (editData.phone || "").trim(),
      ...(assignRegisterIds.length ? { assignRegisterIds } : {}),
      ...(unassignRegisterIds.length ? { unassignRegisterIds } : {}),
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
        // Receipt headers cache profiles for the session - drop the stale copy.
        clearOutletProfileCache();
      } catch (profileErr) {
        console.error("Failed to save outlet profile:", profileErr);
        setError(profileErr.response?.data?.error || "Outlet saved, but its contact / address / logo details could not be saved");
      }
      // Write Discounting Below Cost Behaviour into this outlet's outlet_settings,
      // merged over the full blob loaded with the editor so every other key is
      // kept. Not loaded (fallback / error) = not written: a partial blob would
      // replace the outlet's saved settings.
      const loadedSettings = outletSettingsRef.current;
      if (loadedSettings && loadedSettings.outletId === editingOutlet.id) {
        const nextBehaviour = editData.discountBelowCost || "Allow";
        const stored = loadedSettings.blob.discountingBelowCostBehaviour;
        const storedNorm = stored === "Block" ? "Prevent" : (stored || "Allow");
        if (nextBehaviour !== storedNorm) {
          try {
            await settingsService.updateOutletSettings(
              { ...loadedSettings.blob, discountingBelowCostBehaviour: nextBehaviour },
              editingOutlet.id
            );
          } catch (settingsErr) {
            console.error("Failed to save outlet settings:", settingsErr);
            setError(settingsErr.response?.data?.error || "Outlet saved, but Discounting Below Cost Behaviour could not be saved");
          }
        }
      }
      const updated = {
        ...editingOutlet,
        ...(response.outlet || {}),
        _count: editingOutlet._count,
        // Unchanged assignments keep the server's own list; a changed one is
        // rebuilt from the full register list, keeping any entry the list lacks.
        registers: registersChanged
          ? editData.registerIds.map((id) => {
              const r = registers.find((x) => x.id === id)
                || (editingOutlet.registers || []).find((x) => x.id === id);
              return r ? { id: r.id, name: r.name, code: r.code, isActive: r.isActive, status: r.status } : { id };
            })
          : (editingOutlet.registers || []),
      };
      // A register assigned here moved OUT of its old outlet: drop it there too,
      // then re-pull, so the next edit of that outlet starts from the truth.
      await applyOutlets(outlets.map((o) => (o.id === updated.id ? updated : {
        ...o,
        registers: (o.registers || []).filter((r) => !assignRegisterIds.includes(r.id)),
      })));
      if (registersChanged) refreshFromServer().catch(() => {});
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

  // ─── Registers: add under an outlet / delete (server refresh, cache-proof) ─

  const refreshFromServer = async () => {
    apiClient.bustCache("/outlets");
    apiClient.bustCache("/registers");
    await posLocalDb.invalidateStore("registers").catch(() => {});
    const [o, r] = await Promise.all([outletService.getEveryOutlet(), listAllRegisters()]);
    setOutlets(o.outlets || []);
    setRegisters(Array.isArray(r) ? r : []);
    await syncNavbarOutlets();
  };

  const openRegisterDialog = (outlet) => {
    setRegisterForm({ name: "", code: "", isActive: true, isDefault: false });
    setRegisterErrors({});
    setRegisterDialogOutlet(outlet);
  };

  const closeRegisterDialog = () => {
    if (registerSaving) return;
    setRegisterDialogOutlet(null);
    setRegisterErrors({});
  };

  const handleCreateRegister = async () => {
    const errors = {};
    if (!registerForm.name.trim()) errors.name = "Name is required";
    if (!registerForm.code.trim()) errors.code = "Code is required";
    if (Object.keys(errors).length > 0) {
      setRegisterErrors(errors);
      return;
    }
    try {
      setRegisterSaving(true);
      await registerService.create({
        name: registerForm.name.trim(),
        code: registerForm.code.trim(),
        isActive: registerForm.isActive,
        isDefault: registerForm.isDefault,
        status: "Closed",
        outletId: registerDialogOutlet.id,
      });
      await refreshFromServer();
      setRegisterDialogOutlet(null);
    } catch (err) {
      setRegisterErrors({ general: err.response?.data?.error || "Failed to create register" });
    } finally {
      setRegisterSaving(false);
    }
  };

  const confirmDeleteRegister = async () => {
    if (!registerDeleteTarget) return;
    try {
      setRegisterDeleting(true);
      await registerService.remove(registerDeleteTarget.id);
      await refreshFromServer();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete register");
    } finally {
      setRegisterDeleting(false);
      setRegisterDeleteTarget(null);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  // â”€â”€â”€ Full-page outlet editor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Reference layout: grey-blue header band (title + icon folder tabs), the tab
  // row sticks under the app bar once the band scrolls away, white centred
  // section body with a heading per tab, floating Save bottom-right.

  if (editingOutlet && editData) {
    const fieldBlock = (key, label, props = {}) => (
      <Box key={key} sx={EDITOR_ROW_SX}>
        <Typography component="label" htmlFor={`outlet-${key}`} sx={{ ...EDITOR_LABEL_SX, display: "block" }}>
          {label}
        </Typography>
        <TextField
          id={`outlet-${key}`}
          fullWidth
          value={editData[key] ?? ""}
          onChange={setField(key)}
          error={!!editErrors[key]}
          helperText={editErrors[key]}
          sx={EDITOR_FIELD_SX}
          {...props}
        />
      </Box>
    );

    const sectionHeading = (tabIndex) => {
      const { label, Icon } = EDITOR_TABS[tabIndex];
      return (
        <Box sx={{ position: "relative", mb: 3 }}>
          {/* Small grey icon hangs in the left margin, per reference */}
          <Icon sx={{ position: "absolute", left: -36, top: 6, fontSize: 22, color: "#8a8d91" }} />
          <Typography component="h2" sx={{ fontSize: 24, fontWeight: 700, color: "#000" }}>
            {label}
          </Typography>
        </Box>
      );
    };

    const switchRow = (key, label, offText, onText) => (
      <Box sx={EDITOR_ROW_SX}>
        <Typography sx={EDITOR_LABEL_SX}>{label}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", minHeight: 42 }}>
          <ShopfrontSwitch
            checked={!!editData[key]}
            onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.checked }))}
          />
          <Typography sx={{ ml: 1.5, fontSize: 14, color: "#676b72" }}>
            {editData[key] ? onText : offText}
          </Typography>
        </Box>
      </Box>
    );

    const registerOutletName = (register) =>
      outlets.find((o) => o.id === register.outletId)?.name || null;

    return (
      <Box sx={{ width: "100%", pb: 12, bgcolor: "#fff", minHeight: "100%" }}>
        {/* Header band */}
        <Box sx={{ bgcolor: BAND_BG }}>
          <Box sx={{ maxWidth: EDITOR_COLUMN, mx: "auto", px: 2, pt: 3, pb: 2, display: "flex", alignItems: "center", gap: 1 }}>
            <Button
              disableRipple
              onClick={closeEditor}
              sx={{ minWidth: 0, p: 0.5, color: "#313439", transition: INSTANT, "&:hover": { bgcolor: "rgba(0,0,0,0.06)" } }}
              aria-label="Back to outlets"
            >
              <ArrowBackIcon fontSize="small" />
            </Button>
            <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: "#000" }}>
              Editing {editingOutlet.name}
            </Typography>
          </Box>
          <Box ref={bandSentinelRef} sx={{ height: 1 }} />
        </Box>

        {/* Tab row: sticky under the app bar once the band has scrolled away */}
        <Box
          role="tablist"
          sx={{
            position: "sticky",
            top: APP_BAR_HEIGHT,
            zIndex: 5,
            bgcolor: tabsStuck ? "#fff" : BAND_BG,
            boxShadow: tabsStuck ? "0 1px 0 rgba(0,0,0,0.08)" : "none",
          }}
        >
          <Box sx={{ maxWidth: EDITOR_COLUMN, mx: "auto", px: 2, display: "flex", gap: 0.5, pt: tabsStuck ? 0.75 : 0, pb: tabsStuck ? 0.75 : 0 }}>
            {EDITOR_TABS.map((tab, i) => {
              const { label, Icon } = tab;
              const active = editTab === i;
              return (
                <Box
                  key={label}
                  component="button"
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setEditTab(i)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    height: tabsStuck ? 42 : 48,
                    px: 2.5,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 15,
                    fontWeight: active ? 700 : 400,
                    color: "#313439",
                    bgcolor: active ? "#fff" : "transparent",
                    // Folder tab joining the white page; outlined pill once stuck.
                    border: active && tabsStuck ? "1px solid #000" : "1px solid transparent",
                    borderRadius: tabsStuck ? "8px" : "8px 8px 0 0",
                    transition: INSTANT,
                    "&:hover": { bgcolor: active ? "#fff" : "rgba(255,255,255,0.5)" },
                  }}
                >
                  <Icon sx={{ fontSize: 18, color: active ? "#0084d1" : "#313439" }} />
                  {label}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Section body */}
        <Box sx={{ maxWidth: EDITOR_COLUMN, mx: "auto", px: 2, pl: { xs: 6, md: 2 }, pt: 4 }}>
          {editErrors.general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editErrors.general}
            </Alert>
          )}

          {sectionHeading(editTab)}

          {editTab === 0 && (
            <>
              {fieldBlock("name", "Name", { required: true })}
              {fieldBlock("code", "Outlet Code", { required: true })}
              {fieldBlock("businessNumber", "Business Number")}

              {switchRow(
                "hasKitchenScreen",
                "Has Kitchen Screen",
                "This Outlet is not allowed to use Kitchen Screens",
                "This Outlet is allowed to use Kitchen Screens"
              )}

              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={{ ...EDITOR_LABEL_SX, mb: 0.25 }}>Primary Ticketing Price Set</Typography>
                <Typography sx={{ fontSize: 14, color: "#676b72", mb: 0.75 }}>
                  This is the default price set that will be used for tickets in this store
                </Typography>
                <FormControl fullWidth>
                  <Select
                    value={
                      priceSets.some((ps) => String(ps.id) === String(editData.primaryTicketingPriceSetId))
                        ? String(editData.primaryTicketingPriceSetId)
                        : ""
                    }
                    onChange={setField("primaryTicketingPriceSetId")}
                    displayEmpty
                    sx={EDITOR_SELECT_SX}
                  >
                    <MenuItem value="">
                      <Typography component="span" sx={{ color: "#808080" }}>Select...</Typography>
                    </MenuItem>
                    {priceSets.map((ps) => (
                      <MenuItem key={ps.id} value={String(ps.id)}>
                        {ps.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={EDITOR_LABEL_SX}>Logo</Typography>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  style={{ display: "none" }}
                />
                <Box
                  role="button"
                  tabIndex={0}
                  onClick={() => logoInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") logoInputRef.current?.click(); }}
                  sx={{
                    width: "100%",
                    height: 250,
                    bgcolor: "#efefef",
                    borderRadius: "6px",
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
                    <Typography sx={{ fontSize: 16, color: "#313439" }}>Select Image</Typography>
                  )}
                </Box>
                <Button
                  fullWidth
                  variant="outlined"
                  disableRipple
                  startIcon={<CloseIcon />}
                  disabled={!editData.logo}
                  onClick={() => setEditData((prev) => ({ ...prev, logo: "" }))}
                  sx={{
                    height: 42,
                    textTransform: "none",
                    fontWeight: 400,
                    fontSize: 16,
                    color: "#313439",
                    borderColor: "#404040",
                    borderRadius: "6px",
                    transition: INSTANT,
                    "&:hover": { borderColor: "#000", bgcolor: "rgba(0,0,0,0.03)" },
                  }}
                >
                  Remove Image
                </Button>
              </Box>

              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={EDITOR_LABEL_SX}>Description</Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  value={editData.description}
                  onChange={setField("description")}
                  sx={{ ...MULTILINE_FIELD_SX, "& .MuiOutlinedInput-root": { ...MULTILINE_FIELD_SX["& .MuiOutlinedInput-root"], borderRadius: "6px" } }}
                />
              </Box>
            </>
          )}

          {editTab === 1 && CONTACT_FIELDS.map(([key, label]) => fieldBlock(key, label, key === "email" ? { type: "email" } : {}))}

          {editTab === 2 && ADDRESS_FIELDS.map(([key, label]) => fieldBlock(key, label))}

          {editTab === 3 && (
            <>
              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={EDITOR_LABEL_SX}>Discounting Below Cost Behaviour</Typography>
                <FormControl fullWidth>
                  <Select
                    value={editData.discountBelowCost || "Allow"}
                    onChange={setField("discountBelowCost")}
                    // Can't be saved unless the outlet's settings loaded (see handleSaveEditor).
                    disabled={!editData._belowCostLoaded}
                    sx={EDITOR_SELECT_SX}
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

              {switchRow(
                "useGlobalCost",
                "Use Global Cost",
                "Share product costs globally across outlets instead of maintaining individual costs",
                "Share product costs globally across outlets instead of maintaining individual costs"
              )}
            </>
          )}

          {editTab === 4 && (
            <>
              <Box sx={{ mb: 3 }}>
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

              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={EDITOR_LABEL_SX}>Registers</Typography>
                <FormControl fullWidth>
                  <Select
                    multiple
                    value={editData.registerIds}
                    onChange={setField("registerIds")}
                    input={<OutlinedInput sx={{ minHeight: 42, borderRadius: "6px", "& .MuiOutlinedInput-notchedOutline": { borderColor: "#404040" } }} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((value) => {
                          const register = registers.find((r) => r.id === value);
                          return <Chip key={value} label={register?.name || `Register ${value}`} size="small" />;
                        })}
                      </Box>
                    )}
                  >
                    {registers.map((register) => {
                      const owner = register.outletId !== editingOutlet.id ? registerOutletName(register) : null;
                      return (
                        <MenuItem key={register.id} value={register.id}>
                          {register.name} ({register.code}){owner ? ` - moves from ${owner}` : ""}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <Typography sx={{ mt: 0.5, fontSize: 14, color: "#676b72" }}>
                  Picking a register from another outlet moves it to this outlet (it must be closed).
                  A register can't be left without an outlet: to take one out, pick it in another
                  outlet or delete it.
                </Typography>
              </Box>

              <Typography sx={{ fontSize: 18, fontWeight: 700, color: "#313439", mb: 2 }}>
                Metcash Integration
              </Typography>
              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={EDITOR_LABEL_SX}>Customer ID</Typography>
                <TextField
                  fullWidth
                  value={editData.metcashCustomerId}
                  onChange={setField("metcashCustomerId")}
                  helperText="Contact Crinit's Shop or your BDM for this information"
                  sx={EDITOR_FIELD_SX}
                />
              </Box>
              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={EDITOR_LABEL_SX}>State</Typography>
                <FormControl fullWidth>
                  <Select value={editData.metcashState} onChange={setField("metcashState")} displayEmpty sx={EDITOR_SELECT_SX}>
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
              <Box sx={EDITOR_ROW_SX}>
                <Typography sx={EDITOR_LABEL_SX}>Pillar</Typography>
                <FormControl fullWidth>
                  <Select value={editData.metcashPillar} onChange={setField("metcashPillar")} displayEmpty sx={EDITOR_SELECT_SX}>
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
            </>
          )}
        </Box>

        {/* Floating Save, bottom-right, pale until something changed */}
        <Button
          variant="contained"
          disableRipple
          disableElevation
          startIcon={<SaveIcon />}
          onClick={handleSaveEditor}
          disabled={saving || !editDirty}
          sx={{
            ...PRIMARY_BUTTON_SX,
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 1200,
            "&.Mui-disabled": { bgcolor: "#5ebbeb", color: "#fff", opacity: 0.45 },
            "&:focus, &:focus-visible": { outline: "none", boxShadow: "none" },
          }}
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
        <Button disableRipple startIcon={<AddIcon />} onClick={handleOpenDialog} sx={PRIMARY_BUTTON_SX}>
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
                          component={RouterLink} to={`/outlets/${outlet.id}`}
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
                        <Button
                          disableRipple
                          startIcon={<AddIcon />}
                          onClick={() => openRegisterDialog(outlet)}
                          sx={rowActionSx("#0084d1")}
                        >
                          Add Register
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
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
                          <Button
                            disableRipple
                            startIcon={<EditIcon />}
                            component={RouterLink}
                            to={`/registers?edit=${register.id}`}
                            sx={EDIT_LINK_SX}
                          >
                            Edit
                          </Button>
                          <Button
                            disableRipple
                            startIcon={<DeleteIcon />}
                            onClick={() => setRegisterDeleteTarget(register)}
                            sx={rowActionSx("#e33430")}
                          >
                            Delete
                          </Button>
                        </Box>
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
                helperText="Contact Crinit's Shop or your BDM for this information"
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

      {/* Add Register (under a specific outlet) */}
      <Dialog
        open={!!registerDialogOutlet}
        onClose={closeRegisterDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "8px" } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: "#313439" }}>
          Add Register — {registerDialogOutlet?.name || ""}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {registerErrors.general && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {registerErrors.general}
              </Alert>
            )}
            <Typography sx={FIELD_LABEL_SX}>Register Name *</Typography>
            <TextField
              fullWidth
              value={registerForm.name}
              onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              error={!!registerErrors.name}
              helperText={registerErrors.name}
              sx={{ ...FIELD_SX, mb: 2 }}
            />
            <Typography sx={FIELD_LABEL_SX}>Register Code *</Typography>
            <TextField
              fullWidth
              value={registerForm.code}
              onChange={(e) => setRegisterForm({ ...registerForm, code: e.target.value })}
              error={!!registerErrors.code}
              helperText={registerErrors.code || "Unique code for this register"}
              sx={{ ...FIELD_SX, mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 4 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ShopfrontSwitch
                  checked={registerForm.isActive}
                  onChange={(e) => setRegisterForm({ ...registerForm, isActive: e.target.checked })}
                />
                <Typography sx={{ fontSize: 16 }}>Active</Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ShopfrontSwitch
                  checked={registerForm.isDefault}
                  onChange={(e) => setRegisterForm({ ...registerForm, isDefault: e.target.checked })}
                />
                <Typography sx={{ fontSize: 16 }}>Default Register</Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disableRipple onClick={closeRegisterDialog} disabled={registerSaving} sx={CANCEL_BUTTON_SX}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableRipple
            disableElevation
            onClick={handleCreateRegister}
            disabled={registerSaving}
            sx={PRIMARY_BUTTON_SX}
          >
            {registerSaving ? "Creating..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!registerDeleteTarget}
        title="Delete Register"
        message={`Are you sure you want to delete register "${registerDeleteTarget?.name || ""}"? This action cannot be undone.`}
        loading={registerDeleting}
        onCancel={() => setRegisterDeleteTarget(null)}
        onConfirm={confirmDeleteRegister}
      />

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
