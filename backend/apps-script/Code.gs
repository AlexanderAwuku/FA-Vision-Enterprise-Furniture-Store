/**
 * FA Vision Enterprise backend (Google Apps Script, bound to a Google Sheet).
 *
 * - doPost: receives website enquiries into the "Enquiries" tab.
 * - doGet:  handles unsubscribe links from campaign emails.
 * - Sales / Expenses / Summary tabs: simple finance records.
 * - sendCampaign: batch-mails clients in the "Clients" tab, within the
 *   daily Gmail quota, and records who was sent what.
 *
 * Run setup() once after pasting this file (see backend/README.md).
 */

// Keep in step with data/business.json in the website repository.
const BUSINESS = {
  name: 'F.A Vision Enterprise',
  address: 'Tarazzo Road, opposite Pacific, Odorkor, Accra',
  whatsapp: '233572646176',
  phones: '057 264 6176 / 020 747 3267 / 054 614 8923',
  website: 'https://alexanderawuku.github.io/FA-Vision-Enterprise-Furniture-Store/',
};

const SHEETS = {
  ENQUIRIES: 'Enquiries',
  CLIENTS: 'Clients',
  SALES: 'Sales',
  EXPENSES: 'Expenses',
  SUMMARY: 'Summary',
  CAMPAIGN_LOG: 'CampaignLog',
};

const HEADERS = {
  Enquiries: ['Timestamp', 'Name', 'Organisation', 'Phone', 'Email', 'Product', 'Quantity', 'Message', 'Source', 'Status'],
  Clients: ['Name', 'Organisation', 'Email', 'Phone', 'Segment', 'Area', 'Status', 'LastCampaign', 'LastSentAt', 'Token'],
  Sales: ['Date', 'Customer', 'Product', 'Quantity', 'UnitPriceGHS', 'TotalGHS', 'AmountPaidGHS', 'BalanceGHS', 'Notes'],
  Expenses: ['Date', 'Category', 'Description', 'AmountGHS', 'PaidTo', 'Notes'],
  CampaignLog: ['Timestamp', 'Campaign', 'Email', 'Result'],
};

// ---------- Setup ----------

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HEADERS).forEach((name) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEADERS[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight('bold');
    }
  });

  // Row formulas for Sales totals and balances.
  const sales = ss.getSheetByName(SHEETS.SALES);
  sales.getRange('F2').setFormula('=ARRAYFORMULA(IF(D2:D="",,D2:D*E2:E))');
  sales.getRange('H2').setFormula('=ARRAYFORMULA(IF(D2:D="",,F2:F-G2:G))');

  const summary = ss.getSheetByName(SHEETS.SUMMARY) || ss.insertSheet(SHEETS.SUMMARY);
  summary.clear();
  summary.getRange('A1:B1').setValues([['Metric', 'Value']]).setFontWeight('bold');
  summary.getRange('A2:B8').setValues([
    ['Total sales (GHS)', '=SUM(Sales!F2:F)'],
    ['Cash received (GHS)', '=SUM(Sales!G2:G)'],
    ['Outstanding balances (GHS)', '=SUM(Sales!H2:H)'],
    ['Total expenses (GHS)', '=SUM(Expenses!D2:D)'],
    ['Profit, cash basis (GHS)', '=B3-B5'],
    ['Open enquiries', '=COUNTIF(Enquiries!J2:J,"New")'],
    ['Clients reachable by email', '=COUNTIFS(Clients!C2:C,"?*",Clients!G2:G,"<>Unsubscribed")'],
  ]);
  summary.getRange('A10').setValue('Monthly sales vs expenses').setFontWeight('bold');
  summary.getRange('A11').setFormula(
    '=QUERY({ARRAYFORMULA(IF(Sales!A2:A="",,TEXT(Sales!A2:A,"yyyy-mm"))),Sales!F2:F},' +
    '"select Col1, sum(Col2) where Col1 is not null group by Col1 label Col1 \'Month\', sum(Col2) \'Sales (GHS)\'",0)'
  );
  summary.getRange('D11').setFormula(
    '=QUERY({ARRAYFORMULA(IF(Expenses!A2:A="",,TEXT(Expenses!A2:A,"yyyy-mm"))),Expenses!D2:D},' +
    '"select Col1, sum(Col2) where Col1 is not null group by Col1 label Col1 \'Month\', sum(Col2) \'Expenses (GHS)\'",0)'
  );

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('NOTIFY_EMAIL')) {
    props.setProperty('NOTIFY_EMAIL', Session.getEffectiveUser().getEmail());
  }
}

