import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Fade,
} from "@mui/material";
import {
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  HomeOutlined as HomeIcon,
  GridViewOutlined as GridViewIcon,
  HistoryOutlined as HistoryIcon,
  AssignmentOutlined as AssignmentIcon,
  SwapHorizOutlined as SwapHorizIcon,
  LocalOfferOutlined as LocalOfferIcon,
  RestoreFromTrashOutlined as RevisionIcon,
  BusinessOutlined as BusinessIcon,
} from "@mui/icons-material";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import productService from "../../services/productService";
import PageLoader from "../../components/Common/PageLoader";
import ProductSalesSummary from "../../components/StockManagement/ProductSalesSummary";
import ProductSalesHistory from "../../components/StockManagement/ProductSalesHistory";
import ProductPurchaseHistory from "../../components/StockManagement/ProductPurchaseHistory";
import ProductTransferHistory from "../../components/StockManagement/ProductTransferHistory";
import ProductRevisionHistory from "../../components/StockManagement/ProductRevisionHistory";
import ProductInventoryLog from "../../components/StockManagement/ProductInventoryLog";
import ProductPromotions from "../../components/StockManagement/ProductPromotions";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import { useAuth } from "../../contexts/AuthContext";

import {
  WIDGET_SHADOW,
  WIDGET_SX,
  WIDGET_H3_SX,
  GRID_TABLE_SX,
  RAIL_FOCUS_SX,
  activateOnKey,
} from "../../components/StockManagement/productViewStyles";

// Right-rail navigation rows (reference: 62px rows, icon + 24px/400 label + 12px description)
const NAV_ITEMS = [
  {
    id: "home",
    label: "Home",
    icon: <HomeIcon sx={{ fontSize: 24 }} />,
    description: "View product details and basic statistics",
  },
  {
    id: "salesSummary",
    label: "Sales Summary",
    icon: <GridViewIcon sx={{ fontSize: 24 }} />,
    description: "See a quick snapshot of this product's sales history",
  },
  {
    id: "salesHistory",
    label: "Sales History",
    icon: <HistoryIcon sx={{ fontSize: 24 }} />,
    description: "View all sales for this product",
  },
  {
    id: "purchaseHistory",
    label: "Purchase History",
    icon: <AssignmentIcon sx={{ fontSize: 24 }} />,
    description: "View all purchases for this product",
  },
  {
    id: "transferHistory",
    label: "Transfer History",
    icon: <SwapHorizIcon sx={{ fontSize: 24 }} />,
    description: "View all transfers for this product",
  },
  {
    id: "promotions",
    label: "Promotions",
    icon: <LocalOfferIcon sx={{ fontSize: 24 }} />,
    description: "Check which promotions apply to the product",
  },
  {
    id: "revision",
    label: "Revision History",
    icon: <RevisionIcon sx={{ fontSize: 24 }} />,
    description: "Check the recent changes made to this product",
  },
  {
    id: "inventoryLog",
    label: "Inventory Log",
    icon: <BusinessIcon sx={{ fontSize: 24 }} />,
    description: "View the changes made to the inventory",
  },
];

// Short month name -> index. Deterministic replacement for Date.parse(), which
// silently yields NaN month keys (and a flat $0 chart) on any unexpected label.
const MONTH_ABBR = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

