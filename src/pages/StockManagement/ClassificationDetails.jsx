import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Dialog,
  TextField,
  Autocomplete,
  CircularProgress
} from '@mui/material';
import {
  EditOutlined as EditOutlinedIcon,
  LocalOfferOutlined as TagOutlinedIcon,
  HomeOutlined as HomeOutlinedIcon,
  CallSplitOutlined as CallSplitOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
  VisibilityOutlined as VisibilityOutlinedIcon,
  HelpOutline as HelpOutlineIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link } from 'react-router-dom';
import classificationService from '../../services/classificationService';
import masterDatabaseService from '../../services/masterDatabaseService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

const TYPE_LABELS = {
  BRAND: 'Brand',
  CATEGORY: 'Category',
  FAMILY: 'Family',
  TAG: 'Tag'
};

// Same MSC codes the Create New Classification dialog offers, grouped like the reference listbox.
const MSC_OPTIONS = [
  { code: '195010101', label: 'ISB BISCUITS / COOKIES', group: 'BAKERY - IN STORE BAKERY' },
  { code: '195010104', label: 'ISB BREADS', group: 'BAKERY - IN STORE BAKERY' },
  { code: '1629202', label: 'ISB DONUTS', group: 'BAKERY - IN STORE BAKERY' }
];

const selectFieldSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 42,
    borderRadius: '8px',
    '& fieldset': { border: '1px solid #595959' },
    '&:hover fieldset': { border: '1px solid #595959' },
    '&.Mui-focused fieldset': { border: '2px solid #000' },
  },
  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
};

const ClassificationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const chartContainerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classification, setClassification] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [chartWidth, setChartWidth] = useState(800);

  // Edit ("Modify <name>") dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editMasterRef, setEditMasterRef] = useState('');
  const [editMscMapping, setEditMscMapping] = useState('');
  const [mdrOptions, setMdrOptions] = useState([]);
  const [mdrInput, setMdrInput] = useState('');
  const [mdrLoading, setMdrLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete confirmation dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add Tag dialog state (category view only)
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState('');
  const [applyingTag, setApplyingTag] = useState(false);

  useEffect(() => {
    if (id) {
      loadClassificationData();
      loadPerformanceData();
      loadProducts();
    }
  }, [id]);

  // Debounced master-database reference lookup (same source as the Create dialog)
  useEffect(() => {
    if (!editOpen) return undefined;
    let active = true;
    const handle = setTimeout(async () => {
      try {
        setMdrLoading(true);
        const data = await masterDatabaseService.getSuppliers({ search: mdrInput });
        if (active) {
          setMdrOptions(
            // de-duped: identical names would collide as React list keys in the Autocomplete
            [...new Set((data.suppliers || []).map((s) => s.name || s.reference).filter(Boolean))]
              .sort((a, b) => a.localeCompare(b))
          );
        }
      } catch {
        if (active) setMdrOptions([]);
      } finally {
        if (active) setMdrLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [mdrInput, editOpen]);

  // Observe container width to make chart truly full width
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    // Set initial width
    const updateWidth = () => {
      const width = el.offsetWidth || el.clientWidth || 800;
      if (width > 0) {
        setChartWidth(width);
      }
    };

    // Initial width calculation
    updateWidth();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) {
          setChartWidth(w);
        }
      }
    });

    resizeObserver.observe(el);

    // Also listen to window resize
    window.addEventListener('resize', updateWidth);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
    // re-run once the chart exists (it is not mounted while the page is loading)
  }, [loading]);

  const loadClassificationData = async () => {
    try {
      const response = await classificationService.getClassification(id);
      setClassification(response.classification);
    } catch (err) {
      setError('Failed to load classification');
      console.error('Error loading classification:', err);
    }
  };

  const loadPerformanceData = async () => {
    try {
      const response = await classificationService.getClassificationPerformance(id);
      setPerformanceData(response.performanceData);
    } catch (err) {
      console.error('Error loading performance data:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await classificationService.getClassificationProducts(id);
      setProducts(response.assignedProducts || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditName(classification?.name || '');
    setEditMasterRef(classification?.masterDatabaseRef || '');
    setEditMscMapping(classification?.mscMapping || '');
    setMdrInput(classification?.masterDatabaseRef || '');
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editName.trim()) return;
    try {
      setSaving(true);
      await classificationService.updateClassification(id, {
        name: editName.trim(),
        type: classification.type,
        masterDatabaseRef: editMasterRef.trim() || null,
        mscMapping: editMscMapping || null
      });
      setEditOpen(false);
      await loadClassificationData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update classification');
      console.error('Error updating classification:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async () => {
    setSelectedTagId('');
    setAddTagOpen(true);
    try {
      setTagsLoading(true);
      const response = await classificationService.getClassifications({ type: 'TAG' });
      setTags(response.classifications || []);
    } catch (err) {
      console.error('Error loading tags:', err);
      setTags([]);
    } finally {
      setTagsLoading(false);
    }
  };

  const handleApplyTag = async () => {
    if (!selectedTagId) return;
    try {
      setApplyingTag(true);
      const productIds = products.map((p) => p.id);
      if (productIds.length === 0) {
        setError('No products to tag in this category');
      } else {
        await classificationService.assignProducts(selectedTagId, productIds, 'assign');
      }
      setAddTagOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add tag to products');
      console.error('Error applying tag:', err);
    } finally {
      setApplyingTag(false);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      await classificationService.deleteClassification(id);
      navigate('/stock-management/classifications');
    } catch (err) {
      setError('Failed to delete classification');
      console.error('Error deleting classification:', err);
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount == null || isNaN(amount)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const renderSalesChart = () => {
    // Generate all 12 months (last 12 months) regardless of data availability
    const now = new Date();
    const allMonths = [];
    const salesMap = {};

    // Create a map from the performance data if available
    if (performanceData?.monthlySales && performanceData.monthlySales.length > 0) {
      performanceData.monthlySales.forEach((item) => {
        salesMap[item.month] = parseFloat(item.sales) || 0;
      });
    }

    // Generate the last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;

      allMonths.push({
        month: key,
        sales: salesMap[key] || 0,
        date: date
      });
    }

    const chartData = allMonths;
    const effectiveWidth = chartWidth > 0 ? chartWidth : 800;
    const height = 310;
    const padTop = 20;
    const padBottom = 40;
    const padLeft = 60;
    const padRight = 30;

    // Calculate smart max value with padding
    const dataMax = Math.max(...chartData.map(d => parseFloat(d.sales) || 0), 0);
    let maxVal = 20000; // Default minimum for better visualization

    if (dataMax > 0) {
      // Add 15% padding above max value
      maxVal = dataMax * 1.15;

      // Round up to a "nice" number
      const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
      const normalized = maxVal / magnitude;

      let nice;
      if (normalized <= 1) nice = 1;
      else if (normalized <= 2) nice = 2;
      else if (normalized <= 5) nice = 5;
      else nice = 10;

      maxVal = nice * magnitude;

      // Ensure minimum based on data range
      if (dataMax < 1000) {
        maxVal = Math.max(1000, dataMax * 1.15);
      }
    }

    const yScale = maxVal > 0 ? (height - padTop - padBottom) / maxVal : 1;

    const scaleY = (v) => {
      return height - padBottom - (v * yScale);
    };

    const getX = (i) => {
      const months = 12;
      return padLeft + (i / (months - 1)) * (effectiveWidth - padLeft - padRight);
    };

    const calculateTicks = (max) => {
      if (max <= 0) return [0];
      const rawStep = max / 6;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const normalized = rawStep / magnitude;
      let step;
      if (normalized <= 1) step = 1 * magnitude;
      else if (normalized <= 2) step = 2 * magnitude;
      else if (normalized <= 5) step = 5 * magnitude;
      else step = 10 * magnitude;

      const ticks = [];
      for (let val = 0; val <= max + step * 0.1; val += step) {
        ticks.push(Math.round(val * 100) / 100);
      }

      if (ticks.length === 0) ticks.push(0);
      if (ticks[ticks.length - 1] < max) {
        ticks.push(Math.ceil(max / step) * step);
      }

      return ticks;
    };

    const yTicks = calculateTicks(maxVal);

    const salesPath = chartData
      .map((d, i) => {
        const x = getX(i);
        const y = scaleY(parseFloat(d.sales) || 0);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");

    const monthLabels = chartData.map((d) => {
      return {
        label: `${d.date.getFullYear()} ${d.date.toLocaleDateString("en-US", { month: "short" })}`,
        month: d.month
      };
    });

    return (
      <Box sx={{ mb: 3, bgcolor: '#fff' }}>
        {/* Centered "Sales" legend chip */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, mb: 1 }}>
          <Box sx={{ width: 36, height: 12, bgcolor: 'rgba(94,187,235,0.35)', border: '2px solid #5ebbeb' }} />
          <Typography sx={{ fontSize: 12, color: '#666' }}>Sales</Typography>
        </Box>

        <Box
          ref={chartContainerRef}
          sx={{
            height: 390,
            position: "relative",
            width: "100%",
            bgcolor: "#fff",
            overflow: "visible",
          }}
        >
          <Box sx={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
            <Box sx={{ flex: 1, width: "100%", overflow: "visible", position: "relative" }}>
              <svg
                width={effectiveWidth}
                height={height + padBottom}
                style={{ overflow: "visible", display: "block" }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const actualWidth = rect.width;
                  const x = e.clientX - rect.left;
                  const months = 12;
                  const stepX = (actualWidth - padLeft - padRight) / (months - 1);
                  const index = Math.min(
                    months - 1,
                    Math.max(0, Math.round((x - padLeft) / stepX))
                  );
                  setHoverIndex(index);
                  setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHoverIndex(null)}
              >
                {yTicks.map((val) => {
                  const y = scaleY(val);
                  return (
                    <g key={val}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={effectiveWidth - padRight}
                        y2={y}
                        stroke="#e0e0e0"
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}

                {/* Vertical month gridlines */}
                {chartData.map((_, i) => (
                  <line
                    key={`vgrid-${i}`}
                    x1={getX(i)}
                    y1={padTop}
                    x2={getX(i)}
                    y2={height - padBottom}
                    stroke="#e0e0e0"
                    strokeWidth="1"
                  />
                ))}

                {yTicks.map((val) => {
                  const y = scaleY(val);
                  return (
                    <text
                      key={`label-${val}`}
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="12"
                      fill="#666"
                    >
                      {formatCurrency(val)}
                    </text>
                  );
                })}

                <line
                  x1={padLeft}
                  y1={height - padBottom}
                  x2={effectiveWidth - padRight}
                  y2={height - padBottom}
                  stroke="#ccc"
                  strokeWidth="1"
                />

                <line
                  x1={padLeft}
                  y1={padTop}
                  x2={padLeft}
                  y2={height - padBottom}
                  stroke="#ccc"
                  strokeWidth="1"
                />

                {/* Sales line (light blue) */}
                <path
                  d={salesPath}
                  stroke="#5ebbeb"
                  strokeWidth="2"
                  fill="none"
                />

                {/* Sales point markers */}
                {chartData.map((d, i) => {
                  const x = getX(i);
                  const y = scaleY(parseFloat(d.sales) || 0);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#5ebbeb"
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Hover guide line */}
                {hoverIndex !== null && (
                  <line
                    x1={getX(hoverIndex)}
                    y1={padTop}
                    x2={getX(hoverIndex)}
                    y2={height - padBottom}
                    stroke="#999"
                    strokeDasharray="2,2"
                    strokeWidth="1"
                  />
                )}
              </svg>
            </Box>

            {/* Month labels (X-axis) — horizontal */}
            <Box sx={{ position: "relative", width: effectiveWidth, height: 20, mt: 1 }}>
              {monthLabels.map((labelObj, i) => (
                <Typography
                  key={i}
                  variant="caption"
                  sx={{
                    position: "absolute",
                    left: `${getX(i)}px`,
                    transform: "translateX(-50%)",
                    fontSize: "0.7rem",
                    whiteSpace: "nowrap",
                    color: "#666",
                  }}
                >
                  {labelObj.label}
                </Typography>
              ))}
            </Box>
          </Box>

          {/* Hover tooltip */}
          {hoverIndex !== null && (
            <Paper
              sx={{
                position: "absolute",
                left: hoverPos.x - 60,
                top: hoverPos.y + 10,
                p: 1.5,
                bgcolor: "rgba(0,0,0,0.85)",
                color: "white",
                fontSize: "0.75rem",
                pointerEvents: "none",
                zIndex: 1000,
                borderRadius: 1,
                minWidth: 140,
                boxShadow: 3,
              }}
            >
              <Box sx={{ mb: 0.5, fontWeight: 600, fontSize: "0.8rem" }}>
                {monthLabels[hoverIndex]?.label || ''}
              </Box>
              <Box>
                <strong>Sales:</strong> {formatCurrency(parseFloat(chartData[hoverIndex]?.sales) || 0)}
              </Box>
            </Paper>
          )}
        </Box>
      </Box>
    );
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!classification) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Classification not found</Alert>
      </Box>
    );
  }

  const typeLabel = TYPE_LABELS[classification.type] || 'Classification';
  const typeLower = typeLabel.toLowerCase();

  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: HomeOutlinedIcon,
      description: `View ${typeLower} details and basic statistics`,
      onClick: () => setActiveTab('home')
    },
    // "Add Tag" only exists on a Category's view screen (2nd item: Home, Add Tag, Assign)
    ...(classification.type === 'CATEGORY'
      ? [{
          id: 'addTag',
          label: 'Add Tag',
          icon: TagOutlinedIcon,
          description: 'Add a tag to all the products in this category',
          onClick: handleAddTag
        }]
      : []),
    {
      id: 'assign',
      label: 'Assign',
      icon: CallSplitOutlinedIcon,
      description: `Assign products to the ${typeLower}`,
      to: `/stock-management/classifications/${id}/assign`
    }
  ];

  const pillButtonSx = {
    height: 42,
    width: '100%',
    px: '32px',
    bgcolor: 'transparent',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'none',
    boxShadow: 'none',
    transition: 'none',
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 50px)', bgcolor: '#fff' }}>
      {/* Left Sidebar */}
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          bgcolor: '#e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Sidebar header: type crumb + View <name> */}
        <Box sx={{ px: '32px', pt: '48px', pb: '16px' }}>
          <Typography sx={{ fontSize: 14, color: '#737373', lineHeight: 1.4 }}>
            {typeLabel}
          </Typography>
          <Typography
            noWrap
            sx={{ fontSize: 20, fontWeight: 700, color: '#000', textOverflow: 'ellipsis' }}
          >
            View {classification.name}
          </Typography>
        </Box>

        {/* Navigation */}
        <Box sx={{ pl: '16px', py: '16px', display: 'flex', flexDirection: 'column' }}>
          {navigationItems.map((item) => {
            const active = activeTab === item.id;
            const ItemIcon = item.icon;
            return (
              <Box
                key={item.id}
                component={item.to ? Link : 'button'}
                type={item.to ? undefined : 'button'}
                to={item.to}
                onClick={item.onClick}
                sx={{
                  position: 'relative',
                  height: 60,
                  border: 0,
                  borderRight: '4px solid transparent',
                  borderRadius: '8px 0 0 8px',
                  px: '24px',
                  font: 'inherit',
                  textAlign: 'left',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  bgcolor: active ? '#fff' : 'transparent',
                  zIndex: active ? 10 : 'auto',
                  boxShadow: active
                    ? '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)'
                    : 'none',
                  transition:
                    'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': { bgcolor: active ? '#fff' : 'rgba(0,0,0,0.1)' },
                }}
              >
                {/* Concave corner notches fusing the active tab into the content panel */}
                {active && [-16, 60].map((top) => (
                  <Box
                    key={top}
                    sx={{
                      position: 'absolute',
                      right: '-4px',
                      top: `${top}px`,
                      width: 16,
                      height: 16,
                      bgcolor: '#fff',
                      overflow: 'hidden',
                      pointerEvents: 'none',
                    }}
                  >
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        bgcolor: '#e2e8f0',
                        borderBottomRightRadius: top < 0 ? '8px' : 0,
                        borderTopRightRadius: top < 0 ? 0 : '8px',
                      }}
                    />
                  </Box>
                ))}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ItemIcon sx={{ fontSize: 20, color: '#000' }} />
                  <Typography sx={{ fontSize: 20, fontWeight: 400, color: '#000', lineHeight: 1.3 }}>
                    {item.label}
                  </Typography>
                </Box>
                <Typography noWrap sx={{ fontSize: 12, color: '#000', lineHeight: 1.3 }}>
                  {item.description}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Edit + Delete pills in a sticky sidebar footer */}
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            bgcolor: '#e2e8f0',
            borderRight: '4px solid rgba(203,213,225,0.5)',
            pt: '8px',
            pb: '16px',
            // 320 sidebar - 4px right border - 2*16px = 284, the reference pill width
            px: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <Button
            disableRipple
            startIcon={<EditOutlinedIcon sx={{ fontSize: 20 }} />}
            onClick={handleEdit}
            sx={{
              ...pillButtonSx,
              border: '1px solid #22c55e',
              color: '#16a34a',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #22c55e' },
            }}
          >
            Edit
          </Button>
          <Button
            disableRipple
            startIcon={<DeleteOutlineIcon sx={{ fontSize: 20 }} />}
            onClick={() => setDeleteOpen(true)}
            sx={{
              ...pillButtonSx,
              border: '1px solid #ef4444',
              color: '#dc2626',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #ef4444' },
            }}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 3, bgcolor: '#fff' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Sales Performance Chart */}
        {renderSalesChart()}

        {/* Products List */}
        <Typography component="h3" sx={{ fontSize: '18.72px', fontWeight: 700, color: '#000', mb: 2 }}>
          Products
        </Typography>
        <Box>
          {products.map((product, index) => (
            <Box
              key={product.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: index % 2 === 0 ? '#fff' : '#f5f5f5',
                borderRadius: '8px',
                height: 50,
                mb: '8px',
                pl: 2,
                pr: 1,
              }}
            >
              <Typography noWrap sx={{ fontSize: 16, color: '#000' }}>
                {product.name}
              </Typography>
              <Box
                component="a"
                onClick={() => navigate(`/products/${product.id}/view`)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  cursor: 'pointer',
                  color: '#0284c7',
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: 'none',
                  px: 1.5,
                  py: 0.75,
                  borderRadius: '8px',
                  flexShrink: 0,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
                }}
              >
                <VisibilityOutlinedIcon sx={{ fontSize: 20 }} />
                View
              </Box>
            </Box>
          ))}
          {products.length === 0 && (
            <Typography sx={{ textAlign: 'center', color: '#737373', fontSize: 16, py: 2 }}>
              No Products
            </Typography>
          )}
        </Box>
      </Box>

      {/* Modify <name> dialog */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        PaperProps={{ sx: { width: 300, maxWidth: '92vw', borderRadius: '8px', overflow: 'hidden' } }}
      >
        <Box sx={{ bgcolor: '#bbf7d0', px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditOutlinedIcon sx={{ color: '#166534', fontSize: 20 }} />
          <Typography noWrap sx={{ color: '#166534', fontSize: 18, fontWeight: 700 }}>
            Modify {classification.name}
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 2 }}>
          <Typography sx={{ fontSize: 14, color: '#000', mb: 0.5 }}>Name</Typography>
          <TextField
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            fullWidth
            size="small"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                height: 42,
                borderRadius: '8px',
                '& fieldset': { border: '1px solid #595959' },
                '&:hover fieldset': { border: '1px solid #595959' },
                '&.Mui-focused fieldset': { border: '2px solid #000' },
              },
            }}
          />
          <Typography sx={{ fontSize: 14, color: '#000', mb: 0.5 }}>Master Database Reference</Typography>
          <Autocomplete
            freeSolo
            options={mdrOptions}
            loading={mdrLoading}
            value={editMasterRef || null}
            onChange={(e, newVal) => setEditMasterRef(newVal || '')}
            inputValue={mdrInput}
            onInputChange={(e, newInput) => setMdrInput(newInput)}
            size="small"
            fullWidth
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select..."
                sx={selectFieldSx}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {mdrLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          {classification.type === 'CATEGORY' && (
            <>
              <Typography sx={{ fontSize: 14, color: '#000', mt: 2, mb: 0.5 }}>MSC Mapping</Typography>
              <Autocomplete
                options={MSC_OPTIONS}
                groupBy={(option) => option.group}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) => option.code === value.code}
                value={MSC_OPTIONS.find((o) => o.code === editMscMapping) || null}
                onChange={(e, newVal) => setEditMscMapping(newVal ? newVal.code : '')}
                size="small"
                fullWidth
                renderInput={(params) => (
                  <TextField {...params} placeholder="Select..." sx={selectFieldSx} />
                )}
                slotProps={{
                  paper: {
                    sx: {
                      '& .MuiAutocomplete-groupLabel': { fontWeight: 700, color: '#000' },
                      '& .MuiAutocomplete-option': { pl: 3 },
                    },
                  },
                }}
              />
            </>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 2.5 }}>
            <Button
              onClick={() => setEditOpen(false)}
              sx={{
                width: 118,
                height: 42,
                bgcolor: '#d4d4d4',
                color: '#000',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: 16,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#c6c6c6', boxShadow: 'none' },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={saving || !editName.trim()}
              sx={{
                width: 118,
                height: 42,
                bgcolor: '#22c55e',
                color: '#fff',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: 16,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#16a34a', boxShadow: 'none' },
                '&.Mui-disabled': { bgcolor: '#22c55e', color: '#fff', opacity: 0.55 },
              }}
            >
              Save
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Add Tag dialog (category only) */}
      <Dialog
        open={addTagOpen}
        onClose={() => setAddTagOpen(false)}
        PaperProps={{ sx: { width: 302, maxWidth: '92vw', borderRadius: '8px', overflow: 'hidden' } }}
      >
        {/* p-4 header: 16px padding + 28px line box = 60px tall, per reference */}
        <Box sx={{ bgcolor: '#bae6fd', p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutlineIcon sx={{ color: '#075985', fontSize: 20 }} />
          <Typography noWrap sx={{ color: '#075985', fontSize: 18, fontWeight: 700, lineHeight: '28px' }}>
            Add Tag
          </Typography>
        </Box>
        <Box sx={{ px: 2, py: 2 }}>
          <Autocomplete
            options={tags}
            loading={tagsLoading}
            getOptionKey={(tag) => tag.id}
            getOptionLabel={(tag) => tag.name || ''}
            value={tags.find((t) => t.id === selectedTagId) || null}
            onChange={(e, newValue) => setSelectedTagId(newValue ? newValue.id : '')}
            size="small"
            fullWidth
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search for tag"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    minHeight: 42,
                    borderRadius: '8px',
                    '& fieldset': { border: '1px solid #595959' },
                    '&:hover fieldset': { border: '1px solid #595959' },
                    '&.Mui-focused fieldset': { border: '2px solid #000' },
                  },
                  '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
                }}
              />
            )}
          />
          {/* 16 + 42 input + 32 + 42 buttons + 16 = 148 body, 60 header => 208 dialog */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 4 }}>
            <Button
              onClick={() => setAddTagOpen(false)}
              sx={{
                width: 118,
                height: 42,
                bgcolor: '#d4d4d4',
                color: '#000',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: 16,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#c6c6c6', boxShadow: 'none' },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyTag}
              disabled={applyingTag || !selectedTagId}
              sx={{
                width: 118,
                height: 42,
                bgcolor: '#22c55e',
                color: '#fff',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: 16,
                textTransform: 'none',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#16a34a', boxShadow: 'none' },
                '&.Mui-disabled': { bgcolor: '#e5e5e5', color: '#737373' },
              }}
            >
              Confirm
            </Button>
          </Box>
        </Box>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete"
        message={`Are you sure you want to delete "${classification.name}"?`}
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
};

export default ClassificationDetails;
