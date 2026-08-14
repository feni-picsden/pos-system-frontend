import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  Alert,
  CircularProgress,
  ClickAwayListener,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import transfereeService from '../../services/transfereeService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

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
  emailOrderAutomatically: false,
  emailFormat: 'Inline',
};

const EMAIL_FORMATS = ['Inline', 'CSV', 'PDF'];

const inputSx = {
  '& .MuiOutlinedInput-root': {
    height: 42,
    borderRadius: '8px',
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input': { fontSize: 16, padding: '0 12px', height: 42 },
};

const fieldLabelSx = { fontSize: 16, fontWeight: 700, color: '#000', mb: 0.5 };

const Field = ({ label, value, onChange }) => (
  <Box sx={{ mb: 2 }}>
    <Typography sx={fieldLabelSx}>{label}</Typography>
    <TextField fullWidth value={value} onChange={onChange} sx={inputSx} />
  </Box>
);

const TransfereeForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { selectedOutletId } = useSelectedOutlet();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(emptyForm);
  const [savedName, setSavedName] = useState('');
  const [formatOpen, setFormatOpen] = useState(false);
  const [formatOpensUp, setFormatOpensUp] = useState(false);
  const formatAnchorRef = useRef(null);

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      try {
        setLoading(true);
        const response = await transfereeService.getTransferee(id);
        const row = response.transferee || {};
        setSavedName(row.name || '');
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
          emailOrderAutomatically: Boolean(row.emailOrderAutomatically),
          emailFormat: row.emailFormat || 'Inline',
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
  };

  const toggleFormatOpen = () => {
    if (!formatOpen && formatAnchorRef.current) {
      const rect = formatAnchorRef.current.getBoundingClientRect();
      setFormatOpensUp(window.innerHeight - rect.bottom < 200);
    }
    setFormatOpen((prev) => !prev);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      if (isEdit) {
        await transfereeService.updateTransferee(id, formData);
      } else {
        await transfereeService.createTransferee({
          ...formData,
          outletId: selectedOutletId || undefined,
        });
      }
      navigate('/setup/transfer-list');
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
            <Box component="span" sx={{ color: '#8e8e8e' }}>
              {isEdit ? savedName : 'Transferee...'}
            </Box>
          </Typography>
        </Box>
      </Box>

      {/* Centered form column, no card chrome */}
      <Box sx={{ maxWidth: 764, mx: 'auto', px: 3, pt: 3, pb: 12 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Field label="Name" value={formData.name} onChange={(e) => setField('name', e.target.value)} />

        <Divider sx={{ my: 2 }} />
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000', mb: 2 }}>Contact</Typography>

        <Field label="Email" value={formData.email} onChange={(e) => setField('email', e.target.value)} />
        <Field label="Fax" value={formData.fax} onChange={(e) => setField('fax', e.target.value)} />
        <Field label="Phone" value={formData.phone} onChange={(e) => setField('phone', e.target.value)} />
        <Field label="Mobile" value={formData.mobile} onChange={(e) => setField('mobile', e.target.value)} />
        <Field label="Website" value={formData.website} onChange={(e) => setField('website', e.target.value)} />
        <Field label="Twitter" value={formData.twitter} onChange={(e) => setField('twitter', e.target.value)} />
        <Field label="Facebook" value={formData.facebook} onChange={(e) => setField('facebook', e.target.value)} />

        <Divider sx={{ my: 2 }} />
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#000', mb: 2 }}>Ordering</Typography>

        {/* Email Order Automatically toggle */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={fieldLabelSx}>Email Order Automatically</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShopfrontSwitch
              checked={formData.emailOrderAutomatically}
              onChange={(e) => setField('emailOrderAutomatically', e.target.checked)}
              sx={{
                '& .MuiSwitch-track': { backgroundColor: '#ababab' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#5ebbeb' },
                '&:hover .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': { backgroundColor: '#ababab' },
                '&:hover .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#5ebbeb' },
              }}
            />
            <Typography sx={{ fontSize: 14, color: '#5e5e5e' }}>
              {formData.emailOrderAutomatically
                ? 'This Transferee will automatically prompt an email to be sent when an order is processed'
                : "User won't automatically prompted to send an email after an order is processed"}
            </Typography>
          </Box>
        </Box>

        {/* Email Format combobox */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={fieldLabelSx}>Email Format</Typography>
          <ClickAwayListener onClickAway={() => setFormatOpen(false)}>
            <Box sx={{ position: 'relative' }}>
              <Box
                ref={formatAnchorRef}
                role="combobox"
                aria-expanded={formatOpen}
                tabIndex={0}
                onClick={toggleFormatOpen}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setFormatOpen(false);
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleFormatOpen();
                  }
                }}
                sx={{
                  height: 42,
                  borderRadius: '8px',
                  border: '1px solid #404040',
                  backgroundColor: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: '12px',
                  cursor: 'pointer',
                  fontSize: 16,
                  color: '#000',
                  userSelect: 'none',
                }}
              >
                <span>{formData.emailFormat}</span>
                <ArrowDropDownIcon
                  sx={{ color: '#000', transform: formatOpen ? 'rotate(180deg)' : 'none' }}
                />
              </Box>
              {formatOpen && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    ...(formatOpensUp ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
                    backgroundColor: '#fff',
                    border: '1px solid #404040',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    zIndex: 10,
                  }}
                  onKeyDown={(e) => e.key === 'Escape' && setFormatOpen(false)}
                >
                  {EMAIL_FORMATS.map((opt) => (
                    <Box
                      key={opt}
                      component="button"
                      type="button"
                      onClick={() => {
                        setField('emailFormat', opt);
                        setFormatOpen(false);
                      }}
                      sx={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: 16,
                        padding: '16px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: formData.emailFormat === opt ? '#38a8dd' : '#000',
                        cursor: 'pointer',
                        transition: 'none',
                        '&:hover': { backgroundColor: '#7dd3fc' },
                      }}
                    >
                      {opt}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </ClickAwayListener>
        </Box>
      </Box>

      {/* Fixed floating Save button */}
      <Button
        type="submit"
        disabled={saving}
        onClick={handleSave}
        sx={{
          position: 'fixed',
          right: 48,
          bottom: 24,
          minWidth: 103,
          minHeight: 42,
          backgroundColor: '#5ebbeb',
          color: '#fff',
          borderRadius: '12px',
          fontSize: 16,
          fontWeight: 700,
          textTransform: 'none',
          boxShadow: 'none',
          transition: 'none',
          '&:hover': { backgroundColor: '#0ea5e9', boxShadow: 'none' },
          '&.Mui-disabled': { backgroundColor: '#404040', color: '#737373' },
        }}
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>
    </Box>
  );
};

export default TransfereeForm;
