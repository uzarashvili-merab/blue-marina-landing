/* Blue Marina Residence — quiz funnel (vanilla JS, no build step) */
(function () {
  'use strict';

  // ---------- content config (edit prices/texts here) ----------
  var UNITS = {
    '1br':    { title: '1 Bedroom',  short: '1 Bed',  view: 'Partial sea view', from: '$538K',  img: '/img/u1.webp' },
    '2br':    { title: '2 Bedroom',  short: '2 Bed',  view: 'Sea view',         from: '$787K',  img: '/img/u2.webp' },
    '3br':    { title: '3 Bedroom',  short: '3 Bed',  view: 'Sea view',         from: '$1.22M', img: '/img/u3.webp' },
    'duplex': { title: 'Duplex / 4 Bedroom', short: 'Duplex', view: 'Marina view', from: '$1.52M', img: '/img/terrace.webp' }
  };

  var H1_BY_ANGLE = {
    plan:   'Pay 50% now, 50% when you get the keys',
    price:  'Marina homes in Dubai from $538K',
    family: 'Sea-view family homes on the Dubai marina'
  };

  var STEPS = [
    { key: 'budget', title: "What's your budget?", options: [
      { v: 'under_790k', label: 'Under $790K',     sub: '1 bedroom · 671–743 sq ft · partial sea view', pts: 2, unit: '1br' },
      { v: '790k_1_2m',  label: '$790K – $1.2M',   sub: '2 bedroom · 1,268–1,846 sq ft · full sea view', pts: 3, unit: '2br' },
      { v: '1_2m_1_9m',  label: '$1.2M – $1.9M',   sub: '3–4 bedroom · up to 3,564 sq ft', pts: 3, unit: '3br' },
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
      { v: 'rent_out',   label: 'Rent it out',            sub: 'Delivered furnished — ready to let from handover', pts: 2 },
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
      { v: 'this_month', label: 'This month',       sub: 'Ready to reserve — booking from $10,900', pts: 4 },
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
  var cfg = { pixelId: '', whatsapp: '', rera: '' };

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
    return '<div class="lcard"><img src="' + x.img + '" alt="" loading="lazy"><div class="lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg></div>' +
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
    var s = STEPS[n - 1];
    $('stepLabel').textContent = 'Step ' + n + ' of ' + STEPS.length;
    $('stepPct').textContent = Math.round(n / STEPS.length * 100) + '%';
    $('progressFill').style.width = (n / STEPS.length * 100) + '%';
    $('qTitle').textContent = s.title;
    document.title = 'Step ' + n + ' of 5 — Blue Marina Residence';
    var box = $('qOptions'); box.innerHTML = '';
    s.options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'opt' + (answers[s.key] === o.v ? ' sel' : '');
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', answers[s.key] === o.v);
      b.innerHTML = '<i class="r"></i><div><b>' + o.label + '</b><span>' + o.sub + '</span></div>';
      b.addEventListener('click', function () {
        answers[s.key] = o.v; sset('answers', answers);
        Array.prototype.forEach.call(box.children, function (c) { c.classList.remove('sel'); });
        b.classList.add('sel');
        trackCustom('QuizStep' + n, { answer: o.v });
        setTimeout(function () { go(n < STEPS.length ? '/quiz/' + (n + 1) : '/results'); }, 300);
      });
      box.appendChild(b);
    });
  }

  function renderResults() {
    document.title = 'Matching units… — Blue Marina Residence';
    $('loadingLine').textContent = 'Matching available units to your budget…';
    setTimeout(function () { $('loadingLine').textContent = 'Preparing your 50/50 payment schedule…'; }, 1100);
    setTimeout(function () { go('/contact', true); }, 2300);
  }

  function renderContact() {
    document.title = 'Your shortlist is ready — Blue Marina Residence';
    var u = unitForCards(), x = UNITS[u];
    $('matchCards').innerHTML = [0,1,2].map(function () { return cardHTML(u, x.short + ' · ' + x.view); }).join('');
    initCountries();
  }

  function renderThanks() {
    document.title = 'Done — Blue Marina Residence';
    var name = sget('lead_name');
    $('thanksTitle').textContent = name ? 'Done, ' + name + '! Check your WhatsApp' : 'Done! Check your WhatsApp';
    var num = (cfg.whatsapp || '').replace(/\D/g, '');
    if (num) $('waBtn').href = 'https://wa.me/' + num + '?text=' + encodeURIComponent("Hi! I'd like my Blue Marina shortlist");
    else $('waBtn').style.display = 'none';
  }

  // ---------- router ----------
  function show(name) {
    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (s) { s.hidden = s.getAttribute('data-screen') !== name; });
    var sticky = $('stickyCta'); sticky.style.display = name === 'home' ? '' : 'none';
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
  $('stickyCta').addEventListener('click', startQuiz);
  setTimeout(function () { $('stickyCta').classList.add('pulse'); }, 3000);
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
        '<option disabled>──────</option>' +
        list.map(function (x) { return '<option value="' + x.c + '">' + x.c + ' +' + x.code + ' ' + x.name + '</option>'; }).join('');
      sel.innerHTML = html; sel.value = 'AE'; countriesReady = true;
    }
    fill();
  }

  // ---------- submit ----------
  var attempt = 0;
  $('leadForm').addEventListener('submit', function (e) {
    e.preventDefault();
    ['eName','ePhone','eConsent'].forEach(function (id) { $(id).textContent = ''; });
    document.querySelectorAll('.field').forEach(function (f) { f.classList.remove('bad'); });

    var name = $('fName').value.trim();
    var country = $('fCountry').value || 'AE';
    var raw = $('fPhone').value.trim();
    var ok = true;
    if (name.length < 2) { $('eName').textContent = 'Please enter your name'; $('fName').parentNode.classList.add('bad'); ok = false; }
    var e164 = '';
    try {
      var pn = window.libphonenumber && libphonenumber.parsePhoneNumberFromString(raw, raw.indexOf('+') === 0 ? undefined : country);
      if (pn && pn.isValid()) e164 = pn.number;
    } catch (err) {}
    if (!e164) { $('ePhone').textContent = 'Please enter a valid WhatsApp number'; $('fPhone').parentNode.classList.add('bad'); ok = false; }
    if (!$('fConsent').checked) { $('eConsent').textContent = 'Please confirm you agree to be contacted'; ok = false; }
    if (!ok) return;

    attempt++;
    var btn = $('submitBtn'); btn.disabled = true; btn.querySelector('span').textContent = 'CHECKING…';
    var payload = {
      name: name, phone: e164, phone_raw: raw, country: country, consent: true,
      company: $('fCompany').value, // honeypot
      answers: answers, started_at: sget('started_at') || null, submitted_at: Date.now(),
      attempt: attempt, attr: attr, fbp: cookie('_fbp'), fbc: fbc(), page_url: location.href
    };
    fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        btn.disabled = false; btn.querySelector('span').textContent = 'SEND MY SHORTLIST';
        if (res.ok) {
          if (res.event_id) track('Lead', { content_name: 'blue_marina_quiz' }, { eventID: res.event_id });
          sset('lead_name', name);
          go('/thank-you', true);
        } else if (res.code === 'no_whatsapp') {
          $('ePhone').textContent = "This number isn't on WhatsApp — please check it";
          $('fPhone').parentNode.classList.add('bad');
        } else if (res.code === 'invalid_phone') {
          $('ePhone').textContent = 'Please enter a valid WhatsApp number';
          $('fPhone').parentNode.classList.add('bad');
        } else {
          $('ePhone').textContent = 'Something went wrong. Please try again.';
        }
      })
      .catch(function () {
        btn.disabled = false; btn.querySelector('span').textContent = 'SEND MY SHORTLIST';
        $('ePhone').textContent = 'Connection problem. Please try again.';
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
    if (cfg.rera) { $('rera').textContent = ' · RERA ORN ' + cfg.rera; $('trustRera').textContent = 'Licensed by RERA · ORN ' + cfg.rera; }
    if (location.pathname.indexOf('/thank-you') === 0) renderThanks();
  }).catch(function () {});

  route();
})();
