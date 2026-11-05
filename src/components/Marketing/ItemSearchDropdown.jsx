import { Box, Paper, Typography } from '@mui/material';
import {
  CropOriginal as ImageIcon,
  CakeOutlined as CategoryIcon,
  HomeOutlined as FamilyIcon,
  LocalOfferOutlined as TagIcon,
  Snooze as InactiveIcon
} from '@mui/icons-material';

// Reference item search dropdown (Express editor + Advanced criteria items panel,
// live 05/11/2026): square panel with a 1px dark frame, drop shadow and a 3px sky
// line along the bottom. One character shows "Start typing to search...", no
// match "No search results found."; results are grouped (CATEGORIES ... PRODUCTS)
// with a glyph per type and the typed text coloured sky inside each name.

const Highlight = ({ text, term }) => {
  const t = String(text || '');
  const q = String(term || '').trim();
  if (!q) return t;
  const lower = t.toLowerCase();
  const ql = q.toLowerCase();
  const parts = [];
  let from = 0;
  for (;;) {
    const idx = lower.indexOf(ql, from);
    if (idx < 0) break;
    parts.push(t.slice(from, idx));
    parts.push(<Box key={idx} component="span" sx={{ color: '#5ebbeb' }}>{t.slice(idx, idx + q.length)}</Box>);
    from = idx + q.length;
  }
  parts.push(t.slice(from));
  return <>{parts}</>;
};

import { GROUP_ORDER, GROUP_LABEL, groupOf } from '../../utils/itemSearchGroups';

const glyphFor = (g) => (g === 'PRODUCT' ? ImageIcon : g === 'FAMILY' ? FamilyIcon : g === 'CATEGORY' ? CategoryIcon : TagIcon);

const panelSx = {
  position: 'absolute',
  left: 0,
  right: 0,
  zIndex: 20,
  border: '1px solid #404040',
  borderBottom: '3px solid #5ebbeb',
  boxShadow: '0 6px 12px rgba(0,0,0,0.25)'
};

/**
 * @param {{term:string, results:Array, loading?:boolean, top?:number,
 *   onPick:(r)=>void, activeIndex?:number}} props
 */
const ItemSearchDropdown = ({ term, results, loading = false, top = 58, onPick, activeIndex = -1 }) => {
  const q = String(term || '').trim();
  if (!q) return null;
  if ((results || []).length === 0) {
    return (
      <Paper square elevation={0} sx={{ ...panelSx, top, px: '18px', py: '12px' }}>
        <Typography sx={{ fontSize: 18, color: '#000', lineHeight: '24px' }}>
          {q.length < 2 ? 'Start typing to search...' : loading ? 'Searching...' : 'No search results found.'}
        </Typography>
      </Paper>
    );
  }
  let flat = -1;
  return (
    <Paper square elevation={0} sx={{ ...panelSx, top, maxHeight: 480, overflowY: 'scroll', px: '14px', pt: '8px', pb: '6px' }}>
      {GROUP_ORDER.filter((g) => results.some((r) => groupOf(r) === g)).map((g) => (
        <Box key={g}>
          <Typography sx={{ fontSize: 16, color: '#9e9e9e', letterSpacing: 0.5, lineHeight: '20px', pt: '10px', pb: '4px' }}>{GROUP_LABEL[g]}</Typography>
          {results.map((r) => {
            if (groupOf(r) !== g) return null;
            flat += 1;
            const inactive = g === 'PRODUCT' && r.isActive === false;
            const Glyph = inactive ? InactiveIcon : glyphFor(g);
            const active = flat === activeIndex;
            return (
              <Box
                key={`${r.resultType}-${r.id}`}
                onClick={() => onPick(r)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  height: 41,
                  cursor: 'pointer',
                  bgcolor: active ? '#f0f0f0' : 'transparent',
                  '&:hover': { backgroundColor: '#f5f5f5' }
                }}
              >
                <Glyph sx={{ fontSize: 22, color: '#404040' }} />
                <Typography sx={{ fontSize: 18, color: '#404040', lineHeight: '24px', flex: 1, minWidth: 0 }}>
                  <Highlight text={r.name} term={q} />
                </Typography>
                {inactive && <Typography sx={{ fontSize: 18, color: '#9e9e9e', pr: '14px' }}>Inactive</Typography>}
              </Box>
            );
          })}
        </Box>
      ))}
    </Paper>
  );
};

export default ItemSearchDropdown;
