import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AttachFile as AttachFileIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import orderInvoiceService from '../../services/orderInvoiceService';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import ReviewerSelectDialog from '../../components/StockManagement/ReviewerSelectDialog';

// Shopfront reference styles (same tokens as OrderDetails)
const metaLabelSx = {
  fontSize: 13,
  fontWeight: 400,
  color: 'rgb(189,189,189)',
  textTransform: 'uppercase',
};
const metaValueSx = { fontSize: 15, color: '#000' };
const sectionTitleSx = { fontSize: 18, fontWeight: 700, mb: 1.5 };
const grayBtnSx = {
  textTransform: 'none',
  color: '#676b72',
  borderColor: '#bdbdbd',
  backgroundColor: '#f8f8f8',
  '&:hover': { borderColor: '#bdbdbd', backgroundColor: '#eee' },
};

const STATUS_ACTIONS = [
  { status: 'APPROVED', label: 'Approve', color: '#16a34a', icon: <CheckIcon sx={{ fontSize: 16 }} /> },
  { status: 'DECLINED', label: 'Decline', color: '#dc2626', icon: <CloseIcon sx={{ fontSize: 16 }} /> },
  { status: 'CHANGES_REQUESTED', label: 'Require Changes', color: '#f59e0b', icon: <RemoveIcon sx={{ fontSize: 16 }} /> },
];

const REVIEWER_STATUS_COLOR = {
  PENDING: '#9e9e9e',
  APPROVED: '#16a34a',
  DECLINED: '#dc2626',
  CHANGES_REQUESTED: '#f59e0b',
};

const sentenceCase = (s) => (s ? (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).replace(/_/g, ' ') : '');

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (dateString) =>
  dateString
    ? new Date(dateString).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : '';

const formatDateTime = (dateString) =>
  dateString
    ? new Date(dateString)
        .toLocaleString('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        .replace(',', '')
    : '';

const initialOf = (name) => (name || '?').charAt(0).toUpperCase();

// Small round initials avatar used across the page
const InitialsAvatar = ({ name, size = 36, bgcolor }) => (
  <Avatar sx={{ width: size, height: size, fontSize: size * 0.44, bgcolor: bgcolor || '#5ebbeb' }}>
    {initialOf(name)}
  </Avatar>
);

// Comment composer: avatar + multiline input + gray Comment button bottom-right
const CommentComposer = ({ userName, value, onChange, onSubmit, saving }) => (
  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mt: 1 }}>
    <InitialsAvatar name={userName} />
    <Box sx={{ flex: 1 }}>
      <TextField
        fullWidth
        multiline
        minRows={2}
        size="small"
        placeholder="Add your comment..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, backgroundColor: '#fff' } }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        <Button
          size="small"
          variant="outlined"
          onClick={onSubmit}
          disabled={saving || !value.trim()}
          sx={grayBtnSx}
        >
          Comment
        </Button>
      </Box>
    </Box>
  </Box>
);

const CommentList = ({ comments }) =>
  comments.map((c) => (
    <Box key={c.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1 }}>
      <InitialsAvatar name={c.user?.name} />
      <Box>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{c.user?.name || 'Unknown'}</Typography>
        <Typography sx={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.comment}</Typography>
        <Typography sx={{ fontSize: 12, color: '#9e9e9e' }}>{formatDateTime(c.createdAt)}</Typography>
      </Box>
    </Box>
  ));

