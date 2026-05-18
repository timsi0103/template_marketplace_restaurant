import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { StoreStatusProvider } from "@/contexts/StoreStatusContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import CartDrawer from "@/components/cart/CartDrawer";
import { Toaster } from "@/components/ui/sonner";
import StoreStatusBanner from "@/components/layout/StoreStatusBanner";
import ScrollToTop from "@/components/layout/ScrollToTop";
import ClosedOverlay from "@/components/layout/ClosedOverlay";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderSuccessPage from "@/pages/OrderSuccessPage";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
import CustomerOrdersPage from "@/pages/CustomerOrdersPage";
import LoyaltyPage from "@/pages/LoyaltyPage";
import KitchenPage from "@/pages/KitchenPage";
import LoginPage from "@/pages/LoginPage";
import SignUpPage from "@/pages/SignUpPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AuthCallback from "@/pages/AuthCallback";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminCatalog from "@/pages/admin/AdminCatalog";
import AdminItemForm from "@/pages/admin/AdminItemForm";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminCategoryForm from "@/pages/admin/AdminCategoryForm";
import AdminModifiers from "@/pages/admin/AdminModifiers";
import AdminModifierForm from "@/pages/admin/AdminModifierForm";
import AdminVariants from "@/pages/admin/AdminVariants";
import AdminHours from "@/pages/admin/AdminHours";
import AdminHolidays from "@/pages/admin/AdminHolidays";
import AdminCoupons from "@/pages/admin/AdminCoupons";
import AdminCouponForm from "@/pages/admin/AdminCouponForm";
import AdminKDSSettings from "@/pages/admin/AdminKDSSettings";
import AdminPrinters from "@/pages/admin/AdminPrinters";
import AdminPrintSettings from "@/pages/admin/AdminPrintSettings";
import AdminPrintJobs from "@/pages/admin/AdminPrintJobs";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminLiveQueue from "@/pages/admin/AdminLiveQueue";
import AdminThrottle from "@/pages/admin/AdminThrottle";
import AdminEightySix from "@/pages/admin/AdminEightySix";
import SearchResultsPage from "@/pages/SearchResultsPage";
import KitchenTicketPage from "@/pages/KitchenTicketPage";
import ReceiptPage from "@/pages/ReceiptPage";
import KDSBoard from "@/pages/KDSBoard";
import CategoryLandingPage from "@/pages/CategoryLandingPage";
import AdminStorefront from "@/pages/admin/AdminStorefront";
import AdminCatalogSettings from "@/pages/admin/AdminCatalogSettings";
import AdminStoreProfile from "@/pages/admin/AdminStoreProfile";
import AdminFees from "@/pages/admin/AdminFees";
import AdminDailySummary from "@/pages/admin/AdminDailySummary";
import AdminSEO from "@/pages/admin/AdminSEO";
import AdminCancellations from "@/pages/admin/AdminCancellations";
import AdminStaff from "@/pages/admin/AdminStaff";
import AdminStaffProfile from "@/pages/admin/AdminStaffProfile";
import AdminRoles from "@/pages/admin/AdminRoles";
import AdminReviews from "@/pages/admin/AdminReviews";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
import ReviewSubmissionPage from "@/pages/ReviewSubmissionPage";
import DiscoverPage from "@/pages/DiscoverPage";
import ProfilePage from "@/pages/ProfilePage";
import { useStorefront } from "@/hooks/useStorefront";

function AppRouter() {
  const location = useLocation();
  useStorefront(); // Load + apply brand theming globally

  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <>
      <ScrollToTop />
      <StoreStatusBanner />
      <Navbar />
      <ClosedOverlay />
      <div className="pb-16 lg:pb-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/menu/:slug" element={<CategoryLandingPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order/success" element={<OrderSuccessPage />} />
          <Route path="/orders" element={<CustomerOrdersPage />} />
          <Route path="/orders/track/:order_id" element={<OrderTrackingPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/kds" element={<KDSBoard />} />
          <Route path="/kds/:station" element={<KDSBoard />} />
          <Route path="/receipt/:order_id" element={<ReceiptPage />} />
          <Route path="/search" element={<SearchResultsPage />} />
          <Route path="/accept-invite/:token" element={<AcceptInvitePage />} />
          <Route path="/review/:order_id" element={<ReviewSubmissionPage />} />
          <Route path="/admin/ticket/:order_id" element={<KitchenTicketPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="catalog/new" element={<AdminItemForm />} />
            <Route path="catalog/:id/edit" element={<AdminItemForm />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="categories/new" element={<AdminCategoryForm />} />
            <Route path="categories/:id/edit" element={<AdminCategoryForm />} />
            <Route path="modifiers" element={<AdminModifiers />} />
            <Route path="modifiers/new" element={<AdminModifierForm />} />
            <Route path="modifiers/:id/edit" element={<AdminModifierForm />} />
            <Route path="variants" element={<AdminVariants />} />
            <Route path="holidays" element={<AdminHolidays />} />
            <Route path="hours" element={<AdminHours />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="coupons/new" element={<AdminCouponForm />} />
            <Route path="coupons/:id/edit" element={<AdminCouponForm />} />
            <Route path="kds-settings" element={<AdminKDSSettings />} />
            <Route path="printers" element={<AdminPrinters />} />
            <Route path="print-settings" element={<AdminPrintSettings />} />
            <Route path="print-jobs" element={<AdminPrintJobs />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="queue" element={<AdminLiveQueue />} />
            <Route path="throttle" element={<AdminThrottle />} />
            <Route path="86" element={<AdminEightySix />} />
            <Route path="storefront" element={<AdminStorefront />} />
            <Route path="catalog-settings" element={<AdminCatalogSettings />} />
            <Route path="store-profile" element={<AdminStoreProfile />} />
            <Route path="fees" element={<AdminFees />} />
            <Route path="daily-summary" element={<AdminDailySummary />} />
            <Route path="seo" element={<AdminSEO />} />
            <Route path="cancellations" element={<AdminCancellations />} />
            <Route path="staff" element={<AdminStaff />} />
            <Route path="staff/:userId" element={<AdminStaffProfile />} />
            <Route path="roles" element={<AdminRoles />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="customers" element={<div className="p-10"><h1 className="font-heading text-3xl font-bold text-brand-text">Customers</h1><p className="font-body text-sm text-brand-text-secondary mt-2">Customer management coming soon.</p></div>} />
            <Route path="settings" element={<div className="p-10"><h1 className="font-heading text-3xl font-bold text-brand-text">Settings</h1><p className="font-body text-sm text-brand-text-secondary mt-2">Settings coming soon.</p></div>} />
          </Route>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </div>
      <Footer />
      <BottomNav />
      <CartDrawer />
      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-brand-bg font-body">
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <StoreStatusProvider>
              <AppRouter />
            </StoreStatusProvider>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
