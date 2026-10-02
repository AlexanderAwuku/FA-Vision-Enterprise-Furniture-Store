# FA Vision Autopilot (browser add-on)

Works with the admin's **Facebook autopilot** and **Price sync** screens. Facebook has no API for Marketplace renewals or group posts, so this add-on does the clicking in your own logged-in Chrome.

## Install (one time)

1. Download this `extension` folder (GitHub → Code → Download ZIP, then unzip).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the folder. Remove any older "FA Vision Price Sync" add-on first.
3. Pin it from the puzzle-piece menu. Stay logged in to Facebook in this Chrome.

## What it does

- **Badge and reminder.** Once an hour it reads your live site's `data/facebook-autopilot.json` and `data/products.json`. The red number on its icon shows Marketplace listings due for renewal, plus 1 if today's group posts haven't run. It sends one reminder a day. Click the icon to open the autopilot screen.
- **Renew.** Opens **Your listings** (marketplace/you/selling), reads every listing and its date, and for each one 7+ days old opens **More options → Renew listing**. Works in batches (20 by default) with a 2-minute pause. Facebook must be on your personal profile; Pages can't use Marketplace.
- **Test without posting.** Runs every step in one group (caption, photo, Post button ready) but never taps Post.
- **Group posts.** Posts today's listing into its next groups: types the caption, attaches the first photo, taps **Post**, then waits 1–3 minutes before the next group.
- **Import groups.** Reads your joined groups from facebook.com/groups/joins.
- **Daily run.** If switched on in the admin's settings, opens the admin at your chosen time and runs everything.
- **Safety.** It stops straight away and reports back if Facebook shows any warning ("temporarily blocked", "try again later" and so on). Every page it works on shows a **Stop** button.

It only acts in a tab the admin opened with a job (the admin hands the job to this add-on, which keeps it per tab, so Facebook's www → web.facebook.com redirect can't lose it). Normal Facebook browsing is untouched.

**After any update:** replace this folder with the new one and click reload ↻ on FA Vision Autopilot in `chrome://extensions`.
