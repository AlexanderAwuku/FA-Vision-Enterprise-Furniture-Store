# Backend: Google Sheet + Apps Script

The backend is a Google Sheet with an Apps Script attached. It costs nothing, needs no billing account, and keeps running without any server to maintain.

| Tab | What it holds |
|---|---|
| **Enquiries** | Quote requests from the website form (you also get an email for each one) |
| **Clients** | Your mailing list: proprietors, offices, past customers |
| **Sales** | Each sale; totals and balances calculate automatically |
| **Expenses** | Materials, wages, transport, rent |
| **Summary** | Total sales, cash received, outstanding balances, profit, monthly sales vs expenses |
| **CampaignLog** | Every campaign email sent, with the result |
| **Orders** | Every website order and payment: option chosen, amount paid online, balance, delivery, Paystack verification, progress |

## One-time setup (about 10 minutes)

1. Create a new Google Sheet named **FA Vision Backend** at <https://sheets.new>.
2. Open **Extensions → Apps Script**. Delete the sample code and paste in [`apps-script/Code.gs`](apps-script/Code.gs).
3. Click **Project Settings** (gear icon), tick **Show "appsscript.json"**, then replace that file's contents with [`apps-script/appsscript.json`](apps-script/appsscript.json).
4. Back in the editor, select **`setup`** from the function list and click **Run**. Approve the permissions prompt. This creates all the tabs.
5. Click **Deploy → New deployment → Web app**. Set *Execute as: Me* and *Who has access: Anyone*, then deploy and copy the **Web app URL**.
6. Put that URL in [`data/business.json`](../data/business.json) as `"enquiry_endpoint"`, run `python3 scripts/generate_listings.py`, and commit. The website's **Custom orders** form now also saves each request into the **Enquiries** tab (it still opens WhatsApp too).
7. Optional: `NOTIFY_EMAIL` (in **Project Settings → Script properties**) is set to your address by `setup`; change it if enquiry alerts should go elsewhere. Emails link to the live website; set `SITE_URL` there only if the address changes.

## Orders & payments

Every website order lands in the **Orders** tab and in your email, and shows on the website admin under **Orders & payments** (`/admin/` → *Orders & payments*). That covers pay in full, 50% deposit, pay on delivery and walk in. Online payments are recorded three ways, so none are missed:

1. the website sends the order when the customer finishes checkout;
2. Paystack calls the backend the moment a payment succeeds, even if the customer closes the page (webhook, step 3 below);
3. `syncPaystack` runs every hour and adds any Paystack payment still missing.

Each online payment is confirmed with Paystack's API and re-priced from your catalogue. Anything that doesn't check out is marked **UNVERIFIED**, **NOT FOUND** or **UNDERPAID** and appears under **Needs checking** in the admin.

One-time setup, after the steps above:

1. **Update the code.** Paste the latest [`apps-script/Code.gs`](apps-script/Code.gs) over the old one and save. Run **`setup`** again and approve the new permissions. It adds the **Orders** tab, creates an **ADMIN_KEY** and starts the hourly Paystack sync.
2. **Add your Paystack secret key.** In **Project Settings → Script properties**, add `PAYSTACK_SECRET_KEY` = your `sk_live_…` key (or `sk_test_…` while testing). It only ever lives here, never on the website.
3. **Point Paystack at the backend.** In Paystack, open **Settings → API Keys & Webhooks** and set **Live Webhook URL** (and Test Webhook URL) to your web app URL.
4. **Publish the new version.** **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy**. This keeps the same web app URL.
5. **Open the admin Orders screen.** On the website admin, tap **Orders & payments** and paste the **ADMIN_KEY** from Script properties. Change an order's progress there (Confirmed → Delivered → Balance paid) and it saves to the Sheet.

Manual MoMo transfers (to your MoMo number, without Paystack) are recorded as orders marked **UNVERIFIED**. Check your wallet for the reference, then move the order along in the admin.

If your phone numbers or address change, update the `BUSINESS` block at the top of `Code.gs` as well as `data/business.json`.

## SMS alerts to your phone

The backend texts you for every customer request: website enquiries, taps on any WhatsApp button (including the student-desk promo order), checkout orders (MoMo, card, deposit, pay on delivery, walk in) and invoice requests. Email alerts keep working as before.

1. Create an account at [arkesel.com](https://arkesel.com) (Ghana SMS provider) and top up a small amount. Texts are paid per message, roughly a few pesewas each.
2. Request a sender ID such as `FAVision` (max 11 characters) and wait for approval.
3. In **Apps Script → Project Settings → Script properties**, add:
   - `SMS_API_KEY`: your Arkesel API key
   - `SMS_TO`: the number(s) to alert, comma separated, e.g. `233572646176,233207473267`
   - `SMS_SENDER`: your approved sender ID (defaults to `FAVision`)
4. Paste the updated `Code.gs`, then **Deploy → Manage deployments → Edit → New version → Deploy** so the website uses it.
5. Run `testSms` once from the editor. You should get a test text within a minute.

Nothing is sent until `SMS_API_KEY` and `SMS_TO` are set, and alerts are capped at 40 texts an hour.

## Invoices

1. Paste the latest `Code.gs`, save, run **`setup`** again (it adds the **Invoices** tab) and approve the new **Google Drive** permission. The script saves invoice PDFs to a Drive folder called **FA Vision Invoices** and shares each one by link.
2. **Deploy → Manage deployments → ✎ Edit → Version: New version → Deploy** (same URL).
3. Invoice numbers continue from **100683** (the paper series PINV100683). To start elsewhere, set the script property **INVOICE_SEQ** to the last number used.
4. In the website admin open **Invoices**, paste the same **ADMIN_KEY** as for Orders, and requests from the website appear there. **Generate invoice** numbers it, saves the PDF, emails it to the customer (if ticked) and fills in the row.


## Sending a batch email campaign

1. Fill the **Clients** tab. You can paste from [`marketing/clients-template.csv`](../marketing/clients-template.csv). Set **Segment** to `Proprietor` for school owners.
2. Run **`previewCampaign`**. It sends the email to you only, so you can check it.
3. Run **`sendCampaign`**. It emails every Proprietor with an email address who hasn't unsubscribed or already received this campaign.
4. For long lists, run **`scheduleDailyCampaign`** once. It sends at 9am each day until everyone has been reached.

Limits and rules:
- A free Gmail account can send to about **100 recipients a day** from Apps Script (Google Workspace: 1,500). The script stops at the limit and continues on the next run, and never emails the same person twice for one campaign.
- Every email includes an **unsubscribe** link. Clicking it marks the client `Unsubscribed` and they are skipped from then on. Only email schools that gave you their address or publish it for business enquiries.
- Edit the wording in the `CAMPAIGNS` section of `Code.gs`. Copy a campaign block and give it a new id for the next promotion.

## Moving to Cloud Run / BigQuery later

When a billing account is linked to the Google Cloud project, the Sheet can feed BigQuery (**Connected Sheets**, or a BigQuery external table on the Sheet) for heavier reporting, and the enquiry endpoint can move to Cloud Run. Nothing on the website changes except `enquiry_endpoint`.