// ---------- Web endpoints ----------

function doPost(e) {
  let data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad request' });
  }
  if (data.website) return json_({ ok: true }); // honeypot
  if (!data.name) return json_({ ok: false, error: 'name required' });

  const clean = (v) => String(v || '').slice(0, 1000).replace(/^[=+\-@]/, "'$&");
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    SpreadsheetApp.getActive().getSheetByName(SHEETS.ENQUIRIES).appendRow([
      new Date(), clean(data.name), clean(data.organisation), clean(data.phone), clean(data.email),
      clean(data.product), Number(data.quantity) || '', clean(data.message), clean(data.source), 'New',
    ]);
  } finally {
    lock.releaseLock();
  }

  const notify = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (notify) {
    MailApp.sendEmail(notify, `New enquiry: ${clean(data.product) || 'website'} from ${clean(data.name)}`,
      `Name: ${clean(data.name)}\nOrganisation: ${clean(data.organisation)}\nPhone: ${clean(data.phone)}\n` +
      `Email: ${clean(data.email)}\n\n${clean(data.message)}`);
  }
  return json_({ ok: true });
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'unsubscribe' && p.token) {
    const found = markUnsubscribed_(p.token);
    return HtmlService.createHtmlOutput(found
      ? '<p style="font-family:sans-serif">You have been unsubscribed from FA Vision Enterprise emails.</p>'
      : '<p style="font-family:sans-serif">This link is no longer valid.</p>');
  }
  return json_({ ok: true, service: 'FA Vision Enterprise backend' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Batch email campaigns ----------

/**
 * Campaign content. Keep {{name}}, {{organisation}} and {{unsubscribe}}
 * placeholders; they are filled per client.
 */
const CAMPAIGNS = {
  'student-desks-2026': {
    segment: 'Proprietor',
    subject: 'Durable student desks for {{organisation}}: bulk pricing for proprietors',
    html:
      '<p>Dear {{name}},</p>' +
      '<p>As {{organisation}} prepares for the new term, F.A Vision Enterprise in Odorkor, Accra is making ' +
      '<b>student desks</b> built for years of classroom use: hardwood tops on welded steel frames, ' +
      'single and double seater.</p>' +
      '<ul>' +
      '<li><b>Bulk discount</b> for schools ordering 20 desks or more</li>' +
      '<li><b>Delivery and setup</b> in your classrooms across Greater Accra</li>' +
      '<li><b>Repairs</b> and replacement parts when you need them</li>' +
      '</ul>' +
      '<p>Reply to this email with the number of desks you need, ' +
      '<a href="{{whatsapp}}">message us on WhatsApp</a>, or see the desk here: ' +
      '<a href="{{site}}#product/FAV-014">School Desk and Chair Set</a>. We respond the same day.</p>' +
      '<p>Warm regards,<br>F.A Vision Enterprise<br>' + BUSINESS.address + '<br>' +
      'Call ' + BUSINESS.phones + '</p>' +
      '<p style="font-size:12px;color:#777">You are receiving this because your school is listed as a potential ' +
      'customer of F.A Vision Enterprise. <a href="{{unsubscribe}}">Unsubscribe</a>.</p>',
  },
};

/** Sends the campaign to yourself only, so you can check how it looks. */
function previewCampaign() {
  const me = Session.getEffectiveUser().getEmail();
  const c = CAMPAIGNS['student-desks-2026'];
  const vars = { name: 'Proprietor', organisation: 'Your School', unsubscribe: '#', site: siteUrl_(), whatsapp: whatsappUrl_() };
  MailApp.sendEmail({ to: me, subject: '[PREVIEW] ' + fill_(c.subject, vars, true), htmlBody: fill_(c.html, vars) });
}

/**
 * Sends the campaign to clients in the matching segment who have an email,
 * are not unsubscribed, and have not received this campaign yet.
 * Safe to run daily: it stops at the Gmail quota and resumes next run.
 */
function sendCampaign(campaignId) {
  campaignId = campaignId || 'student-desks-2026';
  const c = CAMPAIGNS[campaignId];
  if (!c) throw new Error('Unknown campaign ' + campaignId);

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEETS.CLIENTS);
  const log = ss.getSheetByName(SHEETS.CAMPAIGN_LOG);
  const rows = sh.getDataRange().getValues();
  const col = indexOf_(rows[0]);
  const webApp = ScriptApp.getService().getUrl();
  let quota = MailApp.getRemainingDailyQuota();
  let sent = 0;

  for (let r = 1; r < rows.length && quota > 0; r++) {
    const row = rows[r];
    const email = String(row[col.Email] || '').trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    if (row[col.Status] === 'Unsubscribed') continue;
    if (c.segment && row[col.Segment] !== c.segment) continue;
    if (row[col.LastCampaign] === campaignId) continue;

    let token = row[col.Token];
    if (!token) {
      token = Utilities.getUuid();
      sh.getRange(r + 1, col.Token + 1).setValue(token);
    }
    const vars = {
      name: row[col.Name] || 'Sir/Madam',
      organisation: row[col.Organisation] || 'your school',
      unsubscribe: `${webApp}?action=unsubscribe&token=${token}`,
      site: siteUrl_(),
      whatsapp: whatsappUrl_(),
    };
    try {
      MailApp.sendEmail({ to: email, subject: fill_(c.subject, vars, true), htmlBody: fill_(c.html, vars), name: BUSINESS.name });
      sh.getRange(r + 1, col.LastCampaign + 1, 1, 2).setValues([[campaignId, new Date()]]);
      log.appendRow([new Date(), campaignId, email, 'sent']);
      sent++;
      quota--;
    } catch (err) {
      log.appendRow([new Date(), campaignId, email, 'error: ' + err.message]);
    }
  }
  Logger.log(`Sent ${sent} emails. Remaining quota today: ${MailApp.getRemainingDailyQuota()}`);
  return sent;
}

/** Creates a daily 9am trigger so a large list is worked through automatically. */
function scheduleDailyCampaign() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sendCampaign')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendCampaign').timeBased().everyDays(1).atHour(9).create();
}

function markUnsubscribed_(token) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CLIENTS);
  const rows = sh.getDataRange().getValues();
  const col = indexOf_(rows[0]);
  for (let r = 1; r < rows.length; r++) {
    if (rows[r][col.Token] === token) {
      sh.getRange(r + 1, col.Status + 1).setValue('Unsubscribed');
      return true;
    }
  }
  return false;
}

function siteUrl_() {
  return PropertiesService.getScriptProperties().getProperty('SITE_URL') || BUSINESS.website;
}

function whatsappUrl_() {
  return 'https://wa.me/' + BUSINESS.whatsapp + '?text=' +
    encodeURIComponent('Hello F.A Vision, I would like a quote for school desks.');
}

function indexOf_(header) {
  const m = {};
  header.forEach((h, i) => { m[h] = i; });
  return m;
}

/** Fills {{placeholders}}. HTML-escapes client values unless plainText (for subjects). */
function fill_(tpl, vars, plainText) {
  return tpl.replace(/{{(\w+)}}/g, (_, k) => {
    const v = String(vars[k] == null ? '' : vars[k]);
    return plainText || k === 'unsubscribe' || k === 'site' || k === 'whatsapp' ? v : v.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  });
}
