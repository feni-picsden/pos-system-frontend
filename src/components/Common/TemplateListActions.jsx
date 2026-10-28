import React from 'react';
import { Box } from '@mui/material';

// Reference Setup list row actions (Statements / Receipts): an inline
// `ul.actions` of coloured text links with a FontAwesome-light glyph each —
// Edit (green), Configure (blue), Delete (red), Clone (blue). FontAwesome is not
// installed, so each glyph is the reference path inline.
const ICONS = {
  pencil: { viewBox: '0 0 512 512', d: 'M410.3 231l11.3-11.3-33.9-33.9-62.1-62.1L291.7 89.8l-11.3 11.3-22.6 22.6L58.6 322.9c-10.4 10.4-18 23.3-22.2 37.4L1 480.7c-2.5 8.4-.2 17.5 6.1 23.7s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L387.7 253.7 410.3 231zM160 399.4l-9.1 22.7c-4 3.1-8.5 5.4-13.3 6.9L59.4 452l23-78.1c1.4-4.9 3.8-9.4 6.9-13.3l22.7-9.1v32c0 8.8 7.2 16 16 16h32zM362.7 18.7L348.3 33.2 325.7 55.8 314.3 67.1l33.9 33.9 62.1 62.1 33.9 33.9 11.3-11.3 22.6-22.6 14.5-14.5c25-25 25-65.5 0-90.5L453.3 18.7c-25-25-65.5-25-90.5 0zm-47.4 168l-144 144c-6.2 6.2-16.4 6.2-22.6 0s-6.2-16.4 0-22.6l144-144c6.2-6.2 16.4-6.2 22.6 0s6.2 16.4 0 22.6z' },
  cogs: { viewBox: '0 0 640 512', d: 'M308.5 135.3c7.1-6.3 9.9-16.2 6.2-25c-2.3-5.3-4.8-10.5-7.6-15.5L304 89.4c-3-5-6.3-9.9-9.8-14.6c-5.7-7.6-15.7-10.1-24.7-7.1l-28.2 9.3c-10.7-8.8-23-16-36.2-20.9L199 27.1c-1.9-9.3-9.1-16.7-18.5-17.8C173.9 8.4 167.2 8 160.4 8h-.7c-6.8 0-13.5 .4-20.1 1.2c-9.4 1.1-16.6 8.6-18.5 17.8L115 56.1c-13.3 5-25.5 12.1-36.2 20.9L50.5 67.8c-9-3-19-.5-24.7 7.1c-3.5 4.7-6.8 9.6-9.9 14.6l-3 5.3c-2.8 5-5.3 10.2-7.6 15.5c-3.7 8.7-.9 18.6 6.2 25l22.2 19.8C32.6 161.9 32 168.9 32 176s.6 14.1 1.7 20.9L11.5 216.7c-7.1 6.3-9.9 16.2-6.2 25c2.3 5.3 4.8 10.5 7.6 15.5l3 5.3c3 5 6.3 9.9 9.9 14.6c5.7 7.6 15.7 10.1 24.7 7.1l28.2-9.3c10.7 8.8 23 16 36.2 20.9l6.1 29.1c1.9 9.3 9.1 16.7 18.5 17.8c6.7 .8 13.5 1.2 20.4 1.2s13.7-.4 20.4-1.2c9.4-1.1 16.6-8.6 18.5-17.8l6.1-29.1c13.3-5 25.5-12.1 36.2-20.9l28.2 9.3c9 3 19 .5 24.7-7.1c3.5-4.7 6.8-9.5 9.8-14.6l3.1-5.4c2.8-5 5.3-10.2 7.6-15.5c3.7-8.7 .9-18.6-6.2-25l-22.2-19.8c1.1-6.8 1.7-13.8 1.7-20.9s-.6-14.1-1.7-20.9l22.2-19.8zM112 176a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zM504.7 500.5c6.3 7.1 16.2 9.9 25 6.2c5.3-2.3 10.5-4.8 15.5-7.6l5.3-3.1c5-3 9.9-6.3 14.6-9.8c7.6-5.7 10.1-15.7 7.1-24.7l-9.3-28.2c8.8-10.7 16-23 20.9-36.2l29.1-6.1c9.3-1.9 16.7-9.1 17.8-18.5c.8-6.7 1.2-13.5 1.2-20.4s-.4-13.7-1.2-20.4c-1.1-9.4-8.6-16.6-17.8-18.5L583.8 307c-5-13.3-12.1-25.5-20.9-36.2l9.3-28.2c3-9 .5-19-7.1-24.7c-4.7-3.5-9.6-6.8-14.6-9.9l-5.3-3c-5-2.8-10.2-5.3-15.5-7.6c-8.7-3.7-18.6-.9-25 6.2l-19.8 22.2c-6.8-1.1-13.8-1.7-20.9-1.7s-14.1 .6-20.9 1.7l-19.8-22.2c-6.3-7.1-16.2-9.9-25-6.2c-5.3 2.3-10.5 4.8-15.5 7.6l-5.3 3c-5 3-9.9 6.3-14.6 9.9c-7.6 5.7-10.1 15.7-7.1 24.7l9.3 28.2c-8.8 10.7-16 23-20.9 36.2L307.1 313c-9.3 1.9-16.7 9.1-17.8 18.5c-.8 6.7-1.2 13.5-1.2 20.4s.4 13.7 1.2 20.4c1.1 9.4 8.6 16.6 17.8 18.5l29.1 6.1c5 13.3 12.1 25.5 20.9 36.2l-9.3 28.2c-3 9-.5 19 7.1 24.7c4.7 3.5 9.5 6.8 14.6 9.8l5.4 3.1c5 2.8 10.2 5.3 15.5 7.6c8.7 3.7 18.6 .9 25-6.2l19.8-22.2c6.8 1.1 13.8 1.7 20.9 1.7s14.1-.6 20.9-1.7l19.8 22.2zM464 304a48 48 0 1 1 0 96 48 48 0 1 1 0-96z' },
  trash: { viewBox: '0 0 448 512', d: 'M135.2 17.7L128 32 32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-96 0-7.2-14.3C307.4 6.8 296.3 0 284.2 0L163.8 0c-12.1 0-23.2 6.8-28.6 17.7zM416 128L32 128 53.2 467c1.6 25.3 22.6 45 47.9 45l245.8 0c25.3 0 46.3-19.7 47.9-45L416 128z' },
  clone: { viewBox: '0 0 512 512', d: 'M64 464l224 0c8.8 0 16-7.2 16-16l0-64 48 0 0 64c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64L0 224c0-35.3 28.7-64 64-64l64 0 0 48-64 0c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16zM224 304l224 0c8.8 0 16-7.2 16-16l0-224c0-8.8-7.2-16-16-16L224 48c-8.8 0-16 7.2-16 16l0 224c0 8.8 7.2 16 16 16zm-64-16l0-224c0-35.3 28.7-64 64-64L448 0c35.3 0 64 28.7 64 64l0 224c0 35.3-28.7 64-64 64l-224 0c-35.3 0-64-28.7-64-64z' },
};