const ProductView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isSuperAdmin, getOutletName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);
  const sectionParam = searchParams.get("section");
  const activeTab = NAV_ITEMS.some((n) => n.id === sectionParam)
    ? sectionParam
    : "home";
  // Keep the open section in the URL so returning to this page (browser Back
  // from an invoice/transfer) restores the section instead of resetting to Home.
  const setActiveTab = (nextId) => {
    const next = new URLSearchParams(searchParams);
    if (nextId === "home") next.delete("section");
    else next.set("section", nextId);
    setSearchParams(next, { replace: true });
  };
  // Reference plots 13 points: the current month plus the previous twelve.
  const [salesSeries, setSalesSeries] = useState(new Array(13).fill(0));
  const [purchasesSeries, setPurchasesSeries] = useState(new Array(13).fill(0));
  const [monthLabels, setMonthLabels] = useState([]);
  // The chart used to paint a fully-drawn flat $0 curve while its data was
  // still in flight, which is indistinguishable from a product with no sales.
  const [chartLoading, setChartLoading] = useState(true);
  const chartContainerRef = useRef(null);
  // Guards against an older in-flight chart request overwriting newer data.
  const chartReqRef = useRef(0);
  const [chartWidth, setChartWidth] = useState(800);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [showInventoryExpanded, setShowInventoryExpanded] = useState(false);
  const [showSupplierExpanded, setShowSupplierExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadProductData();
    }
  }, [id]);

  useEffect(() => {
    if (product) {
      loadChartData();
    }
  }, [product]);

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
  }, [product]);

  const loadProductData = async () => {
    try {
      setLoading(true);
      const response = await productService.getProduct(id);
      console.log("Product data:", response.product); // Debug log
      setProduct(response.product);
    } catch (err) {
      setError("Failed to load product");
      console.error("Error loading product:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    const req = ++chartReqRef.current;
    setChartLoading(true);
    try {
      console.log("Loading chart data for product:", id);

      // Load sales summary data for the last 12 months
      const salesSummaryResponse = await productService.getProductSalesSummary(
        id,
        "monthly"
      );
      
      console.log("Sales summary response:", salesSummaryResponse);

      // Load purchase history from orders/invoices for the last 12 months
      // Get all purchases without pagination for chart data
      let purchaseData = [];
      try {
        // Calculate date range for last 12 months
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
        
        const purchaseResponse = await productService.getProductPurchaseHistory(id, {
          startDate: twelveMonthsAgo.toISOString(),
          endDate: now.toISOString(),
          limit: 1000, // Get a large number to include all purchases
          page: 1
        });
        console.log("Purchase response:", purchaseResponse);
        // Extract purchases from the response structure
        purchaseData = purchaseResponse.data?.purchases || purchaseResponse.purchases || [];
        console.log(`Loaded ${purchaseData.length} purchases from orders/invoices`);
      } catch (err) {
        console.error("Error loading purchase data:", err);
      }

      // Process sales and purchase data into monthly series
      const monthlySales = new Array(13).fill(0);
      const monthlyPurchases = new Array(13).fill(0);
      const monthLabels = [];

      // Generate the last 12 months in proper order
      const now = new Date();
      const salesMap = {};
      const purchasesMap = {};

      let salesData = null;
      
      // Try different possible response structures
      if (salesSummaryResponse?.summary?.last12Months) {
        salesData = salesSummaryResponse.summary.last12Months;
      } else if (salesSummaryResponse?.data?.summary?.last12Months) {
        salesData = salesSummaryResponse.data.summary.last12Months;
      } else if (salesSummaryResponse?.last12Months) {
        salesData = salesSummaryResponse.last12Months;
      }
      
      console.log("Sales data found:", salesData);

      if (salesData && Array.isArray(salesData)) {
        salesData.forEach((item) => {
          let monthKey = "";
          const period = item.period || item.month || "";
          
          if (period.includes(" ")) {
            // Format: "January 2025" or "Jan 2025"
            const parts = period.trim().split(" ");
            if (parts.length >= 2) {
              const monthIndex = MONTH_ABBR.indexOf(
                parts[0].slice(0, 3).toLowerCase()
              );
              const yearNum = parseInt(parts[parts.length - 1], 10);
              if (monthIndex >= 0 && !Number.isNaN(yearNum)) {
                monthKey = `${yearNum}-${String(monthIndex + 1).padStart(2, "0")}`;
              }
            }
          } else if (period.includes("-")) {
            // Format: "2025-01"
            monthKey = period;
          }

          if (monthKey) {
            const salesValue = parseFloat(item.sales) || 0;
            salesMap[monthKey] = salesValue;
            console.log(`Mapped sales for ${monthKey}: $${salesValue}`);
          }
        });
      }

      // Process purchase data from orders/invoices
      if (Array.isArray(purchaseData) && purchaseData.length > 0) {
        purchaseData.forEach((purchase) => {
          // Use orderDate from OrderInvoice table
          const dateStr = purchase.orderDate || purchase.date || purchase.purchaseDate || purchase.createdAt;
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = date.getMonth() + 1;
              const key = `${year}-${String(month).padStart(2, "0")}`;
              
              const totalCost = parseFloat(purchase.totalAmount || 0);
              
              purchasesMap[key] = (purchasesMap[key] || 0) + totalCost;
              console.log(`Mapped purchase for ${key}: $${totalCost} (Order: ${purchase.orderNumber || purchase.id})`);
            }
          }
        });
      }

        for (let i = 12; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const key = `${year}-${String(month).padStart(2, "0")}`;

        monthLabels.push({
          label: `${year} ${date.toLocaleDateString("en-US", { month: "short" })}`,
          key: key
        });

        const salesValue = salesMap[key] || 0;
        const purchaseValue = purchasesMap[key] || 0;
        
        monthlySales[12 - i] = salesValue;
        monthlyPurchases[12 - i] = purchaseValue;
      }

        console.log("Final monthly sales:", monthlySales);
      console.log("Final monthly purchases:", monthlyPurchases);
      console.log("Month labels:", monthLabels);

      if (req !== chartReqRef.current) return; // a newer request already won
      setSalesSeries(monthlySales);
      setPurchasesSeries(monthlyPurchases);
      setMonthLabels(monthLabels);
    } catch (err) {
      console.error("Error loading chart data:", err);
      console.error("Error stack:", err.stack);
      if (req !== chartReqRef.current) return;
      // Keep whatever series were already drawn - blanking them to zero on a
      // transient failure is what produced the "flat $0 chart" after remount.
      const defaultLabels = [];
      const now = new Date();
      for (let i = 12; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        defaultLabels.push({
          label: `${date.getFullYear()} ${date.toLocaleDateString("en-US", { month: "short" })}`,
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        });
      }
      setMonthLabels(defaultLabels);
    } finally {
      if (req === chartReqRef.current) setChartLoading(false);
    }
  };

  const handleEdit = () => {
    // Saving on the edit page comes back here (with the open section), not to the list.
    navigate(`/products/${id}/edit`, {
      state: { returnTo: `/products/${id}/view?section=${activeTab}` },
    });
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await productService.deleteProduct(id);
      // Ref: back to the products list (/inventory/products is a dead stub route)
      navigate("/products");
    } catch (err) {
      // Delete has documented failure reasons ("product is currently on order",
      // "we could not delete the product from the server"). Show the server's
      // reason instead of swallowing it behind a generic message.
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to delete product"
      );
      console.error("Error deleting product:", err);
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "salesSummary":
        return (
          <ProductSalesSummary productId={id} productName={product?.name} />
        );
      case "salesHistory":
        return (
          <ProductSalesHistory productId={id} productName={product?.name} />
        );
      case "purchaseHistory":
        return (
          <ProductPurchaseHistory productId={id} productName={product?.name} />
        );
      case "transferHistory":
        return (
          <ProductTransferHistory productId={id} productName={product?.name} />
        );
      case "promotions":
        return (
          <ProductPromotions productId={id} productName={product?.name} />
        );
      case "revision":
        return (
          <ProductRevisionHistory productId={id} productName={product?.name} />
        );
      case "inventoryLog":
        return (
          <ProductInventoryLog productId={id} productName={product?.name} />
        );
      default:
        return renderHomeContent();
    }
  };

  const renderHomeContent = () => (
    // Reference pane: #f8f8f8 behind transparent widgets, 8px 8px 0 padding.
    <Box sx={{ p: 1, pb: 0, bgcolor: "#f8f8f8", flexGrow: 1 }}>
      {/* Sales/Purchases Graph - bare chart on the page (no card, no internal title) */}
        <Box
          ref={chartContainerRef}
          sx={{
            mb: 2,
            position: "relative",
            width: "100%",
            minWidth: "100%",
          }}
        >
          {chartLoading ? (
            <Box
              sx={{
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress sx={{ color: "#5ebbeb" }} />
            </Box>
          ) : (() => {
            // Reference geometry: 300px svg, plot inset translate(80,10), 205px tall,
            // 20px right gutter, 13 points (current month + previous twelve).
            const svgHeight = 300;
            const padTop = 10;
            const plotHeight = 205;
            const padLeft = 80;
            const padRight = 20;
            const months = 13;
            const baselineY = padTop + plotHeight;

            const effectiveWidth = chartWidth > 0 ? chartWidth : 800;
                        const dataMax = Math.max(...salesSeries, ...purchasesSeries);
            let maxVal = 35; // Default minimum
            
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
              if (maxVal < 35) maxVal = 35;
            }
            
            const yScale = maxVal > 0 ? plotHeight / maxVal : 1;
            const scaleY = (v) => {
              // Ensure value is never negative
              const clampedValue = Math.max(0, v);
              // Calculate Y position: baselineY is at bottom, subtract scaled value to go up
              // In SVG, Y=0 is at top, so smaller Y values are higher on screen
                // y = baselineY means at bottom (value = 0)
              // y < baselineY means above bottom (value > 0)
              const y = baselineY - (clampedValue * yScale);
              // Ensure Y never goes above the top (padTop) or below baseline
              // Since we're subtracting, y will naturally be <= baselineY, so we just need to ensure it's >= padTop
              return Math.max(padTop, Math.min(baselineY, y));
            };
            const getX = (i, containerWidth) => {
              return padLeft + (i / (months - 1)) * (containerWidth - padLeft - padRight);
            };
            const labels = monthLabels.length > 0
              ? monthLabels
              : Array.from({ length: months }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - (months - 1 - i));
                  return {
                    label: `${d.getFullYear()} ${d.toLocaleDateString("en-US", { month: "short" })}`,
                    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
                  };
            });
            // Helper function to create smooth curve path
            const createSmoothPath = (dataSeries) => {
              if (dataSeries.length === 0) return "";
              if (dataSeries.length === 1) {
                const x = getX(0, effectiveWidth);
                const y = scaleY(dataSeries[0]);
                return `M ${x} ${y}`;
              }
              
              let path = "";
              const points = dataSeries.map((v, i) => ({
                x: getX(i, effectiveWidth),
                y: scaleY(v) // Already clamped in scaleY
              }));
              
              // Start with first point
              path += `M ${points[0].x} ${points[0].y}`;
              
              // Create smooth curves between points using cubic Bezier
              for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[Math.max(0, i - 1)];
                const p1 = points[i];
                const p2 = points[i + 1];
                const p3 = points[Math.min(points.length - 1, i + 2)];
                
                // Calculate control points for smooth curve
                const cp1x = p1.x + (p2.x - p0.x) / 6;
                let cp1y = p1.y + (p2.y - p0.y) / 6;
                const cp2x = p2.x - (p3.x - p1.x) / 6;
                let cp2y = p2.y - (p3.y - p1.y) / 6;
                
                // Clamp control points to stay within chart bounds (between padTop and baselineY)
                cp1y = Math.max(padTop, Math.min(baselineY, cp1y));
                cp2y = Math.max(padTop, Math.min(baselineY, cp2y));
                
                // Use cubic Bezier curve
                path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
              }
              
              return path;
            };
            
            // Create smooth curved paths
            const salesPath = createSmoothPath(salesSeries);
            
            // Create area path for sales (for area fill)
            const salesAreaPath = salesPath + 
              ` L ${getX(months - 1, effectiveWidth)} ${baselineY}` +
              ` L ${getX(0, effectiveWidth)} ${baselineY} Z`;
            
            // Create smooth curved path for purchases
            const purchasesPath = createSmoothPath(purchasesSeries);
            
            // Create area path for purchases (for area fill)
            const purchasesAreaPath = purchasesPath + 
              ` L ${getX(months - 1, effectiveWidth)} ${baselineY}` +
              ` L ${getX(0, effectiveWidth)} ${baselineY} Z`;
            
            // Calculate smart Y-axis tick values - limit to max 8 ticks for readability
            const calculateTicks = (max) => {
              if (max <= 0) return [0];
              
              // Determine appropriate step size
              const rawStep = max / 6; // Aim for ~6-8 ticks
              const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
              const normalized = rawStep / magnitude;
              
              // Choose nice step: 1, 2, 5, 10, 20, 50, 100, etc.
              let step;
              if (normalized <= 1) step = 1 * magnitude;
              else if (normalized <= 2) step = 2 * magnitude;
              else if (normalized <= 5) step = 5 * magnitude;
              else step = 10 * magnitude;
              
              // Generate ticks
              const ticks = [];
              for (let val = 0; val <= max + step * 0.1; val += step) {
                ticks.push(Math.round(val * 100) / 100); // Round to 2 decimals
              }
              
              // Ensure we show at least 0 and max
              if (ticks.length === 0) ticks.push(0);
              if (ticks[ticks.length - 1] < max) {
                ticks.push(Math.ceil(max / step) * step);
              }
              
              return ticks;
            };
            
            const yTicks = calculateTicks(maxVal);
            
            return (
              <Box sx={{ width: "100%", display: "flex", flexDirection: "column" }}>
                <Box sx={{ width: "100%", overflow: "visible", position: "relative" }}>
                <svg
                    width="100%"
                    height={svgHeight}
                    viewBox={`0 0 ${effectiveWidth} ${svgHeight}`}
                    preserveAspectRatio="none"
                    style={{ overflow: "visible", display: "block", minWidth: "100%" }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                      const actualWidth = rect.width;
                    const x = e.clientX - rect.left;
                      const stepX = (actualWidth - padLeft - padRight) / (months - 1);
                    const idx = Math.min(
                      months - 1,
                        Math.max(0, Math.round((x - padLeft) / stepX))
                    );
                    setHoverIndex(idx);
                      setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  {/* Reference draws a #ddd gridline on every tick, both axes,
                      and no separate axis strokes. */}
                  {yTicks.map((val) => (
                    <line
                      key={`gy-${val}`}
                      x1={padLeft}
                      y1={scaleY(val)}
                      x2={effectiveWidth - padRight}
                      y2={scaleY(val)}
                      stroke="#ddd"
                      strokeWidth="1"
                    />
                  ))}
                  {labels.map((_, i) => (
                    <line
                      key={`gx-${i}`}
                      x1={getX(i, effectiveWidth)}
                      y1={padTop}
                      x2={getX(i, effectiveWidth)}
                      y2={baselineY}
                      stroke="#ddd"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Y-axis labels */}
                  {yTicks.map((val) => (
                    <text
                      key={`label-${val}`}
                      x={padLeft - 10}
                      y={scaleY(val) + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#333"
                    >
                      ${val % 1 === 0 ? val : val.toFixed(2)}
                    </text>
                  ))}

                  {/* X-axis labels - in-SVG, rotated -30deg, anchored at the tick */}
                  {labels.map((labelObj, i) => (
                    <text
                      key={`xl-${i}`}
                      transform={`translate(${getX(i, effectiveWidth)},${baselineY}) translate(0,10) rotate(-30)`}
                      textAnchor="end"
                      fontSize="11"
                      fill="#333"
                    >
                      {labelObj.label || labelObj}
                    </text>
                  ))}

                  {/* Legend - 16px swatches, 11px #333, 100px apart, centred */}
                  <g
                    transform={`translate(${(effectiveWidth - 200) / 2},${
                      baselineY + 40
                    })`}
                  >
                    {[
                      { label: "Purchases", color: "#e3342f" },
                      { label: "Sales", color: "#5ebbeb" },
                    ].map((item, i) => (
                      <g key={item.label} transform={`translate(${i * 100},0)`}>
                        <rect x="0" y="2" width="16" height="16" fill={item.color} />
                        <text
                          x="24"
                          y="10"
                          fontSize="11"
                          fill="#333"
                          dominantBaseline="middle"
                        >
                          {item.label}
                        </text>
                      </g>
                    ))}
                  </g>


                  {/* Purchases area fill (render first so it's behind sales) */}
                  <path
                    d={purchasesAreaPath}
                    fill="#e3342f"
                    fillOpacity="0.1"
                  />
                  
                  {/* Sales area fill */}
                  <path
                    d={salesAreaPath}
                    fill="#5ebbeb"
                    fillOpacity="0.1"
                  />
                  
                  {/* Purchases line (red) - smooth curve */}
                  <path
                    d={purchasesPath}
                    stroke="#e3342f"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Sales line (blue) - smooth curve */}
                  <path
                    d={salesPath}
                    stroke="#5ebbeb"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  
                  {/* Sales dots */}
                  {salesSeries.map((v, i) => {
                    const x = getX(i, effectiveWidth);
                    const y = scaleY(v); // Already clamped in scaleY
                    return (
                      <circle
                        key={`s-${i}`}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#5ebbeb"
                      />
                    );
                  })}
                  
                  {/* Purchases dots */}
                  {purchasesSeries.map((v, i) => {
                    const x = getX(i, effectiveWidth);
                    const y = scaleY(v); // Already clamped in scaleY
                    return (
                      <circle
                        key={`p-${i}`}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#e3342f"
                      />
                    );
                  })}
                  
                  {/* Hover guide line */}
                  {hoverIndex !== null && (
                    <line
                      x1={getX(hoverIndex, effectiveWidth)}
                      y1={padTop}
                      x2={getX(hoverIndex, effectiveWidth)}
                      y2={baselineY}
                      stroke="#999"
                      strokeDasharray="4,4"
                      strokeWidth="1"
                    />
                  )}
                </svg>
                </Box>
              </Box>
            );
          })()}
          
          {/* Hover tooltip - white, black text, colored swatches (Purchases then Sales) */}
          {!chartLoading && hoverIndex !== null && (
            <Paper
              sx={{
                position: "absolute",
                // Anchor to the cursor and flip to its left past the midpoint,
                // so the tooltip never overhangs the chart and forces a scrollbar.
                left: hoverPos.x,
                top: hoverPos.y + 10,
                transform:
                  hoverPos.x > chartWidth / 2
                    ? "translateX(calc(-100% - 10px))"
                    : "translateX(10px)",
                whiteSpace: "nowrap",
                p: 1.25,
                bgcolor: "#fff",
                color: "#000",
                border: "1px solid #ccc",
                pointerEvents: "none",
                zIndex: 1000,
                borderRadius: 0,
                minWidth: 140,
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Box sx={{ width: 10, height: 10, bgcolor: "#e3342f", flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: "#000", lineHeight: 1.2 }}>
                  Purchases ${purchasesSeries[hoverIndex]?.toFixed(2) || "0.00"}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 10, height: 10, bgcolor: "#5ebbeb", flexShrink: 0 }} />
                <Typography sx={{ fontSize: 12, color: "#000", lineHeight: 1.2 }}>
                  Sales ${salesSeries[hoverIndex]?.toFixed(2) || "0.00"}
                </Typography>
              </Box>
            </Paper>
          )}
        </Box>

      {/* Relevant Prices - full-width widget above the two columns */}
      <Paper elevation={0} sx={WIDGET_SX}>
        <TableContainer>
          <Table sx={GRID_TABLE_SX}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ padding: "16px 10px !important" }}>Source</TableCell>
                <TableCell sx={{ width: 120 }}>Quantity</TableCell>
                <TableCell sx={{ width: 150 }}>Price</TableCell>
                <TableCell sx={{ width: 120 }}>Cost</TableCell>
                <TableCell sx={{ width: 120 }}>%</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Full-width grey group row under the header */}
              <TableRow sx={{ backgroundColor: "#ebebeb" }}>
                <TableCell
                  colSpan={5}
                  sx={{ fontSize: "19.2px !important", padding: "16px !important" }}
                >
                  Relevant Prices
                </TableCell>
              </TableRow>
              {Array.isArray(product?.prices) && product.prices.length > 0 ? (
                [...product.prices]
                  .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
                  .map((p, idx) => {
                    const qty = p.quantity || 1;
                    const price = Number(p.price) || 0;
                    // Cost is derived from the product cost; stored 0 (legacy bad rows) falls back too
                    const cost = Number(p.cost) || (Number(product?.itemCost || 0) * qty) || 0;
                    const margin = price > 0 ? (((price - cost) / price) * 100) : 0;
                    return (
                      <TableRow key={`price-${idx}`}>
                        <TableCell sx={{ padding: "16px 10px !important" }}>
                          Default Price
                        </TableCell>
                        <TableCell sx={{ padding: "16px !important" }}>{qty}</TableCell>
                        <TableCell sx={{ padding: "16px !important" }}>
                          ${price.toFixed(2)}
                        </TableCell>
                        {/* Cost is derived, not editable - reference greys it out */}
                        <TableCell
                          sx={{
                            padding: "16px !important",
                            backgroundColor: "#bdbdbd !important",
                          }}
                        >
                          ${cost.toFixed(2)}
                        </TableCell>
                        <TableCell sx={{ padding: "16px !important" }}>
                          {margin.toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    );
                  })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} sx={{ padding: "16px !important" }}>
                    No prices configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {/* Reference lays the remaining widgets out with CSS columns (count 2,
          16px gap), so each column packs independently instead of row-aligning. */}
      <Box sx={{ columnCount: { xs: 1, md: 2 }, columnGap: 2 }}>
        {/* Details widget - stacked bold label with plain value underneath */}
        <Paper elevation={0} sx={WIDGET_SX}>
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#000" }}>
                Case Quantity
              </Typography>
              <Typography sx={{ fontWeight: 400, fontSize: 16, color: "#000" }}>
                {product?.caseQuantity || 0}
              </Typography>
            </Box>
            <Box sx={{ mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#000" }}>
                Tax Rate
              </Typography>
              <Typography sx={{ fontWeight: 400, fontSize: 16, color: "#000" }}>
                {product?.retailTaxRate || "N/A"}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#000" }}>
                Category
              </Typography>
              <Typography sx={{ fontWeight: 400, fontSize: 16, color: "#000" }}>
                {product?.category?.name || "N/A"}
              </Typography>
            </Box>
        </Paper>

        {/* Inventory summary - click to expand/collapse */}
        <Paper
          elevation={0}
          sx={{
            ...WIDGET_SX,
            cursor: "pointer",
            "&:hover": { backgroundColor: "rgba(0,0,0,0.02)" },
          }}
          onClick={() => setShowInventoryExpanded(!showInventoryExpanded)}
        >
            <Typography component="h3" sx={WIDGET_H3_SX}>Inventory</Typography>
            {(() => {
              const hasOutletRows = Array.isArray(product?.product_outlets) && product.product_outlets.length > 0;
              const rows = hasOutletRows
                ? product.product_outlets.map((po) => ({
                    outletName: po.outlets?.name ?? "Outlet",
                    cases: po.currentStockCases ?? 0,
                    items: po.currentStockItems ?? 0,
                    reorderLevelCases: po.reorderLevelCases ?? 0,
                    reorderLevelItems: po.reorderLevelItems ?? 0,
                    reorderAmountCases: po.reorderAmountCases ?? 0,
                    reorderAmountItems: po.reorderAmountItems ?? 0,
                  }))
                : [
                    {
                      // Global products (outletId null) follow the app-wide convention:
                      // 'Global' for super admins, otherwise the viewer's own outlet.
                      outletName:
                        product?.outlet?.name ??
                        (isSuperAdmin() ? "Global" : getOutletName() || "N/A"),
                      cases: product?.currentStockCases ?? 0,
                      items: product?.currentStockItems ?? 0,
                      reorderLevelCases: product?.reorderLevelCases ?? 0,
                      reorderLevelItems: product?.reorderLevelItems ?? 0,
                      reorderAmountCases: product?.reorderAmountCases ?? 0,
                      reorderAmountItems: product?.reorderAmountItems ?? 0,
                    },
                  ];
              const totalCases = rows.reduce((s, r) => s + (r.cases || 0), 0);
              const totalItems = rows.reduce((s, r) => s + (r.items || 0), 0);
              return (
                <>
                  {/* Reference: flex space-around, 32px/400 figure over a 16px label */}
                  <Box sx={{ display: "flex", justifyContent: "space-around" }}>
                    {[
                      { value: totalCases, label: "Cases" },
                      { value: totalItems, label: "Items" },
                    ].map((stat) => (
                      <Box key={stat.label} sx={{ textAlign: "center" }}>
                        <Typography sx={{ fontSize: 32, fontWeight: 400, color: "#000" }}>
                          {stat.value}
                        </Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 400, color: "#000" }}>
                          {stat.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {showInventoryExpanded && (
                    <TableContainer sx={{ mt: 2 }} onClick={(e) => e.stopPropagation()}>
                      <Table sx={GRID_TABLE_SX}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Outlet</TableCell>
                            <TableCell>Cases</TableCell>
                            <TableCell>Items</TableCell>
                            <TableCell colSpan={2}>Reorder Level</TableCell>
                            <TableCell colSpan={2}>Reorder Amount</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell /><TableCell /><TableCell />
                            <TableCell>Cases</TableCell>
                            <TableCell>Items</TableCell>
                            <TableCell>Cases</TableCell>
                            <TableCell>Items</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {rows.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.outletName}</TableCell>
                              <TableCell align="center">{row.cases}</TableCell>
                              <TableCell align="center">{row.items}</TableCell>
                              <TableCell align="center">{row.reorderLevelCases}</TableCell>
                              <TableCell align="center">{row.reorderLevelItems}</TableCell>
                              <TableCell align="center">{row.reorderAmountCases}</TableCell>
                              <TableCell align="center">{row.reorderAmountItems}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              );
            })()}
        </Paper>

        {/* Barcodes table */}
        <Paper elevation={0} sx={WIDGET_SX}>
          <Typography component="h3" sx={WIDGET_H3_SX}>Barcodes</Typography>
          <Table sx={GRID_TABLE_SX}>
            <TableHead>
              <TableRow>
                <TableCell>Quantity</TableCell>
                <TableCell>Barcode</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Array.isArray(product?.barcodes) && product.barcodes.length > 0 ? (
                product.barcodes.map((b, i) => (
                  <TableRow key={`bc-${i}`}>
                    <TableCell align="center">{b.quantity || 1}</TableCell>
                    <TableCell>{b.code || b}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} align="center">No barcodes</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>

        {/* Core Supplier - click to expand/collapse */}
        <Paper
          elevation={0}
          sx={{
            ...WIDGET_SX,
            mb: 0,
            cursor: "pointer",
            "&:hover": { backgroundColor: "rgba(0,0,0,0.02)" },
          }}
          onClick={() => setShowSupplierExpanded(!showSupplierExpanded)}
        >
            <Typography component="h3" sx={WIDGET_H3_SX}>Core Supplier</Typography>
            {(() => {
              const list = Array.isArray(product?.suppliers) ? product.suppliers : [];
              const core = list.find((s) => s.isCoreSupplier);
              const supplierName = core?.supplier?.name || core?.name || "";
              const supplierCode = core?.code ?? core?.supplier?.code ?? "";
              return (
                <>
                  <Box sx={{ textAlign: "center" }}>
                    <Typography sx={{ fontSize: "19.2px", fontWeight: 400, color: "#000" }}>
                      {supplierName || "N/A"}
                    </Typography>
                    {supplierCode && (
                      <Typography sx={{ fontSize: "19.2px", fontWeight: 400, color: "#000" }}>
                        {supplierCode}
                      </Typography>
                    )}
                  </Box>
                  {showSupplierExpanded && list.length > 0 && (
                    <TableContainer sx={{ mt: 2 }} onClick={(e) => e.stopPropagation()}>
                      <Table sx={GRID_TABLE_SX}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Supplier</TableCell>
                            <TableCell>Code</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {list.map((s, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{s.supplier?.name ?? s.name ?? ""}</TableCell>
                              <TableCell>{s.code ?? s.supplier?.code ?? ""}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </>
              );
            })()}
        </Paper>
      </Box>
    </Box>
  );

  if (loading) {
    return <PageLoader />;
  }

  if (!product) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Product not found</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{ display: "flex", height: "calc(100vh - 50px)", bgcolor: "#464a4e" }}
    >
      {/* Main Content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {/* Header - 16px padding, heavy widget shadow (63px tall) */}
        <Box
          sx={{
            textAlign: "center",
            mb: 1,
            backgroundColor: "#f8f8f8",
            border: "1px solid #000",
            padding: "16px",
            boxShadow: WIDGET_SHADOW,
          }}
        >
          <Typography
            sx={{
              fontWeight: 400,
              fontSize: 24,
              color: "#000",
              lineHeight: "29px",
            }}
          >
            {product?.name || "Unnamed Product"}
          </Typography>
        </Box>
        {/* Content pane - sits directly on the page (no border, no card shadow) */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            bgcolor: "#fff",
            overflow: "auto",
          }}
        >
          {/* Fade the swapped-in section instead of an instant unmount/remount */}
          <Fade in key={activeTab} timeout={250}>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {renderMainContent()}
            </Box>
          </Fade>
        </Box>
      </Box>
      {/* Right rail - Edit card, nav card, Delete card (Shopfront reference) */}
      <Box
        sx={{
          width: 300,
          height: "100%",
          pl: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Edit - full-width 62px rail card */}
        <Box
          onClick={handleEdit}
          onKeyDown={activateOnKey(handleEdit)}
          role="button"
          tabIndex={0}
          aria-label="Edit product"
          sx={{
            ...RAIL_FOCUS_SX,
            height: 62,
            minHeight: 62,
            mb: 1,
            backgroundColor: "#f8f8f8",
            boxShadow: WIDGET_SHADOW,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            p: 1,
            gap: 1,
            cursor: "pointer",
            color: "#32b643",
            // Rail-button slide (Dashboard rail pattern, 300ms) + colour transition
            transition: "color 0.2s ease, transform 0.3s ease",
            "&:hover": {
              color: "rgb(109, 215, 123)",
              transform: "translateX(-8px)",
            },
          }}
        >
          <EditIcon sx={{ fontSize: 24 }} />
          <Typography
            sx={{ fontSize: 24, fontWeight: 400, color: "inherit", lineHeight: 1 }}
          >
            Edit
          </Typography>
        </Box>

        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {/* Navigation card - 62px rows, hover recolors text/icon to #5ebbeb */}
          <Box
            role="tablist"
            aria-label="Product sections"
            sx={{
              backgroundColor: "#f8f8f8",
              boxShadow: WIDGET_SHADOW,
              // Reference leaves ~120px of page background here; we stretch the
              // card to the Delete button instead so the rail reads as one block.
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              py: "4px",
            }}
          >
            {NAV_ITEMS.map((item, idx) => {
              const isActive = activeTab === item.id;
              return (
                <Box
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  onKeyDown={activateOnKey(() => setActiveTab(item.id))}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  sx={{
                    ...RAIL_FOCUS_SX,
                    position: "relative",
                    height: 62,
                    display: "flex",
                    alignItems: "center",
                    px: 1,
                    mb: idx === NAV_ITEMS.length - 1 ? 0 : "8px",
                    borderRadius: 0,
                    cursor: "pointer",
                    overflow: "hidden",
                    color: isActive ? "#5ebbeb" : "#000",
                    transition: "color 0.2s ease",
                    "&:hover": {
                      color: isActive ? "rgb(49, 168, 229)" : "#5ebbeb",
                      "& .rail-sub": { color: "inherit" },
                    },
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: "4px",
                      backgroundColor: isActive ? "#5ebbeb" : "transparent",
                    },
                  }}
                >
                  <Box
                    sx={{
                      minWidth: 40,
                      display: "flex",
                      alignItems: "center",
                      color: "inherit",
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 24,
                        fontWeight: 400,
                        lineHeight: 1.2,
                        color: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.label}
                    </Typography>
                    <Typography
                      className="rail-sub"
                      sx={{
                        fontSize: 12,
                        lineHeight: 1.2,
                        color: isActive ? "inherit" : "#676b72",
                        transition: "color 0.2s ease",
                      }}
                    >
                      {item.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          {/* Delete - full-width 62px rail card pinned at the bottom */}
          <Box
            onClick={handleDelete}
            onKeyDown={activateOnKey(handleDelete)}
            role="button"
            tabIndex={0}
            aria-label="Delete product"
            sx={{
              ...RAIL_FOCUS_SX,
              height: 62,
              minHeight: 62,
              mt: 1,
              backgroundColor: "#f8f8f8",
              boxShadow: WIDGET_SHADOW,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              cursor: "pointer",
              color: "#e3342f",
              transition: "color 0.2s ease",
              "&:hover": { color: "rgb(243, 170, 168)" },
            }}
          >
            <DeleteIcon sx={{ fontSize: 24 }} />
            <Typography
              sx={{ fontSize: 24, fontWeight: 400, color: "inherit", lineHeight: 1 }}
            >
              Delete
            </Typography>
          </Box>
        </Box>
      </Box>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete"
        message={`Are you sure you want to delete "${product?.name}"? This action cannot be undone.`}
        loading={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
};

export default ProductView;
