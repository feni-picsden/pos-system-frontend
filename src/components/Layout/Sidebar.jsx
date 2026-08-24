import React, { useEffect, useState } from "react";
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  Box,
  Chip,
  Typography,
  CircularProgress,
} from "@mui/material";
import {
  // Reference uses thin-outline (FA light) glyphs — MUI Outlined variants only
  DashboardOutlined as DashboardIcon,
  StoreOutlined as StoreIcon,
  Inventory2Outlined as InventoryIcon,
  PeopleOutlined as PeopleIcon,
  ReceiptOutlined as ReceiptIcon,
  CreditCardOutlined as CreditCardIcon,
  SettingsOutlined as SettingsIcon,
  KeyboardArrowRight,
  ShoppingCartOutlined as ShoppingCart,
  CategoryOutlined as Category,
  StorefrontOutlined as Storefront,
  AccountCircleOutlined as AccountCircle,
  PaymentOutlined as Payment,
  AttachMoneyOutlined as AttachMoney,
  BarChartOutlined as BarChart,
  TrendingUpOutlined as TrendingUp,
  AssignmentOutlined as Assignment,
  NotificationsOutlined as Notifications,
  WorkOutline as WorkOutline,
  PointOfSaleOutlined as RegisterIcon,
  AssessmentOutlined as Assessment,
  EngineeringOutlined as Engineering,
  KeyOutlined as Key,
  ReceiptOutlined as Receipt,
  Add,
  CardGiftcardOutlined as CardGiftcard,
  LocalOfferOutlined as TicketIcon,
  ImageOutlined as ImageIcon,
  CalendarTodayOutlined as CalendarToday,
  MailOutlined as MailIcon,
  DeleteOutline as DeleteIcon,
  EmojiEventsOutlined as LoyaltyIcon,
  ExtensionOutlined as ExtensionIcon,
  StorageOutlined as StorageIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  closeCustomerDisplayWindow,
  isCustomerDisplayWindowOpen,
  openCustomerDisplayWindow,
} from "../../utils/customerDisplayWindow";
import { confirmLeave } from "../../utils/leaveGuard";

