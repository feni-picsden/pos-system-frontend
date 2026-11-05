import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowDropDownOutlined as ArrowDropDownIcon,
  InsertDriveFileOutlined as BlankIcon,
  ArticleOutlined as DefaultIcon,
  FormatBoldOutlined,
  FormatItalicOutlined,
  FormatUnderlinedOutlined,
  StrikethroughSOutlined,
  CodeOutlined,
  SuperscriptOutlined,
  SubscriptOutlined,
  FormatListBulletedOutlined,
  FormatListNumberedOutlined,
  FormatIndentDecreaseOutlined,
  FormatIndentIncreaseOutlined,
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
  FormatAlignJustifyOutlined,
  FormatColorTextOutlined,
  LinkOutlined,
  LinkOffOutlined,
  ImageOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import outletService from '../../services/outletService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import TemplateListActions, { templateListHeadSx, templateListBodySx } from '../../components/Common/TemplateListActions';
import PageLoader from '../../components/Common/PageLoader';
import statementTemplateService from '../../services/statementTemplateService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

const blankCanvas = () => ({ width: 210, padding: 10, fontFamily: 'Arial', fontSize: 12, backgroundColor: '#ffffff' });

// Blue circular "?" badge overhanging the top edge (reference .question dialogs).
const QuestionBadge = () => (
  <Box
    sx={{
      position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
      width: 120, height: 120, borderRadius: '50%', bgcolor: '#1c86f2',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    {/* Reference glyph: outlined '?' (light weight), not a solid fill */}
    <Box component="i" className="fal fa-question" aria-hidden="true" sx={{ display: 'flex', color: '#f8f8f8', '& svg': { height: 80, width: 54 } }}>
      <svg viewBox="0 0 24 36" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M5 11.5a7 7 0 1 1 10.6 6c-2.2 1.3-3.6 2.6-3.6 5.2v1.3" />
        <circle cx="12" cy="30" r="3" />
      </svg>
    </Box>
  </Box>
);

const questionPaperSx = (width) => ({
  width, maxWidth: 'calc(100vw - 32px)', m: 0, mt: '60px', bgcolor: '#fff', borderRadius: 0, overflow: 'visible',
  boxShadow: 'rgba(0,0,0,0.25) 0 0 30px 0, rgba(0,0,0,0.19) 0 15px 30px 0',
});

const dialogTitleSx = { fontSize: '18.72px', fontWeight: 700, color: '#000', textAlign: 'center', p: '8px 0 0', m: 0, mt: '60px' };

// Reference name input: 1px black box with small rounded corners (2px when focused).
const nameFieldSx = {
  '& .MuiOutlinedInput-root': {
    height: 53, bgcolor: '#fff', borderRadius: '4px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
  },
  '& .MuiOutlinedInput-input': { p: '16px', fontSize: 16, color: '#000' },
};

// Reference green Create / Clone button (32px text, dark when disabled).
const addButtonSx = {
  height: 48, bgcolor: '#32b643', color: '#f8f8f8', border: '1px solid #f8f8f8', borderRadius: 0,
  fontSize: 32, fontWeight: 400, lineHeight: 1, textTransform: 'none', boxShadow: 'none', p: '4px 8px',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#f8f8f8', color: '#32b643', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#404040', color: '#737373', border: '1px solid #404040' },
};

// Same centred, evenly spaced actions as Setup > Receipts.
const actionsCellSx = {
  textAlign: 'center',
  // One line, like the reference: no wrap, gap sized to fit the 391px column.
  '& ul.actions': { display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap', columnGap: '16px' },
  '& ul.actions li': { height: 'auto', lineHeight: '24px', display: 'inline-flex', alignItems: 'center', p: 0 },
  '& ul.actions li > i.fal': { width: 20, height: 20, mr: '6px', '& svg': { width: 18, height: 18 } },
};

const apiError = (err, fallback) => err?.response?.data?.error || fallback;

// Reference Cancel: pale grey, grey outline, 32px text.
const cancelButtonSx = {
  height: 48, bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #676b72', borderRadius: 0,
  fontSize: 32, fontWeight: 400, lineHeight: 1, textTransform: 'none', boxShadow: 'none', p: '4px 8px',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#676b72', color: '#f8f8f8', boxShadow: 'none' },
};

// Reference form inputs: label above, square 1px black box.
const squareFieldSx = {
  '& .MuiOutlinedInput-root': {
    height: 53, bgcolor: '#fff', borderRadius: 0,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
  },
  '& .MuiOutlinedInput-input': { p: '16px', fontSize: 16, color: '#000' },
};
const fieldLabelSx = { fontSize: 16, fontWeight: 400, color: '#000', lineHeight: '20px' };

const StatementTemplates = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, prompt } = useAppDialogs();
  const navigate = useNavigate();
  const { isTrueSuperAdmin } = useAuth();
  // Outlet rule: with a navbar outlet the new template belongs to it (no Outlet
  // picker); on All Outlets the picker shows and defaults to Global.
  const { selectedOutletId } = useSelectedOutlet();
  const showOutletPicker = isTrueSuperAdmin() && selectedOutletId == null;
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Reference: + New asks the name first, then Blank or Default creates it.
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    outletId: '',
  });
  const [showConfigureDialog, setShowConfigureDialog] = useState(false);
  const [configureTemplate, setConfigureTemplate] = useState(null);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [emailReplyTo, setEmailReplyTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const emailBodyRef = useRef(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Push loaded body HTML into the contentEditable once the dialog is ready.
  useEffect(() => {
    if (showConfigureDialog && !configLoading && emailBodyRef.current) {
      emailBodyRef.current.innerHTML = emailTemplate || '';
    }
  }, [showConfigureDialog, configLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const emailExec = (command, value = null) => {
    emailBodyRef.current?.focus();
    document.execCommand(command, false, value);
  };
  const emailInsertHTML = (html) => {
    emailBodyRef.current?.focus();
    document.execCommand('insertHTML', false, html);
  };

  useEffect(() => {
    loadTemplates();
    if (isTrueSuperAdmin()) {
      loadOutlets();
    }
  }, [isTrueSuperAdmin, selectedOutletId]);

  const loadOutlets = async () => {
    try {
      const response = await outletService.getAllOutlets();
      setOutlets(response.outlets || []);
    } catch (err) {
      console.error('Error loading outlets:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await statementTemplateService.getTemplates();
      setTemplates(response.templates || []);
    } catch (err) {
      console.error('Error loading statement templates:', err);
      setError('Failed to load statement templates');
    } finally {
      setLoading(false);
    }
  };

  // Name dialog's Create: keep the name / outlet and ask Blank or Default.
  const handleNameEntered = () => {
    if (!newTemplate.name.trim()) {
      setError('Please enter a name for the statement template');
      return;
    }
    setShowCreateDialog(false);
    setShowStartDialog(true);
  };

  const [creating, setCreating] = useState(false);

  const handleCreateTemplate = async (startFrom) => {
    if (creating) return;
    try {
      if (!newTemplate.name.trim()) {
        setError('Please enter a name for the statement template');
        return;
      }
      setCreating(true);

      const templateData = {
        name: newTemplate.name.trim(),
        // Blank = empty canvas; marked as designed so it is never re-seeded
        // with the default layout. Default = the reference layout.
        ...(startFrom === 'blank'
          ? { config: { components: [], canvas: blankCanvas(), lastModified: new Date().toISOString() } }
          : {}),
      };

      // All Outlets: the picked outlet, or null = Global. With a navbar outlet
      // nothing is sent and the request carries that outlet.
      if (showOutletPicker) {
        templateData.outletId = newTemplate.outletId ? parseInt(newTemplate.outletId, 10) : null;
      }

      const response = await statementTemplateService.createTemplate(templateData);
      const createdTemplate = response.template || response;
      
      if (createdTemplate && createdTemplate.id) {
        handleCloseCreateDialog();
        navigate(`/setup/statements/${createdTemplate.id}/edit`);
      } else {
        await loadTemplates();
        handleCloseCreateDialog();
      }
    } catch (err) {
      console.error('Error creating statement template:', err);
      // Close the Blank/Default step so the error is visible on the page.
      setShowStartDialog(false);
      setError(apiError(err, 'Failed to create statement template'));
    } finally {
      setCreating(false);
    }
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setShowStartDialog(false);
    setNewTemplate({
      name: '',
      outletId: '',
    });
    setError('');
  };

  const handleEdit = (template) => {
    navigate(`/setup/statements/${template.id}/edit`);
  };

  const handleConfigure = async (template) => {
    setConfigureTemplate(template);
    setShowConfigureDialog(true);
    setConfigLoading(true);
    try {
      const res = await statementTemplateService.getTemplateConfig(template.id);
      const cfg = res.config || res || {};
      setTemplateConfig(cfg);
      const email = cfg.email || {};
      setEmailReplyTo(email.replyTo || '');
      setEmailSubject(email.subject || 'Your Statement from {start} to {end}');
      setEmailTemplate(email.template || '');
    } catch (err) {
      console.error('Error loading statement config:', err);
      setTemplateConfig({});
      setEmailReplyTo('');
      setEmailSubject('Your Statement from {start} to {end}');
      setEmailTemplate('');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleCloseConfigure = () => {
    setShowConfigureDialog(false);
    setConfigureTemplate(null);
    setTemplateConfig(null);
  };

  const handleConfirmConfigure = async () => {
    if (!configureTemplate) return;
    try {
      setConfigSaving(true);
      const updatedConfig = {
        ...(templateConfig || {}),
        email: {
          replyTo: emailReplyTo,
          subject: emailSubject,
          template: emailBodyRef.current ? emailBodyRef.current.innerHTML : emailTemplate,
        },
      };
      await statementTemplateService.updateTemplateConfig(configureTemplate.id, updatedConfig);
      handleCloseConfigure();
    } catch (err) {
      console.error('Error saving statement config:', err);
      setError('Failed to save statement configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleDelete = (templateId) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete == null) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await statementTemplateService.deleteTemplate(templateToDelete);
      await loadTemplates();
    } catch (err) {
      console.error('Error deleting statement template:', err);
      setError('Failed to delete statement template');
    } finally {
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  // Reference "Confirm Clone" (same as Receipts): ask the name, prefilled "<name> - Clone".
  const [cloneSource, setCloneSource] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneError, setCloneError] = useState('');
  const [cloning, setCloning] = useState(false);

  const handleClone = (template) => {
    setCloneSource(template);
    setCloneName(`${template.name} - Clone`);
    setCloneError('');
  };

  const closeCloneDialog = () => {
    if (cloning) return;
    setCloneSource(null);
    setCloneError('');
  };

  const confirmClone = async () => {
    if (!cloneSource || cloning) return;
    const name = cloneName.trim();
    if (!name) {
      setCloneError('Please enter a name for the clone');
      return;
    }
    setCloning(true);
    try {
      // Fresh copy from the server, so the clone gets the latest saved design.
      let source = cloneSource;
      if (cloneSource.id != null) {
        const res = await statementTemplateService.getTemplate(cloneSource.id).catch(() => null);
        if (res?.template) source = res.template;
      }
      await statementTemplateService.cloneTemplate(source, name);
      setCloneSource(null);
      await loadTemplates();
    } catch (err) {
      console.error('Error cloning statement template:', err);
      setCloneError(apiError(err, 'Failed to clone statement template'));
    } finally {
      setCloning(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ px: '8px', pt: '15px', pb: 3 }}>
      <Typography
        component="h1"
        sx={{ fontSize: 32, fontWeight: 700, color: '#000', height: 48, lineHeight: '48px', m: 0, mb: '22px' }}
      >
        Statements
        <Button
          disableRipple
          onClick={() => setShowCreateDialog(true)}
          sx={{
            width: 130,
            height: 48,
            minWidth: 130,
            bgcolor: '#32b643',
            color: '#f8f8f8',
            border: '1px solid #f8f8f8',
            borderRadius: 0,
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1,
            textTransform: 'none',
            boxShadow: 'none',
            p: '4px 8px',
            verticalAlign: 'middle',
            ml: '9px',
            position: 'relative',
            top: '-3px',
            transition: 'background 0.2s ease, color 0.2s ease',
            // Reference .button-add:hover inverts green/near-white.
            '&:hover': { bgcolor: '#f8f8f8', color: '#32b643', boxShadow: 'none' },
          }}
        >
          + New
        </Button>
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table sx={{ borderCollapse: 'collapse', tableLayout: 'fixed', bgcolor: 'transparent' }}>
          <TableHead>
            <TableRow sx={templateListHeadSx}>
              {/* 1512 / 391 split of the 1903px table = 79.4535% */}
              <TableCell sx={{ width: '79.4535%' }}>Name</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          {/* Reference rows alternate grey / white */}
          <TableBody sx={{ ...templateListBodySx, '& tr:nth-of-type(even)': { bgcolor: '#fff' } }}>
            {templates.map((template) => (
              <TableRow key={template.id ?? 'default'}>
                <TableCell>{template.name}</TableCell>
                <TableCell sx={actionsCellSx}>
                  <TemplateListActions
                    onEdit={() => handleEdit(template)}
                    onConfigure={() => handleConfigure(template)}
                    onDelete={() => handleDelete(template.id)}
                    onClone={() => handleClone(template)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* + New, step 2 (reference): after the name, Blank or Default creates it */}
      <Dialog
        open={showStartDialog}
        onClose={() => { if (!creating) handleCloseCreateDialog(); }}
        maxWidth={false}
        // Same size as the name dialog before it.
        PaperProps={{ className: 'question show-frame', sx: questionPaperSx(382) }}
      >
        <QuestionBadge />
        <Typography component="h3" className="dialog-header-title" sx={dialogTitleSx}>
          Create New Statement
        </Typography>
        <Box sx={{ display: 'flex', gap: '16px', p: '16px 16px 0' }}>
          {[
            { key: 'blank', label: 'Blank', Icon: BlankIcon },
            { key: 'default', label: 'Default', Icon: DefaultIcon },
          ].map(({ key, label, Icon }) => (
            <Button
              key={key}
              disableRipple
              onClick={() => handleCreateTemplate(key)}
              disabled={creating}
              sx={{
                '&.Mui-disabled': { bgcolor: '#8fc2f8', color: '#f8f8f8' },
                flex: 1, height: 120, bgcolor: '#1c86f2', color: '#f8f8f8', borderRadius: 0,
                display: 'flex', flexDirection: 'column', gap: '8px', textTransform: 'none',
                fontSize: 20, fontWeight: 700, lineHeight: 1, boxShadow: 'none',
                '&:hover': { bgcolor: '#73b4f7', boxShadow: 'none' },
              }}
            >
              <Icon sx={{ fontSize: 48 }} />
              {creating ? 'Creating...' : label}
            </Button>
          ))}
        </Box>
        <Box sx={{ p: '16px' }}>
          <Button disableRipple fullWidth onClick={handleCloseCreateDialog} sx={cancelButtonSx}>
            Cancel
          </Button>
        </Box>
      </Dialog>

      {/* Create New Statement Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={handleCloseCreateDialog}
        maxWidth={false}
        PaperProps={{
          id: 'dialog',
          className: 'question show-frame',
          sx: questionPaperSx(382),
        }}
      >
        <QuestionBadge />

        <Typography component="h3" className="dialog-header-title" sx={dialogTitleSx}>
          Create New Statement
        </Typography>

        <DialogContent sx={{ p: '16px', overflow: 'visible' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000', mb: '8px', textAlign: 'center' }}>
            What should the statement be called?
          </Typography>
          <TextField
            name="name"
            variant="outlined"
            autoFocus
            value={newTemplate.name}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameEntered(); }}
            required
            sx={{ width: 350, ...nameFieldSx }}
          />

          {/* Outlet picker: All Outlets only (a navbar outlet owns the new template) */}
          {showOutletPicker && (
            <FormControl sx={{ width: 350, mt: '16px' }}>
              {/* Shows its default (Global) instead of an empty box. */}
              <InputLabel shrink>Assign to Outlet (Optional)</InputLabel>
              <Select
                displayEmpty
                notched
                renderValue={(v) => {
                  if (v === '' || v == null) return 'Global Template (All Outlets)';
                  const o = outlets.find((x) => x.id === v);
                  return o ? `${o.name} (${o.code})` : '';
                }}
                value={newTemplate.outletId}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, outletId: e.target.value }))}
                label="Assign to Outlet (Optional)"
                IconComponent={ArrowDropDownIcon}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      mt: 0.5,
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                      '& .MuiMenuItem-root:hover': { bgcolor: '#5ebbeb' },
                      '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent' },
                      '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: '#5ebbeb' }
                    }
                  }
                }}
                sx={{
                  borderRadius: 0,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' }
                }}
              >
                <MenuItem value="">
                  <em>Global Template (All Outlets)</em>
                </MenuItem>
                {outlets.map((outlet) => (
                  <MenuItem key={outlet.id} value={outlet.id}>
                    {outlet.name} ({outlet.code})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </DialogContent>

        <DialogActions sx={{ p: '0 16px 16px', gap: '16px', justifyContent: 'center' }}>
          <Button
            disableRipple
            className="button-cancel"
            onClick={handleCloseCreateDialog}
            sx={{ ...cancelButtonSx, width: 167, minWidth: 167 }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            className="button-add"
            onClick={handleNameEntered}
            disabled={!newTemplate.name.trim()}
            sx={{ ...addButtonSx, width: 167, minWidth: 167 }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Configure Statement Email Dialog */}
      {/* Reference: the same "?" question dialog — no header bar, no ✕ (Cancel closes). */}
      <Dialog
        open={showConfigureDialog}
        onClose={handleCloseConfigure}
        maxWidth={false}
        PaperProps={{ className: 'question show-frame', sx: questionPaperSx(948) }}
      >
        <QuestionBadge />
        <Typography component="h3" className="dialog-header-title" sx={dialogTitleSx}>
          Configure Statement
        </Typography>

        <DialogContent sx={{ p: '8px 16px 16px', overflow: 'visible' }}>
          {configLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Box>
                <Typography sx={fieldLabelSx}>Reply to address</Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={emailReplyTo}
                  onChange={(e) => setEmailReplyTo(e.target.value)}
                  placeholder="example@example.com"
                  sx={squareFieldSx}
                />
              </Box>
              <Box>
                <Typography sx={fieldLabelSx}>Subject Template</Typography>
                <TextField
                  fullWidth
                  variant="outlined"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Your Statement from {start} to {end}"
                  sx={squareFieldSx}
                />
              </Box>

              <Box>
                <Typography sx={fieldLabelSx}>
                  Template
                </Typography>
                <Box sx={{ border: '1px solid #000', borderRadius: 0 }}>
                  {/* Toolbar */}
                  {/* Reference: one row of tools, no dividers. */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap', p: 1, borderBottom: '1px solid #000', bgcolor: '#f7f7f7', '& .MuiIconButton-root': { p: '5px' } }}>
                    {[
                      { icon: <FormatBoldOutlined fontSize="small" />, cmd: 'bold', title: 'Bold' },
                      { icon: <FormatItalicOutlined fontSize="small" />, cmd: 'italic', title: 'Italic' },
                      { icon: <FormatUnderlinedOutlined fontSize="small" />, cmd: 'underline', title: 'Underline' },
                      { icon: <StrikethroughSOutlined fontSize="small" />, cmd: 'strikeThrough', title: 'Strikethrough' },
                    ].map((b) => (
                      <IconButton key={b.cmd} size="small" title={b.title} onClick={() => emailExec(b.cmd)} sx={{ color: '#313439', borderRadius: 0 }}>
                        {b.icon}
                      </IconButton>
                    ))}
                    <IconButton size="small" title="Code" onClick={() => emailExec('formatBlock', 'pre')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <CodeOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Superscript" onClick={() => emailInsertHTML('<sup>x</sup>')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <SuperscriptOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Subscript" onClick={() => emailInsertHTML('<sub>x</sub>')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <SubscriptOutlined fontSize="small" />
                    </IconButton>

                    <Box sx={{ width: 4 }} />

                    <Select
                      size="small"
                      defaultValue="p"
                      onChange={(e) => emailExec('formatBlock', e.target.value)}
                      sx={{ minWidth: 92, height: 32, bgcolor: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' } }}
                    >
                      <MenuItem value="p">Normal</MenuItem>
                      <MenuItem value="h1">Heading 1</MenuItem>
                      <MenuItem value="h2">Heading 2</MenuItem>
                      <MenuItem value="h3">Heading 3</MenuItem>
                    </Select>
                    <Select
                      size="small"
                      defaultValue="3"
                      onChange={(e) => emailExec('fontSize', e.target.value)}
                      sx={{ minWidth: 64, height: 32, bgcolor: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' } }}
                    >
                      {/* execCommand sizes 1-7 in px; reference shows 16 by default (size 3). */}
                      <MenuItem value="1">10</MenuItem>
                      <MenuItem value="2">13</MenuItem>
                      <MenuItem value="3">16</MenuItem>
                      <MenuItem value="4">18</MenuItem>
                      <MenuItem value="5">24</MenuItem>
                      <MenuItem value="6">32</MenuItem>
                      <MenuItem value="7">48</MenuItem>
                    </Select>

                    <Box sx={{ width: 4 }} />

                    {/* Reference order: bulleted, numbered, indent, outdent */}
                    <IconButton size="small" title="Bulleted List" onClick={() => emailExec('insertUnorderedList')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatListBulletedOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Numbered List" onClick={() => emailExec('insertOrderedList')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatListNumberedOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Increase Indent" onClick={() => emailExec('indent')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatIndentIncreaseOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Decrease Indent" onClick={() => emailExec('outdent')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatIndentDecreaseOutlined fontSize="small" />
                    </IconButton>

                    <Box sx={{ width: 4 }} />

                    <IconButton size="small" title="Align Left" onClick={() => emailExec('justifyLeft')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatAlignLeftOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Align Center" onClick={() => emailExec('justifyCenter')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatAlignCenterOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Align Right" onClick={() => emailExec('justifyRight')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatAlignRightOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Justify" onClick={() => emailExec('justifyFull')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatAlignJustifyOutlined fontSize="small" />
                    </IconButton>

                    <Box sx={{ width: 4 }} />

                    <IconButton
                      size="small"
                      title="Text Color"
                      onClick={async () => {
                        const color = await prompt('Enter colour (e.g. #ff0000 or red):', '#000000', { title: 'Text colour' });
                        if (color) emailExec('foreColor', color);
                      }}
                      sx={{ color: '#313439', borderRadius: 0 }}
                    >
                      <FormatColorTextOutlined fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Insert Link"
                      onClick={async () => {
                        const url = await prompt('Enter URL:', 'https://', { title: 'Insert link', confirmText: 'Insert link' });
                        if (url) emailExec('createLink', url);
                      }}
                      sx={{ color: '#313439', borderRadius: 0 }}
                    >
                      <LinkOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Remove Link" onClick={() => emailExec('unlink')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <LinkOffOutlined fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Insert Image"
                      onClick={async () => {
                        const url = await prompt('Enter image URL:', 'https://', { title: 'Insert image', confirmText: 'Insert image' });
                        if (url) emailInsertHTML(`<img src="${url}" alt="" style="max-width:100%;height:auto;" />`);
                      }}
                      sx={{ color: '#313439', borderRadius: 0 }}
                    >
                      <ImageOutlined fontSize="small" />
                    </IconButton>

                    <Box sx={{ width: 4 }} />

                    <IconButton size="small" title="Undo" onClick={() => emailExec('undo')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <UndoOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Redo" onClick={() => emailExec('redo')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <RedoOutlined fontSize="small" />
                    </IconButton>
                  </Box>

                  {/* WYSIWYG body */}
                  <Box
                    ref={emailBodyRef}
                    contentEditable
                    suppressContentEditableWarning
                    sx={{
                      minHeight: 220,
                      p: 2,
                      bgcolor: '#fff',
                      outline: 'none',
                      fontSize: 14,
                      color: '#000',
                      overflow: 'auto',
                    }}
                  />
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: '0 16px 16px', gap: '16px', '& > :not(:first-of-type)': { ml: 0 } }}>
          <Button disableRipple onClick={handleCloseConfigure} sx={{ ...cancelButtonSx, flex: 1 }}>
            Cancel
          </Button>
          <Button
            disableRipple
            onClick={handleConfirmConfigure}
            disabled={configLoading || configSaving}
            sx={{
              flex: 1, height: 48, bgcolor: '#1c86f2', color: '#f8f8f8', border: '1px solid #f8f8f8', borderRadius: 0,
              fontSize: 32, fontWeight: 400, lineHeight: 1, textTransform: 'none', boxShadow: 'none', p: '4px 8px',
              '&:hover': { bgcolor: '#f8f8f8', color: '#1c86f2', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#404040', color: '#737373', border: '1px solid #404040' },
            }}
          >
            {configSaving ? 'Saving...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Clone — reference: '?' badge, name question, prefilled name, Cancel / Clone. */}
      <Dialog
        open={Boolean(cloneSource)}
        onClose={closeCloneDialog}
        maxWidth={false}
        PaperProps={{ className: 'question show-frame', sx: questionPaperSx(476) }}
      >
        <QuestionBadge />
        <Typography component="h3" className="dialog-header-title" sx={dialogTitleSx}>
          Confirm Clone
        </Typography>
        <DialogContent sx={{ p: '16px', overflow: 'visible' }}>
          {cloneError && (
            <Alert severity="error" onClose={() => setCloneError('')} sx={{ mb: 2 }}>{cloneError}</Alert>
          )}
          <Typography sx={{ fontSize: 16, color: '#000', mb: '16px', wordBreak: 'break-word' }}>
            What do you want to name the clone of &quot;{cloneSource?.name}&quot;?
          </Typography>
          <TextField
            fullWidth
            autoFocus
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmClone(); } }}
            sx={nameFieldSx}
          />
        </DialogContent>
        <DialogActions sx={{ p: '0 16px 16px', gap: '16px', '& > :not(:first-of-type)': { ml: 0 } }}>
          <Button disableRipple onClick={closeCloneDialog} disabled={cloning} sx={{ ...cancelButtonSx, flex: 1 }}>
            Cancel
          </Button>
          <Button disableRipple onClick={confirmClone} disabled={cloning || !cloneName.trim()} sx={{ ...addButtonSx, flex: 1 }}>
            {cloning ? 'Cloning...' : 'Clone'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Statement Template"
        message="Are you sure you want to delete this statement template?"
        onCancel={() => {
          setDeleteDialogOpen(false);
          setTemplateToDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default StatementTemplates;

