// POST /api/lead — antispam → phone validation → WhatsApp check (WAHA) → Google Sheet → Meta CAPI
const crypto = require('crypto');
const { parsePhoneNumberFromString } = require('libphonenumber-js/max');

const SCORES = {
  budget:  { under_790k: 2, '790k_1_2m': 3, '1_2m_1_9m': 3, '1_9m_plus': 3 },
  unit:    { '1br': 1, '2br': 1, '3br': 1, duplex: 1, not_sure: 0 },
  purpose: { rent_out: 2, live: 2, residency: 2, holiday: 2 },
  payment: { plan_50_50: 2, cash: 3, undecided: 0 },
  timing:  { this_month: 4, '3_months': 2, exploring: 0 }
};
const LABELS = {
  budget:  { under_790k: 'Under $790K', '790k_1_2m': '$790K–$1.2M', '1_2m_1_9m': '$1.2M–$1.9M', '1_9m_plus': '$1.9M+' },
  unit:    { '1br': '1 Bedroom', '2br': '2 Bedroom', '3br': '3 Bedroom', duplex: 'Duplex / 4 Bedroom', not_sure: 'Not sure yet' },
  purpose: { rent_out: 'Rent it out', live: 'Live in it', residency: 'Home + UAE residency', holiday: 'Holiday home + rental' },
  payment: { plan_50_50: '50/50 payment plan', cash: 'Cash in full', undecided: 'Not decided yet' },
  timing:  { this_month: 'This month', '3_months': 'Within 3 months', exploring: 'Just exploring' }
};
const MIN_QUIZ_SECONDS = 8;

const sha256 = (s) => crypto.createHash('sha256').update(String(s).trim().toLowerCase()).digest('hex');
const clean = (s, n = 200) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

function scoreLead(a) {
  let score = 0;
  for (const k of Object.keys(SCORES)) score += SCORES[k][a[k]] || 0;
  let temp = score >= 10 ? 'Hot' : score >= 7 ? 'Warm' : 'Cold';
  if (a.timing === 'this_month') temp = 'Hot';
  return { score, temp };
}

function badPattern(digits) {
  const national = digits.slice(-9);
  if (/^(\d)\1+$/.test(national)) return true;                  // 999999999
  if ('0123456789012345678'.includes(national) || '9876543210987654321'.includes(national)) return true; // sequences
  return false;
}

