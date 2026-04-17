# The Culinary Editorial - F&B E-Commerce Platform PRD

## Original Problem Statement
Create a food & beverage e-commerce website template. The platform serves restaurant owners, food trucks, D2C food brands, bakeries, and similar F&B businesses covering ordering, delivery, pickup, dine-in, subscriptions, loyalty, kitchen operations, and admin management.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI components
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: JWT (httpOnly cookies) + Emergent Google OAuth + Guest Sessions
- **Cart**: React Context + localStorage persistence
- **Design**: Cormorant Garamond (headings) + Manrope (body), #F8F5F0 bg, #6E1C1E primary, #E55A3D accent

## What's Been Implemented

### Phase 1 (Feb 2026) - Skeleton Template
- [x] 8 page skeletons (Home, Menu, Product, Checkout, Admin, Orders, Loyalty, Kitchen)
- [x] Navigation, Footer, responsive base layout
- [x] Backend placeholder API routes

### Phase 2 (Feb 2026) - Authentication & Identity
- [x] JWT email/password auth (register, login, logout, forgot/reset password)
- [x] Google OAuth via Emergent Auth
- [x] Guest checkout with temporary sessions
- [x] Session-aware navbar (avatar/name dropdown when logged in)
- [x] Brute force protection, admin seeding

### Phase 3 (Feb 2026) - Mobile-First Responsive Design
- [x] Mobile Homepage: collapsed hero (image on top), stacked collections, horizontally scrollable Currently Craving cards
- [x] Mobile Bottom Navigation: Discover, Menu, Orders, Profile tabs (hidden on checkout/admin/auth)
- [x] Mobile Menu: sticky horizontal scrollable category bar, full-width horizontal food cards
- [x] Mobile Cart Drawer: slide-up bottom sheet (vaul) with items, qty steppers, subtotal, checkout CTA
- [x] Mobile Checkout: single column stacked layout, order summary on top, mobile CTA button
- [x] Mobile Product Detail: sticky bottom bar with touch-optimized qty stepper + Add to Order
- [x] Touch Interactions: 44px touch targets, active:scale feedback, scroll-snap categories
- [x] CartContext: add/remove/update items, localStorage persistence, drawer state
- [x] Cart Badge: orange count badge on navbar shopping bag icon
- [x] Desktop layout fully preserved (bottom nav hidden, grid layouts intact)

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!

## Prioritized Backlog

### P0 - Critical (Next Phase)
- Menu CRUD (create/read/update/delete menu items via admin)
- Order placement flow (checkout → create order in DB)
- Connect cart to real menu data from backend

### P1 - High Priority
- Order tracking with real-time status updates
- Kitchen display system with order management
- Admin analytics with real charts (Recharts)
- Payment integration (Stripe)

### P2 - Nice to Have
- Loyalty points system
- Subscription management
- Search and filtering
- Image upload for menu items
- Push notifications for order status
- Apple/Facebook OAuth (currently placeholders)

## Next Tasks
1. Implement menu CRUD via admin panel
2. Build order placement flow (cart → order creation)
3. Connect frontend pages to real backend data
4. Add Stripe payment integration
