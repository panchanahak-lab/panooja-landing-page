# PANOOJA Product Image Carousel Upgrade

**Repository:** [github.com/panchanahak-lab/panooja-landing-page](https://github.com/panchanahak-lab/panooja-landing-page)  
**Production URL:** [panooja.com](https://www.panooja.com/)  
**Release Commit:** `25c8a9b`

---

## 1. Feature Overview

The product cards in `#productGrid` and the **Product Quick-View Modal** have been upgraded with an automatic sliding image carousel powered directly by the Google Sheet CSV feed.

![Product Carousel QA Verification](/carousel_qa_verification.png)

---

## 2. Key Capabilities Implemented

### A. Google Sheet Column Mapping
- **Columns Supported:**
  - `Direct Image URL (Auto)`
  - `Direct Image URL 2 (Auto)`
  - `Direct Image URL 3 (Auto)`
  - `Direct Image URL 4 (Auto)`
  *(Also supports automatic extraction from Drive Share Link columns)*
- **Data Hygiene:**
  - Automatically filters out empty cells, `null`, `none`, and duplicate URLs.
  - Automatically transforms standard Google Drive share links into `https://lh3.googleusercontent.com/d/FILE_ID` direct image links.
  - Adds `referrerPolicy="no-referrer"` to every `<img>` tag so Google Drive photos always load reliably.

### B. Automatic Sliding & Continuous Loop
- When a product has more than 1 image, it automatically slides smoothly every **3 seconds** in a continuous loop:
  `1 → 2 → 3 → 1`.
- Hardware-accelerated sliding transition (`transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)`) with `will-change: transform`.

### C. Pause on Touch, Hold & Hover
- **On Mobile:**
  - `touchstart` / `pointerdown`: Immediately pauses the auto-slide timer.
  - `touchend` / `pointerup`: Resumes auto-sliding after finger release.
  - **Swipe Gestures:** Supports left-to-right (previous image) and right-to-left (next image) finger swiping.
- **On Desktop:**
  - `mouseenter`: Immediately pauses the auto-slide timer.
  - `mouseleave`: Resumes auto-sliding when mouse leaves the image.
  - `mousedown` (press & hold): Pauses auto-sliding while held down; resumes on mouseup.

### D. Clean Dot Indicators & Interaction Isolation
- Centered dot indicators with subtle frosted glass background at the bottom of each image.
- Active slide indicated by an elongated white luxury pill (`width: 16px`).
- Tapping or clicking any dot immediately jumps directly to that photo.
- Clicking a dot indicator uses `stopPropagation()` so it changes the photo without inadvertently opening the Quick-View modal.
- Clicking on the image itself opens the Quick-View modal.

### E. Quick-View Modal Integration
- The Quick-View popup features the same multi-image carousel with auto-sliding, dot indicators, and previous/next navigation arrows.
- Properly destroys interval timers when closed to preserve browser performance.
