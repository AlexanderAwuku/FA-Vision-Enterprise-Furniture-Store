# FA Vision Enterprise Furniture Store

Online presence for **FA Vision Enterprise**, a furniture business based in Odorkor, Accra, Ghana.

## About

FA Vision Enterprise makes and sells furniture for homes and offices. This repository will hold the store's website and related materials: product catalogue, pricing, contact details, and marketing content.

## What's here

| Path | Purpose |
|---|---|
| `index.html` | Website: business overview, catalogue with category filters, WhatsApp enquiry buttons. Reads its content from `data/`. |
| `data/business.json` | Name, tagline, address, WhatsApp, service areas, hashtags. |
| `data/products.json` | Product catalogue. **The single place to edit products and prices.** |
| `data/groups.csv` | Facebook groups you post in. |
| `scripts/generate_listings.py` | Builds the Facebook listing kit into `output/`. |
| `output/listings.md` | Ready-to-paste Marketplace listings, 3 group caption variants and WhatsApp status text for every product. |
| `output/posting-tracker.csv` | Log of each Marketplace/group post (date, enquiries, sold). |
| `output/meta-catalog.csv` | Product feed for Meta Commerce Manager (Facebook/Instagram Shop). |
| `docs/facebook-posting-playbook.md` | Weekly posting routine and rules for staying within Facebook's limits. |

After editing anything in `data/`, regenerate the kit:

```bash
python3 scripts/generate_listings.py
```

To preview the website locally, run `python3 -m http.server` and open http://localhost:8000.

## Project status

- [x] Landing page with business overview and location
- [x] Product catalogue structure (GHS prices, WhatsApp enquiry links)
- [x] Facebook Marketplace and group listing kit
- [ ] Real product photos, prices and dimensions (the current products are placeholders)
- [ ] Publish the website (for example on GitHub Pages)
- [ ] Simple sales and expense tracking

## Contact

Tarazzo Road, opposite Pacific, Odorkor, Accra · WhatsApp +233 27 401 3717 · [Facebook](https://www.facebook.com/FaVisionEnterprise)

## Location

Odorkor, Accra, Ghana

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
