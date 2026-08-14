import React from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  InfoOutlined,
} from '@mui/icons-material';
import {
  DEFAULT_ATTACHMENT_NAME,
  isEmailTemplate,
  isTextOnlyTemplate,
} from '../../utils/receiptTemplateShape';

// The ONE Configure dialog. Measured 2026-08-07 (docs/parity/receipt-editor-measured-2026-08-07.md):
// the list page's `Configure` action and the editor's gear open the SAME dialog, titled
// `Configure Receipt`. They used to be two separate implementations that had drifted —
// the editor's offered padding only, with no width and no attachments.
// Content is conditional on the template type:
//   receipt-text          -> Receipt Width instead of the padding block
//   everything else       -> padding block (Top/Left/Right/Bottom + live box preview)
//   email                 -> padding block PLUS the Receipt Attachments table
//
// Fully controlled: the parent owns `value` because the two callers persist differently
// (the list page saves on Confirm, the editor defers to its own Save).
const padInputSx = {
  width: 156,
  '& .MuiOutlinedInput-root': { borderRadius: 0, height: 53 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
};

// Measured: 223×48 with 32px labels.
const actionSx = {
  width: 223,
  height: 48,
  borderRadius: 0,
  textTransform: 'none',
  px: 2,
  fontSize: 32,
  lineHeight: 1,
};

const ConfigureReceiptDialog = ({
  open,
  template,
  value,
  onChange,
  onCancel,
  onConfirm,
  a4Templates = [],
  loading = false,
  saving = false,
  error = '',
  onErrorClose,
}) => {
  const padding = value?.padding || { top: 0, left: 0, right: 0, bottom: 0 };
  const attachments = value?.attachments || [];
  const setPadding = (side, v) => onChange({ ...value, padding: { ...padding, [side]: v } });
  const setAttachments = (next) => onChange({ ...value, attachments: next });

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      PaperProps={{ /* measured 494×376 panel */ sx: { width: 494, maxWidth: 494, borderRadius: 0, overflow: 'visible', mt: 5, boxShadow: '0 0 30px rgba(0,0,0,0.25)' } }}
    >
      {/* Measured: a blue circular ⓘ badge STRADDLING the top edge, not an inline icon in
          a title bar. Same pattern as the list page's Create dialog. */}
      <Box sx={{
        position: 'absolute',
        top: -28,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 56,
        height: 56,
        borderRadius: '50%',
        bgcolor: '#1c86f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      }}>
        <InfoOutlined sx={{ color: '#fff', fontSize: 34 }} />
      </Box>
      <DialogTitle sx={{ textAlign: 'center', fontWeight: 700, pt: 4.5 }}>
        Configure Receipt
      </DialogTitle>
      <DialogContent>
        {/* Inside the dialog, never on the page behind it — a validation error raised
            with the modal open used to render under the backdrop and read as
            "Confirm does nothing". */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={onErrorClose}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {isTextOnlyTemplate(template) ? (
              /* Measured: a text-only receipt has no paper padding, only a width. */
              <TextField
                label="Receipt Width"
                type="number"
                size="small"
                value={value?.receiptWidth ?? ''}
                onChange={(e) => onChange({ ...value, receiptWidth: e.target.value })}
                sx={{ ...padInputSx, mt: 1 }}
              />
            ) : (
              <>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Receipt Padding (in pixels)
                </Typography>
                {/* Measured: the four 156×53 inputs sit at two x positions (872/1035) and
                    two y positions (427/504) — a 2×2 GRID — with the live grey box preview
                    beside them at the LEFT. It used to be a 3-column plus/cross with the
                    preview in the middle. */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {/* Live box preview: the grey paper grows with the padding around it. */}
                  <Box
                    sx={{
                      width: 100,
                      height: 72,
                      flex: '0 0 auto',
                      bgcolor: '#f7f7f7',
                      border: '1px solid #000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#676b72',
                      fontSize: 12,
                      pt: `${Number(padding.top) || 0}px`,
                      pr: `${Number(padding.right) || 0}px`,
                      pb: `${Number(padding.bottom) || 0}px`,
                      pl: `${Number(padding.left) || 0}px`,
                      boxSizing: 'content-box',
                    }}
                  >
                    Receipt
                  </Box>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 156px)', columnGap: '7px', rowGap: '24px' }}>
                    {['top', 'left', 'right', 'bottom'].map((side) => (
                      <TextField
                        key={side}
                        type="number"
                        size="small"
                        label={side.charAt(0).toUpperCase() + side.slice(1)}
                        value={padding[side]}
                        onChange={(e) => setPadding(side, e.target.value)}
                        inputProps={{ min: 0 }}
                        sx={padInputSx}
                      />
                    ))}
                  </Box>
                </Box>
              </>
            )}

            {/* Measured: EMAIL gets the padding block PLUS the attachments table. */}
            {isEmailTemplate(template) && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Receipt Attachments
                </Typography>
                {attachments.map((att, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
                    <TextField
                      size="small"
                      value={att.name || ''}
                      onChange={(e) => setAttachments(attachments.map((a, i) => (i === index ? { ...a, name: e.target.value } : a)))}
                      sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
                    />
                    {/* Measured: "a template select" — no label is recorded, so none is invented. */}
                    <FormControl size="small" sx={{ flex: 1 }}>
                      <Select
                        displayEmpty
                        value={att.receiptTemplateId || ''}
                        onChange={(e) => setAttachments(attachments.map((a, i) => (i === index ? { ...a, receiptTemplateId: e.target.value } : a)))}
                        sx={{ borderRadius: 0 }}
                      >
                        {a4Templates.map((t) => (
                          <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <IconButton
                      onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}
                      sx={{ color: '#e33430' }}
                      title="Remove attachment"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setAttachments([...attachments, { name: DEFAULT_ATTACHMENT_NAME, receiptTemplateId: '' }])}
                  sx={{ textTransform: 'none', color: '#1c86f2', borderRadius: 0 }}
                >
                  Add Attachment
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={onCancel}
          sx={{ ...actionSx, bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #676b72', '&:hover': { bgcolor: '#efefef' } }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading || saving}
          sx={{ ...actionSx, bgcolor: '#1c86f2', color: '#fff', '&:hover': { bgcolor: '#1670d0' } }}
        >
          {saving ? 'Saving...' : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfigureReceiptDialog;
