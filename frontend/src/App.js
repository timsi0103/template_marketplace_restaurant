import "@/App.css";
import { lazy, Suspense } from "react";
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
import ErrorBoundary from "@/components/ErrorBoundary";
import AuthCallback from "@/pages/AuthCallback";
import { useStorefront } from "@/hooks/useStorefront";

// Lazy-loaded route components (code splitting)
const HomePage = lazy(() => import("@/pages/HomePage"));
const MenuPage = lazy(() => import("@/pages/MenuPage"));
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const OrderSuccessPage = lazy(() => import("@/pages/OrderSuccessPage"));
const OrderTrackingPage = lazy(() => import("@/pages/OrderTrackingPage"));
const CustomerOrdersPage = lazy(() => import("@/pages/CustomerOrdersPage"));
const LoyaltyPage = lazy(() => import("@/pages/LoyaltyPage"));
const KitchenPage = lazy(() => import("@/pages/KitchenPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const SignUpPage = lazy(() => import("@/pages/SignUpPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminCatalog = lazy(() => import("@/pages/admin/AdminCatalog"));
const AdminItemForm = lazy(() => import("@/pages/admin/AdminItemForm"));
const AdminCategories = lazy(() => import("@/pages/admin/AdminCategories"));
const AdminCategoryForm = lazy(() => import("@/pages/admin/AdminCategoryForm"));
const AdminModifiers = lazy(() => import("@/pages/admin/AdminModifiers"));
const AdminModifierForm = lazy(() => import("@/pages/admin/AdminModifierForm"));
const AdminVariants = lazy(() => import("@/pages/admin/AdminVariants"));
const AdminHours = lazy(() => import("@/pages/admin/AdminHours"));
const AdminHolidays = lazy(() => import("@/pages/admin/AdminHolidays"));
const AdminCoupons = lazy(() => import("@/pages/admin/AdminCoupons"));
const AdminCouponForm = lazy(() => import("@/pages/admin/AdminCouponForm"));
const AdminKDSSettings = lazy(() => import("@/pages/admin/AdminKDSSettings"));
const AdminPrinters = lazy(() => import("@/pages/admin/AdminPrinters"));
const AdminPrintSettings = lazy(() => import("@/pages/admin/AdminPrintSettings"));
const AdminPrintJobs = lazy(() => import("@/pages/admin/AdminPrintJobs"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminLiveQueue = lazy(() => import("@/pages/admin/AdminLiveQueue"));
const AdminThrottle = lazy(() => import("@/pages/admin/AdminThrottle"));
const AdminEightySix = lazy(() => import("@/pages/admin/AdminEightySix"));
const SearchResultsPage = lazy(() => import("@/pages/SearchResultsPage"));
const KitchenTicketPage = lazy(() => import("@/pages/KitchenTicketPage"));
const ReceiptPage = lazy(() => import("@/pages/ReceiptPage"));
const KDSBoard = lazy(() => import("@/pages/KDSBoard"));
const CategoryLandingPage = lazy(() => import("@/pages/CategoryLandingPage"));
const AdminStorefront = lazy(() => import("@/pages/admin/AdminStorefront"));
const AdminCatalogSettings = lazy(() => import("@/pages/admin/AdminCatalogSettings"));
const AdminStoreProfile = lazy(() => import("@/pages/admin/AdminStoreProfile"));
const AdminFees = lazy(() => import("@/pages/admin/AdminFees"));
const AdminDailySummary = lazy(() => import("@/pages/admin/AdminDailySummary"));
const AdminSEO = lazy(() => import("@/pages/admin/AdminSEO"));
const AdminCancellations = lazy(() => import("@/pages/admin/AdminCancellations"));
const AdminStaff = lazy(() => import("@/pages/admin/AdminStaff"));
const AdminStaffProfile = lazy(() => import("@/pages/admin/AdminStaffProfile"));
const AdminRoles = lazy(() => import("@/pages/admin/AdminRoles"));
const AdminReviews = lazy(() => import("@/pages/admin/AdminReviews"));
const AcceptInvitePage = lazy(() => import("@/pages/AcceptInvitePage"));
const ReviewSubmissionPage = lazy(() => import("@/pages/ReviewSubmissionPage"));
const DiscoverPage = lazy(() => import("@/pages/DiscoverPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-border border-t-brand-primary rounded-full animate-spin" />
    </div>
  );
}

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
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
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
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <CartProvider>
              <StoreStatusProvider>
                <AppRouter />
              </StoreStatusProvider>
            </CartProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </div>
  );
}

export default App;
