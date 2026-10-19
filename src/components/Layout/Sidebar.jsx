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
  // Reference glyphs (Font Awesome light) matched to MUI Outlined icons (user 19/10/2026)
  AccountBalanceOutlined,
  AccountTreeOutlined,
  Add,
  AttachMoneyOutlined,
  BadgeOutlined,
  BalanceOutlined,
  BarChartOutlined,
  BuildOutlined,
  CalendarMonthOutlined,
  CampaignOutlined,
  CardGiftcardOutlined,
  ConfirmationNumberOutlined,
  ContactPageOutlined,
  CreditCardOutlined,
  DeleteOutline,
  DesktopWindowsOutlined,
  DoorFrontOutlined,
  DrawOutlined,
  EditCalendarOutlined,
  EmojiEventsOutlined,
  ExtensionOutlined,
  FilterNoneOutlined,
  FormatListNumberedOutlined,
  GroupOutlined,
  GroupWorkOutlined,
  HubOutlined,
  InfoOutlined,
  Inventory2Outlined,
  KeyboardArrowRight,
  KeyboardOutlined,
  LocalBarOutlined,
  LocalOfferOutlined,
  LocalShippingOutlined,
  LockOutlined,
  MailOutlined,
  MedicalServicesOutlined,
  MenuBookOutlined,
  PaymentsOutlined,
  PercentOutlined,
  PieChartOutlineOutlined,
  PlaceOutlined,
  PointOfSaleOutlined,
  PrintOutlined,
  ReceiptLongOutlined,
  RepeatOutlined,
  ScatterPlotOutlined,
  SettingsOutlined,
  ShieldOutlined,
  ShoppingBagOutlined,
  ShoppingCartOutlined,
  ShowChartOutlined,
  ShuffleOutlined,
  SmartphoneOutlined,
  SpeedOutlined,
  StackedLineChartOutlined,
  StarBorderOutlined,
  StorageOutlined,
  ThermostatOutlined,
  ThumbUpOffAltOutlined,
  TuneOutlined,
  TvOutlined,
  ViewInArOutlined,
  ViewWeekOutlined,
} from "@mui/icons-material";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  closeCustomerDisplayWindow,
  isCustomerDisplayWindowOpen,
  openCustomerDisplayWindow,
} from "../../utils/customerDisplayWindow";
import { confirmLeave, hasLeaveGuard } from "../../utils/leaveGuard";

