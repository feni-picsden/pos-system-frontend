import React from 'react';
import { Box, Typography } from '@mui/material';

// Reference "nothing matched" states (user 18/11/2026), one look on every list.
// Glyphs are drawn as thin outline SVGs like the reference, not MUI's filled icons.

/** Thin outline magnifier (reference list pages). */
export const SearchGlyph = ({ size = 26, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-glyph="search">
    <circle cx="10.5" cy="10.5" r="7" />
    <line x1="15.6" y1="15.6" x2="21" y2="21" />
  </svg>
);

/** Outline page with a folded corner and a magnifier breaking out bottom-right
 *  (reference Product / Customer Utilities and Trashed Items). */
export const FileSearchGlyph = ({ size = 56, color = '#000' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-glyph="file-search">
    <path d="M13 2H5a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h8" />
    <path d="M13 2l6 6v4" />
    <path d="M13 2v6h6" />
    <circle cx="15.5" cy="16.5" r="3.5" />
    <line x1="18" y1="19" x2="21.5" y2="22.5" />
  </svg>
);

/** Ø - circle with the slash running past it (reference "No ..." blocks). */
export const EmptySetGlyph = ({ size = 140 }) => (
  <svg width={size} height={size} viewBox="0 0 140 140" aria-hidden="true" data-glyph="empty-set">
    <circle cx="70" cy="70" r="56" fill="none" stroke="#000" strokeWidth="10" />
    <line x1="10" y1="130" x2="130" y2="10" stroke="#000" strokeWidth="10" strokeLinecap="round" />
  </svg>
);

/** List pages: grey search icon + one line, no table. */
export function NoResults({ text = 'No results found. Try changing the search filters', sx }) {
  return (
    <Box
      data-testid="no-results"
      sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1.5, py: 6, color: '#676b72', fontSize: 19, ...sx }}
    >
      <SearchGlyph />
      <span>{text}</span>
    </Box>
  );
}

/** Utilities pages: big page-search glyph above one black line. */
export function NoResultsDoc({ text = 'No results found. Change search filters and try again.', sx }) {
  return (
    <Box data-testid="no-results-doc" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, mt: 5, ...sx }}>
      <FileSearchGlyph />
      <Typography sx={{ fontSize: 16, color: '#000' }}>{text}</Typography>
    </Box>
  );
}

const TickGlyph = () => (
  <svg width="140" height="110" viewBox="0 0 140 110" aria-hidden="true">
    <path d="M8 62 L46 100 L132 8" fill="none" stroke="#000" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Orders & Invoices / Statements: big glyph, bold title, one sub-line. */
export function EmptyBlock({ icon = 'none', title, subtitle, testId = 'empty-block' }) {
  return (
    <Box data-testid={testId} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, py: 6 }}>
      {icon === 'tick' ? <TickGlyph /> : <EmptySetGlyph />}
      <Box>
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 3 }}>{title}</Typography>
        <Typography sx={{ fontSize: 16, color: '#000' }}>{subtitle}</Typography>
      </Box>
    </Box>
  );
}

export default NoResults;
