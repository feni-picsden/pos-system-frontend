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
// Reference rail glyphs are outlined: pencil, trash, house, clock.
import {
  EditOutlined as EditIcon,
  DeleteOutlineOutlined as DeleteIcon,
  HomeOutlined as HomeIcon,
  AccessTimeOutlined as HistoryIcon,
} from "@mui/icons-material";
import { useParams, useNavigate, Link as RouterLink } from "react-router-dom";
import promotionService from "../../services/promotionService";
import productService from "../../services/productService";
import apiClient from "../../services/apiClient";
import { getBaseTier } from "../../utils/baseTier";
import { formatRevisionValue } from "../../utils/revisionValue";
import { format } from "date-fns";
import { formatAppPattern } from "../../utils/appDateTime";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import {
  WIDGET_SHADOW,
  GRID_TABLE_SX,
  SECTION_ROOT_SX,
  RAIL_FOCUS_SX,
  activateOnKey,
} from "../../components/StockManagement/productViewStyles";

// Two vocabularies write express promotions: the express editor stores its own type
// names, the create wizard stores its card names. Both are the same three single-condition
// promotions, so map wizard names onto the editor names instead of whitelisting one set
// (that whitelist bounced every wizard-created express promotion to the generic view).
const EXPRESS_TYPE_ALIASES = {
  "Price Override": "Price Override",
  "Buy X for Y": "Price Override",
  Express: "Price Override",
  "Discount Percentage": "Discount Percentage",
  "Buy X get Y% off": "Discount Percentage",
  "Discount Amount": "Discount Amount",
};
const expressTypeOf = (type) => EXPRESS_TYPE_ALIASES[type] || null;

