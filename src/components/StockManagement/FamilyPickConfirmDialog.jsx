import React from 'react';
import { Alert, Box, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ShopfrontDialog, { DialogButton } from '../Common/ShopfrontDialog';
import { familyCategoryCheck } from '../../utils/familyOverride';
import FamilyPriceTiers, { FamilyMemberPriceRows } from './FamilyPriceTiers';

// Asked before a product joins a family whose products are from a DIFFERENT category
// (our own safety net — the reference asks nothing). Joining changes no price by
// itself, but the product can then take the family's prices with one click, a price
// edit on any member is carried to all of them, and members on the same price points
// are added together for quantity deals at the till — so the wrong family is a pricing
// mistake, not a label. The dialog shows who is already in the family.
const cellSx = { fontSize: 14, py: 0.75, px: 1, borderBottom: '1px solid #e5e7eb' };
const headSx = { ...cellSx, fontWeight: 700, color: '#313439' };

const FamilyPickConfirmDialog = ({ open, family, members = [], product, onConfirm, onCancel }) => {
  if (!open || !family) return null;

  const { mismatch, familyCategories } = familyCategoryCheck(product?.category, members);

  return (
    <ShopfrontDialog
      open={open}
      onClose={onCancel}
      title={`Add to family "${family.name}"?`}
      width={640}
      actions={
        <>
          <DialogButton tone="cancel" onClick={onCancel}>Cancel</DialogButton>
          <DialogButton tone={mismatch ? 'danger' : 'primary'} onClick={onConfirm}>
            {mismatch ? 'Add anyway' : 'Add to family'}
          </DialogButton>
        </>
      }
    >
      {mismatch && (
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left', fontSize: 15 }}>
          <strong>{product?.name || 'This product'}</strong> is in the category{' '}
          <strong>{product.category}</strong>, but this family holds{' '}
          <strong>{familyCategories.join(', ')}</strong> products.
        </Alert>
      )}

      <Typography sx={{ fontSize: 15, textAlign: 'left', mb: 2 }}>
        A family is a group of products sold at the <strong>same prices</strong>. This product keeps
        its own prices until you choose to take the
        family&apos;s — but a price change on any product in the family is carried to all of them.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, textAlign: 'left', mb: 0.5 }}>
          This product&apos;s prices
        </Typography>
        <FamilyPriceTiers product={product} emptyLabel="none yet" />
      </Box>

      <Typography sx={{ fontSize: 14, fontWeight: 700, textAlign: 'left', mb: 0.5 }}>
        Products already in this family
      </Typography>
      <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #e5e7eb' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>Product</TableCell>
              <TableCell sx={headSx}>Category</TableCell>
              <TableCell sx={headSx} align="center">Quantity</TableCell>
              <TableCell sx={headSx} align="right">Price</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((m) => (
              <FamilyMemberPriceRows key={m.id} member={m} cellSx={cellSx} />
            ))}
          </TableBody>
        </Table>
      </Box>
    </ShopfrontDialog>
  );
};

export default FamilyPickConfirmDialog;
