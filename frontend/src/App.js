import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import CartDrawer from "@/components/cart/CartDrawer";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
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

function AppRouter() {
  const location = useLocation();

  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <>
      <Navbar />
      <div className="pb-16 md:pb-0">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrderTrackingPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="catalog" element={<AdminCatalog />} />
            <Route path="catalog/new" element={<AdminItemForm />} />
            <Route path="catalog/:id/edit" element={<AdminItemForm />} />
            <Route path="orders" element={<div className="p-10"><h1 className="font-heading text-3xl font-bold text-brand-text">Orders</h1><p className="font-body text-sm text-brand-text-secondary mt-2">Order management coming soon.</p></div>} />
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
    </>
  );
}

function App() {
  return (
    <div className="App min-h-screen bg-brand-bg font-body">
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <AppRouter />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
