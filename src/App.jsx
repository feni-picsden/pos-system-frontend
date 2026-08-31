import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeModeProvider } from "./contexts/ThemeModeContext";
import { AppDialogProvider } from "./components/Common/AppDialogProvider";
import GlobalLoader from './components/Common/GlobalLoader';
import AppDataSync from './components/AppDataSync';
import DashboardLayout from "./components/Layout/DashboardLayout";
import Reports from "./pages/Reports";
import ReportsDashboard from "./pages/ReportsDashboard";
import SalesReport from "./pages/Reports/SalesReport";
import PurchaseReport from "./pages/Reports/PurchaseReport";
import InventoryReport from "./pages/Reports/InventoryReport";
import SecurityCentre from "./pages/Reports/SecurityCentre";
import TransferReports from "./pages/Reports/TransferReports";
import InventoryQueryEditor from "./pages/Reports/InventoryQueryEditor";
import SalesQueryEditor from "./pages/Reports/SalesQueryEditor";
import PurchaseQueryEditor from "./pages/Reports/PurchaseQueryEditor";
import DashboardCustomizer from "./pages/DashboardCustomizer";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ReportCustomizer from "./pages/ReportCustomizer";
import Login from "./pages/Login";
import Users from "./pages/Setup/Users";
import RolesAndPermissions from "./pages/Setup/RolesAndPermissions";
import RolePermissions from "./pages/Setup/RolePermissions";
import RoleRevisions from "./pages/Setup/RoleRevisions";
import SaleKey from "./pages/Setup/SaleKey";
import Outlets from "./pages/Setup/Outlets";
import OutletDetails from "./pages/Setup/OutletDetails";
import Registers from "./pages/Setup/Registers";
import LoyaltySettings from "./pages/Setup/LoyaltySettings";
import AssignLoyalty from "./pages/Setup/AssignLoyalty";
import CustomerGroups from "./pages/Customers/CustomerGroups";
import CustomerGroupDetails from "./pages/Customers/CustomerGroupDetails";
import CustomerGroupView from "./pages/Customers/CustomerGroupView";
import Customers from "./pages/Customers/Customers";
import CustomerDetails from "./pages/Customers/CustomerDetails";
import CustomerView from "./pages/Customers/CustomerView";
import CustomerMerge from "./pages/Customers/CustomerMerge";
import PriceLists from "./pages/PriceLists/PriceLists";
import PriceListDetails from "./pages/PriceLists/PriceListDetails";
import PriceListConfiguration from "./pages/PriceLists/PriceListConfiguration";
import Balance from "./pages/Customers/Balance";
import GiftCards from "./pages/Customers/GiftCards";
import ImportGiftCards from "./pages/Customers/ImportGiftCards";
import Classifications from "./pages/StockManagement/Classifications";
import ClassificationAssignment from "./pages/StockManagement/ClassificationAssignment";
import ClassificationDetails from "./pages/StockManagement/ClassificationDetails";
import Products from "./pages/StockManagement/Products";
import ProductView from "./pages/StockManagement/ProductView";
import CreateProductWizard from "./pages/StockManagement/CreateProductWizard";
import Suppliers from "./pages/StockManagement/Suppliers";
import SupplierView from "./pages/StockManagement/SupplierView";
import SupplierAssignment from "./pages/StockManagement/SupplierAssignment";
import SupplierDetails from "./pages/StockManagement/SupplierDetails";
import OrdersInvoices from "./pages/StockManagement/OrdersInvoices";
import OrderDetails from "./pages/StockManagement/OrderDetails";
import ReviewOrder from "./pages/StockManagement/ReviewOrder";
import CreateOrder from "./pages/StockManagement/CreateOrder";
import CreateTransfer from "./pages/StockManagement/CreateTransfer";
import CreateReturn from "./pages/StockManagement/CreateReturn";
import CreateCreditNote from "./pages/StockManagement/CreateCreditNote";
import CreateReceiveStock from "./pages/StockManagement/CreateReceiveStock";
import EditOrder from "./pages/StockManagement/EditOrder";
import ManageCash from "./pages/ManageCash";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SelectedOutletProvider } from "./contexts/SelectedOutletContext";
import { SelectedRegisterProvider } from "./contexts/SelectedRegisterContext";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import PermissionProtectedRoute from "./components/Auth/PermissionProtectedRoute";
import { PermissionProvider } from "./hooks/usePermissions";
import ProductEdit from "./pages/StockManagement/ProductEdit";
import SaleKeyPage from "./pages/SaleKeyPage";
import RegisterClosures from "./pages/Reports/RegisterClosures";
import RegisterClosureView from "./pages/Reports/RegisterClosureView";
import MiscellaneousReports from "./pages/Reports/MiscellaneousReports";
import InventoryAtDate from "./pages/Reports/InventoryAtDate";
import SlowMovingStock from "./pages/Reports/SlowMovingStock";
import FavouriteReports from "./pages/Reports/FavouriteReports";
import StocktakedProducts from "./pages/Reports/StocktakedProducts";
import ProductRevisionHistory from "./pages/Reports/ProductRevisionHistory";
import InventoryMovement from "./pages/Reports/InventoryMovement";
import MetcashMscSales from "./pages/Reports/MetcashMscSales";
import CloseRegister from "./pages/Register/CloseRegister";
import CustomerDisplayScreen from "./pages/Register/CustomerDisplayScreen";
import OpenCustomerDisplay from "./pages/Register/OpenCustomerDisplay";
import SaleKeySets from './pages/Setup/SaleKeySets';
import SaleKeyEditor from './pages/Setup/SaleKeyEditor';
import TaxRates from './pages/Setup/TaxRates';
import PaymentMethods from './pages/Setup/PaymentMethods';
import PromotionCategories from './pages/Setup/PromotionCategories';
import Surcharging from './pages/Setup/Surcharging';
import ReceiptTemplates from './pages/Setup/ReceiptTemplates';
import ReceiptEditor from './pages/Setup/ReceiptEditor';
import StatementTemplates from './pages/Setup/StatementTemplates';
import StatementEditor from './pages/Setup/StatementEditor';
import ShelfTicketTemplates from './pages/Setup/ShelfTicketTemplates';
import ShelfTicketEditor from './pages/Setup/ShelfTicketEditor';
import AccountBilling from './pages/Setup/AccountBilling';
import GeneralSettings from './pages/Setup/GeneralSettings';
import AdditionalInformation from './pages/Setup/AdditionalInformation';
import PriceSets from './pages/Setup/PriceSets';
import PageRules from './pages/Setup/PageRules';
import EnterprisePolicies from './pages/Setup/EnterprisePolicies';
import Integrations from './pages/Setup/Integrations';
import HardwareSettings from './pages/Setup/HardwareSettings';
import LinklySettings from './pages/Setup/LinklySettings';
import CustomerDisplays from './pages/Setup/CustomerDisplays';
import CustomerDisplayEditor from './pages/Setup/CustomerDisplayEditor';
import TransferList from './pages/Setup/TransferList';
import TransfereeForm from './pages/Setup/TransfereeForm';
import TransfereeView from './pages/Setup/TransfereeView';
import SalesHistory from './pages/SalesHistory';
import Promotions from './pages/Marketing/Promotions';
import CreatePromotion from './pages/Marketing/CreatePromotion';
import PromotionDetails from './pages/Marketing/PromotionDetails';
import PromotionView from './pages/Marketing/PromotionView';
import ExpressPromotion from './pages/Marketing/ExpressPromotion';
import ExpressPromotionView from './pages/Marketing/ExpressPromotionView';
import ShelfTickets from './pages/Marketing/ShelfTickets';
import EverydayTickets from './pages/Marketing/EverydayTickets';
import PromotionalTickets from './pages/Marketing/PromotionalTickets';
import Media from './pages/Marketing/Media';
import Stocktakes from './pages/StockManagement/Stocktakes';
import ExpressStocktake from './pages/StockManagement/ExpressStocktake';
import AdvancedStocktake from './pages/StockManagement/AdvancedStocktake';
import StocktakeDetails from './pages/StockManagement/StocktakeDetails';
import MoreStockManagement from './pages/StockManagement/MoreStockManagement';
import StockList from './pages/StockManagement/StockList';
import ProductBuyingPeriods from './pages/StockManagement/ProductBuyingPeriods';
import ExternalStocktake from './pages/StockManagement/ExternalStocktake';
import BulkPriceEdit from './pages/StockManagement/BulkPriceEdit';
import ImportProducts from './pages/StockManagement/ImportProducts';
import AdvancedProductImporter from './pages/StockManagement/AdvancedProductImporter';
import ProductMerge from './pages/StockManagement/ProductMerge';
import CappedPricing from './pages/StockManagement/CappedPricing';
import ProductCombos from './pages/StockManagement/ProductCombos';
import ImportSupplierProducts from './pages/StockManagement/ImportSupplierProducts';
import FuturePrices from './pages/Utilities/FuturePrices';
import FutureCosts from './pages/Utilities/FutureCosts';
import TrashedItems from './pages/Utilities/TrashedItems';
import ProductUtilities from './pages/Utilities/ProductUtilities';
import CustomerUtilities from './pages/Utilities/CustomerUtilities';
import Barcodes from './pages/Utilities/Barcodes';
import MailLog from './pages/Utilities/MailLog';
import PushNotifications from './pages/PushNotifications';
import EditProfile from './pages/Profile/EditProfile';