const menuItems = [
  {
    id: "sell",
    title: "Sell",
    icon: <WorkOutline />,
    path: "/",
    badge: null,
    permissions: ["register.access"], // Requires register access
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: <DashboardIcon />,
    path: "/dashboard",
    badge: null,
    permissions: ["reports.dashboard"], // Requires dashboard permission
  },
  {
    id: "register",
    title: "Register",
    icon: <RegisterIcon />,
    path: "/register",
    badge: null,
    permissions: ["register.access"], // Parent permission
    children: [
      {
        id: "manage-cash",
        title: "Manage Cash",
        icon: <Payment />,
        path: "/register/manage-cash",
        permissions: ["register.cash_drawer"],
      },
      {
        id: "close-register",
        title: "Close Register",
        icon: <Category />,
        path: "/register/close",
        permissions: ["register.access"],
      },
      {
        id: "sale-history",
        title: "Sales History",
        icon: <Assignment />,
        path: "/register/history",
        permissions: ["see_history", "reports.sales"],
      },
      {
        id: "open-customer-display",
        title: "Open Customer Display",
        icon: <Storefront />,
        path: "/register/display",
        permissions: ["register.access"],
      },
    ],
  },
  {
    id: "stock-management",
    title: "Stock Management",
    icon: <InventoryIcon />,
    path: "/stock",
    badge: null,
    permissions: ["stock.view"], // Parent permission
    children: [
      {
        id: "products",
        title: "Products",
        icon: <Category />,
        path: "/products",
        permissions: ["products.view"],
      },
      {
        id: "classifications",
        title: "Classifications",
        icon: <Category />,
        path: "/stock-management/classifications",
        permissions: ["classifications.view"],
      },
    
      {
        id: "suppliers",
        title: "Suppliers",
        icon: <Storefront />,
        path: "/suppliers",
        permissions: ["suppliers.view"],
      },
      {
        id: "orders-invoices",
        title: "Orders & Invoices",
        icon: <ReceiptIcon />,
        path: "/orders-invoices",
        permissions: ["orders-invoices.view"],
      },
      {
        id: "stocktakes",
        title: "Stocktakes",
        icon: <Assignment />,
        path: "/stock-management/stocktakes",
        permissions: ["stocktakes.view"],
      },
      {
        id: "product-combos",
        title: "Product Combos",
        icon: <ShoppingCart />,
        path: "/stock-management/product-combos",
        permissions: ["products.view"],
      },
      {
        id: "more",
        title: "More",
        icon: <Add />,
        path: "/stock-management/more",
        permissions: ["stock.view"],
      },
    ],
  },
  {
    id: "customer-management",
    title: "Customer Management",
    icon: <PeopleIcon />,
    path: "/customers",
    badge: null,
    permissions: ["customers.view"],
    children: [
      {
        id: "customers",
        title: "Customers",
        icon: <Category />,
        path: "/customers",
        permissions: ["customers.view"],
      },
      {
        id: "customer-groups",
        title: "Customer Groups",
        icon: <Storefront />,
        path: "/customers/groups",
        permissions: ["customer_groups.view"],
      },
      {
        id: "price-lists",
        title: "Price Lists",
        icon: <Assignment />,
        path: "/customers/price-lists",
        permissions: ["price_lists.view"],
      },
      {
        id: "balance",
        title: "Balance",
        icon: <Assignment />,
        path: "/customers/balance",
        permissions: ["balance.view"],
      },
      {
        id: "gift-cards",
        title: "Gift Cards",
        icon: <CardGiftcard />,
        path: "/customers/gift-cards",
        permissions: ["customers.view"],
      },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    icon: <TrendingUp />,
    path: "/marketing",
    badge: null,
    permissions: ["promotions.view"],
    children: [
      {
        id: "promotions",
        title: "Promotions",
        icon: <Notifications />,
        path: "/marketing/promotions",
        permissions: ["promotions.view"],
      },
      {
        id: "shelf-tickets",
        title: "Shelf Tickets",
        icon: <TicketIcon />,
        path: "/marketing/shelf-tickets",
        permissions: ["promotions.view"],
      },
      {
        id: "media",
        title: "Media Center",
        icon: <ImageIcon />,
        path: "/marketing/media",
        permissions: ["promotions.view"],
      },
    ],
  },
  {
    id: "reporting",
    title: "Reporting",
    icon: <BarChart />,
    path: "/reports",
    badge: null,
    permissions: ["reports.view"],
    children: [
      {
        id: "reports",
        title: "Reporting Dashboard",
        icon: <Assessment />,
        path: "/reports/dashboard",
        permissions: ["reports.view"],
      },
      {
        id: "sales-report",
        title: "Sales Report",
        icon: <Assessment />,
        path: "/reports/sales",
        permissions: ["reports.sales"],
      },
      {
        id: "inventory-report",
        title: "Inventory Report",
        icon: <InventoryIcon />,
        path: "/reports/inventory",
        permissions: ["reports.inventory"],
      },
      {
        id: "transfer-reports",
        title: "Transfer Reports",
        icon: <Assessment />,
        path: "/reports/transfer-reports",
        permissions: ["reports.view"],
      },
      {
        title: "Purchase Report",
        icon: <Assessment />,
        path: "/reports/purchases",
        permissions: ["reports.purchases"],
      },
      {
        id: "register-closures",
        title: "Register Closures",
        icon: <Assessment />,
        path: "/reports/register-closures",
        permissions: ["reports.view"],
      },
      {
        id: "security-centre",
        title: "Security Centre",
        icon: <Assessment />,
        path: "/reports/security-centre",
        permissions: ["reports.view"],
      },
      {
        id: "miscellaneous-reports",
        title: "Miscellaneous Reports",
        icon: <Assessment />,
        path: "/reports/miscellaneous",
        permissions: ["reports.view"],
      },
      {
        id: "favourite-reports",
        title: "Favourite Reports",
        icon: <Assessment />,
        path: "/reports/favourite",
        permissions: ["reports.view"],
      },
    ],
  },
  {
    id: "setup",
    title: "Setup",
    icon: <SettingsIcon />,
    path: "/setup",
    badge: null,
    permissions: [],
    children: [
      {
        id: "general",
        title: "General",
        icon: <SettingsIcon />,
        path: "/setup/general",
        permissions: ["settings.view"],
      },
      {
        id: "integrations",
        title: "Integrations",
        icon: <ExtensionIcon />,
        path: "/setup/integrations",
        permissions: ["modify_integrations"],
      },
      {
        id: "hardware",
        title: "Hardware",
        icon: <ReceiptIcon />,
        path: "/setup/hardware",
        permissions: ["modify_hardware"],
      },
      {
        id: "linkly",
        title: "Linkly EFTPOS",
        icon: <CreditCardIcon />,
        path: "/setup/linkly",
        permissions: ["register.manage"],
      },
      {
        id: "master-database-products",
        title: "Master Database Products",
        icon: <StorageIcon />,
        path: "/setup/master-database-products",
        permissions: ["products.add"],
      },
      // {
      //   id: "account-billing",
      //   title: "Account & Billing",
      //   icon: <AccountCircle />,
      //   path: "/setup/account-billing",
      //   permissions: [],
      // },
      {
        id: "sale-key",
        title: "Sale Key",
        icon: <Key />,
        path: "/setup/sale-key-sets",
        permissions: ["sale_keys.view"],
      },
      {
        id: "receipts",
        title: "Receipts",
        icon: <Receipt />,
        path: "/setup/receipts",
        permissions: ["modify_receipts"],
      },
      {
        id: "statements",
        title: "Statements",
        icon: <Assignment />,
        path: "/setup/statements",
        permissions: ["modify_statements"],
      },
      {
        id: "shelf-ticket-templates",
        title: "Shelf Ticket Templates",
        icon: <TicketIcon />,
        path: "/setup/shelf-tickets",
        permissions: ["modify_ticket_templates"],
      },
      {
        id: "customer-display",
        title: "Customer Display",
        icon: <Storefront />,
        path: "/setup/customer-display",
        permissions: ["register.access"],
      },
      {
        id: "transfer-list",
        title: "Transfer List",
        icon: <ReceiptIcon />,
        path: "/setup/transfer-list",
        permissions: ["orders-invoices.view"],
      },
      {
        id: "outlets",
        title: "Outlets",
        icon: <StoreIcon />,
        path: "/outlets",
        permissions: [], 
      },
      {
        id: "registers",
        title: "Registers",
        icon: <RegisterIcon />,
        path: "/registers",
        permissions: ["register.manage"], 
      },
      {
        id: "users",
        title: "Users",
        icon: <AccountCircle />,
        path: "/setup/users",
        permissions: ["users.view"],
      },
      {
        id: "rolesandpermissions",
        title: "Roles and Permissions",
        icon: <AccountCircle />,
        path: "/setup/roles",
        permissions: ["roles.view"],
      },
      {
        id: "loyalty",
        title: "Loyalty",
        icon: <LoyaltyIcon />,
        path: "/setup/loyalty",
        permissions: ["settings.view"],
      },
      {
        id: "surcharging",
        title: "Surcharging",
        icon: <AttachMoney />,
        path: "/setup/surcharging",
        permissions: ["surcharges.view"],
      },
      {
        id: "taxes",
        title: "Taxes",
        icon: <ReceiptIcon />,
        path: "/setup/taxes",
        permissions: ["taxes.view"],
      },
      {
        id: "promotion-categories",
        title: "Promotion Categories",
        icon: <Category />,
        path: "/setup/promotion-categories",
        permissions: ["promotion_categories.view"],
      },
      {
        id: "payment-methods",
        title: "Payment Methods",
        icon: <Payment />,
        path: "/setup/payment-methods",
        permissions: ["payment_methods.view"],
      },
      {
        id: "push-notifications",
        title: "Push Notifications",
        icon: <Notifications />,
        path: "/admin/push-notifications",
        permissions: ["manage_push_devices"],
      },
    ],
  },
  {
    id: "utilities",
    title: "Utilities",
    icon: <Engineering />,
    path: "/utilities",
    badge: null,
    permissions: [],
    children: [
      {
        id: "future-prices",
        title: "Future Prices",
        icon: <CalendarToday />,
        path: "/utilities/future-prices",
        permissions: ["modify_default_prices"],
      },
      {
        id: "future-costs",
        title: "Future Costs",
        icon: <CalendarToday />,
        path: "/utilities/future-costs",
        permissions: ["modify_default_prices"],
      },
      {
        id: "mail-log",
        title: "Mail Log",
        icon: <MailIcon />,
        path: "/utilities/mail-log",
        permissions: ["see_mail_log"],
      },
      {
        id: "trashed-items",
        title: "Trashed Items",
        icon: <DeleteIcon />,
        path: "/utilities/trashed-items",
        permissions: ["see_trashed_items"],
      },
      {
        id: "product-utilities",
        title: "Product Utilities",
        icon: <InventoryIcon />,
        path: "/utilities/product-utilities",
        permissions: ["edit_products"],
      },
      {
        id: "customer-utilities",
        title: "Customer Utilities",
        icon: <PeopleIcon />,
        path: "/utilities/customer-utilities",
        permissions: ["edit_customers"],
      },
      {
        id: "barcodes",
        title: "Barcodes",
        icon: <InventoryIcon />,
        path: "/utilities/barcodes",
        permissions: ["modify_barcode_templates"],
      },
    ],
  },
];

const Sidebar = ({ onClick }) => {
  const [openItems, setOpenItems] = useState({});
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false);
  const navigate = useNavigate();
  const { isSuperAdmin, getOutletName } = useAuth();
  const { hasAnyPermission, user, loading } = usePermissions();

  useEffect(() => {
    const tick = () => setCustomerDisplayOpen(isCustomerDisplayWindowOpen());
    tick();
    const id = window.setInterval(tick, 800);
    return () => window.clearInterval(id);
  }, []);

  const isTrueSuperAdmin = Boolean(
    user?.isSuperAdmin || (user?.hasAllPermission && (user?.outletId === null || user?.outletId === undefined))
  );

  const handleItemClick = (item) => {
    if (item.id === "open-customer-display") {
      if (isCustomerDisplayWindowOpen()) {
        closeCustomerDisplayWindow();
        setCustomerDisplayOpen(false);
      } else {
        void (async () => {
          const registerId = localStorage.getItem("selectedRegisterId");
          await openCustomerDisplayWindow(
            registerId ? Number(registerId) : undefined
          );
          setCustomerDisplayOpen(isCustomerDisplayWindowOpen());
        })();
      }
      onClick?.();
      return;
    }
    if (item.children) {
      setOpenItems((prev) => ({
        ...prev,
        [item.id]: !prev[item.id],
      }));
    } else if (item.path) {
      // Pages with unsaved edits (Setup > General) get to confirm before we leave.
      confirmLeave(() => navigate(item.path));
      onClick();
    }
  };

  const hasPermissionForItem = (item) => {
    if (!item.permissions || item.permissions.length === 0) {
      return true;
    }

    if (user?.hasAllPermission) {
      return true;
    }

    return hasAnyPermission(item.permissions);
  };

  const shouldShowMenuItem = (item) => {
    if (item.id === 'outlets') {
      return isTrueSuperAdmin;
    }

    if (item.id === 'registers') {
      return isTrueSuperAdmin;
    }

    if (item.id === 'master-database-products') {
      return isTrueSuperAdmin;
    }

    return hasPermissionForItem(item);
  };

  const filterMenuItems = (items) => {
    return items
      .filter((item) => {
        const hasItemPermission = shouldShowMenuItem(item);

        if (item.children && item.children.length > 0) {
          const accessibleChildren = item.children.filter((child) =>
            shouldShowMenuItem(child)
          );
          // A group is only a door to its children: showing it with every child
          // filtered out gave a restricted user an empty, dead-end menu. The group's
          // own permission does not gate it — a user who may see one child reaches it
          // through the group.
          return accessibleChildren.length > 0;
        }

        return hasItemPermission;
      })
      .map((item) => {
        if (item.children && item.children.length > 0) {
          const filteredChildren = item.children.filter((child) =>
            shouldShowMenuItem(child)
          );
          return { ...item, children: filteredChildren };
        }
        return item;
      });
  };

  // Don't filter menu items until permissions are loaded
  const filteredMenuItems = loading ? [] : filterMenuItems(menuItems);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, p: 2 }}>
        <CircularProgress size={32} sx={{ color: '#6a5acd' }} />
      </Box>
    );
  }

  const renderMenuItem = (item) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openItems[item.id];

    return (
      <React.Fragment key={item.id}>
        <ListItem
          disablePadding
          sx={{
            my: "4px",
            // Reference keeps the expanded group header pinned while its
            // sub-items scroll underneath.
            ...(hasChildren && isOpen
              ? { position: "sticky", top: 0, zIndex: 1, bgcolor: "#fff" }
              : {}),
          }}
        >
          <ListItemButton
            disableRipple
            onClick={() => handleItemClick(item)}
            sx={{
              p: "4px 0",
              borderRadius: 0,
              transition: "none",
              "&:hover": {
                bgcolor: "transparent",
                "& .MuiListItemText-primary": { color: "#737373" },
              },
            }}
          >
            <ListItemIcon
              sx={{
                // Reference: 25px fixed-width icon box (fa-fw) + 16px gap to label
                minWidth: 25,
                width: 25,
                mr: "16px",
                justifyContent: "center",
                "& svg": { fontSize: 20, color: "#136e9d" },
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={
                item.id === "open-customer-display"
                  ? customerDisplayOpen
                    ? "Close Customer Display"
                    : "Open Customer Display"
                  : item.title
              }
              sx={{
                "& .MuiTypography-root": {
                  fontSize: 20,
                  // 28px label line-height => 36px row box + 4px margins = 40px step (reference)
                  lineHeight: "28px",
                  fontWeight: 400,
                  color: "#171717",
                },
                m: 0,
              }}
            />
            {item.badge && (
              <Chip
                label={item.badge}
                size="small"
                color={item.badge === "New" ? "success" : "primary"}
                sx={{ height: 20, fontSize: "0.75rem" }}
              />
            )}
            {hasChildren && (
              <KeyboardArrowRight
                sx={{
                  ml: "auto",
                  fontSize: 16,
                  color: "#171717",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            )}
          </ListItemButton>
        </ListItem>
        {hasChildren && (
          <Collapse in={isOpen} timeout={150} unmountOnExit>
            <List component="div" disablePadding sx={{ p: "4px 0 12px 24px" }}>
              {item.children.map((child) => (
                <React.Fragment key={child.id || child.path}>
                  {renderMenuItem(child)}
                </React.Fragment>
              ))}
            </List>
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box sx={{ width: "100%", height: "100%", pt: 0 }}>
      {!isSuperAdmin() && getOutletName() && (
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Current Outlet
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {getOutletName()}
          </Typography>
        </Box>
      )}
      
      <List sx={{ p: "32px 32px 16px" }}>
        {filteredMenuItems.map((item) => (
          <React.Fragment key={item.id}>
            {renderMenuItem(item)}
            {/* {(index === 0 || index === 4) && <Divider sx={{ my: 1 }} />} */}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

export default Sidebar;
