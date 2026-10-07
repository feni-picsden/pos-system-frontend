import React, { useState, useRef, useEffect } from 'react';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';

// One "search the list, and if it isn't there make it" combobox for every lookup
// field in the app — category, brand, family, tag, supplier, customer group,
// price list, promotion category. Typing a name that no option matches adds a
// `Create "<name>"` row to the bottom of the list; picking it calls onCreate,
// and the record that comes back is selected as if it had always been there.
//
// This started as the hand-rolled block in CreateReceiveStock's supplier combo.
// Every other lookup had copy-pasted the combo *without* the create half, so the
// behaviour existed in exactly one field out of ~30. Import this instead.

// Marks the synthetic bottom row. A real record can never collide with it
// because records are keyed by their own id.
const CREATE_ID = '__create__';

const isCreateRow = (option) => Boolean(option && option.__isCreate);

/**
 * @param {object[]} options       the records to choose from
 * @param {object|object[]|null} value  selected record(s) — array when `multiple`
 * @param {(v: object|object[]|null) => void} onChange  gets records, never the sentinel
 * @param {(name: string) => Promise<object|null|undefined>} onCreate
 *        creates the record for the typed text and resolves to it. Returning
 *        nothing (or throwing) leaves the selection untouched.
 * @param {string} [labelKey='name']  which field to search and display
 * @param {(name: string) => string} [createLabel]  text of the create row
 * @param {(err: unknown) => void} [onError]  so the page can show its own Alert
 */
const CreatableAutocomplete = ({
  options = [],
  value,
  onChange,
  onCreate,
  labelKey = 'name',
  createLabel = (name) => `Create "${name}"...`,
  onError,
  multiple = false,
  disabled = false,
  placeholder = '',
  textFieldProps = {},
  ...autocompleteProps
}) => {
  const [creating, setCreating] = useState(false);

  // The list is a portal, so it paints ABOVE the fixed app bar. With the field
  // scrolled up under that bar the list hung from an input nobody could see
  // (Create Order "From"). Three rules keep field and list together:
  //   1. open   -> scroll the field into view under the bar (scrollMarginTop)
  //   2. open   -> the list always drops DOWN; Popper's flip used to push it up
  //                over the bar where its first rows were clipped
  //   3. scroll -> page scroll closes the list; scrolling INSIDE the list does not
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  // Rule 1's own smooth scroll fires scroll events too; ignore those.
  const openedAtRef = useRef(0);
  useEffect(() => {
    if (!open) return undefined;
    const onScroll = (event) => {
      if (Date.now() - openedAtRef.current < 700) return;
      if (event.target?.closest?.('.MuiAutocomplete-popper')) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [open]);

  const { componentsProps = {}, slotProps = {}, onOpen, onClose, sx: userSx, ...restProps } = autocompleteProps;
  const userPopper = componentsProps.popper || slotProps.popper || {};
  const popperProps = {
    placement: 'bottom-start',
    ...userPopper,
    modifiers: [
      { name: 'flip', enabled: false },
      { name: 'preventOverflow', options: { altAxis: false, padding: 8 } },
      ...(userPopper.modifiers || []),
    ],
  };

  const labelOf = (option) => (option && option[labelKey] != null ? String(option[labelKey]) : '');

  // Turn the typed text into a record, then merge it into the current value.
  const runCreate = async (name, previous) => {
    if (!onCreate || !name) return;
    setCreating(true);
    try {
      const created = await onCreate(name);
      // A creator that resolves to nothing (validation refused, duplicate name)
      // must not clear what was already selected.
      if (!created) return;
      onChange(multiple ? [...previous, created] : created);
    } catch (err) {
      if (onError) onError(err);
      else console.error('Failed to create option:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleChange = (_event, next) => {
    if (multiple) {
      const list = next || [];
      const pending = list.find(isCreateRow);
      if (pending) {
        // Drop the sentinel; the real record takes its place once created.
        runCreate(pending.__inputValue, list.filter((o) => !isCreateRow(o)));
        return;
      }
      onChange(list);
      return;
    }
    if (isCreateRow(next)) {
      runCreate(next.__inputValue, []);
      return;
    }
    onChange(next ?? null);
  };

  return (
    <Autocomplete
      ref={rootRef}
      open={open}
      onOpen={(event) => {
        openedAtRef.current = Date.now();
        setOpen(true);
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        if (onOpen) onOpen(event);
      }}
      onClose={(event, reason) => {
        setOpen(false);
        if (onClose) onClose(event, reason);
      }}
      // 96px clears the fixed app bar; 320px below leaves room for the list.
      sx={[{ scrollMarginTop: '96px', scrollMarginBottom: '320px' }, ...(Array.isArray(userSx) ? userSx : [userSx || {}])]}
      componentsProps={{ ...componentsProps, popper: popperProps }}
      multiple={multiple}
      options={options}
      value={value}
      disabled={disabled || creating}
      // Names are not unique across records (two suppliers can share one), so
      // key by id — MUI otherwise falls back to the label and they collide.
      getOptionKey={(option) => (isCreateRow(option) ? CREATE_ID : option?.id)}
      getOptionLabel={labelOf}
      isOptionEqualToValue={(option, selected) => option?.id === selected?.id}
      onChange={handleChange}
      filterOptions={(all, state) => {
        const typed = state.inputValue.trim();
        const needle = typed.toLowerCase();
        const matches = needle
          ? all.filter((option) => labelOf(option).toLowerCase().includes(needle))
          : all.slice();
        // Offer creation only for text that isn't already an option — an exact
        // match means the user should pick the existing record, not clone it.
        const exists = all.some((option) => labelOf(option).toLowerCase() === needle);
        if (onCreate && typed && !exists) {
          matches.push({
            id: CREATE_ID,
            [labelKey]: createLabel(typed),
            __inputValue: typed,
            __isCreate: true,
          });
        }
        return matches;
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          {...textFieldProps}
          InputProps={{
            ...params.InputProps,
            ...(textFieldProps.InputProps || {}),
            endAdornment: (
              <>
                {creating ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
                {params.InputProps?.endAdornment}
              </>
            ),
          }}
        />
      )}
      {...restProps}
    />
  );
};

export default CreatableAutocomplete;
