# Camigo Portable Assets Checklist

This checklist keeps Camigo portable across PCs and laptops.

If a file is needed for the app to render correctly on any machine, it should either:

1. live in the repo, or
2. live at a stable hosted URL already saved in the app/admin

Use this document whenever you move development to another machine.

## 1. Keep In Repo

These are app-owned assets that should always move with GitHub and deploy with Render.

### Core UI assets
- Header/logo assets used directly in the frontend
- Hero banner artwork used by the homepage layout
- Discount badge / burst / ribbon assets
- Product placeholder or preview-sheet assets
- Any icon-like PNG/JPG/WEBP/AVIF that is referenced directly from code/CSS

### Current repo-backed Camigo assets
- `/images/camigo-delivery-hero.png`
- `/images/product-discount-banner.avif`
- `/images/product-discount-banner.png`
- `/images/product-discount-burst.png`
- `/images/product-preview-sheet.jpg`

### Core reference product images already in repo
- DVR images
- NVR images
- AHD camera images
- IP camera images
- PTZ images
- PoE switch images
- SMPS and accessory images
- Solar camera images

Reference manifest:
- [D:\instamart-clone\instamart-web\public\camigo-hosted-assets.json](D:\instamart-clone\instamart-web\public\camigo-hosted-assets.json)

Hosted version after deploy:
- [https://camigo-store.onrender.com/camigo-hosted-assets.json](https://camigo-store.onrender.com/camigo-hosted-assets.json)

## 2. Keep As Stable Hosted URLs

These are operational media files that can be updated without a code change.

### Best candidates
- Product cover photos uploaded from admin
- Product gallery photos
- Full setup package photos
- Category tile photos
- Homepage/category banners
- Promotional posters

### Recommended source
- InfinityFree / your stable public host
- Use public HTTPS image URLs
- Save those URLs in admin/database

### Rule
If the business team needs to update it often, host it and store the URL instead of committing every change into the repo.

## 3. Admin/FTP Managed Only

These can be maintained outside Git if the URL is stable and already saved.

### Good for admin-only updates
- New package images
- New banner artwork
- Seasonal promo creatives
- Category card updates
- One-off campaign graphics

### Important
Do not rely on files sitting only on a local desktop.
If it is not in Git and not on a stable host URL, another machine cannot use it.

## 4. What Must Not Stay Only On One PC

Do **not** depend on these being local-only:
- Desktop image files
- Downloads folder image edits
- Temporary compressed product images
- Local screenshots used by the app
- Uncommitted source assets

If any of these are important, move them to:
- repo, or
- stable hosted URL

## 5. Machine Move Checklist

When shifting work to another laptop/PC:

1. Clone the repo
2. Pull latest `main`
3. Confirm app-owned assets exist in:
   - `instamart-web/public/images`
   - `instamart-web/src/assets`
4. Confirm hosted admin media URLs still open
5. Reconfigure secrets locally if needed:
   - Firebase
   - Razorpay
   - Delhivery
   - FTP/media settings
6. Start work only after both:
   - Git assets are present
   - hosted URLs are reachable

## 6. Recommended Split For Camigo

### Repo
- branding
- hero visuals
- discount stickers
- built-in fallback product/category visuals
- UI-owned images used by CSS/components

### Hosted URL / Admin
- frequently changing business creatives
- package images
- product photos
- category tiles
- banners

## 7. Current Safe Baseline

Right now, Camigo is portable if you move to another machine because:
- pushed code is in GitHub
- static app assets are in repo
- deployed app serves repo-backed images
- admin-managed images can continue through hosted URLs

## 8. Future Rule Of Thumb

Before using any new file, decide:

- **Needed by code every time?** -> put in repo
- **Updated by admin/business often?** -> host it and save the URL
- **Only on local machine?** -> not safe yet

