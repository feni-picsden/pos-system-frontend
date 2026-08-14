import React, { useState, useEffect } from "react";
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from "@mui/material";
import {
  EditOutlined as EditOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
  HomeOutlined as HomeOutlinedIcon,
  HistoryOutlined as HistoryOutlinedIcon,
  AccessTimeOutlined as AccessTimeOutlinedIcon,
  VisibilityOutlined as VisibilityOutlinedIcon,
  CheckOutlined as CheckOutlinedIcon,
  CloseOutlined as CloseOutlinedIcon,
} from "@mui/icons-material";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import customerGroupService from "../../services/customerGroupService";
import customerService from "../../services/customerService";
import salesService from "../../services/salesService";
import PrintReceiptDialog from "../../components/PrintReceiptDialog";
import EmailReceiptModal from "../../components/SalesHistory/EmailReceiptModal";
import ConfirmDeleteDialog from "../../components/Common/ConfirmDeleteDialog";
import { saleBasePrice, saleLineTotal } from "../../utils/saleTotals";
import { formatRevisionValue } from "../../utils/revisionValue";
import { formatCurrency } from "../../utils/currency";

const CustomerGroupView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerGroup, setCustomerGroup] = useState(null);
  // Keep the open section in the URL (ProductView pattern) so a reload or a
  // browser Back restores the section instead of resetting to Home.
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const activeTab = ["salesHistory", "revision"].includes(sectionParam)
    ? sectionParam
    : "home";
  const setActiveTab = (nextId) => {
    const next = new URLSearchParams(searchParams);
    if (nextId === "home") next.delete("section");
    else next.set("section", nextId);
    setSearchParams(next, { replace: true });
  };
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      loadCustomerGroupData();
    }
  }, [id]);

  useEffect(() => {
    if (id && activeTab === "revision") {
      loadRevisionHistory();
    } else if (id && activeTab === "salesHistory" && customerGroup) {
      loadSalesHistory();
    }
  }, [id, activeTab, customerGroup]);

  const loadCustomerGroupData = async () => {
    try {
      setLoading(true);
      const response = await customerGroupService.getCustomerGroup(id);
      setCustomerGroup(response.customerGroup);
    } catch (err) {
      setError("Failed to load customer group");
      console.error("Error loading customer group:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/customers/groups/${id}`);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      await customerGroupService.deleteCustomerGroup(id);
      navigate("/customers/groups");
    } catch (err) {
      setError("Failed to delete customer group");
      console.error("Error deleting customer group:", err);
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleViewCustomer = (customer) => {
    navigate(`/customers/${customer.id}/view`);
  };

  const handleEditCustomer = (customer) => {
    navigate(`/customers/${customer.id}`);
  };

  const loadRevisionHistory = async () => {
    try {
      setRevisionsLoading(true);
      const response = await customerGroupService.getCustomerGroupRevisions(id);
      setRevisions(response.revisions || []);
    } catch (err) {
      console.error("Error loading revision history:", err);
      setError("Failed to load revision history");
    } finally {
      setRevisionsLoading(false);
    }
  };

  const loadSalesHistory = async () => {
    try {
      setSalesLoading(true);
      if (!customerGroup?.customers || customerGroup.customers.length === 0) {
        setSales([]);
        return;
      }

      // Fetch sales for all customers in the group
      const customerIds = customerGroup.customers.map(c => c.id);
      const allSales = [];

      for (const customerId of customerIds) {
        try {
          const response = await customerService.getCustomerSales(customerId, 50);
          if (response.sales && response.sales.length > 0) {
            allSales.push(...response.sales);
          }
        } catch (err) {
          console.error(`Error loading sales for customer ${customerId}:`, err);
        }
      }

      // Sort by sale date descending
      allSales.sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate));
      setSales(allSales);
    } catch (err) {
      console.error("Error loading sales history:", err);
      setError("Failed to load sales history");
    } finally {
      setSalesLoading(false);
    }
  };

  // Sale total from the line totals — same math as the shared sell-side base price.
  const computeSaleTotal = saleLineTotal;

  const handleSendEmail = async (saleId, receiverEmails, senderEmail) => {
    const result = await salesService.emailReceipt(saleId, receiverEmails, senderEmail);
    if (!result?.success) {
      throw new Error(result?.message || "Failed to send email");
    }
  };

  // The reprint button only renders inside the expanded row, so `selectedSale` is already that sale.
  const handleClosePrintDialog = () => {
    setShowPrintDialog(false);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const customerName = (customer) => {
    const person = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
    if (customer.company) return person ? `${customer.company} ${person}` : customer.company;
    return person || "Unnamed Customer";
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!customerGroup) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Customer group not found</Alert>
      </Box>
    );
  }

  const customers = customerGroup.customers || [];
  const accountLimit = Number(customerGroup.accountLimit) || 0;

  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: HomeOutlinedIcon,
      description: 'View customer group details'
    },
    {
      id: 'revision',
      label: 'Revision History',
      icon: HistoryOutlinedIcon,
      description: 'Check recent changes to this customer group'
    },
    // ponytail: local-only pane (not on the reference rail). Kept because removing working
    // functionality is out of scope; drop this entry to reach a literal 2-item reference rail.
    {
      id: 'salesHistory',
      label: 'Sales History',
      icon: AccessTimeOutlinedIcon,
      description: 'View customer group sales history'
    }
  ];

  // Loyalty / Promotions / Account Sales status cells of the summary card
  const summaryStatuses = [
    { label: 'Loyalty', enabled: !!customerGroup.loyaltyEnabled },
    { label: 'Promotions', enabled: !customerGroup.disablePromotions },
    { label: 'Account Sales', enabled: !!customerGroup.allowAccountSales }
  ];

  // Reference rail pills: outlined, transparent, no hover change, no transition
  const pillButtonSx = {
    height: 42,
    width: '100%',
    bgcolor: 'transparent',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'none',
    boxShadow: 'none',
    transition: 'none',
  };

  const roundedHeaderSx = {
    '& th': {
      bgcolor: '#5ebbeb',
      color: '#fff',
      fontWeight: 700,
      fontSize: 16,
      textTransform: 'none',
      border: 0,
      p: 2,
    },
    '& th:first-of-type': { borderRadius: '12px 0 0 12px' },
    '& th:last-of-type': { borderRadius: '0 12px 12px 0' },
  };

  const zebraBodySx = {
    '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
    '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
    '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5, px: 2 },
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 50px)', bgcolor: '#fff' }}>
      {/* Left action rail */}
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          bgcolor: '#f5f7f9',
          display: 'flex',
          flexDirection: 'column',
          pt: 2.5,
          pb: 2.5,
        }}
      >
        {/* Rail header: View <group name> */}
        <Box sx={{ px: 2, mb: 2 }}>
          <Typography sx={{ fontSize: 14, color: '#737373', lineHeight: 1.4 }}>
            Customer Group
          </Typography>
          <Typography noWrap sx={{ fontSize: 20, fontWeight: 700, color: '#000' }}>
            View {customerGroup.name}
          </Typography>
        </Box>

        {/* Navigation */}
        <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column' }}>
          {navigationItems.map((item) => {
            const active = activeTab === item.id;
            const ItemIcon = item.icon;
            return (
              <Box
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                sx={{
                  height: 60,
                  borderRadius: '8px 0 0 8px',
                  px: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  bgcolor: active ? '#fff' : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                  transition: 'none',
                  '&:hover': { bgcolor: active ? '#fff' : 'transparent' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ItemIcon sx={{ fontSize: 20, color: '#000' }} />
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#000', lineHeight: 1.3 }}>
                    {item.label}
                  </Typography>
                </Box>
                <Typography noWrap sx={{ fontSize: 12, color: '#676b72', lineHeight: 1.3 }}>
                  {item.description}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Edit + Delete pills at the bottom of the rail */}
        <Box sx={{ px: '18px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            disableRipple
            startIcon={<EditOutlinedIcon sx={{ fontSize: 20 }} />}
            onClick={handleEdit}
            sx={{
              ...pillButtonSx,
              border: '1px solid #22c55e',
              color: '#16a34a',
              '&:hover': { bgcolor: 'transparent', border: '1px solid #22c55e' },
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
              '&:hover': { bgcolor: 'transparent', border: '1px solid #ef4444' },
            }}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          p: 3,
          bgcolor: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
            {error}
          </Alert>
        )}

        {activeTab === "home" ? (
          <>
            {/* Summary card: Loyalty / Promotions / Account Sales / Account Limit */}
            <Box
              sx={{
                bgcolor: '#fff',
                border: '1px solid #e5e5e5',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                p: 2,
                mb: 3,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
              }}
            >
              {summaryStatuses.map((status) => (
                <Box key={status.label} sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>
                    {status.label}
                  </Typography>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      color: status.enabled ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {status.enabled
                      ? <CheckOutlinedIcon sx={{ fontSize: 18 }} />
                      : <CloseOutlinedIcon sx={{ fontSize: 18 }} />}
                    <Typography sx={{ fontSize: 16 }}>
                      {status.enabled ? 'Enabled' : 'Disabled'}
                    </Typography>
                  </Box>
                </Box>
              ))}
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000' }}>
                  Account Limit
                </Typography>
                <Typography sx={{ fontSize: 16, color: accountLimit > 0 ? '#000' : '#9ca3af' }}>
                  {accountLimit > 0 ? formatCurrency(accountLimit) : 'Unlimited'}
                </Typography>
              </Box>
            </Box>

            {/* Customers table */}
            <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
              <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <TableHead>
                  <TableRow sx={roundedHeaderSx}>
                    <TableCell>Customers</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody sx={zebraBodySx}>
                  {customers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                        <Typography sx={{ fontSize: 16, color: '#737373' }}>
                          No customers in this group
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>{customerName(customer)}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
                            <Button
                              size="small"
                              startIcon={<VisibilityOutlinedIcon />}
                              onClick={() => handleViewCustomer(customer)}
                              sx={{ color: '#0284c7', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                            >
                              View
                            </Button>
                            <Button
                              size="small"
                              startIcon={<EditOutlinedIcon />}
                              onClick={() => handleEditCustomer(customer)}
                              sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                            >
                              Edit
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : activeTab === "salesHistory" ? (
          <>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Sales History
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {sales.length} sale{sales.length !== 1 ? "s" : ""}
              </Typography>
            </Box>
            <Divider sx={{ mb: 1 }} />

            <Box sx={{ flex: 1, overflowY: "auto" }}>
              {salesLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : sales.length > 0 ? (
                sales.map((sale) => (
                  <React.Fragment key={`sale-fr-${sale.id}`}>
                    {selectedSale?.id !== sale.id && (
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          py: 1,
                          borderBottom: "1px solid #e0e0e0",
                          cursor: "pointer",
                        }}
                        onClick={() =>
                          setSelectedSale(
                            selectedSale?.id === sale.id ? null : sale
                          )
                        }
                      >
                        {/* Leading circle */}
                        <Box
                          sx={{
                            width: 32,
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              border: "2px solid #4caf50",
                              bgcolor: "#4caf50",
                            }}
                          />
                        </Box>

                        {/* Date/time + invoice number */}
                        <Box sx={{ width: 220 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ lineHeight: 1.1 }}
                          >
                            {formatDateTime(sale.saleDate)}
                          </Typography>
                          <Typography variant="caption" color="primary">
                            {sale.saleNumber || `#${String(sale.id).padStart(8, '0')}`}
                          </Typography>
                        </Box>

                        {/* User */}
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2">
                            {sale.user?.name || "-"}
                          </Typography>
                        </Box>

                        {/* Amount right-aligned */}
                        <Box sx={{ width: 160, textAlign: "right" }}>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {formatCurrency(computeSaleTotal(sale))}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {selectedSale?.id === sale.id && (
                      <Paper
                        sx={{
                          mb: 1,
                          p: 2,
                          border: "1px solid #bdbdbd",
                          borderRadius: 0,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            pb: 1,
                            mb: 1,
                            borderBottom: "1px solid #e0e0e0",
                          }}
                        >
                          {/* Status + header info line */}
                          <Box
                            sx={{
                              width: 36,
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                border: "3px solid #4caf50",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  bgcolor: "#4caf50",
                                }}
                              />
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                            }}
                          >
                            <Box>
                              <Typography variant="subtitle2">
                                {formatDateTime(sale.saleDate)}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {sale.saleNumber || `#${String(sale.id).padStart(8, '0')}`}
                              </Typography>
                            </Box>
                            <Typography variant="body2">
                              {sale.user?.name || "-"}
                            </Typography>
                          </Box>
                          <Box sx={{ ml: "auto", textAlign: "right" }}>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                              {formatCurrency(computeSaleTotal(sale))}
                            </Typography>
                          </Box>
                        </Box>

                        {/* Summary row with buttons on right */}
                        <Box sx={{ display: "flex", gap: 2 }}>
                          <Box
                            sx={{
                              flex: 1,
                              display: "grid",
                              gridTemplateColumns:
                                "repeat(2, minmax(120px, 1fr))",
                              rowGap: 1,
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <Typography variant="body2">
                                Base Price
                              </Typography>
                              <Typography variant="body2">
                                {formatCurrency(saleBasePrice(sale))}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <Typography variant="body2">Savings</Typography>
                              <Typography variant="body2">
                                {formatCurrency(sale.savings)}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <Typography variant="body2">
                                Discount
                              </Typography>
                              <Typography variant="body2">
                                {formatCurrency(sale.discount)}
                              </Typography>
                            </Box>
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <Typography variant="body2">Tax</Typography>
                              <Typography variant="body2">
                                {formatCurrency(sale.tax)}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ width: 320 }}>
                            <Button
                              onClick={() => setSelectedSale(null)}
                              variant="contained"
                              fullWidth
                              sx={{
                                mb: 1,
                                bgcolor: "#1976d2",
                                "&:hover": { bgcolor: "#115293" },
                              }}
                            >
                              ✕ Close
                            </Button>
                            <Button
                              variant="outlined"
                              fullWidth
                              sx={{ mb: 1 }}
                              onClick={() => setShowPrintDialog(true)}
                            >
                              Reprint Receipt
                            </Button>
                            <Button
                              variant="outlined"
                              fullWidth
                              sx={{ mb: 1 }}
                              onClick={() => setShowEmailModal(true)}
                            >
                              Email Receipt
                            </Button>
                            <Button
                              variant="outlined"
                              fullWidth
                              onClick={() =>
                                navigate("/", {
                                  state: { returnSaleNumber: sale.saleNumber },
                                })
                              }
                            >
                              Return Items
                            </Button>
                          </Box>
                        </Box>

                        <Box
                          sx={{
                            borderTop: "1px solid #bdbdbd",
                            mt: 2,
                            pt: 1,
                          }}
                        >
                          {sale.items?.map((it, idx) => (
                            <Box
                              key={`sel-item-${sale.id}-${idx}`}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                py: 0.5,
                              }}
                            >
                              <Box
                                sx={{ width: 32, textAlign: "right", pr: 1 }}
                              >
                                <Typography
                                  variant="body2"
                                  sx={{ fontWeight: 600 }}
                                >
                                  {it.quantity}
                                </Typography>
                              </Box>
                              <Box sx={{ width: 56 }}>
                                <Typography variant="body2">Items</Typography>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="body2">
                                  {it.productName}
                                </Typography>
                              </Box>
                              <Box sx={{ width: 140, textAlign: "right" }}>
                                <Typography variant="body2">
                                  {formatCurrency(
                                    it.totalPrice ??
                                      (Number(it.unitPrice) || 0) *
                                        (Number(it.quantity) || 0)
                                  )}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                          <Box
                            sx={{
                              mt: 1,
                              borderTop: "1px solid #9e9e9e",
                              display: "flex",
                              justifyContent: "flex-end",
                              pt: 0.5,
                            }}
                          >
                            <Typography variant="subtitle1" sx={{ mr: 2 }}>
                              Balance {formatCurrency(0)}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <Typography sx={{ textAlign: 'center', color: '#737373', fontSize: 16, py: 4 }}>
                  No sales found
                </Typography>
              )}
            </Box>
          </>
        ) : activeTab === "revision" ? (
          <>
            {revisionsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
                <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                  <TableHead>
                    <TableRow sx={roundedHeaderSx}>
                      <TableCell>Field</TableCell>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={5} sx={{ bgcolor: '#f5f5f5', border: 0, py: 1, px: 2 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 400, color: '#676b72' }}>
                          Please Note: Revisions may take up to five minutes to appear
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody sx={zebraBodySx}>
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
                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                          <Typography sx={{ fontSize: 16, color: '#737373' }}>
                            No revisions found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        ) : null}
      </Box>

      {/* Print Receipt Dialog */}
      <PrintReceiptDialog
        open={showPrintDialog}
        onClose={handleClosePrintDialog}
        sale={selectedSale}
      />

      <EmailReceiptModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSend={handleSendEmail}
        saleId={selectedSale?.id}
      />

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Delete"
        message={`Are you sure you want to delete the customer group "${customerGroup.name}"?`}
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
    </Box>
  );
};

export default CustomerGroupView;
