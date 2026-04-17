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
import AdminDashboard from "@/pages/AdminDashboard";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
import LoyaltyPage from "@/pages/LoyaltyPage";
import KitchenPage from "@/pages/KitchenPage";
import LoginPage from "@/pages/LoginPage";
import SignUpPage from "@/pages/SignUpPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import AuthCallback from "@/pages/AuthCallback";

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
          <Route path="/admin/*" element={<AdminDashboard />} />
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
