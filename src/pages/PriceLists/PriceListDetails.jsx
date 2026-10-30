import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Typography,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  HomeOutlined as HomeIcon,
  GroupsOutlined as CustomersIcon,
  History as RevisionsIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOutlined as ViewIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import priceListService from '../../services/priceListService';
import productService from '../../services/productService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { GRID_TABLE_SX, WIDGET_SHADOW, SECTION_ROOT_SX } from '../../components/StockManagement/productViewStyles';
import { formatRuleLabel, formatMinimumRule, entityTypeLabel, overrideTiers, money } from './ruleLabels';

// Shopfront's price list VIEW page (reference, 29/10/2026 screenshots):
//   left panel  - "View <name>", Home / Customers / Revisions, Edit + Delete
//   Home        - Allow Higher Prices / Allow Discounting Promotions card, then an
//                 Item / Type / Rule / Minimum Rule / Details table (the fallback
//                 is the last row, "All Other Products")
//   Details     - right-hand drawer: type, name, included/excluded, Price Rule
//                 (override rules show a Quantity / Price / Cost / % table)
//   Customers   - everyone sold at this list (own list or via their group)
//   Revisions   - Field / From / To / User / Timestamp, newest first
// Nothing here writes except Delete.

const NAV_ITEMS = [
  { id: 'home', label: 'Home', hint: 'View price list details', icon: <HomeIcon sx={{ fontSize: 22 }} /> },
  { id: 'customers', label: 'Customers', hint: 'View the price list customers', icon: <CustomersIcon sx={{ fontSize: 22 }} /> },
  { id: 'revisions', label: 'Revisions', hint: 'View the price list revisions', icon: <RevisionsIcon sx={{ fontSize: 22 }} /> },
];

// Rounded light-blue header row shared by the Home, Customers and drawer tables.
const blueHeaderSx = {
  '& th': { bgcolor: '#5ebbeb', color: '#f8f8f8', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
};

const bodySx = {
  '& td': { border: 0, fontSize: 16, color: '#000', py: 2.25 },
};

const linkSx = {
  color: '#1c86f2',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  minWidth: 0,
  px: 1,
  transition: 'all 0s ease',
  '&:hover': { bgcolor: 'transparent', textDecoration: 'none' },
};

const outlineButtonSx = (color) => ({
  // Same pill style as the Classification view page: outline only, light grey tint on hover.
  width: '100%',
  height: 42,
  mb: 1,
  px: '32px',
  bgcolor: 'transparent',
  color,
  border: `1px solid ${color}`,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: `1px solid ${color}`, boxShadow: 'none' },
});

const formatDateTime = (isoDate) => {
  try {
    return new Date(isoDate)
      .toLocaleString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      })
      .replace(',', '');
  } catch {
    return '-';
  }
};

