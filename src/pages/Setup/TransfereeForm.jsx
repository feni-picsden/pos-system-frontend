import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import transfereeService from '../../services/transfereeService';
import { outletService } from '../../services/outletService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useAuth } from '../../contexts/AuthContext';
import PageSaveBar from '../../components/Common/PageSaveBar';
import { REF_MENU_PROPS } from '../../components/Common/refMenuProps';

const emptyForm = {
  name: '',
  email: '',
  fax: '',
  phone: '',
  mobile: '',
  website: '',
  twitter: '',
  facebook: '',
  notes: '',
  isActive: true,
  emailOrderAutomatically: false,
  emailFormat: 'Inline',
};

// Same set the backend accepts (lib/transfereeOrdering.js).
const EMAIL_FORMATS = ['Inline', 'CSV', 'PDF'];
const NAME_MAX = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-root:not(.MuiInputBase-multiline)': { height: 42 },
  '& .MuiOutlinedInput-input': { fontSize: 16, padding: '0 12px' },
  '& .MuiOutlinedInput-root:not(.MuiInputBase-multiline) .MuiOutlinedInput-input': { height: 42 },
  '& .MuiSelect-select': { display: 'flex', alignItems: 'center' },
};

const fieldLabelSx = { fontSize: 16, fontWeight: 700, color: '#000', mb: 0.5 };

const switchSx = {
  '& .MuiSwitch-track': { backgroundColor: '#ababab' },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#5ebbeb' },
  '&:hover .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': { backgroundColor: '#ababab' },
  '&:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#5ebbeb' },
};

const Field = ({ label, value, onChange, error, ...rest }) => (
  <Box sx={{ mb: 2 }}>
    <Typography sx={fieldLabelSx}>{label}</Typography>
    <TextField fullWidth value={value} onChange={onChange} sx={inputSx} error={Boolean(error)} helperText={error || undefined} {...rest} />
  </Box>
);

const TransfereeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { selectedOutletId } = useSelectedOutlet();
  const { isTrueSuperAdmin } = useAuth();
  // Outlet pick only for a global admin on "All Outlets"; a navbar outlet fixes
  // the outlet (header rule, same as the Tax Rate dialog). Fixed after creation.
  const showOutletSelect = !isEdit && isTrueSuperAdmin() && selectedOutletId == null;
  const [outlets, setOutlets] = useState([]);
  const [outletId, setOutletId] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formData, setFormData] = useState(emptyForm);
  const [savedName, setSavedName] = useState('');
  const [savedOutlet, setSavedOutlet] = useState(null);

  useEffect(() => {
    document.title = `${isEdit ? 'Edit' : 'New'} Transferee | Crinit's Shop`;
  }, [isEdit]);

  useEffect(() => {
    if (!showOutletSelect) return;
    outletService.getAllOutlets()
      .then((r) => setOutlets((r.outlets || []).filter((o) => o.isActive !== false)))
      .catch((err) => { console.error('Error loading outlets:', err); setOutlets([]); });
  }, [showOutletSelect]);

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      try {
        setLoading(true);
        const response = await transfereeService.getTransferee(id);
        const row = response.transferee || {};
        setSavedName(row.name || '');
        setSavedOutlet(row.outlet || null);
        setFormData({
          name: row.name || '',
          email: row.email || '',
          fax: row.fax || '',
          phone: row.phone || '',
          mobile: row.mobile || '',
          website: row.website || '',
          twitter: row.twitter || '',
          facebook: row.facebook || '',
          notes: row.notes || '',
          isActive: row.isActive !== false,
          emailOrderAutomatically: Boolean(row.emailOrderAutomatically),
          emailFormat: EMAIL_FORMATS.includes(row.emailFormat) ? row.emailFormat : 'Inline',
        });
      } catch (err) {
        console.error('Error loading transferee:', err);
        setError(err.response?.data?.error || 'Failed to load transferee');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const setField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Mirrors routes/transferees.js so the user sees the problem before the round trip.
  const validate = () => {
    const errors = {};
    const name = formData.name.trim();
    if (!name) errors.name = 'Name is required';
    else if (name.length > NAME_MAX) errors.name = `Name must be ${NAME_MAX} characters or fewer`;
    const email = formData.email.trim();
    if (email && !EMAIL_RE.test(email)) errors.email = 'Email address is not valid';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setError('');
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        ...formData,
        name: formData.name.trim(),
        email: formData.email.trim(),
      };
      if (isEdit) {
        await transfereeService.updateTransferee(id, payload);
      } else {
        await transfereeService.createTransferee({
          ...payload,
          // All Outlets: the picked outlet ('' = Global). Navbar outlet: that
          // outlet. Pinned user: the server uses the session outlet regardless.
          outletId: showOutletSelect ? (outletId === '' ? null : outletId) : (selectedOutletId ?? null),
        });
      }
      navigate('/settings/transfer-list');
    } catch (err) {
      console.error('Error saving transferee:', err);
      setError(err.response?.data?.error || 'Failed to save transferee');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#fff', minHeight: '100%' }}>
      {/* Full-width header band — text aligned to the centered form column */}
      <Box sx={{ bgcolor: '#e2e8f0', height: 128, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ maxWidth: 764, width: '100%', mx: 'auto', px: 3 }}>
          <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#616161' }}>
            {isEdit ? 'Editing ' : 'Creating '}
            <Box component="span" sx={{ color: '#8e8e8e', fontWeight: 400 }}>
              {isEdit ? `${savedName}...` : 'Transferee...'}
            </Box>
          </Typography>
        </Box>
      </Box>

      {/* Centered form column, no card chrome */}
      <Box sx={{ maxWidth: 764, mx: 'auto', px: 3, pt: 3, pb: 12 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Field
          label="Name"
          value={formData.name}
          onChange={(e) => setField('name', e.target.value)}
          error={fieldErrors.name}
          inputProps={{ maxLength: NAME_MAX }}
        />

        {/* Outlet: global admin on All Outlets picks; otherwise shown read-only */}
        {showOutletSelect && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={fieldLabelSx}>Outlet</Typography>
            <TextField
              select
              fullWidth
              value={outletId}
              onChange={(e) => setOutletId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              sx={inputSx}
              SelectProps={{ MenuProps: REF_MENU_PROPS, displayEmpty: true }}
            >
              <MenuItem value="">Global (All Outlets)</MenuItem>
              {outlets.map((o) => (
                <MenuItem key={o.id} value={o.id}>{o.name}{o.code ? ` (${o.code})` : ''}</MenuItem>
              ))}
            </TextField>
          </Box>
        )}
        {isEdit && (
          <Typography sx={{ fontSize: 14, color: '#5e5e5e', mb: 2 }}>
            Outlet: {savedOutlet ? `${savedOutlet.name}${savedOutlet.code ? ` (${savedOutlet.code})` : ''}` : 'Global (All Outlets)'}
          </Typography>
        )}

        {/* Active: inactive transferees are hidden from the transfer "To" list */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={fieldLabelSx}>Active</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShopfrontSwitch
              checked={formData.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
              sx={switchSx}
            />
            <Typography sx={{ fontSize: 14, color: '#5e5e5e' }}>
              {formData.isActive
                ? 'This Transferee can be selected when creating a transfer'
                : 'Inactive - new transfers cannot be sent to this Transferee'}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000', mb: 2 }}>Contact</Typography>

        <Field label="Email" value={formData.email} onChange={(e) => setField('email', e.target.value)} error={fieldErrors.email} type="email" />
        <Field label="Fax" value={formData.fax} onChange={(e) => setField('fax', e.target.value)} />
        <Field label="Phone" value={formData.phone} onChange={(e) => setField('phone', e.target.value)} />
        <Field label="Mobile" value={formData.mobile} onChange={(e) => setField('mobile', e.target.value)} />
        <Field label="Website" value={formData.website} onChange={(e) => setField('website', e.target.value)} />
        <Field label="Twitter" value={formData.twitter} onChange={(e) => setField('twitter', e.target.value)} />
        <Field label="Facebook" value={formData.facebook} onChange={(e) => setField('facebook', e.target.value)} />
        <Field label="Notes" value={formData.notes} onChange={(e) => setField('notes', e.target.value)} multiline minRows={3} />

        <Divider sx={{ my: 2 }} />
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000', mb: 2 }}>Ordering</Typography>

        {/* Email Order Automatically toggle */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={fieldLabelSx}>Email Order Automatically</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShopfrontSwitch
              checked={formData.emailOrderAutomatically}
              onChange={(e) => setField('emailOrderAutomatically', e.target.checked)}
              sx={switchSx}
            />
            <Typography sx={{ fontSize: 14, color: '#5e5e5e' }}>
              {formData.emailOrderAutomatically
                ? 'The transfer will be emailed to this Transferee automatically when it is sent'
                : "User won't automatically prompted to send an email after an order is processed"}
            </Typography>
          </Box>
          {formData.emailOrderAutomatically && !formData.email.trim() && (
            <Typography sx={{ fontSize: 13, color: '#b45309', mt: 0.5 }}>
              Add an Email address above, or nothing will be sent.
            </Typography>
          )}
        </Box>

        {/* Email Format */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={fieldLabelSx}>Email Format</Typography>
          <TextField
            select
            fullWidth
            value={formData.emailFormat}
            onChange={(e) => setField('emailFormat', e.target.value)}
            sx={inputSx}
            SelectProps={{ MenuProps: REF_MENU_PROPS }}
          >
            {EMAIL_FORMATS.map((opt) => (
              <MenuItem key={opt} value={opt}>{opt}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      {/* Fixed floating Save button */}
      <PageSaveBar onSave={handleSave} saving={saving} />
    </Box>
  );
};

export default TransfereeForm;
