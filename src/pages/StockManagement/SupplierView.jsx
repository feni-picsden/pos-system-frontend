import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import {
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  HomeOutlined as HomeIcon,
  LocalBarOutlined as ProductsIcon,
  AccessTime as OrderHistoryIcon,
  VisibilityOutlined as ViewIcon,
  Block as NoResultsIcon,
  AssignmentOutlined as OrderRowIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import supplierService from '../../services/supplierService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

// Shopfront card chrome (reference: .show-frame / #dialog)
const CARD_SHADOW = '0 0 30px 0 rgba(0,0,0,.25), 0 15px 30px 0 rgba(0,0,0,.19)';
// reference graph = current month + the full preceding 12
const MONTHS = 13;

const SupplierView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const resizeObsRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supplier, setSupplier] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [chartWidth, setChartWidth] = useState(800);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadSupplierData();
      loadPerformanceData();
      loadProducts();
      // preload orders so the Order History tab opens instantly like the reference
      loadOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Callback ref: the chart only mounts once the Home tab renders, so a mount-time
  // effect would find a null node and leave the svg stuck at its 800px fallback.
  const chartContainerRef = useCallback((node) => {
    resizeObsRef.current?.disconnect();
    resizeObsRef.current = null;
    if (!node) return;
    setChartWidth(node.clientWidth || 800);
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setChartWidth(w);
    });
    ro.observe(node);
    resizeObsRef.current = ro;
  }, []);

  useEffect(() => () => resizeObsRef.current?.disconnect(), []);

  const loadSupplierData = async () => {
    try {
      const response = await supplierService.getSupplier(id);
      setSupplier(response.supplier);
    } catch (err) {
      setError('Failed to load supplier');
      console.error('Error loading supplier:', err);
    }
  };

  const loadPerformanceData = async () => {
    try {
      const response = await supplierService.getSupplierPerformance(id);
      setPerformanceData(response.performanceData);
    } catch (err) {
      console.error('Error loading performance data:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await supplierService.getSupplierProducts(id);
      setProducts(response.assignedProducts || []);
    } catch (err) {
      console.error('Error loading products:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      const response = await supplierService.getSupplierOrders(id);
      setOrders(response.orders || []);
    } catch (err) {
      console.error('Error loading supplier orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/suppliers/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await supplierService.deleteSupplier(id);
      navigate('/suppliers');
    } catch (err) {
      setError('Failed to delete supplier');
      console.error('Error deleting supplier:', err);
    } finally {
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
    const now = new Date();
    const allMonths = [];
    const salesMap = {};
    
    if (performanceData?.monthlySales && performanceData.monthlySales.length > 0) {
      performanceData.monthlySales.forEach((item) => {
        salesMap[item.month] = parseFloat(item.sales) || 0;
      });
    }

    for (let i = MONTHS - 1; i >= 0; i--) {
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
    const height = 250;
    const padTop = 20;
    const padBottom = 40;
    const padLeft = 60;
    const padRight = 30;

    const dataMax = Math.max(...chartData.map(d => parseFloat(d.sales) || 0), 0);
    let maxVal = 20000;
    
    if (dataMax > 0) {
      maxVal = dataMax * 1.15;
      const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
      const normalized = maxVal / magnitude;
      
      let nice;
      if (normalized <= 1) nice = 1;
      else if (normalized <= 2) nice = 2;
      else if (normalized <= 5) nice = 5;
      else nice = 10;
      
      maxVal = nice * magnitude;
      
      if (dataMax < 1000) {
        maxVal = Math.max(1000, dataMax * 1.15);
      }
    }

    const yScale = maxVal > 0 ? (height - padTop - padBottom) / maxVal : 1;
    
    const scaleY = (v) => {
      return height - padBottom - (v * yScale);
    };
    
    const getX = (i) =>
      padLeft + (i / (MONTHS - 1)) * (effectiveWidth - padLeft - padRight);

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

    // ponytail: ref shows a single "$0.00" label when all sales are zero
    const yTicks = dataMax === 0 ? [0] : calculateTicks(maxVal);
    // Smooth bezier through the points like the reference chart
    const pts = chartData.map((d, i) => [getX(i), scaleY(parseFloat(d.sales) || 0)]);
    const salesPath = pts
      .map(([x, y], i) => {
        if (i === 0) return `M ${x} ${y}`;
        const [px, py] = pts[i - 1];
        const cx = px + (x - px) / 2;
        return `C ${cx} ${py} ${cx} ${y} ${x} ${y}`;
      })
      .join(" ");
    const formatTick = (val) =>
      `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const monthLabels = chartData.map((d) => {
      return {
        label: `${d.date.getFullYear()} ${d.date.toLocaleDateString("en-US", { month: "short" })}`,
        month: d.month
      };
    });

    return (
      <Box
        ref={chartContainerRef}
        sx={{
          mb: 2,
          height: 300,
          position: "relative",
          width: "100%",
          overflow: "visible",
        }}
      >
        <svg
          width={effectiveWidth}
          height={height + padBottom}
          style={{ overflow: "visible", display: "block" }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const actualWidth = rect.width;
            const x = e.clientX - rect.left;
            const stepX = (actualWidth - padLeft - padRight) / (MONTHS - 1);
            const index = Math.min(
              MONTHS - 1,
              Math.max(0, Math.round((x - padLeft) / stepX))
            );
            setHoverIndex(index);
            setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
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
                
                {yTicks.map((val) => {
                  const y = scaleY(val);
                  return (
                    <text
                      key={`label-${val}`}
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#666"
                    >
                      {formatTick(val)}
                    </text>
                  );
                })}
                {monthLabels.map((labelObj, i) => (
                  <text
                    key={`month-${i}`}
                    fontSize="11"
                    fill="#666"
                    textAnchor="end"
                    transform={`translate(${getX(i)}, ${height - padBottom + 14}) rotate(-45)`}
                  >
                    {labelObj.label}
                  </text>
                ))}

                <path
                  d={`${salesPath} L ${getX(chartData.length - 1)} ${height - padBottom} L ${getX(0)} ${height - padBottom} Z`}
                  fill="rgba(94,187,235,0.25)"
                  stroke="none"
                />
                <path
                  d={salesPath}
                  stroke="#5ebbeb"
                  strokeWidth="2"
                  fill="none"
                />
                
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
    );
  };

  const navigationItems = [
    { 
      id: 'home', 
      label: 'Home', 
      icon: <HomeIcon />,
      description: 'View supplier details and basic statistics'
    },
    { 
      id: 'products', 
      label: 'Products', 
      icon: <ProductsIcon />,
      description: 'View products from this supplier'
    },
    {
      id: 'orderHistory',
      label: 'Order History',
      icon: <OrderHistoryIcon />,
      description: 'View previous suppliers'
    }
  ];

  const formatOrderDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'RECEIVED': return 'success';
      case 'PENDING': return 'warning';
      case 'CANCELLED': return 'error';
      default: return 'default';
    }
  };

  if (loading) {
    return null;
  }

  if (!supplier) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Supplier not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 50px)', bgcolor: '#676b72', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, p: 0.5, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box
          sx={{
            textAlign: 'center',
            mb: 1,
            backgroundColor: '#f8f8f8',
            border: '1px solid #000',
            boxShadow: CARD_SHADOW,
            boxSizing: 'border-box',
          }}
        >
          <Typography
            sx={{ fontSize: '24px', fontWeight: 400, lineHeight: 1.2, color: 'black', padding: 2 }}
          >
            {supplier.name}
          </Typography>
        </Box>

        <Box
          sx={{
            p: 1,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8f8f8',
            borderRadius: 0,
            border: '1px solid #000',
            boxShadow: CARD_SHADOW,
            boxSizing: 'border-box',
            minHeight: 0,
            overflowY: 'auto',
          }}
        >
          {activeTab === 'home' ? (
            <>
              {renderSalesChart()}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
                {[
                  { label: 'Business Number', lines: [supplier.businessNumber] },
                  {
                    label: 'Address',
                    // reference stacks: street / SUBURB STATE POSTCODE / country
                    lines: [
                      [supplier.streetAddress1, supplier.streetAddress2].filter(Boolean).join(', '),
                      [supplier.suburb, supplier.state, supplier.postCode].filter(Boolean).join(' '),
                      supplier.country,
                    ],
                  },
                  { label: 'Phone', lines: [supplier.phone] },
                  { label: 'Credit Balance', lines: [formatCurrency(supplier.creditBalance || 0)] },
                ].map((field) => (
                  <Box key={field.label}>
                    <Typography
                      sx={{
                        fontSize: '16px',
                        color: '#676b72',
                        letterSpacing: '1px',
                        fontVariant: 'all-petite-caps',
                        mb: 0.5,
                      }}
                    >
                      {field.label}
                    </Typography>
                    {/* empty values render blank on the reference, never a dash */}
                    {field.lines.filter(Boolean).map((line) => (
                      <Typography key={line} sx={{ color: '#313439', fontSize: '16px' }}>
                        {line}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Box>
            </>
          ) : activeTab === 'products' ? (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Products
              </Typography>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <List sx={{ p: 0 }}>
                  {products.map((product, index) => (
                    <React.Fragment key={product.id}>
                      <ListItem
                        sx={{
                          height: 72,
                          backgroundColor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                          '&:hover': { backgroundColor: '#f0f0f0' },
                          borderBottom: index < products.length - 1 ? '1px solid #e0e0e0' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <ListItemText
                          primary={product.name}
                          sx={{ '& .MuiTypography-root': { fontSize: '0.875rem' } }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            startIcon={<ViewIcon />}
                            onClick={() => navigate(`/products/${product.id}/view`)}
                            sx={{ color: '#2196f3', textTransform: 'none' }}
                          >
                            View
                          </Button>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/products/${product.id}/edit`)}
                            sx={{ color: '#45a049', textTransform: 'none' }}
                          >
                            Edit
                          </Button>
                        </Box>
                      </ListItem>
                    </React.Fragment>
                  ))}
                  {products.length === 0 && (
                    <ListItem>
                      <ListItemText
                        primary="No products assigned to this supplier"
                        sx={{ textAlign: 'center', color: 'text.secondary' }}
                      />
                    </ListItem>
                  )}
                </List>
              </Box>
            </Box>
          ) : activeTab === 'orderHistory' ? (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {ordersLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : orders.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <NoResultsIcon sx={{ fontSize: 64, color: '#676b72', mb: 2 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '20px', color: '#000', mb: 1 }}>
                    No results found
                  </Typography>
                  <Typography sx={{ fontSize: '16px', color: '#676b72' }}>
                    We could not find any results that matched the filters.
                  </Typography>
                </Box>
              ) : (
                <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, textAlign: 'center', fontSize: 13 } }}>
                        <TableCell />
                        <TableCell>FROM</TableCell>
                        <TableCell>TO</TableCell>
                        <TableCell>DATE</TableCell>
                        <TableCell>INVOICE NUMBER</TableCell>
                        <TableCell>REFERENCE</TableCell>
                        <TableCell>STATUS</TableCell>
                        <TableCell />
                        <TableCell>ACTIONS</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow
                          key={order.id}
                          sx={{
                            '&:hover': { backgroundColor: '#f5f5f5' },
                            backgroundColor: orders.indexOf(order) % 2 === 0 ? '#fafafa' : 'white',
                            '& td': { textAlign: 'center' },
                          }}
                        >
                          <TableCell sx={{ width: 40 }}>
                            <OrderRowIcon sx={{ fontSize: 22, color: '#313439', verticalAlign: 'middle' }} />
                          </TableCell>
                          <TableCell sx={{ textAlign: 'left !important' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#000' }}>
                              {order.supplier?.name || '-'}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: '#676b72' }}>SUPPLIER</Typography>
                          </TableCell>
                          <TableCell sx={{ textAlign: 'left !important' }}>
                            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#000' }}>
                              {order.outlet?.name || order.customer?.name || order.to || '-'}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: '#676b72' }}>OUTLET</Typography>
                          </TableCell>
                          <TableCell>{formatOrderDate(order.orderDate)}</TableCell>
                          <TableCell>{order.orderNumber || '-'}</TableCell>
                          <TableCell>{order.internalReference || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={order.status}
                              color={getStatusColor(order.status)}
                              size="small"
                              sx={{ fontWeight: 500 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {formatCurrency(order.totalAmount)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block">
                              {order.items?.length ?? 0} LINES
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="small"
                              startIcon={<ViewIcon />}
                              onClick={() => navigate(`/orders-invoices/${order.id}`)}
                              sx={{ color: '#2196f3', textTransform: 'none' }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          ) : null}
        </Box>
      </Box>

      <Box
        sx={{
          width: 300,
          p: 0.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          position: 'sticky',
          top: 0,
          height: 'calc(100vh - 50px)',
          overflow: 'hidden',
        }}
      >
        <Box
          onClick={handleEdit}
          sx={{
            backgroundColor: '#f8f8f8',
            border: '1px solid #000',
            boxShadow: CARD_SHADOW,
            boxSizing: 'border-box',
            cursor: 'pointer',
            height: 62,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            p: 1,
            gap: 1,
            color: '#32b643',
            transition: 'color 0.2s ease',
            '&:hover': { color: 'rgb(109,215,123)' },
          }}
        >
          <EditIcon />
          <Typography sx={{ fontSize: '24px', fontWeight: 400, color: 'inherit' }}>
            Edit
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            justifyContent: 'space-between',
          }}
        >
          {/* 1px border + 8px padding + 3x62 items + 2x8 gaps = the reference 220px group card */}
          <Box
            sx={{
              backgroundColor: '#f8f8f8',
              border: '1px solid #000',
              boxShadow: CARD_SHADOW,
              boxSizing: 'border-box',
              p: 1,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {navigationItems.map((item) => {
              const current = activeTab === item.id;
              return (
                <Box
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  sx={{
                    position: 'relative',
                    height: 62,
                    flexShrink: 0,
                    width: '100%',
                    p: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: current ? '#5ebbeb' : '#000',
                    transition: 'color 0.2s ease',
                    '&:hover': { color: '#5ebbeb' },
                    '&:hover .rail-desc': { color: '#5ebbeb' },
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: current ? '4px' : 0,
                      backgroundColor: '#5ebbeb',
                      transition: 'width 0.2s ease',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ color: 'inherit', display: 'flex' }}>{item.icon}</Box>
                    <Typography
                      sx={{
                        fontSize: '24px',
                        fontWeight: 400,
                        lineHeight: 1.1,
                        color: 'inherit',
                        whiteSpace: 'nowrap',
                        ml: 1,
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                  <Typography
                    className="rail-desc"
                    sx={{
                      fontSize: '12px',
                      color: current ? '#5ebbeb' : '#676b72',
                      transition: 'color 0.2s ease',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.description}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          <Box
            onClick={() => setDeleteOpen(true)}
            sx={{
              mb: 0,
              backgroundColor: '#f8f8f8',
              border: '1px solid #000',
              boxShadow: CARD_SHADOW,
              boxSizing: 'border-box',
              cursor: 'pointer',
              height: 62,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              p: 1,
              gap: 1,
              color: '#e3342f',
              transition: 'color 0.2s ease',
              '&:hover': { color: 'rgb(243,170,168)' },
            }}
          >
            <DeleteIcon />
            <Typography sx={{ fontSize: '24px', fontWeight: 400, color: 'inherit' }}>
              Delete
            </Typography>
          </Box>
        </Box>
      </Box>

      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${supplier?.name}"?`}
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </Box>
  );
};

export default SupplierView;