// Revision cells: the "Items" / "Fallback Rule" rows carry a rule snapshot
// ([{ name, type, lines[] }]) - each rule prints as a bold name over its lines,
// the way the reference lays out its From / To columns.
const RevisionValue = ({ value }) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (Array.isArray(value)) {
    if (!value.length) return 'None';
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {value.map((item, i) => (
          <Box key={`${item?.name || 'item'}-${i}`}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000', mb: 0.5 }}>{item?.name || '-'}</Typography>
            {(item?.lines || []).map((line, j) => (
              <Typography key={j} sx={{ fontSize: 16, color: '#000' }}>{line}</Typography>
            ))}
            {/* reference: override prices as a small bold-header "Quantity | Price" grid */}
            {Array.isArray(item?.tiers) && item.tiers.length > 0 && (
              <Box
                component="table"
                sx={{
                  borderCollapse: 'collapse',
                  '& th, & td': { border: '1px solid #000', px: 1, py: 0.75, fontSize: 16, color: '#000', textAlign: 'left' },
                  '& th': { fontWeight: 700 },
                }}
              >
                <thead>
                  <tr><th>Quantity</th><th>Price</th></tr>
                </thead>
                <tbody>
                  {item.tiers.map((t, k) => (
                    <tr key={k}><td>{t.quantity}</td><td>${t.price}</td></tr>
                  ))}
                </tbody>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    );
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const PriceListDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priceList, setPriceList] = useState(null);
  const [configuration, setConfiguration] = useState({ rules: [], fallbackRule: null });
  const [activeTab, setActiveTab] = useState('home');

  const [customers, setCustomers] = useState(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [revisions, setRevisions] = useState(null);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  const [detail, setDetail] = useState(null); // { rule, isFallback, unitCost }
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [listRes, configRes] = await Promise.all([
          priceListService.getPriceList(id),
          priceListService.getPriceListConfiguration(id).catch(() => null),
        ]);
        if (cancelled) return;
        setPriceList(listRes.priceList);
        setConfiguration(configRes?.configuration || { rules: [], fallbackRule: null });
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load price list');
        console.error('Error loading price list:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Customers / Revisions load on first visit to their tab only.
  useEffect(() => {
    if (activeTab === 'customers' && customers === null && !customersLoading) {
      setCustomersLoading(true);
      priceListService.getPriceListCustomers(id)
        .then((res) => setCustomers(res?.customers || []))
        .catch((err) => { setCustomers([]); setError(err.response?.data?.error || 'Failed to load customers'); })
        .finally(() => setCustomersLoading(false));
    }
    if (activeTab === 'revisions' && revisions === null && !revisionsLoading) {
      setRevisionsLoading(true);
      priceListService.getPriceListRevisions(id)
        .then((res) => setRevisions(res?.revisions || []))
        .catch((err) => { setRevisions([]); setError(err.response?.data?.error || 'Failed to load revisions'); })
        .finally(() => setRevisionsLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  const openDetails = (rule, isFallback = false) => {
    setDetail({ rule, isFallback, unitCost: Number(rule?.cost) || 0 });
    // Override tiers show cost + profit %, so fetch the product's current cost.
    if (!isFallback && rule?.pricingMethod === 'override' && (rule.entityType || 'product') === 'product' && rule.entityId) {
      productService.getProduct(rule.entityId)
        .then((res) => {
          const p = res?.product;
          const cost = Number(p?.itemCost ?? p?.cost ?? p?.replacementCost);
          if (Number.isFinite(cost)) {
            setDetail((d) => (d && d.rule === rule ? { ...d, unitCost: cost } : d));
          }
        })
        .catch(() => {});
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await priceListService.deletePriceList(id);
      navigate('/customers/price-lists');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete price list');
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  const rules = configuration.rules || [];
  const fallbackRule = configuration.fallbackRule;
  const allowHigher = Boolean(configuration.allowHigherPrice);
  const allowPromos = Boolean(configuration.allowDiscountingPromotions);

  const flag = (on) => (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 16, color: '#000' }}>
      {on
        ? <CheckIcon sx={{ fontSize: 18, color: '#32b643' }} />
        : <CloseIcon sx={{ fontSize: 18, color: '#e33430' }} />}
      {on ? 'Enabled' : 'Disabled'}
    </Box>
  );

  const renderHome = () => (
    <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          textAlign: 'center',
          p: 2,
          mb: 3,
          bgcolor: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>Allow Higher Prices</Typography>
          {flag(allowHigher)}
        </Box>
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>Allow Discounting Promotions</Typography>
          {flag(allowPromos)}
        </Box>
      </Box>

      <TableContainer>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow sx={blueHeaderSx}>
              <TableCell sx={{ width: '34%' }}>Item</TableCell>
              <TableCell sx={{ width: '17%' }}>Type</TableCell>
              <TableCell sx={{ width: '17%' }}>Rule</TableCell>
              <TableCell sx={{ width: '18%' }}>Minimum Rule</TableCell>
              <TableCell sx={{ width: '14%' }} />
            </TableRow>
          </TableHead>
          <TableBody sx={bodySx}>
            {rules.map((rule, index) => (
              <TableRow key={rule.id ?? `${rule.entityType}-${rule.entityId}-${index}`}>
                <TableCell>{rule.entityName}</TableCell>
                <TableCell>{entityTypeLabel(rule.entityType)}</TableCell>
                <TableCell sx={{ color: rule.excludeFromPriceList ? '#e33430 !important' : undefined }}>{formatRuleLabel(rule)}</TableCell>
                <TableCell sx={{ color: ['No Minimum', 'N/A'].includes(formatMinimumRule(rule)) ? '#6b7280 !important' : undefined }}>{formatMinimumRule(rule)}</TableCell>
                <TableCell>
                  <Button disableRipple startIcon={<ViewIcon />} onClick={() => openDetails(rule)} sx={linkSx}>
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {fallbackRule && (
              <TableRow>
                <TableCell>All Other Products</TableCell>
                <TableCell>Fallback</TableCell>
                <TableCell>{formatRuleLabel(fallbackRule)}</TableCell>
                <TableCell sx={{ color: formatMinimumRule(fallbackRule) === 'No Minimum' ? '#6b7280 !important' : undefined }}>{formatMinimumRule(fallbackRule)}</TableCell>
                <TableCell>
                  <Button disableRipple startIcon={<ViewIcon />} onClick={() => openDetails(fallbackRule, true)} sx={linkSx}>
                    Details
                  </Button>
                </TableCell>
              </TableRow>
            )}
            {rules.length === 0 && !fallbackRule && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6, color: '#6b7280 !important' }}>
                  This price list is empty
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );

  const renderCustomers = () => (
    customersLoading || customers === null ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
    ) : (
      <TableContainer>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow sx={blueHeaderSx}>
              <TableCell>Customer</TableCell>
              <TableCell sx={{ width: 140 }} />
            </TableRow>
          </TableHead>
          <TableBody sx={bodySx}>
            {customers.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell align="right">
                  <Button disableRipple startIcon={<ViewIcon />} component={RouterLink} to={`/customers/${c.id}/view`} sx={linkSx}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {customers.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} align="center" sx={{ py: 6, color: '#6b7280 !important' }}>
                  No customers are using this price list
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    )
  );

  const renderRevisions = () => (
    revisionsLoading || revisions === null ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>
    ) : (
      <Box>
        <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>
          Please Note: Revisions may take up to five minutes to appear
        </Typography>
        <TableContainer sx={{ ...SECTION_ROOT_SX, p: 0 }}>
          <Table sx={{ ...GRID_TABLE_SX, tableLayout: 'fixed', '& thead tr': { backgroundColor: '#fff', boxShadow: WIDGET_SHADOW }, '& td': { verticalAlign: 'top' } }}>
            <TableHead>
              <TableRow>
                {[['Field', '9%'], ['From', '31%'], ['To', '31%'], ['User', '9%'], ['Timestamp', '20%']].map(([h, w]) => (
                  <TableCell key={h} sx={{ width: w }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {revisions.length > 0 ? (
                revisions.map((rev, idx) => (
                  <TableRow key={`rev-${idx}`}>
                    <TableCell>{rev.field}</TableCell>
                    <TableCell><RevisionValue value={rev.from} /></TableCell>
                    <TableCell><RevisionValue value={rev.to} /></TableCell>
                    <TableCell>{rev.user || '-'}</TableCell>
                    <TableCell>{formatDateTime(rev.timestamp)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center">No revisions found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    )
  );

  const detailRule = detail?.rule;
  const detailTiers = detailRule ? overrideTiers(detailRule) : [];

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 50px)', bgcolor: '#fff' }}>
      {/* Left panel */}
      <Box sx={{ width: 320, flexShrink: 0, bgcolor: '#e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <Typography component="h1" sx={{ fontSize: 20, fontWeight: 700, color: '#000', m: 0, px: 2, py: 3 }}>
          View {priceList?.name || ''}
        </Typography>
        <Box sx={{ flex: 1, py: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <Box
                key={item.id}
                role="button"
                tabIndex={0}
                aria-current={active ? 'page' : undefined}
                onClick={() => setActiveTab(item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveTab(item.id); } }}
                sx={{
                  ml: 2,
                  mr: active ? 0 : 0,
                  mb: 1,
                  px: 3,
                  py: 1.25,
                  cursor: 'pointer',
                  bgcolor: active ? '#fff' : 'transparent',
                  borderTopLeftRadius: 8,
                  borderBottomLeftRadius: 8,
                  boxShadow: active ? '0 1px 6px rgba(0,0,0,0.18)' : 'none',
                  transition: 'background 0.15s ease, box-shadow 0.15s ease',
                  '&:hover': { bgcolor: active ? '#fff' : '#d6dee8' },
                  '&:focus-visible': { outline: '2px solid #5ebbeb', outlineOffset: '-2px' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#000' }}>
                  {item.icon}
                  <Typography sx={{ fontSize: 20, color: '#000' }}>{item.label}</Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: '#313439', ml: '30px' }}>{item.hint}</Typography>
              </Box>
            );
          })}
        </Box>
        <Box sx={{ px: 2, pb: 2 }}>
          <Button
            disableElevation
            startIcon={<EditIcon />}
            component={RouterLink}
            to={`/customers/price-lists/${id}/configuration`}
            sx={outlineButtonSx('#32b643')}
          >
            Edit
          </Button>
          <Button
            disableElevation
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteOpen(true)}
            sx={outlineButtonSx('#e33430')}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0, px: 4, py: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {activeTab === 'home' && renderHome()}
        {activeTab === 'customers' && renderCustomers()}
        {activeTab === 'revisions' && renderRevisions()}
      </Box>

      {/* Details drawer: dark overlay + right-hand panel sliding in (reference) */}
      {detailRule && (
        <Box
          onClick={() => setDetail(null)}
          sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, animation: 'plDrawerFade 180ms ease', '@keyframes plDrawerFade': { from: { opacity: 0 }, to: { opacity: 1 } } }}
        >
          <Box
            role="dialog"
            aria-label="Rule details"
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: 512,
              maxWidth: '100vw',
              p: 3,
              boxSizing: 'border-box',
              bgcolor: '#fff',
              overflowY: 'auto',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.2)',
              animation: 'plDrawerIn 220ms ease',
              '@keyframes plDrawerIn': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
            }}
          >
            <IconButton aria-label="Close" onClick={() => setDetail(null)} sx={{ position: 'absolute', top: 12, right: 12, color: '#000' }}>
              <CloseIcon />
            </IconButton>
            <Typography sx={{ fontSize: 12, color: '#6b7280' }}>
              {detail.isFallback ? 'Fallback Rule' : entityTypeLabel(detailRule.entityType)}
            </Typography>
            <Typography sx={{ fontSize: 22, color: '#000', mb: 2, pr: 5 }}>
              {detail.isFallback ? 'All Other Products' : detailRule.entityName}
            </Typography>

            {/* reference: the fallback drawer has no included/excluded line */}
            {!detail.isFallback && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2, fontSize: 16, color: '#000' }}>
                {detailRule.excludeFromPriceList
                  ? <CloseIcon sx={{ fontSize: 20, color: '#e33430' }} />
                  : <CheckIcon sx={{ fontSize: 20, color: '#32b643' }} />}
                {detailRule.excludeFromPriceList ? 'Excluded from the price list' : 'Included in the price list'}
              </Box>
            )}

            {detailRule.pricingMethod === 'override' ? (
              <>
                <Typography sx={{ fontSize: 13, color: '#6b7280', mb: 0.5 }}>Override Prices</Typography>
                <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <TableHead>
                    <TableRow sx={{ ...blueHeaderSx, '& th': { ...blueHeaderSx['& th'], textAlign: 'center' } }}>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Cost</TableCell>
                      <TableCell>%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={{ '& td': { border: 0, fontSize: 16, color: '#000', textAlign: 'center', py: 1.5 } }}>
                    {detailTiers.map((tier, i) => {
                      const qty = Number(tier.quantity) || 0;
                      const price = Number(tier.price) || 0;
                      const cost = qty * (Number(detail.unitCost) || 0);
                      const pct = price > 0 ? ((price - cost) / price) * 100 : 0;
                      return (
                        <TableRow key={i}>
                          <TableCell>{qty}</TableCell>
                          <TableCell>${money(price)}</TableCell>
                          <TableCell>${money(cost)}</TableCell>
                          <TableCell>{money(pct)}</TableCell>
                        </TableRow>
                      );
                    })}
                    {detailTiers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} sx={{ color: '#6b7280 !important' }}>No prices set</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </>
            ) : (
              <>
                {/* reference: an excluded rule still prints its (unused) rule, e.g. "Discount by 0.00%" */}
                <Typography sx={{ fontSize: 13, color: '#6b7280' }}>Price Rule</Typography>
                <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>{formatRuleLabel(detailRule, { ignoreExclude: true }) || 'Discount by 0.00%'}</Typography>
                {!['No Minimum', 'N/A'].includes(formatMinimumRule(detailRule)) && (
                  <>
                    <Typography sx={{ fontSize: 13, color: '#6b7280' }}>Minimum Price</Typography>
                    <Typography sx={{ fontSize: 16, color: '#000' }}>{formatMinimumRule(detailRule)}</Typography>
                  </>
                )}
              </>
            )}
          </Box>
        </Box>
      )}

      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete Price List"
        message={`Are you sure you want to delete the price list "${priceList?.name || ''}"?`}
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default PriceListDetails;