const ReviewOrder = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { outlets: knownOutlets } = useSelectedOutlet();
  const [order, setOrder] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [modifyOpen, setModifyOpen] = useState(false);
  const [generalComment, setGeneralComment] = useState('');
  const [itemComments, setItemComments] = useState({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [orderRes, usersRes] = await Promise.all([
          orderInvoiceService.getOrderInvoice(id),
          userService.getUsers().catch(() => ({ users: [] })),
        ]);
        const loaded = orderRes.orderInvoice;
        if (!loaded?.reviews?.length) {
          // No review exists on this order — nothing to show here
          navigate(`/orders-invoices/${id}`, { replace: true });
          return;
        }
        setOrder(loaded);
        setUsers(usersRes.users || usersRes.data || usersRes || []);
      } catch (err) {
        console.error('Error loading review:', err);
        setSnackbar({ open: true, message: 'Failed to load review', severity: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadOrder = async () => {
    const response = await orderInvoiceService.getOrderInvoice(id);
    setOrder(response.orderInvoice);
  };

  const userName = (userId) =>
    users.find((u) => u.id === userId)?.name ||
    order?.reviews?.find((r) => r.reviewerId === userId)?.reviewer?.name ||
    'Unknown';

  const handleSubmitStatus = async (status) => {
    try {
      setSaving(true);
      await orderInvoiceService.submitReview(id, { status });
      await reloadOrder();
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to submit review.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateReviewers = async (reviewerIds) => {
    if (reviewerIds.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one reviewer.', severity: 'warning' });
      return;
    }
    try {
      setSaving(true);
      await orderInvoiceService.updateReviewers(id, { reviewerIds });
      setModifyOpen(false);
      await reloadOrder();
      setSnackbar({ open: true, message: 'Reviewers updated.', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to update reviewers.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async (text, orderInvoiceItemId = null) => {
    if (!text.trim()) return;
    try {
      setSaving(true);
      const response = await orderInvoiceService.addReviewComment(id, {
        comment: text.trim(),
        orderInvoiceItemId: orderInvoiceItemId ?? undefined,
      });
      setOrder((prev) =>
        prev ? { ...prev, reviewComments: [...(prev.reviewComments || []), response.comment] } : prev
      );
      if (orderInvoiceItemId) {
        setItemComments((prev) => ({ ...prev, [orderInvoiceItemId]: '' }));
      } else {
        setGeneralComment('');
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to add comment.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setSaving(true);
      const response = await orderInvoiceService.uploadAttachment(id, file);
      setOrder((prev) => (prev ? { ...prev, attachments: response.attachments } : prev));
      setSnackbar({ open: true, message: 'Attachment uploaded successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to upload attachment', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (!order) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Review not found</Alert>
      </Box>
    );
  }

  // From / To display (same swap logic as OrderDetails, trimmed to loaded relations)
  const supplierSide =
    order.from === 'all' ? 'All Suppliers' : order.supplier?.name || order.fromName || order.from;
  const outletSide = order.customer
    ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.name
    : order.toName || knownOutlets.find((o) => o.id === (order.toOutletId ?? order.outletId))?.name || 'N/A';
  const isReturn = order.type === 'RETURN';
  const fromDisplay = isReturn ? outletSide : supplierSide;
  const toDisplay = isReturn ? supplierSide : outletSide;

  const includesFreight = Boolean(
    order.supplier?.freightIncludedOnInvoices || (order.purchases?.[0]?.freight || 0) > 0
  );
  const getCaseQuantity = (item) => item?.caseQuantity || 1;
  const itemTaxRate = (item) => (order.type === 'TRANSFER' ? 0 : (item?.taxRatePercent ?? 10) / 100);
  const lineTotals = (item) => {
    const totalEx = (item.quantity || 0) * (item.unitPrice || 0);
    return { totalEx, totalInc: totalEx * (1 + itemTaxRate(item)) };
  };
  const totalEx = (order.items || []).reduce((sum, item) => sum + lineTotals(item).totalEx, 0);
  const totalInc = (order.items || []).reduce((sum, item) => sum + lineTotals(item).totalInc, 0);

  const reviews = order.reviews || [];
  const reviewComments = order.reviewComments || [];
  const generalComments = reviewComments.filter((c) => !c.orderInvoiceItemId);
  const commentsForItem = (itemId) => reviewComments.filter((c) => c.orderInvoiceItemId === itemId);
  const myReview = reviews.find((r) => r.reviewerId === user?.id);
  const lockedReviewerIds = reviews.filter((r) => r.status !== 'PENDING').map((r) => r.reviewerId);

  // Activity feed: review creation, resolved statuses, comments — chronological
  const createdReview = [...reviews].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
  const activity = [
    ...(createdReview
      ? [{ key: 'created', text: `${createdReview.requester?.name || userName(createdReview.requestedBy)} created the review`, at: createdReview.createdAt }]
      : []),
    ...reviews
      .filter((r) => r.status !== 'PENDING' && r.resolvedAt)
      .map((r) => ({
        key: `r${r.id}`,
        text: `${r.reviewer?.name || 'Unknown'} ${
          { APPROVED: 'approved the order', DECLINED: 'declined the order', CHANGES_REQUESTED: 'requested changes' }[r.status]
        }`,
        at: r.resolvedAt,
      })),
    ...reviewComments.map((c) => ({ key: `c${c.id}`, text: `${c.user?.name || 'Unknown'} commented`, at: c.createdAt })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  const metaEntries = [
    ['Type', sentenceCase(order.type)],
    ['Status', sentenceCase(order.status)],
    ['From', fromDisplay],
    ['To', toDisplay],
    ['Order Date', formatDate(order.orderDate)],
    ['Order Number', order.orderNumber],
    ['Includes Freight', includesFreight ? 'Yes' : 'No'],
    ['Created By', order.creator?.name || 'N/A'],
    ['Created At', formatDateTime(order.createdAt)],
  ];

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', minHeight: '100vh', p: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {/* Main content */}
        <Paper sx={{ flex: 1, backgroundColor: '#fff', borderRadius: 0, boxShadow: 'none', p: 3 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 700, mb: 2 }}>Reviewing Order</Typography>

          {/* Header meta grid */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: '40px', rowGap: 2, mb: 3 }}>
            {metaEntries.map(([label, value]) => (
              <Box key={label}>
                <Typography sx={metaLabelSx}>{label}</Typography>
                <Typography sx={metaValueSx}>{value}</Typography>
              </Box>
            ))}
          </Box>

          {/* Totals band */}
          <Typography sx={sectionTitleSx}>Totals</Typography>
          <Box
            sx={{
              backgroundColor: '#eef3f7',
              px: 2,
              py: 1.5,
              display: 'flex',
              gap: 6,
              mb: 3,
            }}
          >
            <Box>
              <Typography sx={metaLabelSx}>Total (ex)</Typography>
              <Typography sx={{ ...metaValueSx, fontWeight: 700 }}>{formatCurrency(totalEx)}</Typography>
            </Box>
            <Box>
              <Typography sx={metaLabelSx}>Total (inc)</Typography>
              <Typography sx={{ ...metaValueSx, fontWeight: 700 }}>{formatCurrency(totalInc)}</Typography>
            </Box>
          </Box>

          {/* Attachments */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Typography sx={{ ...sectionTitleSx, mb: 0 }}>Attachments</Typography>
            <Button
              size="small"
              variant="outlined"
              component="label"
              startIcon={<AttachFileIcon sx={{ fontSize: 16 }} />}
              disabled={saving}
              sx={grayBtnSx}
            >
              Upload
              <input type="file" hidden accept="image/*,application/pdf" onChange={handleUploadAttachment} />
            </Button>
          </Box>
          <Box sx={{ mb: 3 }}>
            {Array.isArray(order.attachments) && order.attachments.length > 0 ? (
              order.attachments.map((att, i) => (
                <Box
                  key={i}
                  component="a"
                  href={`${window.location.protocol}//${window.location.hostname}:5000${att.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'block', fontSize: 15, color: '#5ebbeb', textDecoration: 'none', py: 0.25 }}
                >
                  {att.name}
                </Box>
              ))
            ) : (
              <Typography sx={{ fontSize: 14, color: '#9e9e9e' }}>No attachments</Typography>
            )}
          </Box>

          {/* General Comments */}
          <Typography sx={sectionTitleSx}>General Comments</Typography>
          <Box sx={{ mb: 3 }}>
            <CommentList comments={generalComments} />
            <CommentComposer
              userName={user?.name}
              value={generalComment}
              onChange={setGeneralComment}
              onSubmit={() => handleAddComment(generalComment)}
              saving={saving}
            />
          </Box>

          {/* Products */}
          <Typography sx={sectionTitleSx}>Products</Typography>
          {(order.items || []).map((item) => {
            const caseQuantity = getCaseQuantity(item);
            const cases = item.cases !== undefined ? item.cases : Math.floor((item.quantity || 0) / caseQuantity);
            const units = item.items !== undefined ? item.items : (item.quantity || 0) % caseQuantity;
            const totals = lineTotals(item);
            const fields = [
              ['Case Quantity', caseQuantity],
              ['Supplier Code', item.supplierCode || '-'],
              ['To Order', `${cases} Cases & ${units} Items`],
              ['Case Cost', formatCurrency((item.unitPrice || 0) * caseQuantity)],
              ['Total (ex)', formatCurrency(totals.totalEx)],
              ['Total (inc)', formatCurrency(totals.totalInc)],
            ];
            return (
              <Box key={item.id} sx={{ mb: 2.5 }}>
                <Box sx={{ backgroundColor: '#eef3f7', px: 2, py: 1.5 }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1 }}>{item.product}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: '32px', rowGap: 1 }}>
                    {fields.map(([label, value]) => (
                      <Box key={label}>
                        <Typography sx={metaLabelSx}>{label}</Typography>
                        <Typography sx={metaValueSx}>{value}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box sx={{ pl: 2 }}>
                  <CommentList comments={commentsForItem(item.id)} />
                  <CommentComposer
                    userName={user?.name}
                    value={itemComments[item.id] || ''}
                    onChange={(v) => setItemComments((prev) => ({ ...prev, [item.id]: v }))}
                    onSubmit={() => handleAddComment(itemComments[item.id] || '', item.id)}
                    saving={saving}
                  />
                </Box>
              </Box>
            );
          })}
        </Paper>

        {/* Right sidebar */}
        <Box sx={{ width: 320, flexShrink: 0 }}>
          <Paper sx={{ backgroundColor: '#fff', borderRadius: 0, boxShadow: 'none', p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                fullWidth
                size="small"
                variant="contained"
                disableElevation
                onClick={() => navigate(`/orders-invoices/${id}/edit`)}
                sx={{ textTransform: 'none', backgroundColor: '#5ebbeb', borderRadius: 0, boxShadow: 'none', '&:hover': { backgroundColor: '#5ebbeb', boxShadow: 'none' } }}
              >
                Edit Order
              </Button>
              <Button
                fullWidth
                size="small"
                variant="contained"
                disableElevation
                onClick={() => navigate(`/orders-invoices/${id}`)}
                sx={{ textTransform: 'none', backgroundColor: '#5ebbeb', borderRadius: 0, boxShadow: 'none', '&:hover': { backgroundColor: '#5ebbeb', boxShadow: 'none' } }}
              >
                View Order
              </Button>
            </Box>

            {/* Reviewer avatars */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {reviews.map((r) => (
                <Tooltip
                  key={r.id}
                  title={`${r.reviewer?.name || 'Unknown'} — ${sentenceCase(r.status)}`}
                >
                  <Box>
                    <InitialsAvatar
                      name={r.reviewer?.name}
                      size={40}
                      bgcolor={REVIEWER_STATUS_COLOR[r.status] || '#9e9e9e'}
                    />
                  </Box>
                </Tooltip>
              ))}
            </Box>

            <Button
              fullWidth
              size="small"
              variant="outlined"
              onClick={() => setModifyOpen(true)}
              sx={{ ...grayBtnSx, mb: 2 }}
            >
              Modify Reviewers
            </Button>

            {/* Status actions: click toggles your review (same status again = back to pending) */}
            {myReview && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {STATUS_ACTIONS.map(({ status, label, color, icon }) => {
                  const active = myReview.status === status;
                  return (
                    <Button
                      key={status}
                      size="small"
                      variant="outlined"
                      startIcon={icon}
                      disabled={saving}
                      onClick={() => handleSubmitStatus(status)}
                      sx={{
                        textTransform: 'none',
                        justifyContent: 'flex-start',
                        borderRadius: 0,
                        color: active ? '#fff' : color,
                        borderColor: color,
                        backgroundColor: active ? color : 'transparent',
                        '&:hover': { borderColor: color, backgroundColor: active ? color : `${color}14` },
                      }}
                    >
                      {label}
                    </Button>
                  );
                })}
              </Box>
            )}

            {/* Activity feed */}
            <Box>
              {activity.map((entry) => (
                <Box
                  key={entry.key}
                  sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.75, borderTop: '1px solid #eee' }}
                >
                  <Typography sx={{ fontSize: 13 }}>{entry.text}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#9e9e9e', whiteSpace: 'nowrap' }}>
                    {formatDateTime(entry.at)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>

      <ReviewerSelectDialog
        open={modifyOpen}
        onClose={() => setModifyOpen(false)}
        users={users}
        initialSelectedIds={reviews.map((r) => r.reviewerId)}
        lockedIds={lockedReviewerIds}
        onConfirm={handleUpdateReviewers}
        saving={saving}
        confirmLabel="Save"
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ReviewOrder;
