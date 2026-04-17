# The Culinary Editorial - F&B E-Commerce Platform PRD

## Original Problem Statement
Create a food & beverage e-commerce website template. The platform serves restaurant owners, food trucks, D2C food brands, bakeries, and similar F&B businesses covering ordering, delivery, pickup, dine-in, subscriptions, loyalty, kitchen operations, and admin management. Only skeleton/template structure — features will be added in follow-up prompts.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI components
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Design**: Cormorant Garamond (headings) + Manrope (body), off-white (#F8F5F0) background, dark maroon (#6E1C1E) primary, orange (#E55A3D) accent

## User Personas
1. **Customer**: Browse menu, order food, track orders, manage loyalty/subscriptions
2. **Restaurant Owner / Admin**: Manage menu, view orders, dashboard analytics, kitchen ops
3. **Kitchen Staff**: View and manage kitchen queue, order preparation

## Core Requirements (Static)
- Home page with hero, collections, craving products
- Menu/collection page with category filters and product grid
- Product detail with enhancements and special instructions
- Checkout with delivery/pickup, form, payment, order summary
- Admin dashboard with sidebar, stats, live service queue
- Order tracking with progress steps
- Loyalty & subscriptions page
- Kitchen operations display

## What's Been Implemented (Feb 2026)
- [x] Full skeleton/template structure for all 8 pages
- [x] Responsive layout matching reference design images
- [x] Navigation bar with active state indicators
- [x] Footer with brand links
- [x] Backend API placeholder routes (menu, orders, admin, kitchen)
- [x] All interactive elements have data-testid attributes
- [x] Testing passed: 100% backend, 100% frontend

## Prioritized Backlog

### P0 - Critical (Next Phase)
- Menu CRUD (create/read/update/delete menu items via admin)
- Cart functionality (add/remove items, persist cart state)
- Order placement flow (checkout → create order in DB)
- Authentication (customer login, admin login)

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

## Next Tasks
1. Implement menu CRUD via admin panel
2. Add cart state management
3. Build order placement flow
4. Add authentication (JWT or Google OAuth)
