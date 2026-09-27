# FA Vision Enterprise Furniture Store

Online presence for **FA Vision Enterprise**, a furniture business based in Odorkor, Accra, Ghana.

## About

FA Vision Enterprise makes and sells quality, handcrafted furniture for homes and offices. This repository holds the store's website and related materials: product catalogue, pricing, contact details, and marketing content.

The first version of the website and the Facebook listing kit are built. Product prices are starting estimates and there are no product photos yet. Confirm both before going live.

## What's inside

| Path | Purpose |
|---|---|
| `index.html` | Storefront website (home, products, about, custom orders, contact) |
| `assets/css/styles.css` | Site styling (mobile-first, responsive) |
| `assets/js/main.js` | Filtering, WhatsApp number and enquiry links |
| `assets/js/products-data.js` | Product list shown on the site. **Generated, don't edit by hand.** |
| `assets/images/` | Product photos and logo (add your own) |
| `data/products.json` | **The single place to edit products and prices.** Used by the website and the listing kit. |
| `data/business.json` | Name, tagline, address, WhatsApp, service areas, hashtags |
| `data/groups.csv` | Facebook groups you post in |
| `scripts/generate_listings.py` | Rebuilds `assets/js/products-data.js` and everything in `output/` |
| `output/listings.md` | Ready-to-paste Marketplace listings, 3 group caption variants and WhatsApp status text for every product |
| `output/posting-tracker.csv` | Log of each Marketplace/group post (date, enquiries, sold) |
| `output/meta-catalog.csv` | Product feed for Meta Commerce Manager (Facebook/Instagram Shop) |
| `docs/facebook-posting-playbook.md` | Weekly posting routine and rules for staying within Facebook's limits |
| `docs/business-profile.md` | Business profile, product lines and operating details |

## Updating products and prices

1. Edit `data/products.json`. For photos, put images in `assets/images/` and list them in the product's `images` field, e.g. `"images": ["assets/images/fav-001-sofa.jpg"]`.
2. Run:

   ```bash
   python3 scripts/generate_listings.py
   ```

3. Commit the changed files. The website and the Facebook listings both update.

The phone/WhatsApp number is in `data/business.json` (for listings) and `WHATSAPP_NUMBER` in `assets/js/main.js` (for the site).

## Preview locally

Open `index.html` in any browser. There's no build step and nothing to install.

## Publish the website free with GitHub Pages

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the site is live at
   `https://alexanderawuku.github.io/FA-Vision-Enterprise-Furniture-Store/`
5. Put that address in `"website"` in `data/business.json` and re-run the generator, so the Meta catalog gets working photo links.

## Project status

- [x] Landing page with business overview and location
- [x] Product catalogue with prices (GHS), filterable by category
- [x] Contact and enquiry form (sends via WhatsApp)
- [x] Phone / WhatsApp number in the contact section
- [x] Facebook Marketplace and group listing kit
- [ ] Confirm real prices and dimensions (current prices are estimates)
- [ ] Real product photos
- [ ] Publish the website on GitHub Pages
- [ ] Simple sales and expense tracking

## Contact

Tarazzo Road, opposite Pacific, Odorkor, Accra · WhatsApp +233 27 401 3717 · [Facebook](https://www.facebook.com/FaVisionEnterprise)

## Location

Odorkor, Accra, Ghana

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
