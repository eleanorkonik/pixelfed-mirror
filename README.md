# Maven & the Border Lord

Illustrated flash fiction by Eleanor Konik.

Live at: **fiction.eleanorkonik.com**

## How it works

A build script fetches the Atom feed from Pixelfed, reverses the posts to chronological order (oldest first), and generates a static HTML page. The site is deployed on DigitalOcean App Platform and auto-deploys when you push to the `main` branch.

## Updating the gallery

When you post new fiction to Pixelfed, rebuild and push:

```bash
cd ~/Documents/life/fiction-gallery
npm run build
git add . && git commit -m "Update gallery" && git push
```

DigitalOcean will auto-deploy within about a minute.

## Local development

```bash
npm install
npm run build
open index.html
```

## Files

- `build.js` - Fetches Pixelfed Atom feed, generates `index.html`
- `style.css` - Teal/maroon/cream color scheme matching your branding
- `horse_logo.webp` - Site favicon and header logo
- `index.html` - Generated output (committed to repo for deployment)

## Color scheme

- Teal: `#2c6c67` - headers, links
- Maroon: `#722F37` - image borders
- Cream: `#e8e4de` - background
