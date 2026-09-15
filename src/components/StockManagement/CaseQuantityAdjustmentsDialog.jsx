import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlaceIcon from '@mui/icons-material/Place';
import Tooltip from '@mui/material/Tooltip';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';

// "Case Quantity Adjustments" (reference, measured 2026-09-15). A case-quantity
// change leaves two readings of the product's stock and cost figures, and this
// dialog is where one is picked — see utils/caseQuantityAdjust.js for the rules.
//
// Layout follows the reference: an outlet row and a "Global" row.
//   * INVENTORY sits on the outlet row only — stock is held at an outlet, so the
//     Global row has nothing to show there.
//   * COST is decided on the Global row. The reference lets an outlet carry its
//     own cost and greys the row out when it does not, saying so in a tooltip;
//     here a product has exactly one cost pair (Product.caseCost/itemCost in
//     schema.prisma — there is no per-outlet cost table), so the outlet row is
//     always the greyed "uses the Global cost" case.

const GREEN_HEADER = '#aaf0c8';
const SELECTED_BORDER = '#5ebbeb';

const pickerButtonSx = (selected) => ({
  // The pair shares its column rather than each holding a fixed width, so three
  // columns always fit the dialog instead of overflowing into a scrollbar.
  flex: 1,
  minWidth: 0,
  height: 38,
  borderRadius: '10px',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: 15,
  boxShadow: 'none',
  bgcolor: '#fff',
  color: selected ? '#1f6f9a' : '#313439',
  border: `2px solid ${selected ? SELECTED_BORDER : '#d5d7da'}`,
  '&:hover': { boxShadow: 'none', bgcolor: '#fff', borderColor: selected ? SELECTED_BORDER : '#9aa0a6' },
});

const valueCardSx = (selected) => ({
  position: 'relative',
  flex: 1,
  minWidth: 0,
  p: '8px 10px',
  borderRadius: '10px',
  cursor: 'pointer',
  bgcolor: '#f2f3f4',
  color: '#40474e',
  fontSize: 13,
  lineHeight: '17px',
  border: `2px solid ${selected ? SELECTED_BORDER : 'transparent'}`,
  textAlign: 'left',
});

// The blue tick the reference puts on the corner of whichever option is chosen.
const Tick = () => (
  <CheckCircleIcon
    sx={{
      position: 'absolute',
      top: -8,
      right: -8,
      fontSize: 18,
      color: SELECTED_BORDER,
      bgcolor: '#fff',
      borderRadius: '50%',
    }}
  />
);

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/** One inventory column cell: the headline pair, then the rest once expanded. */
const InventoryCell = ({ rows, side, selected, onSelect, expanded }) => {
  const [headline, ...rest] = rows;
  if (!headline) return null;
  const value = (row) => row[side];
  return (
    <Box sx={valueCardSx(selected)} onClick={onSelect} role="button" aria-pressed={selected}>
      {selected && <Tick />}
      <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: '17px' }}>
        {headline.pair.label}
      </Typography>
      <Box>{value(headline).cases} Cases</Box>
      <Box>{value(headline).items} Items</Box>
      {expanded
        ? rest.map((row) => (
            <Box key={row.pair.label} sx={{ mt: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, lineHeight: '17px' }}>
                {row.pair.label}
              </Typography>
              <Box>{value(row).cases} Cases</Box>
              <Box>{value(row).items} Items</Box>
            </Box>
          ))
        : rest.length > 0 && <Box sx={{ color: '#676b72' }}>+{rest.length} more fields</Box>}
    </Box>
  );
};

/**
 * One cost column cell — the case and item cost that option lands on.
 * `muted` is the outlet row, which shows what it will inherit but cannot be picked.
 */
