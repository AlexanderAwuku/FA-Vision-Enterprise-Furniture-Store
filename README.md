# FA Vision Enterprise — Furniture Store

Quality, handcrafted furniture for homes and offices, made in **Odorkor, Accra, Ghana**.

This repository holds the web presence and business resources for FA Vision Enterprise.

## What's inside

| Path | Purpose |
|---|---|
| `index.html` | Storefront website (home, products, about, contact) |
| `assets/css/styles.css` | Site styling (mobile-first, responsive) |
| `assets/js/main.js` | Product catalogue data, filtering, WhatsApp enquiry links |
| `assets/images/` | Product photos and logo (add your own) |
| `docs/business-profile.md` | Business profile, product lines and operating details |

## Preview locally

Open `index.html` in any browser — no build step or installs needed.

## Publish the website free with GitHub Pages

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the site is live at
   `https://alexanderawuku.github.io/FA-Vision-Enterprise-Furniture-Store/`

## Updating the site

- **Products & prices:** edit the `PRODUCTS` list at the top of `assets/js/main.js`.
- **Phone / WhatsApp number:** edit `WHATSAPP_NUMBER` in `assets/js/main.js`
  (international format, no `+` or spaces, e.g. `233241234567`) and the
  contact details in `index.html`.
- **Photos:** drop images into `assets/images/` and set each product's `image`
  field to the file name.

## License

GPL-3.0 — see [LICENSE](LICENSE).
