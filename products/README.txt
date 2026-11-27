PANOOJA Product Photos (/products/)
====================================

You can host fast WebP or compressed JPG product photos directly in this folder instead of (or alongside) Google Drive links:

1. Convert your product photo to `.webp` (recommended, under 150 KB, max 1200 px wide) at https://squoosh.app/.
2. Save the file inside this `products/` folder using lowercase letters, numbers, and hyphens only (no spaces), e.g.:
   `products/cat-eye-1.webp`
   `products/sea-shell-pendant-1.webp`
3. Commit and push the file to GitHub (`main` branch) so Vercel deploys it at `https://www.panooja.com/products/your-file.webp`.
4. In your Google Sheet (`Direct Image URL (Auto)` or `Direct Image URL 2 (Auto)` columns), paste:
   `/products/your-file.webp`
   (or `products/your-file.webp`).
5. Existing Google Drive share links (`https://lh3.googleusercontent.com/d/...`) continue to work automatically alongside `/products/` paths.