const CostCell = ({ row, side, selected, onSelect, muted = false }) => (
  <Box
    sx={{
      ...valueCardSx(selected),
      ...(muted && {
        cursor: 'default',
        color: '#9aa0a6',
        bgcolor: '#f7f8f8',
        borderColor: selected ? '#cfd4d8' : 'transparent',
      }),
    }}
    onClick={muted ? undefined : onSelect}
    role={muted ? undefined : 'button'}
    aria-pressed={muted ? undefined : selected}
    aria-disabled={muted || undefined}
  >
    {selected && !muted && <Tick />}
    <Box>{money(row[side].caseCost)} Case</Box>
    <Box>{money(row[side].itemCost)} Item</Box>
  </Box>
);

const CaseQuantityAdjustmentsDialog = ({ open, adjustments, outletName, onKeepOld, onAccept, onClose }) => {
  // The reference preselects New in every column.
  const [picks, setPicks] = useState({ inventory: 'new', cost: 'new' });
  const [expanded, setExpanded] = useState(false);

  // Each opening starts from the reference's defaults rather than the last pick.
  React.useEffect(() => {
    if (open) {
      setPicks({ inventory: 'new', cost: 'new' });
      setExpanded(false);
    }
  }, [open]);

  if (!adjustments) return null;
  const { inventory, costs } = adjustments;
  const side = (choice) => (choice === 'old' ? 'old' : 'next');

  const columns = [
    { key: 'inventory', label: 'Inventory' },
    ...costs.map((row, i) => ({ key: 'cost', label: row.pair.label, costRow: row, costIndex: i })),
  ];

  const pickFor = (key) => picks[key];
  const choose = (key, choice) => setPicks((prev) => ({ ...prev, [key]: choice }));

  // A global admin edits the product without standing in an outlet, so there is no
  // outlet row to name — the Global row then carries the stock as well.
  const outletLabel = outletName && outletName !== 'Global' ? outletName : null;
  const rows = outletLabel
    ? [
        // Stock lives at the outlet; its cost is inherited, so it is shown greyed.
        { key: 'outlet', label: outletLabel, pin: true, showInventory: true, costMuted: true },
        { key: 'global', label: 'Global', showInventory: false, costMuted: false },
      ]
    : [{ key: 'global', label: 'Global', showInventory: true, costMuted: false }];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: '10px', overflow: 'hidden' } }}
    >
      <Box sx={{ bgcolor: GREEN_HEADER, px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditOutlinedIcon sx={{ fontSize: 20, color: '#1b7a45' }} />
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#1b7a45' }}>
          Case Quantity Adjustments
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, py: 3 }}>
        <Typography sx={{ fontSize: 15, color: '#313439', mb: 2 }}>
          Case Quantity has changed, select the correct adjustments for inventory levels and costs
        </Typography>

        {/* Only offered when there is something folded away to show. */}
        {inventory.length > 1 && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <ShopfrontSwitch checked={expanded} onChange={(e) => setExpanded(e.target.checked)} />
            <Typography sx={{ ml: 2, fontSize: 15 }}>Show more inventory fields</Typography>
          </Box>
        )}

        {/* One grid for all three rows: the columns SHARE the width instead of each
            claiming a fixed one, so Average Cost can never be pushed off the edge
            behind a scrollbar. Below tablet width the grid drops the label column
            and scrolls as a last resort rather than squashing the figures. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '104px repeat(3, minmax(190px, 1fr))', sm: '132px repeat(3, minmax(0, 1fr))' },
            // No row gap, and every cell stretches to its row's full height: the
            // left borders then join into the continuous rules the reference draws
            // between the three column groups. Letting cells size to their own
            // content instead left the short cost columns with stubby lines that
            // stopped well above the tall inventory one.
            rowGap: 0,
            alignItems: 'stretch',
            overflowX: { xs: 'auto', sm: 'visible' },
            // Every cell but the label column carries the rule and its own gutter.
            // nth-CHILD, not nth-of-type: the heading cells render as <p> and the
            // rest as <div>, so counting by tag would fall out of step.
            '& > *:not(:nth-child(4n + 1))': { borderLeft: '1px solid #e3e5e7', px: 2 },
            '& > *': { py: 1 },
          }}
        >
          {/* Column group headings */}
          <Box />
          {columns.map((col, i) => (
            <Typography key={`h-${col.label}-${i}`} sx={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
              {col.label}
            </Typography>
          ))}

          {/* Old / New pickers — the reference puts these on an "Outlet" row */}
          <Box sx={{ fontSize: 15, fontWeight: 600, color: '#40474e', display: 'flex', alignItems: 'center' }}>
            Outlet
          </Box>
          {columns.map((col, i) => (
            <Box key={`pick-${col.label}-${i}`} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              {['old', 'new'].map((choice) => (
                <Button
                  key={choice}
                  onClick={() => choose(col.key, choice)}
                  sx={pickerButtonSx(pickFor(col.key) === choice)}
                >
                  {choice === 'old' ? 'Old' : 'New'}
                </Button>
              ))}
            </Box>
          ))}

          {/* The outlet row holds the stock and inherits the cost (greyed); the
              Global row is where cost is actually decided. */}
          {rows.map((row) => (
            <React.Fragment key={row.key}>
              {/* The cells stretch so the column rules stay continuous; what is
                  INSIDE them hugs the top, level with the first line of figures. */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, pt: 2 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#40474e' }}>
                  {row.label}
                </Typography>
                {row.pin && <PlaceIcon sx={{ fontSize: 16, color: '#5ebbeb', mt: '2px' }} />}
              </Box>
              {columns.map((col, i) => (
                <Box
                  key={`${row.key}-${col.label}-${i}`}
                  sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                >
                  {col.key === 'inventory' ? (
                    row.showInventory
                      ? ['old', 'new'].map((choice) => (
                          <InventoryCell
                            key={choice}
                            rows={inventory}
                            side={side(choice)}
                            selected={pickFor('inventory') === choice}
                            onSelect={() => choose('inventory', choice)}
                            expanded={expanded}
                          />
                        ))
                      : null
                  ) : row.costMuted ? (
                    <Tooltip title={`${row.label} uses the Global cost`} placement="top" arrow>
                      <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minWidth: 0 }}>
                        {['old', 'new'].map((choice) => (
                          <CostCell
                            key={choice}
                            row={col.costRow}
                            side={side(choice)}
                            selected={pickFor('cost') === choice}
                            muted
                          />
                        ))}
                      </Box>
                    </Tooltip>
                  ) : (
                    ['old', 'new'].map((choice) => (
                      <CostCell
                        key={choice}
                        row={col.costRow}
                        side={side(choice)}
                        selected={pickFor('cost') === choice}
                        onSelect={() => choose('cost', choice)}
                      />
                    ))
                  )}
                </Box>
              ))}
            </React.Fragment>
          ))}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        {/* Both colours are pinned with `&&` so neither the app's MuiButton theme
            override nor the contained variant's own palette can win and leave the
            label unreadable against its own background. */}
        <Button
          variant="contained"
          disableElevation
          onClick={onKeepOld}
          sx={{
            '&&': { bgcolor: '#e9eaec', color: '#40474e' },
            '&&:hover': { bgcolor: '#dcdee1' },
            textTransform: 'none',
            borderRadius: '10px',
            height: 42,
            px: 4,
            fontWeight: 700,
            boxShadow: 'none',
          }}
        >
          Keep Old
        </Button>
        <Button
          variant="contained"
          disableElevation
          onClick={() => onAccept(picks)}
          sx={{
            '&&': { bgcolor: '#22c55e', color: '#ffffff' },
            '&&:hover': { bgcolor: '#4ade80' },
            textTransform: 'none',
            borderRadius: '10px',
            height: 42,
            px: 4,
            fontWeight: 700,
            boxShadow: 'none',
          }}
        >
          Accept Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CaseQuantityAdjustmentsDialog;
