# Camigo Security Scan MVP

## Summary

Camigo Security Scan is a guided pre-purchase experience that helps a customer understand what CCTV setup is appropriate before buying. Instead of asking the customer to guess camera count, recorder type, and installation scope, the feature converts site information into a suggested plan.

This MVP is intentionally framed as an estimate:

- AI-assisted estimate
- suggested coverage plan
- installer confirms final placement on site

That wording keeps the experience high-conviction without over-promising expert site engineering on day one.

## Core user value

The feature helps the customer:

1. understand weak areas and blind spots
2. see recommended camera placement zones
3. receive an instant package estimate
4. compare before and after security confidence
5. move directly into installation booking or product shopping

## MVP flow

### Step 1: Entry point

Entry points for the MVP:

- homepage promo band
- footer company link
- direct route: `/security-scan`

### Step 2: Guided site input

The customer chooses:

- place type
  - home
  - shop
  - office
  - warehouse
  - resort / villa
- property size
  - small
  - medium
  - large
- monitored areas
  - gate
  - cash counter
  - parking
  - staircase
  - backside
  - floor area
  - storage room
  - reception

### Step 3: Monitoring preference

The customer also indicates:

- night monitoring required
- same-day installation wanted
- high-value stock / cash / assets present
- recording retention preference
  - 7 days
  - 15 days
  - 30 days

### Step 4: Recommendation output

The app calculates:

- estimated before security score
- estimated after security score
- recommended number of camera points
- selected-area placement notes
- likely blind spots from unselected key areas
- recommended CCTV package
- estimated installation slot
- sample monitoring preview tiles

### Step 5: Conversion actions

The customer can:

- book technician
- browse CCTV products

## UX structure

### Hero

Purpose:

- explain the concept quickly
- create confidence
- keep the promise simple

Primary message:

> Scan your place, spot blind areas, and get the right CCTV package instantly.

### Builder column

Contains:

- place type chips
- size chips
- monitored area toggles
- monitoring preference switches
- recording retention chips

### Results column

Contains:

- before / after security score
- suggested placement
- blind spot list
- instant package generator
- monitoring preview
- technician booking CTA

## Recommendation logic used in MVP

The current MVP uses deterministic frontend heuristics instead of ML or computer vision.

Inputs affecting results:

- place type baseline
- selected coverage zones
- property size
- high-value asset presence
- night monitoring need
- storage retention target

Outputs:

- adjusted camera count
- before score
- after score
- package type
- price adjustment
- install urgency label

Package selection currently uses four templates:

- 4 Camera HD Setup
- 4 Camera IP Setup
- 8 Camera IP Setup
- Hybrid Security Setup

## Why this MVP approach is good

This version is fast to ship and useful immediately because:

- it removes buying confusion
- it produces a clear next action
- it can be explained in ads and app banners
- it does not depend on live computer vision yet
- it creates a strong foundation for future AI assistance

## Future phases

### Phase 2: Assisted visual scan

Add:

- photo upload
- short video upload
- guided room / exterior photo capture
- heuristic overlay suggestions
- live browser camera preview
- tap-to-place markers for gate camera, cash counter camera, parking camera, and blind spots

### Phase 3: Live camera analysis

Add:

- camera stream scene understanding
- blind spot markers in live preview
- wall / gate / counter suggestions
- confidence scoring per area

### Phase 4: VR placement mode

Add:

- walk-through style camera placement preview
- virtual field-of-view overlay
- before / after secure coverage visualization
- technician validation using the same scan session

### Phase 4: Full service pipeline

Add:

- technician inventory matching
- slot engine
- location-based install availability
- paid consultation escalation
- saved scan reports in customer account

## Technical architecture for MVP

### Current implementation

The current MVP is frontend-driven and includes both guided form input and browser-based live camera scan support.

Files:

- `D:\instamart-clone\instamart-web\src\components\SecurityScanPage.js`
- `D:\instamart-clone\instamart-web\src\App.js`
- `D:\instamart-clone\instamart-web\src\App.css`
- `D:\instamart-clone\instamart-web\src\components\Footer.js`

### Current routing

Route:

- `/security-scan`

### Data model in MVP

Currently no backend persistence is required.

State is held locally in the page:

- place type
- size
- selected areas
- boolean preferences
- recording days
- live scan markers
- selected live marker type
- camera ready / error state

### Suggested backend additions later

When the feature grows, add:

#### `security_scan_sessions`

- id
- user_id nullable
- place_type
- area_size
- selected_areas json
- watch_night
- same_day_install
- high_value_assets
- record_days
- before_score
- after_score
- suggested_camera_points
- suggested_package_key
- estimated_price
- created_at

#### `security_scan_media`

- id
- session_id
- media_type
- media_url
- uploaded_at

#### `security_scan_bookings`

- id
- session_id
- preferred_slot
- booking_status
- assigned_installer_id

## Recommended analytics

Track:

- scan started
- scan completed
- package generated
- book technician clicked
- browse CCTV clicked
- place type distribution
- selected area distribution
- conversion by package recommendation

## Recommended copy guardrails

Use wording like:

- AI-assisted estimate
- recommended coverage plan
- blind spot check
- installer confirms final placement

Avoid wording like:

- guaranteed security
- perfect site diagnosis
- certified expert layout without inspection

## Success metrics

Primary:

- scan completion rate
- technician booking CTA click rate
- package-to-order conversion rate

Secondary:

- higher average order value
- more setup-package purchases
- more installation leads
- more repeat return visits

## Immediate next improvements

1. save scan state for logged-in users
2. prefill installation booking from scan result
3. create admin controls for package templates and score tuning
4. attach real package SKUs to recommended plans
5. add media upload for photo-assisted scan
