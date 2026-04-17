# The Culinary Editorial - F&B E-Commerce Platform PRD

## Original Problem Statement
Create a food & beverage e-commerce website template serving restaurant owners, food trucks, D2C food brands, bakeries.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI, relative API paths (/api/...)
- **Backend**: FastAPI + MongoDB (Motor async), JWT + Emergent Google OAuth
- **Design**: Cormorant Garamond + Manrope, #F8F5F0/#6E1C1E/#E55A3D

## What's Been Implemented

### Phase 1 - Skeleton Template
- [x] 8 page skeletons, Navigation, Footer

### Phase 2 - Authentication & Identity
- [x] JWT email/password, Google OAuth, Guest sessions, admin seeding

### Phase 3 - Mobile-First Responsive Design
- [x] Bottom nav, cart drawer, horizontal scroll, sticky bars, touch targets

### Phase 4 - Product/Menu Item Catalog (Current)
- [x] **Full Menu Page**: Fetches from backend API, category tabs (All/Starters/Mains/Drinks/Desserts), sold out grayscale+overlay, seasonal badges
- [x] **Item Detail Page**: Hero image, gallery carousel (prev/next/dots/thumbnails), availability badges (In Stock/Sold Out/Seasonal), full description
- [x] **Sold Out State**: Grayscale image + overlay on catalog, grayscale + no controls + message on detail page
- [x] **Admin Catalog Management**: Protected admin routes (role-based), table with image/name/category/price/status/toggle/edit/delete, search, category filter
- [x] **Admin Add/Edit Form**: Name, description, price, category select, availability status, tags, multiple image URLs with preview
- [x] **Backend CRUD**: POST/PUT/DELETE/PATCH for menu items, admin guard, 10 seeded items
- [x] **Admin Route Protection**: AdminLayout with auth guard, redirects non-admin to /, unauthenticated to /login

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!

## Prioritized Backlog
### P0
- Order placement flow (cart → order creation)
- Payment integration (Stripe)
### P1
- Order tracking real-time updates
- Kitchen display with order management
- Admin analytics with charts
### P2
- Loyalty points, subscriptions, search, image upload, notifications
