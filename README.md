# FA Vision Enterprise Furniture Store

Online presence for **FA Vision Enterprise**, a furniture business based in Odorkor, Accra, Ghana.

**Live website:** https://alexanderawuku.github.io/FA-Vision-Enterprise-Furniture-Store/
**Admin (post products):** https://alexanderawuku.github.io/FA-Vision-Enterprise-Furniture-Store/admin/

## About

FA Vision Enterprise makes and sells quality, handcrafted furniture for homes, offices and schools. This repository holds the store's website, its admin page and the Facebook listing kit.

Product prices are still starting estimates and there are no product photos yet. Post real photos and prices from the admin page before promoting the site widely.

## Posting products (admin)

Open `/admin/` on your phone or computer. It works like posting an ad on Jiji:

1. **Category & photos.** Pick a category and type, then add photos. The first photo is the main photo; drag or use the arrows to reorder. Every photo is auto-enhanced and framed to the website's 4:3 shape. Tap **✎ Edit** on a photo to open the photo studio (below).
2. **Details & price.** Title, condition, material, size, colours, description, key features, price (negotiable or not, or "price on request"), made to order, in stock.
3. **Review & post.** See the card exactly as customers will, then post.

After posting you get one-tap buttons to send the product on WhatsApp, or copy a Facebook Marketplace listing, a group post or a WhatsApp status. **🎨 Create promo image** makes a branded picture (square post or status/story, dark or cream) to share or download. **My products** lets you edit, share, mark sold or delete anything.

### Photo studio (✎ Edit)

Everything runs in the browser, and photos never leave your device until you post.

- **Frame:** *Fill frame* (drag to position, zoom) or *Show whole piece* on a backdrop, straighten (±15°), rotate 90°.
- **Light & colour:** *Auto-enhance* (on by default) plus brightness, contrast, warmth and colour sliders. Hold **Compare** to see the original.
- **Background:** *Remove background* cuts the furniture out with on-device AI and puts it in a studio (white, cream, soft grey or showroom dark) with a soft floor shadow. The first use downloads about 55 MB, so use Wi-Fi; it's cached after that. It works best when the furniture is the main thing in the photo.
- **Use this look on all photos** copies the light, framing style and background to the product's other photos, so a product's photos match.

Background removal uses [@imgly/background-removal](https://github.com/imgly/background-removal-js) (AGPL-3.0), loaded from jsDelivr.

**How it works:** there's no server to pay for. The admin saves products and photos straight into this GitHub repository, and GitHub Pages republishes the site about a minute later.

### One-time sign-in setup

The admin needs a GitHub token that can only edit this one repository:

1. Open https://github.com/settings/personal-access-tokens/new (Settings → Developer settings → Fine-grained tokens → Generate new token).
2. **Token name:** FA Vision Admin. **Expiration:** 1 year.
3. **Repository access:** Only select repositories → `FA-Vision-Enterprise-Furniture-Store`.
4. **Permissions → Repository permissions → Contents:** Read and write.
5. Generate it, copy it, and paste it into the admin's sign-in box.

The token stays in that browser only. Anyone who has it can change the website, so don't share it. If a phone is lost, delete the token on GitHub and create a new one.

## What's inside

| Path | Purpose |
|---|---|
| `index.html` | Storefront: hero, collection with search/filters/sort, product pages (`#product/FAV-001` links), custom-order form, showroom and contacts |
| `assets/css/site.css`, `assets/js/site.js` | Storefront styling and behaviour |
| `admin/` | Admin page for posting, editing and sharing products (`admin.js`), photo studio (`photo-studio.js`, `photo-editor.js`) and promo images (`promo.js`) |
| `assets/js/catalog-config.js` | Categories, product types, colours and icons shared by the site and admin |
| `assets/js/products-data.js` | Product and business data the site reads. **Generated, don't edit by hand.** |
| `assets/images/products/` | Product photos uploaded from the admin |
| `assets/images/og-cover.jpg` | Preview image shown when the site link is shared on WhatsApp or Facebook |
| `data/products.json` | The product list. The admin edits this for you. |
| `data/business.json` | Name, tagline, address, phone/WhatsApp numbers, service areas, hashtags |
| `data/groups.csv` | Facebook groups you post in |
| `scripts/generate_listings.py` | Rebuilds `assets/js/products-data.js` and the bulk listing files in `output/` |
| `output/` | Bulk Marketplace/group/WhatsApp texts, posting tracker and Meta catalog feed |
| `docs/facebook-posting-playbook.md` | Weekly posting routine and rules for staying within Facebook's limits |
| `docs/business-profile.md` | Business profile, product lines and operating details |

## Changing contact details

Phone and WhatsApp numbers, the address and hashtags live in `data/business.json`. After editing it, run `python3 scripts/generate_listings.py` and commit, and the site and listings pick up the change.

## Bulk listing files

The admin's share buttons cover day-to-day posting. To rebuild the bulk files in `output/` (all products at once, the posting tracker and the Meta catalog feed), run:

```bash
python3 scripts/generate_listings.py
```

## Preview locally

Open `index.html` in any browser. There's no build step and nothing to install. The admin page needs an internet connection because it saves to GitHub.

## Publish the website free with GitHub Pages

1. On GitHub, go to **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main` and folder `/ (root)`, then **Save**.
4. After a minute the site is live at
   `https://alexanderawuku.github.io/FA-Vision-Enterprise-Furniture-Store/`

## How it fits together

- [x] Landing page with business overview and location
- [x] Product catalogue with prices (GHS), filterable by category
- [x] Contact and enquiry form (sends via WhatsApp)
- [x] Phone / WhatsApp number in the contact section
- [x] Facebook Marketplace and group listing kit
- [x] Admin page for posting products with photos
- [ ] Confirm real prices and dimensions (current prices are estimates)
- [ ] Real product photos
- [x] Publish the website on GitHub Pages
- [x] Simple sales and expense tracking (Google Sheet backend, see [`backend/`](backend/))

## Backend: enquiries, sales, expenses and batch emails

[`backend/`](backend/) is a Google Sheet with Apps Script (free, no server). It:

- saves every **Custom orders** request from the website (as well as opening WhatsApp) and emails you an alert
- keeps your **client list**, **sales** and **expenses**, with a profit summary by month
- sends **batch email campaigns** within Gmail's daily limit, with unsubscribe links

Setup takes about 10 minutes: see [`backend/README.md`](backend/README.md). The last step is pasting the Sheet's web app URL into `enquiry_endpoint` in `data/business.json`. Until then the form works exactly as before, WhatsApp only.

The first campaign, student desks for school proprietors, is in [`marketing/campaigns/student-desks-proprietors.md`](marketing/campaigns/student-desks-proprietors.md).

## Contact

Tarazzo Road, opposite Pacific, Odorkor, Accra · WhatsApp 057 264 6176 · Call 057 264 6176 / 020 747 3267 / 054 614 8923 · [Facebook](https://www.facebook.com/FaVisionEnterprise)

## Location

Odorkor, Accra, Ghana

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