const Glyph = ({ name }) => (
  <i className={`fal fa-${name} fa-fw shopfront-icon`} aria-hidden="true">
    <svg viewBox={ICONS[name].viewBox} fill="currentColor" focusable="false"><path d={ICONS[name].d} /></svg>
  </i>
);

export const templateListActionsSx = {
  display: 'block',
  whiteSpace: 'nowrap',
  listStyle: 'none',
  m: 0,
  p: 0,
  '& li': {
    display: 'inline-block', letterSpacing: 'normal', height: 19, p: '0 8px', m: 0, borderRadius: 0,
    fontSize: 16, fontWeight: 400, lineHeight: '19px', cursor: 'pointer', transition: 'all 0s', userSelect: 'none', whiteSpace: 'nowrap',
  },
  '& li > i.fal': {
    width: 20, height: 16, mr: '8px', fontWeight: 300, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    verticalAlign: 'middle', flexShrink: 0, '& svg': { width: 14, height: 14 },
  },
  '& li.action-edit': { color: '#32b643', '&:hover': { color: '#6dd77b' } },
  '& li.action-view': { color: '#1c86f2', '&:hover': { color: '#73b4f7' } },
  '& li.action-delete': { color: '#e3342f', '&:hover': { color: '#f3aaa8' } },
  '& li.action-clone': { color: '#1c86f2', '&:hover': { color: '#73b4f7' } },
};

// Same bordered table every Setup template list uses (reference): 1px black
// cell borders, centred bold headers, near-white rows.
export const templateListHeadSx = {
  '& th': { bgcolor: 'transparent', color: '#000', fontWeight: 700, fontSize: 16, border: '1px solid #000', borderRadius: 0, height: 36, lineHeight: '20px', p: '8px', textAlign: 'center' },
};
export const templateListBodySx = {
  '& tr': { bgcolor: '#f8f8f8', height: 52 },
  '& td': { border: '1px solid #000', fontSize: 16, fontWeight: 400, lineHeight: '20px', color: '#000', p: '16px' },
};

const TemplateListActions = ({ onEdit, onConfigure, onDelete, onClone }) => (
  <Box component="ul" className="actions" sx={templateListActionsSx}>
    {onEdit && <li className="action-edit action-locked" onClick={onEdit}><Glyph name="pencil" />Edit</li>}
    {onConfigure && <li className="action-view action-locked" onClick={onConfigure}><Glyph name="cogs" />Configure</li>}
    {onDelete && <li className="action-delete action-locked" onClick={onDelete}><Glyph name="trash" />Delete</li>}
    {onClone && <li className="action-clone action-locked" onClick={onClone}><Glyph name="clone" />Clone</li>}
  </Box>
);

export default TemplateListActions;
