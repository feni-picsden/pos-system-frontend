import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from "@mui/material";
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Home as HomeIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import { useParams, useNavigate } from "react-router-dom";
import promotionService from "../../services/promotionService";
import apiClient from "../../services/apiClient";
import { format } from "date-fns";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import PageLoader from "../../components/Common/PageLoader";
import { getBaseTier } from "../../utils/baseTier";
import { formatRevisionValue } from "../../utils/revisionValue";
import {
  WIDGET_SHADOW,
  GRID_TABLE_SX,
  SECTION_ROOT_SX,
  RAIL_FOCUS_SX,
  activateOnKey,
} from "../../components/StockManagement/productViewStyles";

const PromotionView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [revisions, setRevisions] = useState([]);
  const [missingItems, setMissingItems] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadPromotionData();
    }
  }, [id]);

  // Real per-field change rows from the server (GET /promotions/:id/revisions),
  // newest first. noCache so an edit made a moment ago isn't hidden by the TTL.
  useEffect(() => {
    if (!promotion?.id) return;
    let cancelled = false;
    apiClient
      .get(`/promotions/${promotion.id}/revisions`, { noCache: true })
      .then((res) => {
        if (!cancelled) setRevisions(res.data?.revisions || []);
      })
      .catch(() => {
        if (!cancelled) setRevisions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [promotion?.id]);

  const loadPromotionData = async () => {
    try {
      setLoading(true);
      const response = await promotionService.getPromotion(id);
      const promo = response.promotion || response;
      setPromotion(promo);
      
      const expressTypes = ['Price Override', 'Discount Percentage', 'Discount Amount'];
      if (expressTypes.includes(promo.promotionType)) {
        navigate(`/marketing/promotions/express/${id}/view`);
        return;
      }

      calculateMissingItems(promo);
    } catch (err) {
      setError("Failed to load promotion");
      console.error("Error loading promotion:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMissingItems = (promo) => {
    const missing = [];
    if (promo.conditions?.criteria) {
      promo.conditions.criteria.forEach((criterion) => {
        if (criterion.items) {
          criterion.items.forEach((item) => {
            if (!item.productId || item.excluded) {
              missing.push({
                ...item,
                criterion: criterion,
              });
            }
          });
        }
      });
    }
    setMissingItems(missing);
  };

  const handleEdit = () => {
    navigate(`/marketing/promotions/${id}/edit`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await promotionService.deletePromotion(id);
      navigate("/marketing/promotions");
    } catch (err) {
      setError("Failed to delete promotion");
      console.error("Error deleting promotion:", err);
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (isoDate) => {
    try {
      return new Date(isoDate).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch {
      return "-";
    }
  };

  // Reference ".promotion-home-header" label: 16px all-small-caps, grey.
  const HEADER_LABEL_SX = {
    fontSize: 16,
    fontVariant: "all-small-caps",
    color: "#676b72",
    lineHeight: 1.2,
  };
  // Reference section label ("CRITERIA" / "MISSING ITEMS").
  const SECTION_LABEL_SX = { ...HEADER_LABEL_SX, mb: 1.5 };

  // Margin on the promo sell price. Uses the BASE tier for price/cost sourcing
  // (a saved promo may have snapshotted a bulk-tier cost as if per-unit), applies
  // any supplier rebate, and returns null when a real cost is unknown. Kept in
  // sync with the editor (PromotionDetails) so the same promo shows one number.
  const calculateItemProfitBasis = (criterion, item) => {
    if (!item || item.excluded) return null;
    const qty = parseFloat(criterion.purchaseValue) || 0;
    if (qty === 0) return null;

    const baseTier = getBaseTier(item.pricingTiers);
    const pricePerUnit = parseFloat(baseTier?.price ?? item.originalPrice) || 0;
    const rawCostPerUnit = parseFloat(baseTier?.cost ?? item.cost) || 0;
    if (!(rawCostPerUnit > 0)) return null;

    const rebatePerUnit = parseFloat(item.rebateAmount) || 0;
    const costPerUnit = Math.max(0, rawCostPerUnit - rebatePerUnit);

    const rv = parseFloat(criterion.receiveValue) || 0;
    let sell = null;
    const cost = costPerUnit * qty;

    switch (criterion.receiveType) {
      case 'quantity_only': sell = pricePerUnit * qty; break;
      case 'total_price': sell = rv; break;
      case 'each_item_for': sell = rv * qty; break;
      case 'discount_each_item': sell = (pricePerUnit - rv) * qty; break;
      case 'discount_total': sell = pricePerUnit * qty - rv; break;
      case 'percentage_discount': sell = pricePerUnit * qty * (1 - rv / 100); break;
      case 'discount':
        if (criterion.purchaseType === 'purchase') sell = pricePerUnit * qty - rv;
        else return null;
        break;
      case 'same_sell_rate': sell = pricePerUnit * qty; break;
      default: return null;
    }
    if (sell == null || !isFinite(sell) || !isFinite(cost)) return null;
    return { sell, cost };
  };

  const calculateItemProfit = (criterion, item) => {
    const b = calculateItemProfitBasis(criterion, item);
    if (!b || b.sell <= 0) return null;
    const profit = ((b.sell - b.cost) / b.sell) * 100;
    return isFinite(profit) ? profit : null;
  };

  const calculateCriterionProfit = (criterion) => {
    const items = (criterion.items || []).filter((it) => !it.excluded);
    if (items.length === 0) return null;
    let totalSell = 0;
    let totalCost = 0;
    let have = false;
    items.forEach((it) => {
      const b = calculateItemProfitBasis(criterion, it);
      if (b && b.sell > 0) { totalSell += b.sell; totalCost += b.cost; have = true; }
    });
    if (!have || totalSell <= 0) return null;
    return ((totalSell - totalCost) / totalSell) * 100;
  };

  const formatProfitPct = (v) => (v == null || isNaN(v) ? 'N/A' : `${v.toFixed(2)}%`);

  const getCriterionSummary = (criterion) => {
    const optionalText = criterion.isOptional ? 'Optionally' : '';
    const purchaseText = criterion.purchaseType === 'purchase' ? 'purchase' : 'spend';
    
    const receiveTextMap = {
      'quantity_only': '(quantity only)',
      'each_item_for': 'each item for',
      'total_price': 'a total price of',
      'discount_each_item': 'a discount on each item worth',
      'discount_total': 'a discount off the total worth',
      'percentage_discount': 'a percentage discount of',
      'same_sell_rate': 'the same sell rate as if the quantity was',
      'discount': 'a discount of',
    };
    
    const receiveText = receiveTextMap[criterion.receiveType] || 'a total price of';
    
    if (criterion.receiveType === 'percentage_discount') {
      return `${optionalText} ${purchaseText} ${criterion.purchaseValue} to receive ${receiveText} ${criterion.receiveValue?.toFixed(2) || 0}%`;
    }
    
    return `${optionalText} ${purchaseText} ${criterion.purchaseValue} to receive ${receiveText} $${criterion.receiveValue?.toFixed(2) || 0}`;
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!promotion) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Promotion not found</Alert>
      </Box>
    );
  }

  // Right-rail rows, same shape as the product view (62px, icon + 24px label
  // + 12px description).
  const navigationItems = [
    {
      id: "home",
      label: "Home",
      icon: <HomeIcon sx={{ fontSize: 24 }} />,
      description: "View promotion details and criteria",
    },
    {
      id: "revision",
      label: "Revision History",
      icon: <HistoryIcon sx={{ fontSize: 24 }} />,
      description: "Every change made to this promotion",
    },
  ];

  const criteria = promotion.conditions?.criteria || [];

  return (
    <Box
      sx={{ display: "flex", height: "calc(100vh - 50px)", bgcolor: "#464a4e" }}
    >
      {/* Main Content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
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
            {promotion.name}
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
          <Box sx={{ ...SECTION_ROOT_SX, display: "flex", flexDirection: "column" }}>
          {activeTab === "revision" ? (
            <>
              <TableContainer sx={{ flex: 1 }}>
                <Table size="small" sx={GRID_TABLE_SX}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Field</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>From</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>To</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ bgcolor: "#eeeeee" }}>
                        <Typography variant="caption">
                          Please Note: Revisions may take up to five minutes to
                          appear
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {revisions && revisions.length > 0 ? (
                      revisions.map((rev, idx) => (
                        <TableRow key={`rev-${idx}`}>
                          <TableCell>{rev.field}</TableCell>
                          <TableCell>{formatRevisionValue(rev.from)}</TableCell>
                          <TableCell>{formatRevisionValue(rev.to)}</TableCell>
                          <TableCell>{rev.user || "-"}</TableCell>
                          <TableCell>{formatDateTime(rev.timestamp)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No revisions found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : (
            <>
              {/* Reference .promotion-home-header: space-evenly, natural widths,
                  and items with no value are omitted entirely. */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-evenly",
                  padding: "16px",
                  mb: 4,
                }}
              >
                {[
                  { label: "Start", value: promotion.startDate && formatDate(promotion.startDate) },
                  { label: "End", value: promotion.endDate && formatDate(promotion.endDate) },
                  { label: "Promotion Category", value: promotion.category?.name },
                ]
                  .filter((h) => h.value)
                  .map((h) => (
                    <Box key={h.label} sx={{ textAlign: "center" }}>
                      <Typography sx={HEADER_LABEL_SX}>{h.label}</Typography>
                      <Typography sx={{ fontSize: 24, color: "#313439", lineHeight: 1.3 }}>
                        {h.value}
                      </Typography>
                    </Box>
                  ))}
              </Box>

              {/* Combo Deal Section (promotionType === 'Combo Deal') */}
              {promotion.promotionType === "Combo Deal" && (() => {
                const combo = promotion.conditions?.combo || null;
                const comboViewItems =
                  combo?.items && combo.items.length > 0
                    ? combo.items
                    : (promotion.items || []).map((it) => ({
                        productId: it.productId,
                        productName: it.productName || it.product?.name,
                        quantity: it.quantity,
                        unitPrice: it.normalPrice,
                      }));
                const normalTotal = comboViewItems.reduce(
                  (sum, it) =>
                    sum + (parseFloat(it.unitPrice) || 0) * (parseInt(it.quantity) || 1),
                  0
                );
                const comboPriceVal = parseFloat(combo?.comboPrice);
                return (
                  <Box sx={{ mb: 4 }}>
                    <Typography
                      sx={{
                        fontSize: 12,
                        letterSpacing: "1px",
                        textTransform: "uppercase",
                        color: "#676b72",
                        mb: 1.5,
                      }}
                    >
                      Combo Deal
                    </Typography>
                    {comboViewItems.length === 0 ? (
                      <Typography sx={{ color: "#676b72", fontStyle: "italic" }}>
                        No products configured in this combo.
                      </Typography>
                    ) : (
                      comboViewItems.map((item, idx) => (
                        <Box
                          key={item.productId ?? idx}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 2,
                            mt: 0.75,
                          }}
                        >
                          <Typography sx={{ color: "#313439" }}>
                            {item.productName || "Unknown Product"} x {item.quantity || 1}
                          </Typography>
                          <Typography sx={{ color: "#313439", whiteSpace: "nowrap" }}>
                            ${(parseFloat(item.unitPrice) || 0).toFixed(2)} each
                          </Typography>
                        </Box>
                      ))
                    )}
                    <Typography sx={{ fontWeight: 700, color: "#313439", mt: 1.5 }}>
                      Combo Price ${isNaN(comboPriceVal) ? "0.00" : comboPriceVal.toFixed(2)}{" "}
                      (normally ${normalTotal.toFixed(2)})
                    </Typography>
                  </Box>
                );
              })()}

              {/* Reference .promotion-home-criteria-list.advanced */}
              <Box sx={{ width: "90%", maxWidth: 800, margin: "auto", padding: "16px" }}>
              {criteria.length > 0 && (
                <Typography sx={SECTION_LABEL_SX}>Criteria</Typography>
              )}
              {criteria.map((criterion, criterionIndex) => {
                const criterionProfit = calculateCriterionProfit(criterion);
                const activeItems = (criterion.items || []).filter((item) => !item.excluded);
                return (
                  <Box key={criterionIndex} sx={{ mb: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#313439" }}>
                        {getCriterionSummary(criterion)}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 16,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          color: criterionProfit < 0 ? "#e33430" : "#313439",
                        }}
                      >
                        {formatProfitPct(criterionProfit)}
                      </Typography>
                    </Box>
                    {activeItems.map((item, itemIndex) => {
                      const profit = calculateItemProfit(criterion, item);
                      return (
                        <Box
                          key={itemIndex}
                          sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2, mb: "4px" }}
                        >
                          <Box sx={{ display: "flex", alignItems: "baseline", gap: 2, minWidth: 0 }}>
                            <Typography
                              component="span"
                              sx={{
                                fontSize: 16,
                                fontVariant: "all-small-caps",
                                letterSpacing: "1px",
                                color: "#676b72",
                                flexShrink: 0,
                                minWidth: 96,
                                textAlign: "right",
                              }}
                            >
                              {/* Reference prints the group label once per item type */}
                              {(item.type || "Product") !==
                              (activeItems[itemIndex - 1]?.type || (itemIndex === 0 ? null : "Product"))
                                ? `${item.type || "Product"}s`
                                : ""}
                            </Typography>
                            <Typography component="span" sx={{ fontSize: 16, color: "#313439" }}>
                              {item.name || item.productName || "Unknown Product"}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{ fontSize: 16, whiteSpace: "nowrap", color: profit < 0 ? "#e33430" : "#313439" }}
                          >
                            {formatProfitPct(profit)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })}

              {/* Missing Items - reference 4-column layout with a green
                  "Add to Promotion" action per row */}
              {missingItems.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Typography sx={SECTION_LABEL_SX}>Missing Items</Typography>
                  <Typography sx={{ fontSize: 16, color: "#313439", mb: 2 }}>
                    We&apos;ve detected the following items exist in the promotion, however
                    aren&apos;t available in this promotion for your store.
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr auto",
                      columnGap: 2,
                      rowGap: 1,
                      alignItems: "center",
                      "& .mi-head": {
                        fontSize: 16,
                        fontVariant: "all-small-caps",
                        letterSpacing: "1px",
                        color: "#676b72",
                        textAlign: "center",
                      },
                      "& .mi-cell": { fontSize: 16, color: "#313439", textAlign: "center" },
                    }}
                  >
                    <Typography className="mi-head">Item</Typography>
                    <Typography className="mi-head">Your Item</Typography>
                    <Typography className="mi-head">Criteria</Typography>
                    <Box />
                    {missingItems.map((item, index) => (
                      <React.Fragment key={index}>
                        <Typography className="mi-cell">
                          {item.name || item.productName || "Unknown Product"}
                        </Typography>
                        <Typography className="mi-cell">Not Matched</Typography>
                        <Typography className="mi-cell">
                          {getCriterionSummary(item.criterion)}
                        </Typography>
                        <Button
                          onClick={() => navigate(`/marketing/promotions/${id}/edit`)}
                          sx={{
                            border: "1px solid #e0e0e0",
                            borderRadius: "12px",
                            height: 42,
                            padding: "8px 32px",
                            fontSize: 16,
                            fontWeight: 700,
                            textTransform: "none",
                            color: "#16a34a",
                            backgroundColor: "transparent",
                            boxShadow: "none",
                            "&:hover": { backgroundColor: "transparent", borderColor: "#16a34a" },
                          }}
                        >
                          Add to Promotion
                        </Button>
                      </React.Fragment>
                    ))}
                  </Box>
                </Box>
              )}
              </Box>
            </>
          )}
          </Box>
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
          aria-label="Edit promotion"
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
            // Reference transitions colour only - no movement, no bg change.
            transition: "color 0.2s ease",
            "&:hover": { color: "rgb(85, 201, 100)" },
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
            aria-label="Promotion sections"
            sx={{
              backgroundColor: "#f8f8f8",
              boxShadow: WIDGET_SHADOW,
              // Stretched to the Delete button so the rail reads as one block
              // (same deliberate deviation as the product view).
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              py: "4px",
            }}
          >
            {navigationItems.map((item, idx) => {
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
                    mb: idx === navigationItems.length - 1 ? 0 : "8px",
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
            aria-label="Delete promotion"
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
        title="Delete Promotion"
        message={`Are you sure you want to delete ${promotion?.name || ""}?`}
        loading={deleting}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default PromotionView;

