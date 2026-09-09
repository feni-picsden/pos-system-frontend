import React from 'react';
import { Box, Button, CircularProgress } from '@mui/material';

/**
 * The one Save control for a full-page form.
 *
 * Every form page used to place its own: some pinned with `position: fixed` at
 * four different offsets (0/0, 16/32, 24/24, 32/32), one `sticky`, and the rest
 * as a plain button at the end of the content — which scrolls out of sight on a
 * long form, so on those pages Save could not be reached without scrolling to the
 * bottom first. This component is the single answer: always pinned, always the
 * same corner, on every page that uses it.
 *
 * `fixed` rather than `sticky` on purpose — a sticky child only pins inside its own
 * scroll container, and these pages disagree about which element scrolls (some the
 * window, some an inner Box with overflow). Fixed positioning is correct in both.
 *
 * Leave BOTTOM_CLEARANCE worth of bottom padding on the scrolling content so the
 * last field is not sitting underneath this bar.
 */

/** Distance from the viewport's bottom-right corner. One value, used everywhere. */
export const SAVE_BAR_OFFSET = 24;

/** Padding a scroll container needs at its bottom so content clears the bar. */
export const SAVE_BAR_CLEARANCE = 96;

const saveButtonSx = {
  backgroundColor: '#5ebbeb',
  border: '1px solid #5ebbeb',
  color: '#ffffff',
  borderRadius: '12px',
  height: 42,
  minWidth: 132,
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  padding: '8px 32px',
  // Ref swaps the hover colour instantly (transition: all 0s)
  transitionDuration: '0ms',
  '&:hover': { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9', boxShadow: 'none' },
  '&.Mui-disabled': { backgroundColor: '#9fd6ef', borderColor: '#9fd6ef', color: '#ffffff' },
};

const cancelButtonSx = {
  backgroundColor: '#676b72',
  border: '1px solid #676b72',
  color: '#ffffff',
  borderRadius: '12px',
  height: 42,
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  padding: '8px 24px',
  transitionDuration: '0ms',
  '&:hover': { backgroundColor: '#585c62', borderColor: '#585c62', boxShadow: 'none' },
};

/**
 * @param {function} onSave     required
 * @param {boolean}  saving     shows a spinner and blocks repeat clicks
 * @param {boolean}  disabled   blocks the save for a reason of the page's own
 * @param {string}   label      defaults to "Save"
 * @param {function} onCancel   optional — renders a Cancel to the Save's left
 * @param {node}     children   optional extra controls, placed left of Cancel
 */
const PageSaveBar = ({
  onSave,
  saving = false,
  disabled = false,
  label = 'Save',
  onCancel,
  cancelLabel = 'Cancel',
  children,
}) => (
  <Box
    sx={{
      position: 'fixed',
      right: SAVE_BAR_OFFSET,
      bottom: SAVE_BAR_OFFSET,
      // Above page content and the app bar, below MUI dialogs (1300) so a
      // confirmation opened from here is never sitting underneath its own button.
      zIndex: 1200,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      // The row spans only its buttons, so the page behind stays clickable.
      pointerEvents: 'none',
      '& > *': { pointerEvents: 'auto' },
    }}
  >
    {children}
    {onCancel && (
      <Button disableRipple disableElevation onClick={onCancel} sx={cancelButtonSx}>
        {cancelLabel}
      </Button>
    )}
    <Button
      disableRipple
      disableElevation
      onClick={onSave}
      disabled={saving || disabled}
      startIcon={saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : null}
      sx={saveButtonSx}
    >
      {saving ? 'Saving' : label}
    </Button>
  </Box>
);

export default PageSaveBar;
