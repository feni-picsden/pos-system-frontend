import React, { useState, useMemo, useRef } from 'react';
import { Box, Typography, Popper, ClickAwayListener } from '@mui/material';
import {
  CloseOutlined as CloseIcon,
  ArrowDropDown as ArrowDropDownIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as SquareCheckedIcon,
} from '@mui/icons-material';
import { INSTANT } from './ticketChrome';

/**
 * Reference shelf-ticket filter control (Everyday Tickets, Promotional Tickets): a 42px
 * typeahead combobox whose caption sits ABOVE and outside the field (the outline stays
 * unbroken — no notched legend), opening a square black-bordered panel instantly (no Grow)
 * with 56px rows, sky-300 hover and the current value in sky-500. Renders 'No Options'
 * when the tenant has nothing configured.
 * In `multiple` mode each row carries a square-checkbox glyph, picking an option toggles
 * membership without closing the panel, the field shows a grey chip (the name, or
 * "N Selected..."), and every checked value is pinned above the list.
 * `fullWidth` stretches the control to its container (default 422px).
 */
const TicketSelect = ({ label, placeholder, value, options, onChange, clearable, multiple, fullWidth }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(null); // null => showing the value, not typing
  const anchorRef = useRef(null);

  const selected = useMemo(() => (multiple ? value || [] : []), [multiple, value]);
  const chip = multiple && selected.length > 0 ? (selected.length === 1 ? selected[0] : `${selected.length} Selected...`) : '';
  const displayValue = multiple ? '' : value;
  const showClear = (multiple || clearable) && (multiple ? selected.length > 0 : Boolean(value));

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return q ? options.filter((option) => option.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const pick = (option) => {
    if (multiple) {
      const current = value || [];
      onChange(current.includes(option) ? current.filter((v) => v !== option) : [...current, option]);
      setQuery(null);
      return;
    }
    onChange(clearable && option === value ? '' : option);
    close();
  };

  // One option row, used both in the list and (pinned) in the selected-values band.
  const renderOption = (option, pinned) => {
    const checked = multiple ? selected.includes(option) : option === value;
    return (
      <Box
        key={pinned ? `pinned-${option}` : option}
        component="button"
        type="button"
        onClick={() => pick(option)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          width: '100%',
          height: 56,
          p: '16px',
          border: 0,
          // Reference: pinned (selected) rows sit on white with sky text and a rule
          // beneath; the hover band is sky.
          borderBottom: pinned ? '1px solid #e5e5e5' : 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 16,
          color: checked ? '#38bdf8' : '#252525',
          transition: INSTANT,
          '&:hover': { bgcolor: '#74d4ff' },
        }}
      >
        {multiple &&
          (checked ? (
            <SquareCheckedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
          ) : (
            <SquareIcon sx={{ fontSize: 16, flexShrink: 0 }} />
          ))}
        {option}
      </Box>
    );
  };

  return (
    <ClickAwayListener onClickAway={close}>
      <Box sx={{ width: fullWidth ? '100%' : 422, maxWidth: '100%' }}>
        <Typography sx={{ fontSize: '12.8px', fontWeight: 400, lineHeight: '16px', color: '#313439' }}>
          {label}
        </Typography>
        <Box
          ref={anchorRef}
          onClick={() => setOpen(true)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            height: 42,
            pl: '16px',
            pr: '4px',
            bgcolor: '#fff',
            border: '1px solid #404040',
            borderRadius: '8px',
            cursor: 'text',
          }}
        >
          {chip && query == null && (
            <Box
              sx={{
                flexShrink: 0,
                mr: 1,
                px: '8px',
                py: '2px',
                borderRadius: '4px',
                bgcolor: '#e5e5e5',
                fontSize: 16,
                color: '#000',
                whiteSpace: 'nowrap',
              }}
            >
              {chip}
            </Box>
          )}
          <Box
            component="input"
            type="text"
            value={query ?? displayValue}
            placeholder={chip ? '' : placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && close()}
            sx={{
              flex: 1,
              minWidth: 0,
              height: 40,
              border: 0,
              outline: 'none',
              bgcolor: 'transparent',
              fontFamily: 'inherit',
              fontSize: 16,
              color: '#000',
              '&::placeholder': { color: '#808080', opacity: 1 },
            }}
          />
          {/* Reference clear control: a '×' inside the field, to the LEFT of the caret. */}
          {showClear && (
            <Box
              component="button"
              type="button"
              aria-label={`Clear ${label}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange(multiple ? [] : '');
                setQuery(null);
              }}
              sx={{
                display: 'flex',
                flexShrink: 0,
                p: 0,
                border: 0,
                bgcolor: 'transparent',
                color: '#404040',
                cursor: 'pointer',
                transition: INSTANT,
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </Box>
          )}
          <ArrowDropDownIcon
            sx={{
              flexShrink: 0,
              color: '#404040',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </Box>

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
          style={{ zIndex: 1300 }}
        >
          <Box
            sx={{
              width: anchorRef.current ? anchorRef.current.offsetWidth : 'auto',
              bgcolor: '#fff',
              // Reference panel: 1px black outline only — square corners, no drop shadow.
              // Only a multi-select panel is capped at 250px; single-select menus size to
              // their options, bounded by the viewport so a long list still scrolls.
              border: '1px solid #000',
              borderRadius: 0,
              boxShadow: 'none',
              maxHeight: multiple ? 250 : '70vh',
              overflowY: 'auto',
              transition: INSTANT,
            }}
          >
            {selected.map((option) => renderOption(option, true))}
            {filtered.length === 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'center', height: 53, px: '16px', fontSize: 16, color: '#252525' }}>
                No Options
              </Box>
            ) : (
              filtered.map((option) => renderOption(option, false))
            )}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default TicketSelect;
