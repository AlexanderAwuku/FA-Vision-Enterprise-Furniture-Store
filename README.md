# FA Vision Enterprise Furniture Store

Online presence for **FA Vision Enterprise**, a furniture business based in Odorkor, Accra, Ghana.

## About

FA Vision Enterprise makes and sells quality, handcrafted furniture for homes and offices. This repository holds the store's website and related materials: product catalogue, pricing, contact details, and marketing content.

## Project status

The first version of the website is built. It still needs the real WhatsApp number, prices and product photos before going live.

## Planned

- [x] Landing page with business overview and location
- [x] Product catalogue with prices (GHS), filterable by category
- [ ] Real product photos
- [x] Contact and enquiry form (sends via WhatsApp)
- [ ] Add phone number and email to the contact section
- [ ] Simple sales and expense tracking

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

## Location

Odorkor, Accra, Ghana

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
