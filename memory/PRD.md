# The Culinary Editorial - F&B E-Commerce Platform PRD

## Original Problem Statement
Create a food & beverage e-commerce website template. The platform serves restaurant owners, food trucks, D2C food brands, bakeries, and similar F&B businesses covering ordering, delivery, pickup, dine-in, subscriptions, loyalty, kitchen operations, and admin management.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI components
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Auth**: JWT (httpOnly cookies) + Emergent Google OAuth + Guest Sessions
- **Design**: Cormorant Garamond (headings) + Manrope (body), #F8F5F0 bg, #6E1C1E primary, #E55A3D accent

## User Personas
1. **Customer**: Browse menu, order food, track orders, manage loyalty/subscriptions
2. **Restaurant Owner / Admin**: Manage menu, view orders, dashboard analytics, kitchen ops
3. **Kitchen Staff**: View and manage kitchen queue, order preparation
4. **Guest**: Browse and checkout without creating an account

## Core Requirements (Static)
- Home page with hero, collections, craving products
- Menu/collection page with category filters and product grid
- Product detail with enhancements and special instructions
- Checkout with delivery/pickup, form, payment, order summary
- Admin dashboard with sidebar, stats, live service queue
- Order tracking with progress steps
- Loyalty & subscriptions page
- Kitchen operations display
- Full authentication system

## What's Been Implemented

### Phase 1 (Feb 2026) - Skeleton Template
- [x] Full skeleton/template structure for all 8 pages
- [x] Responsive layout matching reference design images
- [x] Navigation bar, Footer, product cards, etc.
- [x] Backend API placeholder routes

### Phase 2 (Feb 2026) - Authentication & Identity
- [x] Sign Up Page: email/password, name, social login (Google/Apple/Facebook), guest checkout
- [x] Log In Page: email/password, forgot password link, social login buttons
- [x] Password Reset Flow: enter email → confirmation screen, reset with token
- [x] Session State: navbar shows avatar/initials + name + dropdown when logged in, Sign In/Sign Up when not
- [x] Google OAuth: functional via Emergent-managed Google Auth
- [x] Guest Checkout: creates temporary 24hr session, redirects to checkout
- [x] Admin seeding: auto-creates admin user on startup
- [x] Brute force protection: 5 failed attempts = 15min lockout
- [x] User dropdown: My Profile, My Orders, Admin Dashboard (admin only), Sign Out
- [x] Apple/Facebook social login buttons (MOCKED - visual placeholders)

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!

## Prioritized Backlog

### P0 - Critical (Next Phase)
- Menu CRUD (create/read/update/delete menu items via admin)
- Cart functionality (add/remove items, persist cart state)
- Order placement flow (checkout → create order in DB)

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
- Email notifications (order confirmation, status updates)
- Apple/Facebook OAuth (currently placeholders)

## Next Tasks
1. Implement menu CRUD via admin panel
2. Add cart state management (context + localStorage)
3. Build order placement flow
4. Connect existing skeleton pages to real backend data
