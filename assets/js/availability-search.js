/**
 * Booking Wizard
 * Step 1: Pick dates & persons → Step 2: Choose FeWo → Step 3: Personal data & submit
 */
(function () {
  'use strict';

  const FEWO_META = {
    '9200':  { slug: 'fewo1',      urlSlug: 'ferienwohnung-1', title: 'Ferienwohnung 1', size: '42 qm',  persons: '4 Pers.',   maxPersons: 4, price: '60 – 80 €',  url: '/ferienwohnungen/fewo-1/' },
    '9477':  { slug: 'fewo2',      urlSlug: 'ferienwohnung-2', title: 'Ferienwohnung 2', size: '56 qm',  persons: '4 Pers.',   maxPersons: 4, price: '65 – 85 €',  url: '/ferienwohnungen/fewo-2/' },
    '9478':  { slug: 'fewo3',      urlSlug: 'ferienwohnung-3', title: 'Ferienwohnung 3', size: '75 qm',  persons: '5 Pers.',   maxPersons: 5, price: '70 – 95 €',  url: '/ferienwohnungen/fewo-3/' },
    '9479':  { slug: 'fewo4',      urlSlug: 'ferienwohnung-4', title: 'Ferienwohnung 4', size: '75 qm',  persons: '5 Pers.',   maxPersons: 5, price: '65 – 90 €',  url: '/ferienwohnungen/fewo-4/' },
    '9480':  { slug: 'fewo5',      urlSlug: 'ferienwohnung-5', title: 'Ferienwohnung 5', size: '100 qm', persons: '2 – 7 Pers.', maxPersons: 7, price: '95 – 150 €', url: '/ferienwohnungen/fewo-5/' },
    '35182': { slug: 'ferienhaus', urlSlug: 'ferienhaus',      title: 'Ferienhaus',      size: '65 qm',  persons: '4 Pers.',   maxPersons: 4, price: '90 – 105 €', url: '/ferienwohnungen/ferienhaus/' }
  };

  let availabilityData = null;
  let currentStep = 1;
  // Wizard state
  let chosen = { anreise: '', abreise: '', fewoSlug: '', fewoTitle: '' };

  async function loadAvailability() {
    try {
      const resp = await fetch('/data/availability.json');
      if (resp.ok) availabilityData = await resp.json();
    } catch (_) {}
  }

  function isFree(id, checkIn, checkOut) {
    if (!availabilityData || !availabilityData[id]) return true;
    const bookings = availabilityData[id];
    for (const b of bookings) {
      if (b.start < checkOut && b.end > checkIn) return false;
    }
    return true;
  }

  function shiftDate(isoStr, days) {
    const d = new Date(isoStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function formatDE(isoStr) {
    const parts = isoStr.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  }

  /* ---- Wizard navigation ---- */
  function goToStep(step) {
    currentStep = step;
    for (let s = 1; s <= 3; s++) {
      var panel = document.getElementById('wizard-step-' + s);
      if (panel) panel.classList.toggle('hidden', s !== step);
    }
    // Update step indicators
    document.querySelectorAll('#wizard-steps .wizard-step').forEach(function (el) {
      var n = parseInt(el.dataset.step, 10);
      el.classList.remove('active', 'done');
      if (n < step) el.classList.add('done');
      else if (n === step) el.classList.add('active');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---- Step 1 → 2 ---- */
  function onStep1Next() {
    var anreise = document.getElementById('search-anreise').value;
    var abreise = document.getElementById('search-abreise').value;
    var errEl = document.getElementById('step1-error');

    if (!anreise || !abreise) {
      errEl.textContent = 'Bitte wählen Sie Anreise- und Abreisedatum.';
      errEl.classList.remove('hidden');
      return;
    }
    if (anreise >= abreise) {
      errEl.textContent = 'Das Abreisedatum muss nach dem Anreisedatum liegen.';
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');

    chosen.anreise = anreise;
    chosen.abreise = abreise;

    renderStep2();
    goToStep(2);
  }

  /* ---- Step 2: Render results ---- */
  function renderStep2() {
    var anreise = chosen.anreise;
    var abreise = chosen.abreise;
    var personenInput = document.getElementById('search-personen');
    var personen = personenInput ? parseInt(personenInput.value, 10) || 0 : 0;
    var prefSelect = document.getElementById('search-fewo');
    var preferredSlug = prefSelect ? prefSelect.value : '';

    // Summary line
    var summaryEl = document.getElementById('step2-summary');
    var summaryText = '📅 ' + formatDE(anreise) + ' – ' + formatDE(abreise);
    if (personen > 0) summaryText += '  ·  👥 ' + personen + ' Personen';
    summaryEl.innerHTML = '<span class="inline-block bg-primary-50 text-primary-800 text-sm font-medium px-4 py-2 rounded-full">' + summaryText + '</span>';

    var available = [];
    var unavailableWithAlternatives = [];

    for (var _i = 0, _a = Object.entries(FEWO_META); _i < _a.length; _i++) {
      var id = _a[_i][0], meta = _a[_i][1];
      if (personen > 0 && meta.maxPersons < personen) continue;

      if (isFree(id, anreise, abreise)) {
        available.push({ id: id, meta: meta });
      } else {
        var alts = [];
        for (var shift = -3; shift <= 3; shift++) {
          if (shift === 0) continue;
          var altIn = shiftDate(anreise, shift);
          var altOut = shiftDate(abreise, shift);
          if (altIn < new Date().toISOString().slice(0, 10)) continue;
          if (isFree(id, altIn, altOut)) {
            alts.push({ shift: shift, checkIn: altIn, checkOut: altOut });
          }
        }
        if (alts.length > 0) {
          unavailableWithAlternatives.push({ id: id, meta: meta, alternatives: alts });
        }
      }
    }

    // Sort: preferred FeWo first
    if (preferredSlug) {
      available.sort(function (a, b) {
        var aP = a.meta.slug === preferredSlug ? 0 : 1;
        var bP = b.meta.slug === preferredSlug ? 0 : 1;
        return aP - bP;
      });
      unavailableWithAlternatives.sort(function (a, b) {
        var aP = a.meta.slug === preferredSlug ? 0 : 1;
        var bP = b.meta.slug === preferredSlug ? 0 : 1;
        return aP - bP;
      });
    }

    var preferredIsAvailable = preferredSlug && available.some(function (a) { return a.meta.slug === preferredSlug; });
    var preferredHasAlt = preferredSlug && unavailableWithAlternatives.some(function (a) { return a.meta.slug === preferredSlug; });

    var html = '';

    // If user had a preference and it's not available, show a hint
    if (preferredSlug && !preferredIsAvailable) {
      var prefTitle = '';
      for (var _j = 0, _b = Object.values(FEWO_META); _j < _b.length; _j++) {
        if (_b[_j].slug === preferredSlug) { prefTitle = _b[_j].title; break; }
      }
      html += '<div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-center">';
      html += '<p class="text-amber-800 font-medium">Ihre Wunsch-Unterkunft <strong>' + prefTitle + '</strong> ist leider im gewählten Zeitraum nicht verfügbar.</p>';
      if (preferredHasAlt) {
        html += '<p class="text-amber-700 text-sm mt-1">Wir zeigen Ihnen unten alternative Zeiträume dafür.</p>';
      }
      html += '</div>';
    }

    if (available.length > 0) {
      html += '<h3 class="text-lg font-heading font-semibold text-stone-800 mb-4">';
      html += '<span class="inline-block w-3 h-3 bg-accent-500 rounded-full mr-2"></span>';
      html += 'Verfügbare Unterkünfte</h3>';
      html += '<div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">';
      for (var i = 0; i < available.length; i++) {
        var isPreferred = available[i].meta.slug === preferredSlug;
        html += fewoCard(available[i].meta, anreise, abreise, null, isPreferred);
      }
      html += '</div>';
    } else {
      html += '<div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">';
      html += '<p class="text-red-700 font-medium">Leider ist für den gewählten Zeitraum keine Ferienwohnung verfügbar.</p>';
      html += '</div>';
    }

    // Show alternatives: always for preferred FeWo, otherwise only when no exact matches
    var altsToShow = unavailableWithAlternatives;
    if (available.length > 0 && preferredSlug) {
      // Only show alternatives for the preferred FeWo if others are available
      altsToShow = unavailableWithAlternatives.filter(function (a) { return a.meta.slug === preferredSlug; });
    }

    if (altsToShow.length > 0) {
      html += '<h3 class="text-lg font-heading font-semibold text-stone-800 mb-4">';
      html += '<span class="inline-block w-3 h-3 bg-primary-400 rounded-full mr-2"></span>';
      html += 'Alternative Zeiträume</h3>';
      html += '<div class="space-y-4">';
      for (var j = 0; j < altsToShow.length; j++) {
        html += alternativeCard(altsToShow[j].meta, altsToShow[j].alternatives);
      }
      html += '</div>';
    }

    if (available.length === 0 && unavailableWithAlternatives.length === 0) {
      html += '<div class="bg-stone-50 border border-stone-200 rounded-xl p-6 text-center">';
      html += '<p class="text-stone-600">Leider sind auch mit verschobenen Daten keine Unterkünfte verfügbar. Bitte probieren Sie einen anderen Zeitraum.</p>';
      html += '</div>';
    }

    var resultsEl = document.getElementById('availability-results');
    resultsEl.innerHTML = html;
    wireBookButtons();
  }

  function fewoCard(meta, checkIn, checkOut, shiftLabel, isPreferred) {
    var borderCls = isPreferred ? 'border-primary-400 ring-2 ring-primary-200' : 'border-stone-200';
    var html = '<div class="bg-white rounded-xl border ' + borderCls + ' p-4 hover:shadow-md transition-shadow">';
    if (isPreferred) {
      html += '<span class="inline-block text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full mb-2">Ihre Wunsch-Unterkunft</span>';
    }
    html += '<h4 class="font-heading font-semibold text-stone-900 mb-2">' + meta.title + '</h4>';
    html += '<div class="text-sm text-stone-500 space-y-1 mb-3">';
    html += '<div>📐 ' + meta.size + ' · 👥 ' + meta.persons + '</div>';
    html += '<div>💰 ' + meta.price + ' / Nacht</div>';
    if (shiftLabel) {
      html += '<div class="text-primary-700 font-medium">' + shiftLabel + '</div>';
    }
    html += '</div>';
    html += '<div class="flex gap-2">';
    html += '<button data-book="' + meta.slug + '" data-title="' + meta.title + '" data-checkin="' + checkIn + '" data-checkout="' + checkOut + '" ';
    html += 'class="flex-1 px-3 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors">Auswählen</button>';
    html += '<a href="' + meta.url + '" class="px-3 py-2 border border-stone-300 text-stone-700 text-sm rounded-lg hover:bg-stone-50 transition-colors">Details</a>';
    html += '</div></div>';
    return html;
  }

  function alternativeCard(meta, alternatives) {
    var html = '<div class="bg-warm-50 rounded-xl border border-stone-200 p-4">';
    html += '<div class="mb-3">';
    html += '<h4 class="font-heading font-semibold text-stone-900">' + meta.title + '</h4>';
    html += '<span class="text-sm text-stone-500">📐 ' + meta.size + ' · 👥 ' + meta.persons + ' · 💰 ' + meta.price + '</span>';
    html += '</div>';
    html += '<div class="grid sm:grid-cols-2 gap-2">';
    for (var i = 0; i < alternatives.length; i++) {
      var alt = alternatives[i];
      var label = (alt.shift > 0 ? '+' : '') + alt.shift + (alt.shift === 1 || alt.shift === -1 ? ' Tag' : ' Tage');
      html += '<div class="flex items-center justify-between bg-white rounded-lg p-3 border border-stone-100">';
      html += '<div>';
      html += '<span class="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">' + label + '</span>';
      html += '<div class="text-sm text-stone-700 mt-1">' + formatDE(alt.checkIn) + ' – ' + formatDE(alt.checkOut) + '</div>';
      html += '</div>';
      html += '<button data-book="' + meta.slug + '" data-title="' + meta.title + '" data-checkin="' + alt.checkIn + '" data-checkout="' + alt.checkOut + '" ';
      html += 'class="px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition-colors whitespace-nowrap">Auswählen</button>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  function wireBookButtons() {
    document.getElementById('availability-results').querySelectorAll('[data-book]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        chosen.fewoSlug = btn.dataset.book;
        chosen.fewoTitle = btn.dataset.title;
        chosen.anreise = btn.dataset.checkin;
        chosen.abreise = btn.dataset.checkout;
        goToStep(3);
        fillStep3();
      });
    });
  }

  /* ---- Step 3: Fill hidden fields & summary ---- */
  function fillStep3() {
    document.getElementById('anreise').value = chosen.anreise;
    document.getElementById('abreise').value = chosen.abreise;
    document.getElementById('ferienwohnung').value = chosen.fewoSlug;

    var summaryHtml = '<strong>' + chosen.fewoTitle + '</strong>';
    summaryHtml += '<br><span class="text-sm text-primary-700">📅 ' + formatDE(chosen.anreise) + ' – ' + formatDE(chosen.abreise) + '</span>';
    document.getElementById('step3-summary').innerHTML = summaryHtml;

    setTimeout(function () {
      var name = document.getElementById('name');
      if (name && !name.value) name.focus();
    }, 300);
  }

  /* ---- Init ---- */
  document.addEventListener('DOMContentLoaded', async function () {
    await loadAvailability();

    document.getElementById('wizard-next-1').addEventListener('click', onStep1Next);
    document.getElementById('wizard-back-2').addEventListener('click', function () { goToStep(1); });
    document.getElementById('wizard-back-3').addEventListener('click', function () {
      renderStep2();
      goToStep(2);
    });

    // When Anreise changes, set Abreise min and default to Anreise + 1
    var searchAnreise = document.getElementById('search-anreise');
    var searchAbreise = document.getElementById('search-abreise');
    var today = new Date().toISOString().slice(0, 10);
    searchAnreise.min = today;
    searchAnreise.value = today;
    searchAbreise.min = shiftDate(today, 1);
    searchAbreise.value = shiftDate(today, 1);
    searchAnreise.addEventListener('change', function () {
      var val = searchAnreise.value;
      if (!val) return;
      var nextDay = shiftDate(val, 1);
      searchAbreise.min = nextDay;
      if (!searchAbreise.value || searchAbreise.value <= val) {
        searchAbreise.value = nextDay;
      }
    });

    // Handle ?fewo= query param → pre-select preference in Step 1
    var params = new URLSearchParams(window.location.search);
    var fewoParam = params.get('fewo');
    if (fewoParam) {
      var prefSelect = document.getElementById('search-fewo');
      if (prefSelect) {
        // Match on urlSlug or slug
        for (var _i = 0, _a = Object.values(FEWO_META); _i < _a.length; _i++) {
          var m = _a[_i];
          if (m.urlSlug === fewoParam || m.slug === fewoParam) {
            prefSelect.value = m.slug;
            break;
          }
        }
      }
    }
  });
})();
