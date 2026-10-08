/* Quiz funnel (vanilla JS, no build step) */
(function () {
  'use strict';

  // ---------- content config (edit prices/texts here) ----------
  var UNITS = {
    '1br':    { title: '1 Bedroom',  short: '1 Bed',  view: 'Partial sea view', from: '$538K',  img: '/u1.webp' },
    '2br':    { title: '2 Bedroom',  short: '2 Bed',  view: 'Sea view',         from: '$787K',  img: '/u2.webp' },
    '3br':    { title: '3 Bedroom',  short: '3 Bed',  view: 'Sea view',         from: '$1.22M', img: '/u3.webp' },
    'duplex': { title: 'Duplex / 4 Bedroom', short: 'Duplex', view: 'Marina view', from: '$1.52M', img: '/terrace.webp' }
  };

  var H1_BY_ANGLE = {
    plan:   'Pay 50% now, 50% when you get the keys',
    price:  'Marina homes in Dubai from $538K',
    family: 'Sea-view family homes on the Dubai marina'
  };

  var STEPS = [
    { key: 'budget', title: "What's your budget?", options: [
      { v: 'under_790k', label: 'Under $790K',     sub: '1 bedroom · 671-743 sq ft · partial sea view', pts: 2, unit: '1br' },
      { v: '790k_1_2m',  label: '$790K-1.2M',   sub: '2 bedroom · 1,268-1,846 sq ft · full sea view', pts: 3, unit: '2br' },
      { v: '1_2m_1_9m',  label: '$1.2M-1.9M',   sub: '3-4 bedroom · up to 3,564 sq ft', pts: 3, unit: '3br' },
      { v: '1_9m_plus',  label: '$1.9M+',          sub: 'Marina duplexes with private terraces', pts: 3, unit: 'duplex' }
    ]},
    { key: 'unit', title: 'Which home fits you?', options: [
      { v: '1br',    label: '1 Bedroom',          sub: 'Partial sea view · balcony', pts: 1 },
      { v: '2br',    label: '2 Bedroom',          sub: "Full sea view · maid's room in typical layout", pts: 1 },
      { v: '3br',    label: '3 Bedroom',          sub: 'Full sea view · 302 sq ft balcony', pts: 1 },
      { v: 'duplex', label: 'Duplex / 4 Bedroom', sub: 'Marina or garden view · up to 1,163 sq ft terrace', pts: 1 },
      { v: 'not_sure', label: 'Not sure yet',     sub: 'Show me the best options across all types', pts: 0 }
    ]},
    { key: 'purpose', title: "What's it for?", options: [
      { v: 'rent_out',   label: 'Rent it out',            sub: 'Delivered furnished, ready to let from handover', pts: 2 },
      { v: 'live',       label: 'Live in it',             sub: 'A family home on the marina', pts: 2 },
      { v: 'residency',  label: 'Home + UAE residency',   sub: '2-bedroom and larger may be eligible to apply for a Golden Visa', pts: 2 },
      { v: 'holiday',    label: 'Holiday home, rented the rest of the year', sub: "Use it yourself, let it when you're away", pts: 2 }
    ]},
    { key: 'payment', title: 'How would you like to pay?', options: [
      { v: 'plan_50_50', label: '50/50 payment plan', sub: '20% on booking · 30% during construction · 50% on handover', pts: 2 },
      { v: 'cash',       label: 'Cash in full',       sub: 'Ask about cash-buyer terms', pts: 3 },
      { v: 'undecided',  label: 'Not decided yet',    sub: "We'll show both options", pts: 0 }
    ]},
    { key: 'timing', title: 'When are you planning to buy?', options: [
      { v: 'this_month', label: 'This month',       sub: 'Ready to reserve, booking from $10,900', pts: 4 },
      { v: '3_months',   label: 'Within 3 months',  sub: 'Comparing a few projects', pts: 2 },
      { v: 'exploring',  label: 'Just exploring',   sub: 'Researching Dubai off-plan', pts: 0 }
    ]}
  ];

  // ---------- state ----------
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem('bm_' + k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem('bm_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var mem = {};
  function sget(k) { var v = store.get(k); return v != null ? v : mem[k]; }
  function sset(k, v) { mem[k] = v; store.set(k, v); }

  var answers = sget('answers') || {};
  var cfg = { pixelId: '', whatsapp: '', rera: '', telegramBot: '', telegramStart: '' };

  // capture attribution once per session
  (function captureAttribution() {
    if (sget('attr')) return;
    var p = new URLSearchParams(location.search), a = {};
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','angle'].forEach(function (k) { if (p.get(k)) a[k] = p.get(k); });
    a.landing_url = location.href;
    a.referrer = document.referrer || '';
    sset('attr', a);
  })();
  var attr = sget('attr') || {};

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function cookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
  function fbc() {
    var c = cookie('_fbc'); if (c) return c;
    return attr.fbclid ? 'fb.1.' + (sget('fbclid_ts') || (function(){ var t = Date.now(); sset('fbclid_ts', t); return t; })()) + '.' + attr.fbclid : '';
  }
  function track(ev, params, opts) { try { if (window.fbq) { if (opts) fbq('track', ev, params || {}, opts); else fbq('track', ev, params || {}); } } catch (e) {} }
  function trackCustom(ev, params) { try { if (window.fbq) fbq('trackCustom', ev, params || {}); } catch (e) {} }

  function unitForCards() {
    if (answers.unit && answers.unit !== 'not_sure') return answers.unit;
    var b = STEPS[0].options.filter(function (o) { return o.v === answers.budget; })[0];
    return b ? b.unit : '2br';
  }
  function cardHTML(u, label) {
    var x = UNITS[u];
    return '<div class="lcard"><img src="' + x.img + '" alt="" loading="lazy"><div class="lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>' +
      '<div class="meta"><b>' + (label || x.title) + '</b><span>from ' + x.from + '</span></div></div>';
  }

  // ---------- render screens ----------
  function renderHome() {
    var angle = attr.angle && H1_BY_ANGLE[attr.angle];
    if (angle) $('h1').textContent = angle;
    $('homeCards').innerHTML = ['1br','2br','3br'].map(function (u) { return cardHTML(u); }).join('');
    Array.prototype.forEach.call($('homeCards').children, function (el) { el.addEventListener('click', startQuiz); el.style.cursor = 'pointer'; });
  }

  function renderStep(n) {
    var s = STEPS[n - 1], pct = Math.round(n / STEPS.length * 100);
    $('stepLabel').textContent = 'Step ' + n + ' of ' + STEPS.length;
    $('stepPct').textContent = pct + '%';
    var bar = $('progressBar'); bar.style.setProperty('--v', pct + '%'); bar.setAttribute('aria-valuenow', n);
    $('qTitle').textContent = s.title;
    document.title = 'Step ' + n + ' of ' + STEPS.length + ' · Housebook';
    var box = $('qOptions'); box.innerHTML = '';
    s.options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'lp-opt' + (answers[s.key] === o.v ? ' sel' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', answers[s.key] === o.v);
      b.innerHTML = '<i class="r" aria-hidden="true"></i><div><b>' + o.label + '</b><span>' + o.sub + '</span></div>';
      b.addEventListener('click', function () {
        answers[s.key] = o.v; sset('answers', answers);
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('sel'); c.setAttribute('aria-checked', 'false'); });
        b.classList.add('sel'); b.setAttribute('aria-checked', 'true');
        trackCustom('QuizStep' + n, { answer: o.v });
        setTimeout(function () { go(n < STEPS.length ? '/quiz/' + (n + 1) : '/results'); }, 300);
      });
      box.appendChild(b);
    });
  }

  function renderResults() {
    document.title = 'Matching units… · Housebook';
    $('loadingLine').textContent = 'Matching available units to your budget…';
    setTimeout(function () { $('loadingLine').textContent = 'Preparing your 50/50 payment schedule…'; }, 1100);
    setTimeout(function () { go('/contact', true); }, 2300);
  }

  function renderContact() {
    document.title = 'Your shortlist is ready · Housebook';
    var u = unitForCards(), x = UNITS[u];
    $('matchCards').innerHTML = [0,1,2].map(function () { return cardHTML(u, x.short + ' · ' + x.view); }).join('');
    initCountries();
    setChannel(channel());
  }

  function renderThanks() {
    document.title = 'Done · Housebook';
    var name = sget('lead_name'), via = sget('lead_channel') === 'tg' ? 'tg' : 'wa';
    var app = via === 'tg' ? 'Telegram' : 'WhatsApp';
    $('thanksTitle').textContent = (name ? 'Done, ' + name + '!' : 'Done!') + ' Check your ' + app;
    $('thanksText').textContent = via === 'tg'
      ? 'A Housebook expert will message you on Telegram. To get the shortlist faster, open our Telegram chat below.'
      : "Charlie from Housebook is sending your shortlist right now. Didn't get it? Tap below.";
    var wa = waLink(), tg = tgLink();
    var main = via === 'tg' ? tg : wa, alt = via === 'tg' ? wa : tg;
    var mainLabel = via === 'tg' ? 'Open Telegram' : 'Open WhatsApp', altLabel = via === 'tg' ? 'Message us on WhatsApp' : 'Message us on Telegram';
    setBtn($('thanksMain'), main, mainLabel);
    setBtn($('thanksAlt'), alt, altLabel);
  }
  function setBtn(el, href, label) {
    if (href) { el.href = href; el.textContent = label; el.hidden = false; } else { el.hidden = true; }
  }

  // ---------- messenger links (header, home, contact, thank-you) ----------
  function waLink() {
    var num = (cfg.whatsapp || '').replace(/\D/g, '');
    return num ? 'https://wa.me/' + num + '?text=' + encodeURIComponent("Hi! I'd like my Dubai Islands marina shortlist") : '';
  }
  function tgLink() {
    var bot = (cfg.telegramBot || '').replace(/^@/, '');
    if (!bot) return '';
    return 'https://t.me/' + bot + (cfg.telegramStart ? '?start=' + encodeURIComponent(cfg.telegramStart) : '');
  }
  function applyLinks() {
    var wa = waLink(), tg = tgLink();
    document.querySelectorAll('.js-wa').forEach(function (a) { if (wa) { a.href = wa; a.hidden = false; } else a.hidden = true; });
    document.querySelectorAll('.js-tg').forEach(function (a) { if (tg) { a.href = tg; a.hidden = false; } else a.hidden = true; });
    document.querySelectorAll('.js-wa, .js-tg').forEach(function (a) {
      if (a.dataset.bound) return; a.dataset.bound = '1';
      a.addEventListener('click', function () { trackCustom('MessengerClick', { channel: a.classList.contains('js-tg') ? 'telegram' : 'whatsapp', screen: currentScreen }); });
    });
  }

  // ---------- router ----------
  var currentScreen = 'home';
  function show(name) {
    currentScreen = name;
    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (s) { s.hidden = s.getAttribute('data-screen') !== name; });
    $('stickyCta').hidden = name !== 'home';
    window.scrollTo(0, 0);
  }
  function route() {
    var p = location.pathname.replace(/\/+$/, '') || '/';
    var m = p.match(/^\/quiz\/(\d)$/);
    if (m) {
      var n = +m[1];
      // don't allow skipping ahead
      for (var i = 0; i < n - 1; i++) if (!answers[STEPS[i].key]) return go('/quiz/' + (i + 1), true);
      show('quiz'); renderStep(n); return;
    }
    if (p === '/results') { if (!answers.timing) return go('/quiz/1', true); show('results'); renderResults(); return; }
    if (p === '/contact') { if (!answers.timing) return go('/quiz/1', true); show('contact'); renderContact(); return; }
    if (p === '/thank-you') { show('thanks'); renderThanks(); return; }
    show('home'); renderHome();
  }
  function go(path, replace) {
    if (replace) history.replaceState({}, '', path + location.search); else history.pushState({}, '', path + location.search);
    route();
  }
  window.addEventListener('popstate', route);

  function startQuiz() {
    if (!sget('started_at')) sset('started_at', Date.now());
    track('ViewContent', { content_name: 'quiz_start' });
    go('/quiz/1');
  }
  $('stickyBtn').addEventListener('click', startQuiz);
  $('quizBack').addEventListener('click', function () { history.back(); });
  $('contactBack').addEventListener('click', function () { go('/quiz/5'); });

  // ---------- phone / countries ----------
  var countriesReady = false;
  function initCountries() {
    if (countriesReady) return;
    var sel = $('fCountry');
    function fill() {
      if (!window.libphonenumber) { setTimeout(fill, 150); return; }
      var dn = (window.Intl && Intl.DisplayNames) ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
      var list = libphonenumber.getCountries().map(function (c) {
        return { c: c, code: libphonenumber.getCountryCallingCode(c), name: dn ? dn.of(c) : c };
      }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      var top = ['AE','GB','SA','IN','RU','DE','US','KZ'];
      var html = top.map(function (c) { return '<option value="' + c + '">' + c + ' +' + libphonenumber.getCountryCallingCode(c) + '</option>'; }).join('') +
        '<option disabled>----------</option>' +
        list.map(function (x) { return '<option value="' + x.c + '">' + x.c + ' +' + x.code + ' ' + x.name + '</option>'; }).join('');
      sel.innerHTML = html; sel.value = 'AE'; countriesReady = true;
    }
    fill();
  }

  // ---------- channel: WhatsApp or Telegram ----------
  function channel() { var r = document.querySelector('input[name="via"]:checked'); return r && r.value === 'tg' ? 'tg' : 'wa'; }
  function setChannel(via) {
    var tg = via === 'tg';
    $('tgField').hidden = !tg;
    $('phoneLabel').textContent = tg ? 'Phone number (optional)' : 'WhatsApp number';
    $('etaText').textContent = tg ? 'A Housebook expert replies on Telegram during working hours' : 'Reply on WhatsApp within 60 seconds';
    clearErr('phoneField'); clearErr('tgField');
    softWarned = false; setSubmitLabel();
  }
  document.querySelectorAll('input[name="via"]').forEach(function (r) {
    r.addEventListener('change', function () { setChannel(channel()); if (channel() === 'tg') $('fTg').focus(); });
  });
  function normTg(v) {
    v = String(v || '').trim().replace(/^https?:\/\/(www\.)?t(elegram)?\.me\//i, '').replace(/^@/, '');
    return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v) ? v : '';
  }

  // ---------- form errors (kit: .field.is-err shows .field__err) ----------
  function setErr(fieldId, errId, text, warn) {
    var f = $(fieldId); f.classList.remove('is-err', 'is-warn'); f.classList.add(warn ? 'is-warn' : 'is-err');
    $(errId).querySelector('span').textContent = text;
    var inp = f.querySelector('.input'); if (inp && !warn) inp.setAttribute('aria-invalid', 'true');
  }
  function clearErr(fieldId) {
    var f = $(fieldId); f.classList.remove('is-err', 'is-warn');
    f.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
  }
  var softWarned = false; // number not found on WhatsApp: warn once, never block
  function setSubmitLabel(busy) {
    var btn = $('submitBtn');
    btn.disabled = !!busy; if (busy) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
    btn.textContent = busy ? 'Sending…' : softWarned ? 'Send anyway' : 'Send my shortlist';
  }
  $('fPhone').addEventListener('input', function () { if (softWarned) { softWarned = false; clearErr('phoneField'); setSubmitLabel(); } });

  // ---------- submit ----------
  var attempt = 0;
  $('leadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    ['nameField', 'phoneField', 'tgField'].forEach(clearErr);
    $('eConsent').hidden = true; $('consentLabel').classList.remove('is-err');

    var via = channel();
    var name = $('fName').value.trim();
    var country = $('fCountry').value || 'AE';
    var raw = $('fPhone').value.trim();
    var tg = normTg($('fTg').value);
    var ok = true, first = null;
    if (name.length < 2) { setErr('nameField', 'eName', 'Please enter your name'); ok = false; first = first || $('fName'); }
    var e164 = '';
    try {
      var pn = raw && window.libphonenumber && libphonenumber.parsePhoneNumberFromString(raw, raw.indexOf('+') === 0 ? undefined : country);
      if (pn && pn.isValid()) e164 = pn.number;
    } catch (err) {}
    if (via === 'wa' && !e164) { setErr('phoneField', 'ePhone', 'Please enter a valid WhatsApp number'); ok = false; first = first || $('fPhone'); }
    if (via === 'tg') {
      if (!tg) { setErr('tgField', 'eTg', 'Please enter your Telegram username, for example @alex_dubai'); ok = false; first = first || $('fTg'); }
      if (raw && !e164) { setErr('phoneField', 'ePhone', 'This number looks incomplete. Fix it or leave the field empty'); ok = false; first = first || $('fPhone'); }
    }
    if (!$('fConsent').checked) { $('eConsent').textContent = 'Please confirm you agree to be contacted'; $('eConsent').hidden = false; $('consentLabel').classList.add('is-err'); ok = false; first = first || $('fConsent'); }
    if (!ok) { if (first) first.focus(); return; }

    attempt++;
    setSubmitLabel(true);
    var payload = {
      name: name, channel: via, telegram: tg, phone: e164, phone_raw: raw, country: country, consent: true,
      company: $('fCompany').value, // honeypot
      answers: answers, started_at: sget('started_at') || null, submitted_at: Date.now(),
      attempt: attempt, attr: attr, fbp: cookie('_fbp'), fbc: fbc(), page_url: location.href
    };
    fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.ok) {
          softWarned = false; setSubmitLabel();
          if (res.event_id) track('Lead', { content_name: 'marina_quiz', contact_channel: via }, { eventID: res.event_id });
          sset('lead_name', name); sset('lead_channel', via);
          go('/thank-you', true);
          return;
        }
        if (res.code === 'no_whatsapp') {
          softWarned = true;
          setErr('phoneField', 'ePhone', "We couldn't find this number on WhatsApp. Check it, switch to Telegram above, or tap Send anyway.", true);
        } else if (res.code === 'invalid_phone') {
          setErr('phoneField', 'ePhone', 'Please enter a valid phone number');
        } else if (res.code === 'invalid_telegram') {
          setErr('tgField', 'eTg', 'Please enter your Telegram username, for example @alex_dubai');
        } else {
          setErr('phoneField', 'ePhone', 'Something went wrong. Please try again.');
        }
        setSubmitLabel();
      })
      .catch(function () {
        setSubmitLabel();
        setErr('phoneField', 'ePhone', 'Connection problem. Please try again.');
      });
  });

  // ---------- config + pixel ----------
  function loadPixel(id) {
    /* Meta Pixel base code */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', id); fbq('track', 'PageView');
  }
  fetch('/api/config').then(function (r) { return r.json(); }).then(function (c) {
    cfg = c || cfg;
    if (cfg.pixelId) loadPixel(cfg.pixelId);
    if (cfg.rera) { $('rera').textContent = ' · RERA ORN ' + cfg.rera; $('trustRera').textContent = 'Licensed by RERA · ORN ' + cfg.rera + ' · secure connection'; }
    applyLinks();
    if (location.pathname.indexOf('/thank-you') === 0) renderThanks();
  }).catch(function () {});

  route();
})();