const POSPage = () => <SaleKeyPage />;

const OrdersPage = () => (
  <div>
    <h2>Orders Management</h2>
    <p>Orders management coming soon...</p>
  </div>
);

const ProductsPage = () => (
  <div>
    <h2>Products</h2>
    <p>Product management coming soon...</p>
  </div>
);

const SettingsPage = () => <GeneralSettings />;

// The whole Setup section moved to /settings/* for reference parity. Canonical
// routes live under /settings; this maps any lingering /setup/* deep link
// (bookmarks, old in-app links) to its /settings/* equivalent so nothing 404s.
const SetupToSettingsRedirect = () => {
  const location = useLocation();
  const target = location.pathname.replace(/^\/setup(?=\/|$)/, "/settings");
  return <Navigate to={`${target}${location.search}${location.hash}`} replace />;
};

const AuthBridge = ({ children }) => {
  const { user, switchOutlet } = useAuth();
  return (
    <SelectedOutletProvider user={user} switchOutlet={switchOutlet}>
      <AppDataSync />
      <SelectedRegisterProvider>{children}</SelectedRegisterProvider>
    </SelectedOutletProvider>
  );
};

function App() {
  return (
    <ThemeModeProvider>
      <AppDialogProvider>
      <Router>
        <AuthProvider>
          <AuthBridge>
          <GlobalLoader />
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            <Route
              path="/customer-display"
              element={
                <ProtectedRoute>
                  <PermissionProvider>
                    <CustomerDisplayScreen />
                  </PermissionProvider>
                </ProtectedRoute>
              }
            />

            {/* Protected routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <PermissionProvider>
                    <DashboardLayout>
                      <Routes>
                        <Route path="/" element={<SaleKeyPage />} />
                        <Route path="/profile/edit" element={<EditProfile />} />
                        <Route
                          path="/dashboard"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.dashboard"]}
                            >
                              <Dashboard />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/register-closures"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <RegisterClosures />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/register-closures/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <RegisterClosureView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/sales/pos"
                          element={
                            <PermissionProtectedRoute requiredPermissions={["register.access"]}>
                              <POSPage />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/sales/orders"
                          element={
                            <PermissionProtectedRoute requiredPermissions={["orders-invoices.view"]}>
                              <OrdersPage />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route path="/register/close" element={<PermissionProtectedRoute requiredPermissions={["register.access"]}><CloseRegister /></PermissionProtectedRoute>} />
                        <Route
                          path="/register/manage-cash"
                          element={
                            <PermissionProtectedRoute requiredPermissions={['register.cash_drawer']}>
                              <ManageCash />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route path="/register/display" element={<PermissionProtectedRoute requiredPermissions={["register.access"]}><OpenCustomerDisplay /></PermissionProtectedRoute>} />
                        <Route
                          path="/inventory/products"
                          element={
                            <PermissionProtectedRoute requiredPermissions={["see_products"]}>
                              <ProductsPage />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.view"]}
                            >
                              <Customers />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/new"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.add"]}
                            >
                              <CustomerDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/create-wizard"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.add"]}
                            >
                              <CustomerDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/merge"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.edit"]}
                            >
                              <CustomerMerge />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/:id/view"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.view"]}
                            >
                              <CustomerView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/:id/edit"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.edit"]}
                            >
                              <CustomerDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.edit"]}
                            >
                              <CustomerDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/groups"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customer_groups.view"]}
                            >
                              <CustomerGroups />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/groups/new"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customer_groups.add"]}
                            >
                              <CustomerGroupDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/groups/:id/view"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customer_groups.view"]}
                            >
                              <CustomerGroupView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/groups/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customer_groups.view"]}
                            >
                              <CustomerGroupDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/gift-cards"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.view"]}
                            >
                              <GiftCards />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/gift-cards/import"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["customers.view"]}
                            >
                              <ImportGiftCards />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/price-lists"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["price_lists.view"]}
                            >
                              <PriceLists />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/price-lists/:id/configuration"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["price_lists.edit"]}
                            >
                              <PriceListConfiguration />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/price-lists/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["price_lists.view"]}
                            >
                              <PriceListDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/customers/balance"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["balance.view"]}
                            >
                              <Balance />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/classifications"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["classifications.view"]}
                            >
                              <Classifications />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/classifications/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["classifications.view"]}
                            >
                              <ClassificationDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/classifications/:id/assign"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["classifications.edit"]}
                            >
                              <ClassificationAssignment />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/products"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["products.view"]}
                            >
                              <Products />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/products/wizard"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["products.add"]}
                            >
                              <CreateProductWizard />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/products/new"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["products.add"]}
                            >
                              <ProductEdit />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/products/:id/view"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["products.view"]}
                            >
                              <ProductView />
                            </PermissionProtectedRoute>
                          }
                        />
                        {/* Bare path mounted the editable form behind a view-only guard.
                            Redirect to the read-only page (relative "view" resolves to
                            /products/:id/view) so links here land where every other
                            call site does. */}
                        <Route
                          path="/products/:id"
                          element={<Navigate to="view" replace />}
                        />
                        <Route
                          path="/products/:id/edit"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["products.edit"]}
                            >
                              <ProductEdit />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/suppliers"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["suppliers.view"]}
                            >
                              <Suppliers />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/suppliers/new"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["suppliers.add"]}
                            >
                              <SupplierDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/suppliers/:id/edit"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["suppliers.edit"]}
                            >
                              <SupplierDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/suppliers/:id/assign"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["suppliers.edit"]}
                            >
                              <SupplierAssignment />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/suppliers/:id/view"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["suppliers.view"]}
                            >
                              <SupplierView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/suppliers/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["suppliers.view"]}
                            >
                              <SupplierView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <OrdersInvoices />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/create"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <CreateOrder />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/create-transfer"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <CreateTransfer />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/create-return"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <CreateReturn />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/create-credit-note"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <CreateCreditNote />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/create-receive-stock"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <CreateReceiveStock />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/:id/edit"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <EditOrder />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/:id/review"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <ReviewOrder />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/orders-invoices/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <OrderDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/stocktakes"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stocktakes.view"]}
                            >
                              <Stocktakes />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/stocktakes/express"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stocktakes.add"]}
                            >
                              <ExpressStocktake />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/stocktakes/advanced"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stocktakes.add"]}
                            >
                              <AdvancedStocktake />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/stocktakes/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stocktakes.view"]}
                            >
                              <StocktakeDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/more"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stock.view"]}
                            >
                              <MoreStockManagement />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/stock-list"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stock.view"]}
                            >
                              <StockList />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/product-buying-periods"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stock.view"]}
                            >
                              <ProductBuyingPeriods />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/stock-management/external-stocktake"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["stocktakes.view"]}
                            >
                              <ExternalStocktake />
                            </PermissionProtectedRoute>
                          }
                        />
        <Route
          path="/stock-management/bulk-price-edit"
          element={
            <PermissionProtectedRoute
              requiredPermissions={["products.edit"]}
            >
              <BulkPriceEdit />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/stock-management/import-products"
          element={
            <PermissionProtectedRoute
              requiredPermissions={["products.add"]}
            >
              <ImportProducts />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/stock-management/advanced-product-importer"
          element={
            <PermissionProtectedRoute
              requiredPermissions={["products.add"]}
            >
              <AdvancedProductImporter />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/stock-management/product-merge"
          element={
            <PermissionProtectedRoute
              requiredPermissions={["products.edit"]}
            >
              <ProductMerge />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/stock-management/capped-pricing"
          element={
            <PermissionProtectedRoute
              requiredPermissions={["products.view"]}
            >
              <CappedPricing />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/stock-management/import-supplier-products"
          element={
            <PermissionProtectedRoute
              requiredPermissions={["products.add"]}
            >
              <ImportSupplierProducts />
            </PermissionProtectedRoute>
          }
        />
        <Route
          path="/stock-management/product-combos"
          element={
            <PermissionProtectedRoute
              requiredPermissions={["products.view"]}
            >
              <ProductCombos />
            </PermissionProtectedRoute>
          }
        />
                        <Route
                          path="/reports/dashboard"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <ReportsDashboard />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/sales"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.sales"]}
                            >
                              <SalesReport />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/inventory"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.inventory"]}
                            >
                              <InventoryReport />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/security-centre"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <SecurityCentre />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/inventory/query"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.inventory"]}
                            >
                              <InventoryQueryEditor />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/sales/query"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.sales"]}
                            >
                              <SalesQueryEditor />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/purchases"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.purchases"]}
                            >
                              <PurchaseReport />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/transfer-reports"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <TransferReports />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/purchases/query"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.purchases"]}
                            >
                              <PurchaseQueryEditor />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/miscellaneous"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <MiscellaneousReports />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/inventory-at-date"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.inventory"]}
                            >
                              <InventoryAtDate />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/slow-moving-stock"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.inventory"]}
                            >
                              <SlowMovingStock />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/stocktaked-products"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.inventory"]}
                            >
                              <StocktakedProducts />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/product-revision-history"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["products.view"]}
                            >
                              <ProductRevisionHistory />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/inventory-movement"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.inventory"]}
                            >
                              <InventoryMovement />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/metcash-msc-sales"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.sales"]}
                            >
                              <MetcashMscSales />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/favourite"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <FavouriteReports />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/analytics/reports"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <Reports />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reporting"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <ReportCustomizer />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/view"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.view"]}
                            >
                              <Reports />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/dashboard/customize"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["reports.dashboard"]}
                            >
                              <DashboardCustomizer />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/general"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.view"]}
                            >
                              <SettingsPage />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.view"]}
                            >
                              <SettingsPage />
                            </PermissionProtectedRoute>
                          }
                        />

                        <Route
                          path="/settings/users"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["users.view"]}
                            >
                              <Users />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/roles"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["roles.view"]}
                            >
                              <RolesAndPermissions />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/roles/new"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["roles.add"]}
                            >
                              <RolePermissions />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/roles/:roleId/permissions"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["roles.edit"]}
                            >
                              <RolePermissions />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/roles/:roleId/revisions"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["roles.view"]}
                            >
                              <RoleRevisions />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/account-billing"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["manage_billing"]}
                            >
                              <AccountBilling />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/sale-key"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["sale_keys.view"]}
                            >
                              <SaleKey />
                            </PermissionProtectedRoute>
                          }
                        />
                                    <Route
              path="/settings/taxes"
              element={
                <PermissionProtectedRoute
                  requiredPermissions={["taxes.view"]}
                >
                  <TaxRates />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/payment-methods"
              element={
                <PermissionProtectedRoute
                  requiredPermissions={["payment_methods.view"]}
                >
                  <PaymentMethods />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/promotion-categories"
              element={
                <PermissionProtectedRoute
                  requiredPermissions={["promotion_categories.view"]}
                >
                  <PromotionCategories />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/surcharging"
              element={
                <PermissionProtectedRoute
                  requiredPermissions={["surcharges.view"]}
                >
                  <Surcharging />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/receipts"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_receipts"]}>
                  <ReceiptTemplates />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/receipts/:templateId/edit"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_receipts"]}>
                  <ReceiptEditor />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/statements"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_statements"]}>
                  <StatementTemplates />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/statements/:templateId/edit"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_statements"]}>
                  <StatementEditor />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/shelf-tickets"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_ticket_templates"]}>
                  <ShelfTicketTemplates />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/shelf-tickets/:templateId/edit"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_ticket_templates"]}>
                  <ShelfTicketEditor />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/customer-display"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_customer_displays"]}>
                  <CustomerDisplays />
                </PermissionProtectedRoute>
              }
            />
            <Route
              path="/settings/customer-display/:templateId/edit"
              element={
                <PermissionProtectedRoute requiredPermissions={["modify_customer_displays"]}>
                  <CustomerDisplayEditor />
                </PermissionProtectedRoute>
              }
            />
                        <Route
                          path="/settings/transfer-list"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <TransferList />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/transfer-list/new"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.add"]}
                            >
                              <TransfereeForm />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/transfer-list/:id/edit"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.edit"]}
                            >
                              <TransfereeForm />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/transfer-list/:id/view"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["orders-invoices.view"]}
                            >
                              <TransfereeView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/sale-key-sets"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["sale_keys.view"]}
                            >
                              <SaleKeySets />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/sale-key/:setId"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["sale_keys.edit"]}
                            >
                              <SaleKeyEditor />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route 
                          path="/settings/loyalty" 
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.view"]}
                            >
                              <LoyaltySettings />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route 
                          path="/settings/loyalty/:id/assign" 
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.edit"]}
                            >
                              <AssignLoyalty />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/integrations"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["modify_integrations"]}
                            >
                              <Integrations />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/additional-information"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.view"]}
                            >
                              <AdditionalInformation />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/pricesets"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.view"]}
                            >
                              <PriceSets />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/rules"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.view"]}
                            >
                              <PageRules />
                            </PermissionProtectedRoute>
                          }
                        />
                        {/* Reference route is /enterprise (not under /settings) */}
                        <Route
                          path="/enterprise"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["settings.view"]}
                            >
                              <EnterprisePolicies />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/master-database-products"
                          element={
                            <ProtectedRoute requireSuperAdmin>
                              <ImportSupplierProducts />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/push"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["manage_push_devices"]}
                            >
                              <PushNotifications />
                            </PermissionProtectedRoute>
                          }
                        />
                        {/* Legacy path kept for existing links */}
                        <Route
                          path="/admin/push-notifications"
                          element={<Navigate to="/settings/push" replace />}
                        />
                        
                        {/* Sales History Route */}
                        <Route
                          path="/register/history"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["see_history", "reports.sales"]}
                            >
                              <SalesHistory />
                            </PermissionProtectedRoute>
                          }
                        />
                        
                        {/* Registers & Outlets — merged Settings page (reference parity) */}
                        <Route
                          path="/settings/registers-outlets"
                          element={
                            <ProtectedRoute requireSuperAdmin>
                              <Outlets />
                            </ProtectedRoute>
                          }
                        />
                        {/* Legacy list path → merged page */}
                        <Route
                          path="/outlets"
                          element={<Navigate to="/settings/registers-outlets" replace />}
                        />
                        <Route
                          path="/outlets/:id"
                          element={
                            <ProtectedRoute requireSuperAdmin>
                              <OutletDetails />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/registers"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={['register.manage']}
                            >
                              <Registers />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/hardware"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["modify_hardware"]}
                            >
                              <HardwareSettings />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings/linkly"
                          element={
                            <PermissionProtectedRoute requiredPermissions={['register.manage']}>
                              <LinklySettings />
                            </PermissionProtectedRoute>
                          }
                        />

                        {/* Marketing Routes */}
                        <Route
                          path="/marketing/promotions"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.view"]}
                            >
                              <Promotions />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/promotions/create"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.add"]}
                            >
                              <CreatePromotion />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/promotions/express/:id/view"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.view"]}
                            >
                              <ExpressPromotionView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/promotions/express/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.edit"]}
                            >
                              <ExpressPromotion />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/promotions/:id"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.view"]}
                            >
                              <PromotionView />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/promotions/:id/edit"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.edit"]}
                            >
                              <PromotionDetails />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/shelf-tickets"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.view"]}
                            >
                              <ShelfTickets />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/shelf-tickets/everyday"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.view"]}
                            >
                              <EverydayTickets />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/shelf-tickets/promotional"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.view"]}
                            >
                              <PromotionalTickets />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/marketing/media"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["promotions.view"]}
                            >
                              <Media />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/utilities/future-prices"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["modify_default_prices"]}
                            >
                              <FuturePrices />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/utilities/future-costs"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["modify_default_prices"]}
                            >
                              <FutureCosts />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/utilities/mail-log"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["see_mail_log"]}
                            >
                              <MailLog />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/utilities/trashed-items"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["see_trashed_items"]}
                            >
                              <TrashedItems />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/utilities/product-utilities"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["edit_products"]}
                            >
                              <ProductUtilities />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/utilities/customer-utilities"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["edit_customers"]}
                            >
                              <CustomerUtilities />
                            </PermissionProtectedRoute>
                          }
                        />
                        {/* Barcode Templates — now under Settings (reference parity); Utilities path kept */}
                        <Route
                          path="/settings/barcodes"
                          element={
                            <PermissionProtectedRoute
                              requiredPermissions={["modify_barcode_templates"]}
                            >
                              <Barcodes />
                            </PermissionProtectedRoute>
                          }
                        />
                        <Route
                          path="/utilities/barcodes"
                          element={<Navigate to="/settings/barcodes" replace />}
                        />

                        {/* Any remaining old /setup/* deep link → /settings/* equivalent */}
                        <Route path="/setup/*" element={<SetupToSettingsRedirect />} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </DashboardLayout>
                  </PermissionProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
          </AuthBridge>
        </AuthProvider>
      </Router>
      </AppDialogProvider>
    </ThemeModeProvider>
  );
}

export default App;
