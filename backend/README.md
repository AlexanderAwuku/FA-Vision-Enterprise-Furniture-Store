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

## One-time setup (about 10 minutes)

1. Create a new Google Sheet named **FA Vision Backend** at <https://sheets.new>.
2. Open **Extensions → Apps Script**. Delete the sample code and paste in [`apps-script/Code.gs`](apps-script/Code.gs).
3. Click **Project Settings** (gear icon), tick **Show "appsscript.json"**, then replace that file's contents with [`apps-script/appsscript.json`](apps-script/appsscript.json).
4. Back in the editor, select **`setup`** from the function list and click **Run**. Approve the permissions prompt. This creates all the tabs.
5. Click **Deploy → New deployment → Web app**. Set *Execute as: Me* and *Who has access: Anyone*, then deploy and copy the **Web app URL**.
6. Put that URL in [`frontend/config.js`](../frontend/config.js) as `enquiryEndpoint` and commit. The website form now saves into the Sheet.
7. In **Project Settings → Script properties**, add `SITE_URL` = your website address (for the links in emails). `NOTIFY_EMAIL` is set to your address by `setup`; change it if enquiries should go elsewhere.

## Sending a batch email campaign

1. Fill the **Clients** tab. You can paste from [`marketing/clients-template.csv`](../marketing/clients-template.csv). Set **Segment** to `Proprietor` for school owners.
2. Run **`previewCampaign`**. It sends the email to you only, so you can check it.
3. Run **`sendCampaign`**. It emails every Proprietor with an email address who hasn't unsubscribed or already received this campaign.
4. For long lists, run **`scheduleDailyCampaign`** once. It sends at 9am each day until everyone has been reached.

Limits and rules:
- A free Gmail account can send to about **100 recipients a day** from Apps Script (Google Workspace: 1,500). The script stops at the limit and continues on the next run, and never emails the same person twice for one campaign.
- Every email includes an **unsubscribe** link. Clicking it marks the client `Unsubscribed` and they are skipped from then on. Only email schools that gave you their address or publish it for business enquiries.
- Edit the wording in the `CAMPAIGNS` section at the bottom of `Code.gs`. Copy a campaign block and give it a new id for the next promotion.

## Moving to Cloud Run / BigQuery later

When a billing account is linked to the Google Cloud project, the Sheet can feed BigQuery (**Connected Sheets**, or a BigQuery external table on the Sheet) for heavier reporting, and the enquiry endpoint can move to Cloud Run. Nothing on the website changes except `enquiryEndpoint`.
