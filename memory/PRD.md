# The Culinary Editorial - F&B E-Commerce Platform PRD

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI, relative API paths (/api/...)
- **Backend**: FastAPI + MongoDB (Motor async), JWT + Emergent Google OAuth
- **Design**: Cormorant Garamond + Manrope, #F8F5F0/#6E1C1E/#E55A3D

## Phases Implemented
1. Skeleton Template (8 pages)
2. Authentication (JWT + Google OAuth + Guest)
3. Mobile-First Responsive (bottom nav, cart drawer, touch targets)
4. Product/Menu Item Catalog (CRUD, gallery, availability)
5. Categories & Subcategories (hierarchy, landing pages)
6. Modifiers, Add-Ons & Customization (required/optional groups, live pricing, validation)

### Phase 7 - Product Variants (Current)
- [x] **Variant Selector**: Button-style cards showing name, price, stock, optional image per variant
- [x] **Selection States**: Default (neutral border), Selected (maroon border + checkmark + stock count), Sold Out (greyed/disabled + strikethrough + "SOLD OUT" text)
- [x] **Price Updates**: Selecting variant changes displayed price + breakdown text
- [x] **Stock Indicators**: "X left" badge for low-stock variants
- [x] **Cart Integration**: Variant name shown below item name in primary color, variant price used (not base), different variants = separate cart lines
- [x] **Seeded Data**: 4 items with variants (Heritage Duck: 250g/500g/1kg, Tart: Single/6-Pack/12-Pack/Case, Tagliatelle: Regular/Large, Cold Brew: Small/Medium/Large)
- [x] **Admin Variant Management** (`/admin/variants`): Expandable item list, variant table with name/price/stock/status columns, inline add/edit/delete form
- [x] **No-Variant Items**: Work normally without variant selector

## Test Credentials
- Admin: admin@culinaryeditorial.com / Admin123!

## Backlog
### P0: Order placement flow, Stripe payment
### P1: Order tracking, Kitchen display, Analytics
### P2: Loyalty, subscriptions, search, notifications
