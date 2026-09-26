# FA Vision Enterprise Furniture Store

Online presence for **FA Vision Enterprise**, a furniture business based in Odorkor, Accra, Ghana.

## About

FA Vision Enterprise makes and sells furniture for homes and offices. This repository will hold the store's website and related materials: product catalogue, pricing, contact details, and marketing content.

## How it fits together

| Part | Where | Cost |
|---|---|---|
| **Frontend**: the website (products, school quote form, WhatsApp) | [`frontend/`](frontend/), hosted on Firebase Hosting | Free (Spark plan) |
| **Backend**: enquiries, clients, sales, expenses, batch emails | [`backend/`](backend/): a Google Sheet with Apps Script | Free |
| **Deploys**: every push to `main` that changes `frontend/` goes live | [`.github/workflows/deploy-hosting.yml`](.github/workflows/deploy-hosting.yml) | Free |
| **Marketing**: student-desk campaign for school proprietors | [`marketing/`](marketing/) | Free |

Google Cloud project: `copper-index-509815-k3`. GitHub signs in to it with Workload Identity Federation, so **no passwords or key files are stored in this repository**.

## First-time setup

1. **Firebase**: open <https://console.firebase.google.com>, click *Add project*, choose the existing project `copper-index-509815-k3`, accept the terms, and stay on the free Spark plan.
2. **Deploy access**: open [Cloud Shell](https://shell.cloud.google.com), clone this repo, run `bash infra/setup-gcp.sh`, and add the two values it prints as GitHub **repository variables**.
3. **Backend**: follow [`backend/README.md`](backend/README.md) to create the Sheet, then put its web app URL in [`frontend/config.js`](frontend/config.js).
4. **Contact details**: fill in the WhatsApp number, phone and email in [`frontend/config.js`](frontend/config.js), and prices in [`frontend/products.json`](frontend/products.json).

## Preview locally

```bash
cd frontend && python3 -m http.server 8000
# open http://localhost:8000
```

## Location

Odorkor, Accra, Ghana

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.