const menuItems = [
  {
    id: "sell",
    title: "Sell",
    icon: <ShoppingBagOutlined />,
    path: "/",
    badge: null,
    permissions: ["register.access"], // Requires register access
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: <SpeedOutlined />,
    path: "/dashboard",
    badge: null,
    permissions: ["reports.dashboard"], // Requires dashboard permission
  },
  {
    id: "register",
    title: "Register",
    icon: <ShoppingCartOutlined />,
    path: "/register",
    badge: null,
    permissions: ["register.access"], // Parent permission
    children: [
      {
        id: "manage-cash",
        title: "Manage Cash",
        icon: <PaymentsOutlined />,
        path: "/register/manage-cash",
        permissions: ["register.cash_drawer"],
      },
      {
        id: "close-register",
        title: "Close Register",
        icon: <AccountBalanceOutlined />,
        path: "/register/close",
        permissions: ["register.access"],
      },
      {
        id: "sale-history",
        title: "Sales History",
        icon: <MenuBookOutlined />,
        path: "/register/history",
        permissions: ["see_history", "reports.sales"],
      },
      {
        id: "open-customer-display",
        title: "Open Customer Display",
        icon: <DesktopWindowsOutlined />,
        path: "/register/display",
        permissions: ["register.access"],
      },
    ],
  },
  {
    id: "stock-management",
    title: "Stock Management",
    icon: <ViewWeekOutlined />,
    path: "/stock",
    badge: null,
    permissions: ["stock.view"], // Parent permission
    children: [
      {
        id: "products",
        title: "Products",
        icon: <LocalBarOutlined />,
        path: "/products",
        permissions: ["products.view"],
      },
      {
        id: "classifications",
        title: "Classifications",
        icon: <LocalOfferOutlined />,
        path: "/classifications",
        permissions: ["classifications.view"],
      },
    
      {
        id: "suppliers",
        title: "Suppliers",
        icon: <LocalShippingOutlined />,
        path: "/suppliers",
        permissions: ["suppliers.view"],
      },
      {
        id: "orders-invoices",
        title: "Orders & Invoices",
        icon: <ViewInArOutlined />,
        path: "/orders-invoices",
        permissions: ["orders-invoices.view"],
      },
      {
        id: "stocktakes",
        title: "Stocktakes",
        icon: <FormatListNumberedOutlined />,
        path: "/stock-management/stocktakes",
        permissions: ["stocktakes.view"],
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
    icon: <ContactPageOutlined />,
    path: "/customers",
    badge: null,
    permissions: ["customers.view"],
    children: [
      {
        id: "customers",
        title: "Customers",
        icon: <BadgeOutlined />,
        path: "/customers",
        permissions: ["customers.view"],
      },
      {
        id: "customer-groups",
        title: "Customer Groups",
        icon: <GroupWorkOutlined />,
        path: "/customers/groups",
        permissions: ["customer_groups.view"],
      },
      {
        id: "price-lists",
        title: "Price Lists",
        icon: <AttachMoneyOutlined />,
        path: "/customers/price-lists",
        permissions: ["price_lists.view"],
      },
      {
        id: "balance",
        title: "Balance",
        icon: <BalanceOutlined />,
        path: "/customers/balance",
        permissions: ["balance.view"],
      },
      {
        id: "gift-cards",
        title: "Gift Cards",
        icon: <CardGiftcardOutlined />,
        path: "/customers/gift-cards",
        permissions: ["customers.view"],
      },
    ],
  },
  {
    id: "marketing",
    title: "Marketing",
    icon: <CampaignOutlined />,
    path: "/marketing",
    badge: null,
    permissions: ["promotions.view"],
    children: [
      {
        id: "promotions",
        title: "Promotions",
        icon: <ThumbUpOffAltOutlined />,
        path: "/marketing/promotions",
        permissions: ["promotions.view"],
      },
      {
        id: "shelf-tickets",
        title: "Shelf Tickets",
        icon: <ConfirmationNumberOutlined />,
        path: "/marketing/shelf-tickets",
        permissions: ["promotions.view"],
      },
      {
        id: "media",
        title: "Media Center",
        icon: <TvOutlined />,
        path: "/marketing/media",
        permissions: ["promotions.view"],
      },
    ],
  },
  {
    id: "reporting",
    title: "Reporting",
    icon: <StackedLineChartOutlined />,
    path: "/reports",
    badge: null,
    permissions: ["reports.view"],
    children: [
      {
        id: "reports",
        title: "Reporting Dashboard",
        icon: <PieChartOutlineOutlined />,
        path: "/reports/dashboard",
        permissions: ["reports.view"],
      },
      {
        id: "sales-report",
        title: "Sales Report",
        icon: <ShowChartOutlined />,
        path: "/reports/sales",
        permissions: ["reports.sales"],
      },
      {
        id: "inventory-report",
        title: "Inventory Report",
        icon: <Inventory2Outlined />,
        path: "/reports/inventory",
        permissions: ["reports.inventory"],
      },
      {
        id: "transfer-reports",
        title: "Transfer Reports",
        icon: <ScatterPlotOutlined />,
        path: "/reports/transfer-reports",
        permissions: ["reports.view"],
      },
      {
        id: "actions-reports",
        title: "Actions Reports",
        icon: <ThermostatOutlined />,
        path: "/reports/actions",
        permissions: ["run_actions_reports"],
      },
      {
        title: "Purchase Report",
        icon: <BarChartOutlined />,
        path: "/reports/purchases",
        permissions: ["reports.purchases"],
      },
      {
        id: "register-closures",
        title: "Register Closures",
        icon: <DoorFrontOutlined />,
        path: "/reports/register-closures",
        permissions: ["reports.view"],
      },
      {
        id: "security-centre",
        title: "Security Centre",
        icon: <ShieldOutlined />,
        path: "/reports/security-centre",
        permissions: ["reports.view"],
      },
      {
        id: "miscellaneous-reports",
        title: "Miscellaneous Reports",
        icon: <HubOutlined />,
        path: "/reports/miscellaneous",
        permissions: ["reports.view"],
      },
      {
        id: "favourite-reports",
        title: "Favourite Reports",
        icon: <StarBorderOutlined />,
        path: "/reports/favourite",
        permissions: ["reports.view"],
      },
    ],
  },
  {
    id: "setup",
    title: "Settings",
    icon: <BuildOutlined />,
    path: "/settings",
    badge: null,
    permissions: [],
    // Ordered to match the reference Settings menu (all four reference-only
    // pages shipped 2026-08-31: Additional Information, Page Rules, Price Sets,
    // Enterprise Policies). Local-only extras
    // (Shelf Ticket Templates, Linkly EFTPOS, Master Database Products) are kept
    // and slotted next to related items.
    children: [
      {
        id: "general",
        title: "General",
        icon: <SettingsOutlined />,
        path: "/settings/general",
        permissions: ["settings.view"],
      },
      // {
      //   id: "account-billing",
      //   title: "Account & Billing",
      //   icon: <AccountCircle />,
      //   path: "/settings/account-billing",
      //   permissions: [],
      // },
      {
        id: "sale-key",
        title: "Sale Keys",
        icon: <KeyboardOutlined />,
        path: "/settings/sale-key-sets",
        permissions: ["sale_keys.view"],
      },
      {
        id: "receipts",
        title: "Receipts",
        icon: <ReceiptLongOutlined />,
        path: "/settings/receipts",
        permissions: ["modify_receipts"],
      },
      {
        id: "statements",
        title: "Statements",
        icon: <MailOutlined />,
        path: "/settings/statements",
        permissions: ["modify_statements"],
      },
      {
        id: "shelf-ticket-templates",
        title: "Shelf Ticket Templates",
        icon: <ConfirmationNumberOutlined />,
        path: "/settings/shelf-tickets",
        permissions: ["modify_ticket_templates"],
      },
      {
        id: "payment-methods",
        title: "Payment Methods",
        icon: <CreditCardOutlined />,
        path: "/settings/payment-methods",
        permissions: ["payment_methods.view"],
      },
      {
        id: "taxes",
        title: "Tax Rates",
        icon: <PercentOutlined />,
        path: "/settings/taxes",
        permissions: ["taxes.view"],
      },
      {
        id: "transfer-list",
        title: "Transfer List",
        icon: <RepeatOutlined />,
        path: "/settings/transfer-list",
        permissions: ["orders-invoices.view"],
      },
      {
        id: "customer-display",
        title: "Customer Display",
        icon: <DesktopWindowsOutlined />,
        path: "/settings/customer-display",
        permissions: ["register.access"],
      },
      {
        id: "users",
        title: "Users",
        icon: <GroupOutlined />,
        path: "/settings/users",
        permissions: ["users.view"],
      },
      {
        id: "rolesandpermissions",
        title: "Roles & Permissions",
        icon: <LockOutlined />,
        path: "/settings/roles",
        permissions: ["roles.view"],
      },
      {
        id: "loyalty",
        title: "Loyalty",
        icon: <EmojiEventsOutlined />,
        path: "/settings/loyalty",
        permissions: ["settings.view"],
      },
      {
        id: "surcharging",
        title: "Surcharging",
        icon: <DrawOutlined />,
        path: "/settings/surcharging",
        permissions: ["surcharges.view"],
      },
      {
        id: "hardware",
        title: "Hardware",
        icon: <PrintOutlined />,
        path: "/settings/hardware",
        permissions: ["modify_hardware"],
      },
      {
        id: "additional-information",
        title: "Additional Information",
        icon: <InfoOutlined />,
        path: "/settings/additional-information",
        permissions: ["settings.view"],
      },
      {
        id: "page-rules",
        title: "Page Rules",
        icon: <ShuffleOutlined />,
        path: "/settings/rules",
        permissions: ["settings.view"],
      },
      {
        id: "linkly",
        title: "Linkly EFTPOS",
        icon: <PointOfSaleOutlined />,
        path: "/settings/linkly",
        permissions: ["register.manage"],
      },
      {
        id: "integrations",
        title: "Integrations",
        icon: <ExtensionOutlined />,
        path: "/settings/integrations",
        permissions: ["modify_integrations"],
      },
      {
        id: "push-notifications",
        title: "Push Notifications",
        icon: <SmartphoneOutlined />,
        path: "/settings/push",
        permissions: ["manage_push_devices"],
      },
      {
        id: "promotion-categories",
        title: "Promotion Categories",
        icon: <FilterNoneOutlined />,
        path: "/settings/promotion-categories",
        permissions: ["promotion_categories.view"],
      },
      {
        id: "barcode-templates",
        title: "Barcode Templates",
        icon: <ViewWeekOutlined />,
        path: "/settings/barcodes",
        permissions: ["modify_barcode_templates"],
      },
      {
        id: "price-sets",
        title: "Price Sets",
        icon: <TuneOutlined />,
        path: "/settings/pricesets",
        permissions: ["settings.view"],
      },
      {
        id: "registers-outlets",
        title: "Registers & Outlets",
        icon: <PlaceOutlined />,
        path: "/settings/registers-outlets",
        permissions: [],
      },
      {
        id: "master-database-products",
        title: "Master Database Products",
        icon: <StorageOutlined />,
        path: "/settings/master-database-products",
        permissions: ["products.add"],
      },
      {
        id: "enterprise-policies",
        title: "Enterprise Policies",
        icon: <AccountTreeOutlined />,
        path: "/enterprise",
        permissions: ["settings.view"],
      },
    ],
  },
  {
    id: "utilities",
    title: "Utilities",
    icon: <MedicalServicesOutlined />,
    path: "/utilities",
    badge: null,
    permissions: [],
    children: [
      {
        id: "future-prices",
        title: "Future Prices",
        icon: <EditCalendarOutlined />,
        path: "/utilities/future-prices",
        permissions: ["modify_default_prices"],
      },
      {
        id: "future-costs",
        title: "Future Costs",
        icon: <CalendarMonthOutlined />,
        path: "/utilities/future-costs",
        permissions: ["modify_default_prices"],
      },
      {
        id: "mail-log",
        title: "Mail Log",
        icon: <MailOutlined />,
        path: "/utilities/mail-log",
        permissions: ["see_mail_log"],
      },
      {
        id: "trashed-items",
        title: "Trashed Items",
        icon: <DeleteOutline />,
        path: "/utilities/trashed-items",
        permissions: ["see_trashed_items"],
      },
      {
        id: "product-utilities",
        title: "Product Utilities",
        icon: <Inventory2Outlined />,
        path: "/utilities/product-utilities",
        permissions: ["edit_products"],
      },
      {
        id: "customer-utilities",
        title: "Customer Utilities",
        icon: <GroupOutlined />,
        path: "/utilities/customer-utilities",
        permissions: ["edit_customers"],
      },
      // Barcode Templates moved to Settings (reference parity) — see the Settings section.
    ],
  },
];

const Sidebar = ({ onClick }) => {
  const [openItems, setOpenItems] = useState({});
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false);
  const navigate = useNavigate();
  const { getOutletName } = useAuth();
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

  // A plain left-click is ours to handle; ctrl/cmd/shift/alt-click and
  // middle-click belong to the browser, which is what opens the item in a new
  // tab or window. Returning early rather than preventDefault-ing is what makes
  // that work now that leaf items render as real <a href> links.
  const isModifiedClick = (e) =>
    Boolean(e) &&
    (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (e.button != null && e.button !== 0));

  const handleItemClick = (item, event) => {
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
      // Modifier/middle click: leave the anchor alone so the browser opens the
      // page in a new tab. The drawer stays open, which is the point.
      if (isModifiedClick(event)) return;
      // Pages with unsaved edits (Setup > General) get to confirm before we
      // leave. Only then do we cancel the anchor and drive the navigation
      // ourselves; with no guard registered the <Link> navigates on its own.
      if (hasLeaveGuard()) {
        event?.preventDefault();
        confirmLeave(() => navigate(item.path));
      }
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
    // Leaf items that go somewhere render as real anchors, so right-click >
    // "Open link in new tab", ctrl/cmd-click and middle-click all work. Group
    // headers (they only expand) and the customer-display toggle (it opens a
    // popup window, not a route) stay plain buttons.
    const linkProps =
      !hasChildren && item.path && item.id !== "open-customer-display"
        ? { component: RouterLink, to: item.path }
        : {};

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
            {...linkProps}
            onClick={(e) => handleItemClick(item, e)}
            onAuxClick={(e) => handleItemClick(item, e)}
            sx={{
              p: "4px 0",
              borderRadius: 0,
              transition: "none",
              // It is an <a> now; keep it looking exactly like the row it was.
              textDecoration: "none",
              color: "inherit",
              "&:hover": {
                bgcolor: "transparent",
                textDecoration: "none",
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
      {!isTrueSuperAdmin && getOutletName() && (
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

// Every page the menu can reach, flattened for pickers (Quick Menu "Page" dropdown):
// [{ id, label: "Stock Management > Products", title, path, permissions }]. Derived
// from the ONE menu definition above, so a page added to the sidebar is pickable
// with no second list to maintain. Group rows that only open a sub-menu are skipped.
export const APP_PAGES = menuItems.flatMap((item) => {
  const children = Array.isArray(item.children) ? item.children : [];
  if (children.length === 0) {
    return item.path ? [{ id: item.id, label: item.title, title: item.title, path: item.path, permissions: item.permissions || [] }] : [];
  }
  return children
    .filter((child) => child.path)
    .map((child) => ({
      id: child.id,
      label: `${item.title} > ${child.title}`,
      title: child.title,
      path: child.path,
      permissions: child.permissions || [],
    }));
});

export default Sidebar;
