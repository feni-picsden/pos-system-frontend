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
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Close as CloseIcon,
  ArrowDropDownOutlined as ArrowDropDownIcon,
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
import PageLoader from '../../components/Common/PageLoader';
import statementTemplateService from '../../services/statementTemplateService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

const StatementTemplates = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, prompt } = useAppDialogs();
  const navigate = useNavigate();
  const { isSuperAdmin } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    if (isSuperAdmin()) {
      loadOutlets();
    }
  }, [isSuperAdmin]);

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

  const handleCreateTemplate = async () => {
    try {
      if (!newTemplate.name.trim()) {
        setError('Please enter a name for the statement template');
        return;
      }

      const templateData = {
        name: newTemplate.name,
        createdAt: new Date().toISOString(),
      };

      if (isSuperAdmin() && newTemplate.outletId) {
        templateData.outletId = parseInt(newTemplate.outletId);
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
      setError('Failed to create statement template');
    }
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
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

  const handleClone = async (template) => {
    try {
      const clonedTemplate = {
        ...template,
        name: `${template.name} (Copy)`,
        id: undefined,
        createdAt: new Date().toISOString(),
      };
      await statementTemplateService.createTemplate(clonedTemplate);
      await loadTemplates();
    } catch (err) {
      console.error('Error cloning statement template:', err);
      setError('Failed to clone statement template');
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
            <TableRow
              sx={{
                '& th': {
                  bgcolor: 'transparent',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: 16,
                  border: '1px solid #000',
                  borderRadius: 0,
                  height: 36,
                  lineHeight: '20px',
                  p: '8px',
                  textAlign: 'center',
                },
              }}
            >
              {/* 1512 / 391 split of the 1903px table = 79.4535% */}
              <TableCell sx={{ width: '79.4535%' }}>Name</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr': { bgcolor: '#f8f8f8', height: 52 },
              '& td': { border: '1px solid #000', fontSize: 16, fontWeight: 400, lineHeight: '20px', color: '#000', p: '16px' },
            }}
          >
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.name}</TableCell>
                <TableCell sx={{ py: '16px' }}>
                  <Box
                    component="ul"
                    className="actions"
                    sx={{
                      // Reference ul.actions is display:block with inline-block li.
                      display: 'block',
                      // Reference allows no break between the inline-block li.
                      whiteSpace: 'nowrap',
                      listStyle: 'none',
                      m: 0,
                      p: 0,
                      '& li': {
                        display: 'inline-block',
                        // MUI Typography bleeds letter-spacing; reference li is normal.
                        letterSpacing: 'normal',
                        height: 19,
                        p: '0 8px',
                        m: 0,
                        borderRadius: 0,
                        fontSize: 16,
                        fontWeight: 400,
                        lineHeight: '19px',
                        cursor: 'pointer',
                        transition: 'all 0s',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                      },
                      // Reference icons are <i class="fal fa-*"> (20x16, fw300). FontAwesome is not
                      // installed and adding it is out of scope, so each glyph is an inline path in
                      // the reference's own tag/class/box.
                      '& li > i.fal': {
                        width: 20,
                        height: 16,
                        mr: '8px',
                        fontWeight: 300,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        verticalAlign: 'middle',
                        flexShrink: 0,
                        '& svg': { width: 14, height: 14 },
                      },
                      '& li.action-edit': { color: '#32b643', '&:hover': { color: '#6dd77b' } },
                      '& li.action-view': { color: '#1c86f2', '&:hover': { color: '#73b4f7' } },
                      '& li.action-delete': { color: '#e3342f', '&:hover': { color: '#f3aaa8' } },
                      '& li.action-clone': { color: '#1c86f2', '&:hover': { color: '#73b4f7' } },
                    }}
                  >
                    <li className="action-edit action-locked" onClick={() => handleEdit(template)}>
                      <i className="fal fa-pencil fa-fw shopfront-icon" aria-hidden="true">
                        <svg viewBox="0 0 512 512" fill="currentColor" focusable="false">
                          <path d="M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z" />
                        </svg>
                      </i>Edit
                    </li>
                    <li className="action-view action-locked" onClick={() => handleConfigure(template)}>
                      <i className="fal fa-cogs fa-fw shopfront-icon" aria-hidden="true">
                        <svg viewBox="0 0 640 512" fill="currentColor" focusable="false">
                          <path d="M308.5 135.3c7.1-6.3 9.9-16.2 6.2-25c-2.3-5.3-4.8-10.5-7.6-15.5L304 89.4c-3-5-6.3-9.9-9.8-14.6c-5.7-7.6-15.7-10.1-24.7-7.1l-28.2 9.3c-10.7-8.8-23-16-36.2-20.9L199 27.1c-1.9-9.3-9.1-16.7-18.5-17.8C173.9 8.4 167.2 8 160.4 8h-.7c-6.8 0-13.5 .4-20.1 1.2c-9.4 1.1-16.6 8.6-18.5 17.8L115 56.1c-13.3 5-25.5 12.1-36.2 20.9L50.5 67.8c-9-3-19-.5-24.7 7.1c-3.5 4.7-6.8 9.6-9.9 14.6l-3 5.3c-2.8 5-5.3 10.2-7.6 15.5c-3.7 8.7-.9 18.6 6.2 25l22.2 19.8C32.6 161.9 32 168.9 32 176s.6 14.1 1.7 20.9L11.5 216.7c-7.1 6.3-9.9 16.2-6.2 25c2.3 5.3 4.8 10.5 7.6 15.5l3 5.3c3 5 6.3 9.9 9.9 14.6c5.7 7.6 15.7 10.1 24.7 7.1l28.2-9.3c10.7 8.8 23 16 36.2 20.9l6.1 29.1c1.9 9.3 9.1 16.7 18.5 17.8c6.7 .8 13.5 1.2 20.4 1.2s13.7-.4 20.4-1.2c9.4-1.1 16.6-8.6 18.5-17.8l6.1-29.1c13.3-5 25.5-12.1 36.2-20.9l28.2 9.3c9 3 19 .5 24.7-7.1c3.5-4.7 6.8-9.5 9.8-14.6l3.1-5.4c2.8-5 5.3-10.2 7.6-15.5c3.7-8.7 .9-18.6-6.2-25l-22.2-19.8c1.1-6.8 1.7-13.8 1.7-20.9s-.6-14.1-1.7-20.9l22.2-19.8zM112 176a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM504.7 500.5c6.3 7.1 16.2 9.9 25 6.2c5.3-2.3 10.5-4.8 15.5-7.6l5.3-3.1c5-3 9.9-6.3 14.6-9.8c7.6-5.7 10.1-15.7 7.1-24.7l-9.3-28.2c8.8-10.7 16-23 20.9-36.2l29.1-6.1c9.3-1.9 16.7-9.1 17.8-18.5c.8-6.7 1.2-13.5 1.2-20.4s-.4-13.7-1.2-20.4c-1.1-9.4-8.6-16.6-17.8-18.5L583.8 307c-5-13.3-12.1-25.5-20.9-36.2l9.3-28.2c3-9 .5-19-7.1-24.7c-4.7-3.5-9.6-6.8-14.6-9.9l-5.3-3c-5-2.8-10.2-5.3-15.5-7.6c-8.7-3.7-18.6-.9-25 6.2l-19.8 22.2c-6.8-1.1-13.8-1.7-20.9-1.7s-14.1 .6-20.9 1.7l-19.8-22.2c-6.3-7.1-16.2-9.9-25-6.2c-5.3 2.3-10.5 4.8-15.5 7.6l-5.3 3c-5 3-9.9 6.3-14.6 9.9c-7.6 5.7-10.1 15.7-7.1 24.7l9.3 28.2c-8.8 10.7-16 23-20.9 36.2L307.1 313c-9.3 1.9-16.7 9.1-17.8 18.5c-.8 6.7-1.2 13.5-1.2 20.4s.4 13.7 1.2 20.4c1.1 9.4 8.6 16.6 17.8 18.5l29.1 6.1c5 13.3 12.1 25.5 20.9 36.2l-9.3 28.2c-3 9-.5 19 7.1 24.7c4.7 3.5 9.5 6.8 14.6 9.8l5.4 3.1c5 2.8 10.2 5.3 15.5 7.6c8.7 3.7 18.6 .9 25-6.2l19.8-22.2c6.8 1.1 13.8 1.7 20.9 1.7s14.1-.6 20.9-1.7l19.8 22.2zM464 304a48 48 0 1 1 0 96 48 48 0 1 1 0-96z" />
                        </svg>
                      </i>Configure
                    </li>
                    <li className="action-delete action-locked" onClick={() => handleDelete(template.id)}>
                      <i className="fal fa-trash fa-fw shopfront-icon" aria-hidden="true">
                        <svg viewBox="0 0 448 512" fill="currentColor" focusable="false">
                          <path d="M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z" />
                        </svg>
                      </i>Delete
                    </li>
                    <li className="action-clone action-locked" onClick={() => handleClone(template)}>
                      <i className="fal fa-clone fa-fw shopfront-icon" aria-hidden="true">
                        <svg viewBox="0 0 512 512" fill="currentColor" focusable="false">
                          <path d="M64 464l224 0c8.8 0 16-7.2 16-16l0-64 48 0 0 64c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 224c0-35.3 28.7-64 64-64l64 0 0 48-64 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16zM224 304l224 0c8.8 0 16-7.2 16-16l0-224c0-8.8-7.2-16-16-16L224 48c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16zm-64-16l0-224c0-35.3 28.7-64 64-64L448 0c35.3 0 64 28.7 64 64l0 224c0 35.3-28.7 64-64 64l-224 0c-35.3 0-64-28.7-64-64z" />
                        </svg>
                      </i>Clone
                    </li>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create New Statement Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={handleCloseCreateDialog}
        maxWidth={false}
        PaperProps={{
          id: 'dialog',
          className: 'question show-frame',
          sx: {
            width: 382,
            m: 0,
            mt: '48px',
            bgcolor: '#fff',
            borderRadius: 0,
            overflow: 'visible',
            boxShadow: 'rgba(0,0,0,0.25) 0 0 30px 0, rgba(0,0,0,0.19) 0 15px 30px 0',
          },
        }}
      >
        {/* Blue circular badge overhanging the top edge (reference .question badge) */}
        <Box
          sx={{
            position: 'absolute',
            top: -48,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 96,
            height: 96,
            borderRadius: '50%',
            bgcolor: '#1c86f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box component="i" className="fal fa-question" aria-hidden="true" sx={{ display: 'flex', color: '#f8f8f8', '& svg': { height: 72 } }}>
            <svg viewBox="0 0 320 512" fill="currentColor" focusable="false">
              <path d="M80 160c0-35.3 28.7-64 64-64l32 0c35.3 0 64 28.7 64 64l0 3.6c0 21.8-11.1 42.1-29.4 53.8l-42.2 27.1c-25.2 16.2-40.4 44.1-40.4 74l0 1.4c0 17.7 14.3 32 32 32s32-14.3 32-32l0-1.4c0-8.2 4.2-15.8 11-20.2l42.2-27.1c36.6-23.6 58.8-64.1 58.8-107.7l0-3.6c0-70.7-57.3-128-128-128l-32 0C73.3 32 16 89.3 16 160c0 17.7 14.3 32 32 32s32-14.3 32-32zm80 320a40 40 0 1 0 0-80 40 40 0 1 0 0 80z" />
            </svg>
          </Box>
        </Box>

        <Typography
          component="h3"
          className="dialog-header-title"
          sx={{ fontSize: '18.72px', fontWeight: 700, color: '#000', textAlign: 'center', p: '8px 0 0', m: 0, mt: '48px' }}
        >
          Create New Statement
        </Typography>

        <DialogContent sx={{ p: '16px', overflow: 'visible' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000', mb: '8px' }}>
            What should the statement be called?
          </Typography>
          <TextField
            name="name"
            variant="outlined"
            value={newTemplate.name}
            onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
            required
            sx={{
              width: 350,
              '& .MuiOutlinedInput-root': {
                width: 350,
                height: 53,
                bgcolor: '#fff',
                borderRadius: 0,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '1px' },
              },
              '& .MuiOutlinedInput-input': { p: '16px', fontSize: 16, color: '#000' },
            }}
          />

          {/* Outlet Selector for Super Admins */}
          {isSuperAdmin() && (
            <FormControl sx={{ width: 350, mt: '16px' }}>
              <InputLabel>Assign to Outlet (Optional)</InputLabel>
              <Select
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
            sx={{
              width: 167,
              minWidth: 167,
              height: 48,
              bgcolor: '#f8f8f8',
              color: '#676b72',
              border: '1px solid #676b72',
              borderRadius: 0,
              fontSize: 32,
              fontWeight: 400,
              lineHeight: 1,
              textTransform: 'none',
              boxShadow: 'none',
              p: '4px 8px',
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#676b72', color: '#f8f8f8', boxShadow: 'none' },
            }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            className="button-add"
            onClick={handleCreateTemplate}
            disabled={!newTemplate.name.trim()}
            sx={{
              width: 167,
              minWidth: 167,
              height: 48,
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
              transition: 'background 0.2s ease, color 0.2s ease',
              '&:hover': { bgcolor: '#f8f8f8', color: '#32b643', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#404040', color: '#737373', border: '1px solid #404040' },
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Configure Statement Email Dialog */}
      <Dialog
        open={showConfigureDialog}
        onClose={handleCloseConfigure}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' } }}
      >
        <DialogTitle sx={{
          bgcolor: '#5ebbeb',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          position: 'relative'
        }}>
          <Box sx={{
            bgcolor: '#4aa9dd',
            borderRadius: '50%',
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <SettingsIcon sx={{ color: 'white', fontSize: '2rem' }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Configure Statement
          </Typography>
          <IconButton
            onClick={handleCloseConfigure}
            sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {configLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
              <TextField
                fullWidth
                label="Reply to address"
                variant="outlined"
                value={emailReplyTo}
                onChange={(e) => setEmailReplyTo(e.target.value)}
                placeholder="replies@example.com"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
                  }
                }}
              />
              <TextField
                fullWidth
                label="Subject Template"
                variant="outlined"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Your Statement from {start} to {end}"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '8px',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
                  }
                }}
              />

              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 16, mb: 1, color: '#313439' }}>
                  Template
                </Typography>
                <Box sx={{ border: '1px solid #000', borderRadius: 0 }}>
                  {/* Toolbar */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', p: 1, borderBottom: '1px solid #000', bgcolor: '#f7f7f7' }}>
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

                    <Divider orientation="vertical" flexItem sx={{ borderColor: '#d9d9d9', mx: 0.5 }} />

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
                      <MenuItem value="1">8</MenuItem>
                      <MenuItem value="2">10</MenuItem>
                      <MenuItem value="3">12</MenuItem>
                      <MenuItem value="4">14</MenuItem>
                      <MenuItem value="5">18</MenuItem>
                      <MenuItem value="6">24</MenuItem>
                      <MenuItem value="7">36</MenuItem>
                    </Select>

                    <Divider orientation="vertical" flexItem sx={{ borderColor: '#d9d9d9', mx: 0.5 }} />

                    <IconButton size="small" title="Numbered List" onClick={() => emailExec('insertOrderedList')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatListNumberedOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Bulleted List" onClick={() => emailExec('insertUnorderedList')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatListBulletedOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Decrease Indent" onClick={() => emailExec('outdent')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatIndentDecreaseOutlined fontSize="small" />
                    </IconButton>
                    <IconButton size="small" title="Increase Indent" onClick={() => emailExec('indent')} sx={{ color: '#313439', borderRadius: 0 }}>
                      <FormatIndentIncreaseOutlined fontSize="small" />
                    </IconButton>

                    <Divider orientation="vertical" flexItem sx={{ borderColor: '#d9d9d9', mx: 0.5 }} />

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

                    <Divider orientation="vertical" flexItem sx={{ borderColor: '#d9d9d9', mx: 0.5 }} />

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

                    <Divider orientation="vertical" flexItem sx={{ borderColor: '#d9d9d9', mx: 0.5 }} />

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
                      '&:empty:before': { content: '"Compose your statement email..."', color: '#808080' },
                    }}
                  />
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0, gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleCloseConfigure}
            sx={{ minWidth: 100, height: 42, textTransform: 'none', fontWeight: 600, borderRadius: '12px', bgcolor: '#f8f8f8', color: '#676b72', borderColor: '#676b72', '&:hover': { borderColor: '#676b72', bgcolor: '#f8f8f8' } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmConfigure}
            disabled={configLoading || configSaving}
            sx={{ bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, minWidth: 100, height: 42 }}
          >
            {configSaving ? 'Saving...' : 'Update'}
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

