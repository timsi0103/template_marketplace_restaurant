import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HomePage from "@/pages/HomePage";
import MenuPage from "@/pages/MenuPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CheckoutPage from "@/pages/CheckoutPage";
import AdminDashboard from "@/pages/AdminDashboard";
import OrderTrackingPage from "@/pages/OrderTrackingPage";
import LoyaltyPage from "@/pages/LoyaltyPage";
import KitchenPage from "@/pages/KitchenPage";

function App() {
  return (
    <div className="App min-h-screen bg-brand-bg font-body">
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders" element={<OrderTrackingPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </div>
  );
}

export default App;