const ExpressPromotionView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [promotion, setPromotion] = useState(null);
  const [items, setItems] = useState([]);
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
  // newest first - the same source the advanced view reads. noCache so an edit
  // made a moment ago isn't hidden by the TTL.
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
      
      if (!expressTypeOf(promo.promotionType)) {
        navigate(`/marketing/promotions/${id}`);
        return;
      }

      setPromotion(promo);

      const itemsWithCost = await Promise.all(
        (promo.items || []).map(async (item) => {
          let cost = 0;
          
          if (item.product) {
            const product = item.product;
            cost = product.itemCost || product.cost || getBaseTier(product.prices)?.cost || 0;
          } else if (item.productId) {
            try {
              const productResponse = await productService.getProduct(item.productId);
              const product = productResponse.product || productResponse;
              cost = product.itemCost || product.cost || getBaseTier(product.prices)?.cost || 0;
            } catch (error) {
              console.error(`Error fetching product ${item.productId} for cost:`, error);
            }
          }
          
          return {
            ...item,
            productId: item.productId,
            productName: item.productName || item.product?.name,
            quantity: item.quantity || 1,
            // line figures are totals for the quantity (editor: cost x qty)
            cost: cost * (item.quantity || 1),
            normalPrice: item.normalPrice || 0,
            promoPrice: item.promoPrice || 0,
            rebate: item.rebate || 0,
            rebatePercentage: item.rebatePercentage || 0,
            discountPercentage: item.discountPercentage || 0
          };
        })
      );

      // Classification lines (category / brand / family / tag) saved by the express
      // editor live in conditions.classificationItems; family rows carry their member
      // products so cost / normal price are the members' averages (editor "~" values).
      const avg = (list, key) => {
        const nums = (list || []).map((m) => Number(m[key])).filter((n) => Number.isFinite(n));
        return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
      };
      const classificationRows = (promo.conditions?.classificationItems || []).map((c) => {
        const qty = Math.max(1, parseInt(c.quantity, 10) || 1);
        const unitNormal = avg(c.members, 'unitNormal') * qty; // line total for the quantity
        const discountPercentage = Number(c.discountPercentage) || 0;
        const discountAmount = Number(c.discountAmount) || 0;
        let promoPrice = Number(c.promoPrice) || 0;
        if (!promoPrice && unitNormal) {
          if (discountPercentage) promoPrice = unitNormal * (1 - discountPercentage / 100);
          else if (discountAmount) promoPrice = unitNormal - discountAmount;
        }
        return {
          classificationId: c.classificationId,
          classificationType: c.classificationType,
          productName: c.name,
          quantity: qty,
          cost: avg(c.members, 'unitCost') * qty,
          normalPrice: unitNormal,
          promoPrice,
          rebate: Number(c.rebate) || 0,
          discountPercentage,
          discountAmount,
          hasMembers: (c.members || []).length > 0
        };
      });

      setItems([...itemsWithCost, ...classificationRows]);
      calculateMissingItems(itemsWithCost);
    } catch (err) {
      setError("Failed to load promotion");
      console.error("Error loading promotion:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMissingItems = (itemsList) => {
    const missing = itemsList.filter(item => !item.productId);
    setMissingItems(missing);
  };

  const handleEdit = () => {
    navigate(`/marketing/promotions/express/${id}`);
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

  // Revision times on the store's clock (Setup > General > Timezone).
  const formatDateTime = (isoDate) => formatAppPattern(isoDate, "DD/MM/YYYY HH:mm:ss") || "-";

  // Reference ".promotion-home-header" label: 16px all-small-caps, grey.
  const HEADER_LABEL_SX = {
    fontSize: 16,
    fontVariant: "all-small-caps",
    color: "#676b72",
    lineHeight: 1.2,
  };
  // Reference section label ("CRITERIA" / "MISSING ITEMS").
  const SECTION_LABEL_SX = { ...HEADER_LABEL_SX, mb: 1.5 };

  // Reference renders each express line as a criterion sentence.
  const getItemSummary = (item) => {
    const qty = item.quantity || 1;
    const type = expressTypeOf(promotion?.promotionType);
    if (type === "Discount Percentage") {
      return `Purchase ${qty} to receive a percentage discount of ${(
        parseFloat(item.discountPercentage) || 0
      ).toFixed(2)}%`;
    }
    if (type === "Discount Amount") {
      const off = item.classificationType
        ? parseFloat(item.discountAmount) || 0
        : (parseFloat(item.normalPrice) || 0) - (parseFloat(item.promoPrice) || 0);
      return `Purchase ${qty} to receive a discount of $${off.toFixed(2)}`;
    }
    const total = (parseFloat(item.promoPrice) || 0) * qty;
    return `Purchase ${qty} to receive a total price of $${total.toFixed(2)}`;
  };

  const calculateProfit = (item) => {
    const promoPrice = parseFloat(item.promoPrice) || 0;
    // Same "%" as the express editor: profit on (cost less the supplier rebate).
    const cost = (parseFloat(item.cost) || 0) - (parseFloat(item.rebate) || 0);

    if (promoPrice === 0) return -100;

    const profit = ((promoPrice - cost) / promoPrice) * 100;
    
    if (isNaN(profit) || !isFinite(profit)) return 0;
    
    return profit;
  };

  if (loading) {
    return null;
  }

  if (!promotion) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Promotion not found</Alert>
      </Box>
    );
  }

  // Right-rail rows, same shape as the advanced promotion view (62px, icon +
  // 24px label + description).
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
      description: "Check the recent changes made to this promotion",
    },
  ];

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
                      {/* Reference: a plain centred note line, no shading. */}
                      <TableCell colSpan={5} sx={{ textAlign: "center", fontSize: 16, fontWeight: 400, color: "#000" }}>
                        Please Note: Revisions may take up to five minutes to appear
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
                  items with no value are omitted; the outlet is a bordered chip. */}
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
                  { label: "Outlets", value: promotion.outlet?.name || (promotion.outletId == null ? "Global" : null), chip: true },
                  { label: "Promotion Category", value: promotion.category?.name },
                ]
                  .filter((h) => h.value)
                  .map((h) => (
                    <Box key={h.label} sx={{ textAlign: "center" }}>
                      <Typography sx={HEADER_LABEL_SX}>{h.label}</Typography>
                      {h.chip ? (
                        <Box
                          component="span"
                          sx={{
                            display: "inline-block",
                            mt: "6px",
                            px: "10px",
                            py: "3px",
                            border: "1px solid #a3a3a3",
                            borderRadius: "4px",
                            fontSize: 16,
                            color: "#313439",
                            lineHeight: 1.3,
                          }}
                        >
                          {h.value}
                        </Box>
                      ) : (
                        <Typography sx={{ fontSize: 24, color: "#313439", lineHeight: 1.3 }}>
                          {h.value}
                        </Typography>
                      )}
                    </Box>
                  ))}
              </Box>

              {/* Reference .promotion-home-criteria-list: no table - one bold
                  criterion sentence per line with a right-aligned margin %. */}
              {/* margin "0 auto": in this flex column, "auto" also centred the block vertically. */}
              <Box sx={{ width: "90%", maxWidth: 800, margin: "0 auto", padding: "16px" }}>
                {items.length > 0 ? (
                  <>
                    <Typography sx={SECTION_LABEL_SX}>Criteria</Typography>
                    {items.map((item, index) => {
                      const profit = calculateProfit(item);
                      // category / brand / tag rows have no member prices -> "-" (editor shows "-")
                      const profitText = item.classificationType && !item.hasMembers ? "-" : `${profit.toFixed(2)}%`;
                      return (
                        <Box key={index} sx={{ mb: 3 }}>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 2,
                            }}
                          >
                            <Typography sx={{ fontSize: 16, fontWeight: 700, color: "#313439" }}>
                              {getItemSummary(item)}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 16,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                                color: profitText !== "-" && profit < 0 ? "#e33430" : "#313439",
                              }}
                            >
                              {profitText}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 2,
                              mb: "4px",
                            }}
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
                                {/* classification lines are labelled by their type (editor row) */}
                                {item.classificationType
                                  ? item.classificationType.charAt(0) + item.classificationType.slice(1).toLowerCase()
                                  : "Products"}
                              </Typography>
                              <Typography component="span" sx={{ fontSize: 16, color: "#313439" }}>
                                {item.productName || "Unknown Product"}
                              </Typography>
                            </Box>
                            <Typography
                              sx={{
                                fontSize: 16,
                                whiteSpace: "nowrap",
                                color: profitText !== "-" && profit < 0 ? "#e33430" : "#313439",
                              }}
                            >
                              {profitText}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                ) : (
                  <Typography sx={{ fontSize: 16, color: "#676b72" }}>
                    No items in promotion
                  </Typography>
                )}

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
                            {item.productName || "Unknown Product"}
                          </Typography>
                          <Typography className="mi-cell">Not Matched</Typography>
                          <Typography className="mi-cell">{getItemSummary(item)}</Typography>
                          <Button
                            component={RouterLink} to={`/marketing/promotions/express/${id}`}
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

                <Typography sx={{ fontSize: 16, color: "#676b72", mt: 2 }}>
                  Please note: All figures are inclusive of tax.
                </Typography>
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
            "&:hover": { color: "rgb(109, 215, 123)" },
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
          {/* Navigation card - 62px rows, hover recolors text/icon to #5ebbeb.
              Reference card hugs its two rows (150px), it does not fill the rail. */}
          <Box
            role="tablist"
            aria-label="Promotion sections"
            sx={{
              backgroundColor: "#f8f8f8",
              boxShadow: WIDGET_SHADOW,
              flex: "0 0 auto",
              py: "8px",
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

export default ExpressPromotionView;

