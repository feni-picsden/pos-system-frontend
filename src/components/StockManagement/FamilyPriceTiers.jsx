import React from 'react';
import { Table, TableHead, TableBody, TableRow, TableCell } from '@mui/material';
import { defaultTiers } from '../../utils/familyOverride';

export default function FamilyPriceTiers({ product, emptyLabel = '—' }) {
  const tiers = defaultTiers(product);
  if (!tiers.length) return <span>{emptyLabel}</span>;

  return (
    <Table size="small" aria-label="Quantity and price" sx={{ maxWidth: 280, border: '1px solid #e5e7eb', '& th, & td': { fontSize: 14, py: 0.75, px: 1.5 }, '& th': { fontWeight: 700, bgcolor: '#f3f4f6' } }}>
      <TableHead><TableRow>
        <TableCell>Quantity</TableCell><TableCell align="right">Price</TableCell>
      </TableRow></TableHead>
      <TableBody>
        {tiers.map((tier, index) => (
          <TableRow key={`${tier.quantity}-${index}`}>
            <TableCell>{tier.quantity}</TableCell>
            <TableCell align="right">${tier.price.toFixed(2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FamilyMemberPriceRows({ member, cellSx }) {
  const tiers = defaultTiers(member);
  const rows = tiers.length ? tiers : [null];
  const category = (typeof member?.category === 'string' ? member.category : member?.category?.name) || '—';
  return rows.map((tier, index) => (
    <TableRow key={`${member.id}-${index}`}>
      {index === 0 && <>
        <TableCell rowSpan={rows.length} sx={cellSx}>
          {member.name}{member.isActive === false ? ' (inactive)' : ''}
        </TableCell>
        <TableCell rowSpan={rows.length} sx={cellSx}>{category}</TableCell>
      </>}
      <TableCell sx={{ ...cellSx, ...(index < rows.length - 1 ? { borderBottom: 'none' } : {}) }} align="center">{tier?.quantity ?? '—'}</TableCell>
      <TableCell sx={{ ...cellSx, ...(index < rows.length - 1 ? { borderBottom: 'none' } : {}), whiteSpace: 'nowrap' }} align="right">{tier ? `$${tier.price.toFixed(2)}` : '—'}</TableCell>
    </TableRow>
  ));
}