async function checkWhatsApp(e164) {
  const base = process.env.WAHA_URL;
  if (!base) return 'not_checked';           // WAHA not configured yet
  const phone = e164.replace(/\D/g, '');
  const session = process.env.WAHA_SESSION || 'default';
  const url = `${base.replace(/\/+$/, '')}/api/contacts/check-exists?phone=${phone}&session=${encodeURIComponent(session)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { headers: { 'X-Api-Key': process.env.WAHA_API_KEY || '' }, signal: ctrl.signal });
    if (!r.ok) return 'check_error';
    const j = await r.json();
    return j && j.numberExists === true ? 'whatsapp_ok' : j && j.numberExists === false ? 'no_whatsapp' : 'check_error';
  } catch (e) {
    return 'check_error';
  } finally { clearTimeout(t); }
}

async function writeSheet(row) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return { ok: false, error: 'SHEETS_WEBHOOK_URL not set' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.SHEETS_SECRET || '', row }),
      redirect: 'follow'
    });
    const txt = await r.text();
    let j = {}; try { j = JSON.parse(txt); } catch (e) {}
    return { ok: r.ok && j.ok !== false, duplicate: !!j.duplicate };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function sendCapi(lead, req) {
  const pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return 'not_configured';
  const body = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: lead.lead_id,
      action_source: 'website',
      event_source_url: lead.page_url,
      user_data: {
        ph: [sha256(lead.phone.replace(/\D/g, ''))],
        fn: lead.name ? [sha256(lead.name.split(' ')[0])] : undefined,
        country: lead.phone_country ? [sha256(lead.phone_country)] : undefined,
        client_ip_address: lead.ip || undefined,
        client_user_agent: lead.user_agent || undefined,
        fbp: lead.fbp || undefined,
        fbc: lead.fbc || undefined
      },
      custom_data: { lead_score: lead.score, lead_temperature: lead.temperature, budget: lead.budget, unit_type: lead.unit }
    }]
  };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    return r.ok ? 'sent' : 'error_' + r.status;
  } catch (e) { return 'error'; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ ok: false }); return; }
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }

  const ip = clean((req.headers['x-forwarded-for'] || '').split(',')[0], 60);
  const ua = clean(req.headers['user-agent'], 300);
  const a = b.answers || {};
  const attr = b.attr || {};
  const flags = [];

  // 1) antibot
  if (b.company) flags.push('honeypot');
  const secs = b.started_at && b.submitted_at ? Math.round((b.submitted_at - b.started_at) / 1000) : null;
  if (secs !== null && secs < MIN_QUIZ_SECONDS) flags.push('too_fast');
  if (!b.consent) flags.push('no_consent');
  for (const k of Object.keys(SCORES)) if (!(a[k] in SCORES[k])) flags.push('bad_answer_' + k);

  // 2) phone format
  const pn = parsePhoneNumberFromString(String(b.phone || ''));
  const phoneValid = !!(pn && pn.isValid());
  const e164 = phoneValid ? pn.number : clean(b.phone, 30);
  if (!phoneValid) flags.push('invalid_phone');
  else if (badPattern(e164.replace(/\D/g, ''))) flags.push('fake_pattern');
  const name = clean(b.name, 60);
  if (name.length < 2) flags.push('no_name');

  const isSpam = flags.length > 0;

  // 3) WhatsApp check (only for otherwise-clean leads)
  let wa = 'not_checked';
  if (!isSpam) wa = await checkWhatsApp(e164);

  // first attempt with no WhatsApp → let the user fix a typo, don't record yet
  if (wa === 'no_whatsapp' && (b.attempt || 1) < 2) {
    res.status(200).json({ ok: false, code: 'no_whatsapp' });
    return;
  }
  // invalid phone from a real user (client validation bypassed) → ask to fix
  if (flags.length === 1 && flags[0] === 'invalid_phone') {
    res.status(200).json({ ok: false, code: 'invalid_phone' });
    return;
  }

  const { score, temp } = scoreLead(a);
  const status = isSpam ? 'SPAM' : wa === 'no_whatsapp' ? 'NO WHATSAPP' : wa === 'whatsapp_ok' ? 'REAL (WhatsApp ✓)' : 'NOT CHECKED';
  const lead = {
    lead_id: 'bm_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex'),
    created_at: new Date().toISOString(),
    status,
    name,
    phone: e164,
    phone_country: pn && pn.country ? pn.country : clean(b.country, 4),
    whatsapp_check: wa,
    spam_flags: flags.join(', '),
    score, temperature: isSpam ? '' : temp,
    budget: LABELS.budget[a.budget] || '',
    unit: LABELS.unit[a.unit] || '',
    purpose: LABELS.purpose[a.purpose] || '',
    payment: LABELS.payment[a.payment] || '',
    timing: LABELS.timing[a.timing] || '',
    quiz_seconds: secs,
    attempt: b.attempt || 1,
    angle: clean(attr.angle, 30),
    utm_source: clean(attr.utm_source), utm_medium: clean(attr.utm_medium), utm_campaign: clean(attr.utm_campaign),
    utm_content: clean(attr.utm_content), utm_term: clean(attr.utm_term),
    fbclid: clean(attr.fbclid, 300), fbp: clean(b.fbp, 100), fbc: clean(b.fbc, 400),
    page_url: clean(b.page_url, 500), referrer: clean(attr.referrer, 300),
    ip, user_agent: ua,
    capi: ''
  };

  // 4) Meta CAPI — only real people (WhatsApp confirmed, or unchecked while WAHA is off)
  const sendToMeta = !isSpam && (wa === 'whatsapp_ok' || wa === 'not_checked' || wa === 'check_error');
  lead.capi = sendToMeta ? await sendCapi(lead, req) : 'skipped';

  // 5) Google Sheet (all leads, including spam, with status)
  const sheet = await writeSheet(lead);
  if (!sheet.ok) console.error('sheet write failed', sheet.error);

  if (isSpam) { res.status(200).json({ ok: true }); return; } // silent for bots
  res.status(200).json({ ok: true, event_id: sendToMeta ? lead.lead_id : null, lead_id: lead.lead_id });
};
