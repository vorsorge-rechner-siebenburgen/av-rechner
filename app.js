// Altersvorsorge-Rechner – Oberfläche, Diagramme, Teilen.
// Gerechnet wird ausschließlich in rechnung.js; hier wird nur angezeigt.
import {
  FOERDERUNG_STANDARD, verlauf, kipppunkt, wartenKostet, spaeterStarten, noetigerBeitrag,
  foerderquote, grundzulage, kinderzulage, kinderMitAnspruch, kaufkraftFaktor,
} from './rechnung.js';

const C = window.RECHNER;
const F = { ...FOERDERUNG_STANDARD, ...(C.FOERDERUNG || {}) };
const PROFILE = C.ANLAGE_PROFILE;
const S = C.STANDARD;
const EIGENE = { id: 'eigene', name: 'Eigene' };

const $ = (sel) => document.querySelector(sel);
const bewegungAus = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Farben (wie rechner.css / Zinseszins-Slide)
const FARBE = {
  eigen: '#9E968B', zulagen: '#00869C', ertrag: '#B8860B', kinder: '#9E1F4A',
  petrol: '#00869C', grau: '#B4BEC2', ink: '#1F2429', ink2: '#5B636B', linie: '#E3E8E7', linie2: '#CFD8D7',
};
const alpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// ───────────── Zahlen formatieren ─────────────
const NBSP = ' ';
const nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro = (v) => `${nf0.format(Math.round(v))}${NBSP}€`;
const runden = (v) => (Math.abs(v) >= 10000 ? Math.round(v / 100) * 100 : Math.round(v / 10) * 10);
const euroRund = (v) => `${nf0.format(runden(v))}${NBSP}€`;
const prozent = (v) => `${nf0.format(v)}${NBSP}%`;
const zinsText = (v) => `${Number.isInteger(v) ? nf0.format(v) : nf1.format(v)}${NBSP}%`;
const kompakt = (v) => {
  if (Math.abs(v) >= 1e6) return `${nf1.format(v / 1e6)}${NBSP}Mio.${NBSP}€`;
  if (Math.abs(v) >= 1000) return `${nf0.format(v / 1000)}${NBSP}Tsd.${NBSP}€`;
  return euro(v);
};
const begrenzen = (v, min, max) => Math.min(max, Math.max(min, v));

// ───────────── Zustand + Link ─────────────
const zustand = {
  alter: S.alter, rente: S.rente, beitrag: S.beitrag, kinder: [], k25: false,
  profil: S.profil, eigeneRendite: S.eigeneRendite, kosten: S.kosten, inflation: S.inflation, fuer: '',
};

function ausLink() {
  const q = new URLSearchParams(location.search);
  const zahl = (k, min, max, standard) => {
    const v = parseFloat((q.get(k) || '').replace(',', '.'));
    return Number.isFinite(v) ? begrenzen(v, min, max) : standard;
  };
  zustand.alter = Math.round(zahl('alter', 16, 60, S.alter));
  zustand.rente = Math.round(zahl('rente', 63, 70, S.rente));
  zustand.beitrag = Math.round(zahl('beitrag', 10, 1000, S.beitrag));
  zustand.kinder = (q.get('kinder') || '').split(',').filter((x) => x.trim() !== '')
    .map(Number).filter(Number.isFinite).map((a) => begrenzen(Math.round(a), 0, 24)).slice(0, 6);
  zustand.k25 = q.get('k25') === '1';
  const p = q.get('profil');
  zustand.profil = PROFILE.some((x) => x.id === p) || p === EIGENE.id ? p : S.profil;
  zustand.eigeneRendite = Math.round(zahl('rendite', 0, 10, S.eigeneRendite) * 2) / 2;
  zustand.kosten = Math.round(zahl('kosten', 0, 2, S.kosten) * 10) / 10;
  zustand.inflation = Math.round(zahl('inflation', 0, 4, S.inflation) * 2) / 2;
  zustand.fuer = (q.get('fuer') || '').slice(0, 40);
}

function alsQuery() {
  const q = new URLSearchParams();
  q.set('alter', zustand.alter);
  q.set('beitrag', zustand.beitrag);
  q.set('profil', zustand.profil);
  if (zustand.profil === EIGENE.id) q.set('rendite', zustand.eigeneRendite);
  q.set('kosten', zustand.kosten);
  q.set('rente', zustand.rente);
  if (zustand.kinder.length) q.set('kinder', zustand.kinder.join(','));
  if (zustand.k25) q.set('k25', '1');
  if (zustand.inflation !== S.inflation) q.set('inflation', zustand.inflation);
  if (zustand.fuer.trim()) q.set('fuer', zustand.fuer.trim());
  return q.toString().replace(/%2C/g, ',');
}

function teilLink() {
  const basis = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : C.OEFFENTLICHE_URL;
  return `${basis}?${alsQuery()}`;
}

let linkTimer;
function linkMerken() {
  clearTimeout(linkTimer);
  linkTimer = setTimeout(() => {
    try { history.replaceState(null, '', `?${alsQuery()}`); } catch { /* z. B. file:// */ }
  }, 250);
}

// ───────────── Ableitungen ─────────────
const profilVon = (id) => (id === EIGENE.id ? { ...EIGENE, rendite: zustand.eigeneRendite } : PROFILE.find((p) => p.id === id));
const aktuellesProfil = () => profilVon(zustand.profil);
const kinderBis = () => (zustand.k25 ? F.kindergeldBisAusbildung : F.kindergeldBis);

function params(extra = {}) {
  return {
    alter: zustand.alter,
    rentenalter: zustand.rente,
    beitragMonat: zustand.beitrag,
    kinder: zustand.kinder,
    kinderBis25: zustand.k25,
    rendite: aktuellesProfil().rendite / 100,
    kosten: zustand.kosten / 100,
    ...extra,
  };
}

// ───────────── Eingaben ─────────────
const ein = {
  alter: $('#in-alter'),
  beitrag: $('#in-beitrag'),
  beitragZahl: $('#in-beitrag-zahl'),
  eigene: $('#in-eigene'),
  rente: $('#in-rente'),
  kosten: $('#in-kosten'),
  inflation: $('#in-inflation'),
  k25: $('#in-k25'),
  fuer: $('#in-fuer'),
};

function fuellen(input) {
  const min = +input.min;
  const max = +input.max;
  const v = begrenzen(+input.value, min, max);
  input.style.setProperty('--fill', `${((v - min) / (max - min)) * 100}%`);
}

function regler(input, schluessel, umrechnen = Number) {
  input.addEventListener('input', () => {
    zustand[schluessel] = umrechnen(input.value);
    aktualisieren();
  });
}

regler(ein.alter, 'alter');
regler(ein.beitrag, 'beitrag');
regler(ein.eigene, 'eigeneRendite');
regler(ein.rente, 'rente');
regler(ein.kosten, 'kosten');
regler(ein.inflation, 'inflation');

ein.beitragZahl.addEventListener('input', () => {
  const v = parseInt(ein.beitragZahl.value, 10);
  if (Number.isFinite(v) && v >= 10 && v <= 1000) {
    zustand.beitrag = v;
    aktualisieren({ zahlFeldNichtSetzen: true });
  }
});
ein.beitragZahl.addEventListener('change', () => {
  const v = parseInt(ein.beitragZahl.value, 10);
  zustand.beitrag = Number.isFinite(v) ? begrenzen(v, 10, 1000) : zustand.beitrag;
  aktualisieren();
});
ein.k25.addEventListener('change', () => { zustand.k25 = ein.k25.checked; aktualisieren(); });
ein.fuer.addEventListener('input', () => { zustand.fuer = ein.fuer.value.slice(0, 40); fuerZeigen(); linkMerken(); });

$('#zuruecksetzen').addEventListener('click', () => {
  Object.assign(zustand, {
    alter: S.alter, rente: S.rente, beitrag: S.beitrag, kinder: [], k25: false,
    profil: S.profil, eigeneRendite: S.eigeneRendite, kosten: S.kosten, inflation: S.inflation,
  });
  kinderZeichnen();
  aktualisieren();
  zeigeToast('Zurückgesetzt');
});

// Kinder
function kinderZeichnen() {
  const liste = $('#kinder-liste');
  liste.replaceChildren();
  zustand.kinder.forEach((alter, i) => {
    const li = document.createElement('li');
    li.className = 'kind';
    const label = document.createElement('label');
    label.htmlFor = `kind-${i}`;
    label.textContent = `Kind ${i + 1}`;
    const feld = document.createElement('input');
    feld.type = 'number';
    feld.id = `kind-${i}`;
    feld.min = '0';
    feld.max = '24';
    feld.inputMode = 'numeric';
    feld.value = alter;
    const einheit = document.createElement('span');
    einheit.textContent = 'J.';
    einheit.title = 'Jahre alt';
    const weg = document.createElement('button');
    weg.type = 'button';
    weg.setAttribute('aria-label', `Kind ${i + 1} entfernen`);
    weg.innerHTML = '<svg aria-hidden="true"><use href="#i-x"/></svg>';

    feld.addEventListener('input', () => {
      const v = parseInt(feld.value, 10);
      if (Number.isFinite(v)) { zustand.kinder[i] = begrenzen(v, 0, 24); aktualisieren(); }
    });
    feld.addEventListener('change', () => { feld.value = zustand.kinder[i]; });
    weg.addEventListener('click', () => {
      zustand.kinder.splice(i, 1);
      kinderZeichnen();
      aktualisieren();
      $('#kind-plus').focus();
    });
    li.append(label, feld, einheit, weg);
    liste.append(li);
  });
  $('#kind-plus').hidden = zustand.kinder.length >= 6;
}
$('#kind-plus').addEventListener('click', () => {
  zustand.kinder.push(3);
  kinderZeichnen();
  aktualisieren();
  const neu = $(`#kind-${zustand.kinder.length - 1}`);
  neu.focus();
  neu.select();
});

// Profil-Auswahl: Pills in den Eingaben + Legende am Diagramm, beide synchron
const pillInputs = [];
for (const p of [...PROFILE, EIGENE]) {
  const label = document.createElement('label');
  label.className = 'pill';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'profil';
  radio.value = p.id;
  const text = document.createElement('span');
  text.textContent = p.name;
  if (p.rendite != null) {
    const i = document.createElement('i');
    i.textContent = zinsText(p.rendite);
    text.append(' ', i);
  }
  radio.addEventListener('change', () => { if (radio.checked) { zustand.profil = p.id; aktualisieren(); } });
  label.append(radio, text);
  $('#profil-pills').append(label);
  pillInputs.push(radio);
}

const legendenKnoepfe = [];
for (const p of [...PROFILE, EIGENE]) {
  const knopf = document.createElement('button');
  knopf.type = 'button';
  knopf.setAttribute('role', 'radio');
  knopf.dataset.id = p.id;
  const sw = document.createElement('i');
  sw.className = 'sw linie';
  const text = document.createElement('span');
  knopf.append(sw, text);
  knopf.addEventListener('click', () => { zustand.profil = p.id; aktualisieren(); });
  $('#profil-legende').append(knopf);
  legendenKnoepfe.push(knopf);
}

function eingabenAbgleichen({ zahlFeldNichtSetzen = false } = {}) {
  ein.alter.value = zustand.alter;
  ein.beitrag.value = begrenzen(zustand.beitrag, 10, 300);
  if (!zahlFeldNichtSetzen) ein.beitragZahl.value = zustand.beitrag;
  ein.eigene.value = zustand.eigeneRendite;
  ein.rente.value = zustand.rente;
  ein.kosten.value = zustand.kosten;
  ein.inflation.value = zustand.inflation;
  ein.k25.checked = zustand.k25;
  if (document.activeElement !== ein.fuer) ein.fuer.value = zustand.fuer;
  for (const r of [ein.alter, ein.beitrag, ein.eigene, ein.rente, ein.kosten, ein.inflation]) fuellen(r);

  $('#out-alter').textContent = `${zustand.alter} Jahre`;
  $('#out-rente').textContent = `mit ${zustand.rente}`;
  $('#out-kosten').textContent = `${nf1.format(zustand.kosten)}${NBSP}%`;
  $('#out-inflation').textContent = `${nf1.format(zustand.inflation)}${NBSP}%`;
  $('#out-eigene').textContent = zinsText(zustand.eigeneRendite);
  document.querySelectorAll('[data-out="rente"]').forEach((n) => { n.textContent = zustand.rente; });

  for (const r of pillInputs) r.checked = r.value === zustand.profil;
  $('#feld-eigene').hidden = zustand.profil !== EIGENE.id;
  $('#info-profil').textContent = zustand.profil === EIGENE.id
    ? 'Eigene Annahme für die Wertentwicklung pro Jahr, vor Kosten.'
    : aktuellesProfil().text || '';

  $('#info-bonus').hidden = !(zustand.alter < F.startbonusVorAlter);

  // Beitrag: was legt der Staat im ersten Jahr drauf?
  const eJahr = zustand.beitrag * 12;
  const nKinder = kinderMitAnspruch(zustand.kinder, 1, kinderBis());
  const zulage = grundzulage(eJahr, F) + kinderzulage(eJahr, nKinder, F);
  let info = `<b>${euro(eJahr)}</b> im Jahr – der Staat legt <b>${euro(zulage)}</b> drauf.`;
  if (zustand.beitrag * 12 <= F.stufe1Grenze) info += ' Bis 30 € im Monat gibt es 50 % Grundzulage.';
  else if (eJahr > F.hoechstbetrag) info += ' Über 150 € im Monat steigt die Grundzulage nicht weiter.';
  $('#info-beitrag').innerHTML = info;

  // Kinder
  if (!zustand.kinder.length) {
    $('#info-kinder').textContent = 'Je Kind bis zu 300 € Kinderzulage im Jahr: 1 € vom Staat für jeden Euro, den du einzahlst.';
  } else {
    const kz = kinderzulage(eJahr, nKinder, F);
    const zuAlt = zustand.kinder.length - nKinder;
    let t = `Kinderzulage jetzt: <b>${euro(kz)}</b> im Jahr, bis zum ${kinderBis()}. Geburtstag.`;
    if (zuAlt > 0) t += ` ${zuAlt === 1 ? 'Ein Kind ist' : `${zuAlt} Kinder sind`} schon zu alt dafür.`;
    if (eJahr < F.kinderzulageMax && nKinder > 0) {
      t += ' Die volle Kinderzulage gibt es ab 25 € im Monat.';
    }
    $('#info-kinder').innerHTML = t;
  }

  for (const k of legendenKnoepfe) {
    const p = profilVon(k.dataset.id);
    k.hidden = p.id === EIGENE.id && zustand.profil !== EIGENE.id;
    k.querySelector('span').textContent = `${p.name} ${zinsText(p.rendite)}`;
    k.setAttribute('aria-checked', String(p.id === zustand.profil));
  }
}

// ───────────── Ergebnis ─────────────
function zaehlen(node, ziel, format) {
  const start = node._wert ?? ziel;
  cancelAnimationFrame(node._raf);
  if (bewegungAus || Math.abs(start - ziel) < 1) {
    node._wert = ziel;
    node.textContent = format(ziel);
    return;
  }
  const t0 = performance.now();
  const schritt = (t) => {
    const k = Math.min(1, (t - t0) / 450);
    node._wert = start + (ziel - start) * (1 - Math.pow(1 - k, 3));
    node.textContent = format(node._wert);
    if (k < 1) node._raf = requestAnimationFrame(schritt);
  };
  node._raf = requestAnimationFrame(schritt);
}

// Gestapelter Balken: Beitrag | Zulagen | Zinseszins. Beschriftung nur, wenn sie ins Segment passt.
function balkenSetzen(balken, werte) {
  const segs = balken.querySelectorAll('.seg');
  const summe = werte.reduce((s, w) => s + Math.max(0, w), 0) || 1;
  segs.forEach((seg, i) => {
    seg.style.flex = `${Math.max(0, werte[i]) / summe} 1 0px`;
    seg.title = seg.dataset.label ? `${seg.dataset.label}: ${euroRund(werte[i])}` : '';
  });
  requestAnimationFrame(() => {
    const breite = balken.clientWidth - 2 * (segs.length - 1);
    segs.forEach((seg, i) => {
      const span = seg.firstElementChild;
      if (!span) return;
      const platz = (breite * Math.max(0, werte[i])) / summe;
      span.classList.toggle('versteckt', span.scrollWidth + 6 > platz);
    });
  });
}
const ergBalken = $('#erg-balken');
['Dein Beitrag', 'Zulagen', 'Erträge aus Zinseszins'].forEach((l, i) => { ergBalken.children[i].dataset.label = l; });

function ergebnisZeichnen(v) {
  const e = v[v.length - 1];
  const jahre = e.jahr;
  zaehlen($('#erg-kapital'), e.kapital, (x) => euroRund(x));
  $('#mini-kapital').textContent = `≈${NBSP}${euroRund(e.kapital)}`;

  const p = aktuellesProfil();
  $('#erg-meta').textContent = `in ${jahre} Jahren · ${euro(zustand.beitrag)} im Monat · ${p.id === EIGENE.id ? 'eigene Annahme' : p.name} ${zinsText(p.rendite)}${NBSP}p.${NBSP}a. · nach ${nf1.format(zustand.kosten)}${NBSP}% Kosten`;

  const kk = $('#erg-kaufkraft');
  kk.hidden = zustand.inflation === 0;
  kk.innerHTML = `Kaufkraft heute: <b>≈${NBSP}${euroRund(e.kapital * kaufkraftFaktor(jahre, zustand.inflation / 100))}</b><br>bei ${nf1.format(zustand.inflation)}${NBSP}% Inflation pro Jahr`;

  balkenSetzen(ergBalken, [e.eigen, e.zulagen, e.ertraege]);

  $('#k-eigen').textContent = euro(e.eigen);
  $('#k-eigen-sub').textContent = `${euro(zustand.beitrag)} × ${jahre * 12} Monate`;
  $('#k-zulagen').textContent = euro(e.zulagen);
  const mitBonus = zustand.alter < F.startbonusVorAlter;
  const mitKindern = zustand.kinder.some((a) => a < kinderBis());
  $('#k-zulagen-sub').textContent = mitBonus && mitKindern ? 'inkl. Kinderzulage und Startbonus'
    : mitBonus ? `inkl. ${euro(F.startbonus)} Startbonus`
      : mitKindern ? 'inkl. Kinderzulage'
        : `${euro(grundzulage(zustand.beitrag * 12, F))} pro Jahr`;
  $('#k-ertrag').textContent = euroRund(e.ertraege);
  $('#k-ertrag-sub').textContent = e.kapital > 0 && e.ertraege > 0 ? `${prozent((e.ertraege / e.kapital) * 100)} deines Kapitals` : 'bei dieser Annahme';
  const quote = e.eigen > 0 ? e.zulagen / e.eigen : 0;
  $('#k-quote').textContent = prozent(quote * 100);
  $('#k-quote-sub').textContent = quote >= 1 ? 'mehr, als du selbst einzahlst' : `${nf0.format(quote * 100)} Cent je eingezahltem Euro`;
  const hebel = e.eigen > 0 ? e.kapital / e.eigen : 0;
  $('#k-hebel').textContent = `×${nf1.format(hebel)}`;
  $('#k-hebel-sub').textContent = `aus 1${NBSP}€ werden ${nf2.format(hebel)}${NBSP}€`;

  clearTimeout(ergebnisZeichnen.timer);
  ergebnisZeichnen.timer = setTimeout(() => {
    $('#sr-ergebnis').textContent = `Kapital mit ${zustand.rente}: etwa ${euroRund(e.kapital)}. Eingezahlt ${euro(e.eigen)}, Zulagen ${euro(e.zulagen)}, Zinseszins etwa ${euroRund(e.ertraege)}.`;
  }, 700);

  $('#erg-satz').innerHTML = `<svg aria-hidden="true"><use href="#i-funkeln"/></svg><span>Du zahlst <b>${euro(e.eigen)}</b> ein, der Staat <b>${euro(e.zulagen)}</b>. `
    + (e.ertraege > 0 ? '<b>Der Rest ist Zinseszins.</b></span>' : 'Bei dieser Annahme gibt es keine Erträge.</span>');
}

// ───────────── Diagramme ─────────────
await document.fonts.ready;

Chart.defaults.font.family = "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = FARBE.ink2;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.devicePixelRatio = Math.max(2, window.devicePixelRatio || 1);
Chart.defaults.animation.duration = bewegungAus ? 0 : 450;
Chart.defaults.plugins.legend.display = false;

const tooltipStil = {
  backgroundColor: '#FFFFFF',
  borderColor: FARBE.linie2,
  borderWidth: 1,
  titleColor: FARBE.ink2,
  bodyColor: FARBE.ink,
  footerColor: FARBE.ink,
  titleFont: { size: 13, weight: '600' },
  bodyFont: { size: 14, weight: '700' },
  footerFont: { size: 14, weight: '800' },
  padding: 12,
  cornerRadius: 12,
  caretSize: 0,
  boxWidth: 14,
  boxHeight: 3,
  boxPadding: 6,
};

// Senkrechte Haarlinie an der Stelle des Tooltips
const fadenkreuz = {
  id: 'fadenkreuz',
  afterDatasetsDraw(chart) {
    const aktiv = chart.tooltip?.getActiveElements?.() ?? [];
    if (!aktiv.length) return;
    const { ctx, chartArea: { top, bottom } } = chart;
    const x = aktiv[0].element.x;
    ctx.save();
    ctx.strokeStyle = alpha(FARBE.ink, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, top);
    ctx.lineTo(Math.round(x) + 0.5, bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function pille(ctx, text, x, y, ausrichtung, { fett = true, farbe = FARBE.ink } = {}) {
  ctx.save();
  ctx.font = `${fett ? 800 : 600} 12px ${Chart.defaults.font.family}`;
  const b = ctx.measureText(text).width + 16;
  const h = 22;
  const links = ausrichtung === 'rechts' ? x - b : x;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = FARBE.linie2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(links, y, b, h, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = farbe;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, links + 8, y + h / 2 + 0.5);
  ctx.restore();
}

// Kipppunkt im Wachstums-Diagramm
const kippMarke = {
  id: 'kippMarke',
  afterDatasetsDraw(chart, _args, opt) {
    if (opt.index == null) return;
    const { ctx, chartArea, scales: { x } } = chart;
    const px = Math.round(x.getPixelForValue(opt.index)) + 0.5;
    ctx.save();
    ctx.strokeStyle = alpha(FARBE.ink, 0.55);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, chartArea.top + 26);
    ctx.lineTo(px, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
    const rechts = px > chartArea.left + chartArea.width * 0.6;
    pille(ctx, opt.text, rechts ? px + 8 : px - 8, chartArea.top, rechts ? 'rechts' : 'links');
  },
};

// Endbeschriftung der Linien (Profil-Vergleich), mit Mindestabstand und Führungslinie
const endLabels = {
  id: 'endLabels',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const labels = [];
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden || !ds.endLabel) return;
      const p = meta.data[meta.data.length - 1];
      if (!p) return;
      labels.push({ y: p.y, py: p.y, px: p.x, text: ds.endLabel, aktiv: ds.aktiv });
    });
    labels.sort((a, b) => a.y - b.y);
    const abstand = 20;
    for (let i = 1; i < labels.length; i++) labels[i].y = Math.max(labels[i].y, labels[i - 1].y + abstand);
    const unten = chartArea.bottom - 4;
    if (labels.length && labels[labels.length - 1].y > unten) {
      labels[labels.length - 1].y = unten;
      for (let i = labels.length - 2; i >= 0; i--) labels[i].y = Math.min(labels[i].y, labels[i + 1].y - abstand);
    }
    ctx.save();
    const lx = chartArea.right + 14;
    for (const l of labels) {
      ctx.strokeStyle = alpha(FARBE.ink, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.px + 6, l.py);
      ctx.lineTo(lx - 4, l.y);
      ctx.stroke();
      ctx.font = `${l.aktiv ? 800 : 600} 12.5px ${Chart.defaults.font.family}`;
      ctx.fillStyle = l.aktiv ? FARBE.ink : FARBE.ink2;
      ctx.textBaseline = 'middle';
      ctx.fillText(l.text, lx, l.y);
    }
    ctx.restore();
  },
};

// Hilfslinien bei 30 € und 150 € (Förderquote)
const foerderMarken = {
  id: 'foerderMarken',
  beforeDatasetsDraw(chart, _args, opt) {
    const { ctx, chartArea, scales: { x } } = chart;
    ctx.save();
    for (const m of opt.marken || []) {
      const px = Math.round(x.getPixelForValue(m.x)) + 0.5;
      ctx.strokeStyle = FARBE.linie2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, chartArea.top + 26);
      ctx.lineTo(px, chartArea.bottom);
      ctx.stroke();
      pille(ctx, m.text, px + 6, chartArea.top, 'links', { fett: false, farbe: FARBE.ink2 });
    }
    ctx.restore();
  },
};

const achseY = {
  beginAtZero: true,
  grid: { color: FARBE.linie },
  border: { display: false },
  ticks: { maxTicksLimit: 6, callback: (v) => kompakt(v), padding: 8 },
};
const achseAlter = {
  grid: { display: false },
  border: { color: FARBE.linie2 },
  ticks: { maxRotation: 0, autoSkipPadding: 18, padding: 6 },
  title: { display: true, text: 'Alter', color: FARBE.ink2, font: { size: 12, weight: '700' } },
};

function flaeche(label, farbe, fill) {
  return {
    label, data: [], fill, borderColor: farbe, backgroundColor: alpha(farbe, 0.5), borderWidth: 2,
    pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: '#fff', pointBackgroundColor: farbe,
    tension: 0,
  };
}

const wachstumChart = new Chart($('#c-wachstum'), {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      flaeche('Dein Beitrag', FARBE.eigen, 'origin'),
      flaeche('Zulagen', FARBE.zulagen, '-1'),
      flaeche('Zinseszins', FARBE.ertrag, '-1'),
    ],
  },
  options: {
    interaction: { mode: 'index', intersect: false },
    scales: { x: achseAlter, y: { ...achseY, stacked: true, grace: '8%' } },
    layout: { padding: { top: 4 } },
    plugins: {
      kippMarke: {},
      tooltip: {
        ...tooltipStil,
        itemSort: (a, b) => b.datasetIndex - a.datasetIndex,
        callbacks: {
          title: (items) => `Mit ${items[0].label} · nach ${items[0].dataIndex} Jahren`,
          label: (c) => ` ${euroRund(c.raw)}  ${c.dataset.label}`,
          labelColor: (c) => ({ borderColor: c.dataset.borderColor, backgroundColor: c.dataset.borderColor }),
          footer: (items) => `Kapital ≈ ${euroRund(items.reduce((s, i) => s + i.raw, 0))}`,
        },
      },
    },
  },
  plugins: [fadenkreuz, kippMarke],
});

const profilChart = new Chart($('#c-profile'), {
  type: 'line',
  data: { labels: [], datasets: [] },
  options: {
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { right: 124, top: 10 } },
    scales: { x: achseAlter, y: { ...achseY, grace: '4%' } },
    plugins: {
      tooltip: {
        ...tooltipStil,
        itemSort: (a, b) => b.raw - a.raw,
        callbacks: {
          title: (items) => `Mit ${items[0].label} · nach ${items[0].dataIndex} Jahren`,
          label: (c) => ` ${euroRund(c.raw)}  ${c.dataset.label}`,
          labelColor: (c) => ({ borderColor: c.dataset.borderColor, backgroundColor: c.dataset.borderColor }),
        },
      },
    },
  },
  plugins: [fadenkreuz, endLabels],
});

const quoteChart = new Chart($('#c-quote'), {
  type: 'line',
  data: { datasets: [] },
  options: {
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
    layout: { padding: { top: 4, right: 8 } },
    scales: {
      x: {
        type: 'linear', min: 10, max: 300,
        grid: { display: false },
        border: { color: FARBE.linie2 },
        ticks: { stepSize: 50, maxRotation: 0, callback: (v) => `${v}${NBSP}€`, padding: 6 },
        title: { display: true, text: 'Monatsbeitrag', color: FARBE.ink2, font: { size: 12, weight: '700' } },
      },
      y: { ...achseY, grace: '12%', ticks: { maxTicksLimit: 6, padding: 8, callback: (v) => `${v}${NBSP}%` } },
    },
    plugins: {
      foerderMarken: { marken: [] },
      tooltip: {
        ...tooltipStil,
        filter: (item) => !item.dataset.markierung,
        callbacks: {
          title: (items) => `${items[0].parsed.x}${NBSP}€ im Monat`,
          label: (c) => ` ${prozent(c.parsed.y)}  ${c.dataset.label}`,
          labelColor: (c) => ({ borderColor: c.dataset.borderColor, backgroundColor: c.dataset.borderColor }),
        },
      },
    },
  },
  plugins: [fadenkreuz, foerderMarken],
});

const alleCharts = [wachstumChart, profilChart, quoteChart];

// Wachstum
function wachstumZeichnen(v) {
  const kipp = kipppunkt(v);
  wachstumChart.data.labels = v.map((z) => z.alter);
  wachstumChart.data.datasets[0].data = v.map((z) => z.eigen);
  wachstumChart.data.datasets[1].data = v.map((z) => z.zulagen);
  wachstumChart.data.datasets[2].data = v.map((z) => Math.max(0, z.ertraege));
  wachstumChart.options.plugins.kippMarke = kipp ? { index: kipp.jahr, text: `Kipppunkt mit ${kipp.alter}` } : {};
  wachstumChart.update();

  $('#txt-kipp').innerHTML = kipp
    ? `<b>Ab ${kipp.alter} arbeitet dein Geld mehr als du:</b> Die Erträge aus Zinseszins sind dann höher als alles, was du selbst eingezahlt hast.`
    : `Bis ${zustand.rente} holen die Erträge deine Einzahlungen noch nicht ein. Je früher du startest, desto stärker wirkt der Zinseszins.`;

  const e = v[v.length - 1];
  const n = e.jahr >= 20 ? 10 : Math.floor(e.jahr / 2);
  if (n >= 2 && e.kapital > 0) {
    const anteil = (e.kapital - v[e.jahr - n].kapital) / e.kapital;
    $('#txt-endspurt').innerHTML = `<b>Der Zinseszins braucht Zeit:</b> ${prozent(anteil * 100)} deines Kapitals entstehen erst in den letzten ${n} Jahren.`;
  } else {
    $('#txt-endspurt').textContent = '';
  }
}

// Tabelle
function tabelleZeichnen(v) {
  const body = $('#tabelle-body');
  body.replaceChildren();
  const zeilen = v.filter((z) => z.jahr > 0 && (z.jahr % 5 === 0 || z.jahr === v.length - 1));
  for (const z of zeilen) {
    const tr = document.createElement('tr');
    for (const [wert, klasse] of [[`${z.alter}`], [euro(z.eigen)], [euro(z.zulagen)], [euroRund(z.ertraege)], [euroRund(z.kapital), 'kapital']]) {
      const td = document.createElement('td');
      td.textContent = wert;
      if (klasse) td.className = klasse;
      tr.append(td);
    }
    body.append(tr);
  }
}
$('#tabelle-knopf').addEventListener('click', () => {
  const t = $('#tabelle');
  t.hidden = !t.hidden;
  $('#tabelle-knopf').setAttribute('aria-expanded', String(!t.hidden));
  $('#tabelle-knopf span').textContent = t.hidden ? 'Werte als Tabelle' : 'Tabelle ausblenden';
});

// Warten kostet
function wartenZeichnen() {
  const laufzeit = zustand.rente - zustand.alter;
  const schritte = laufzeit >= 15 ? [0, 5, 10] : laufzeit >= 6 ? [0, 2, 4] : [0, 1, 2];
  const basis = params();
  const w = wartenKostet(basis, schritte, F);
  const max = w[0].kapital || 1;
  const liste = $('#warten-liste');
  liste.replaceChildren();
  w.forEach((x, i) => {
    const zeile = document.createElement('div');
    zeile.className = 'warten-zeile';
    const kopf = document.createElement('div');
    kopf.className = 'wz-kopf';
    const titel = document.createElement('span');
    titel.className = 'wz-titel';
    titel.innerHTML = `${i === 0 ? 'Start heute' : `Start in ${x.warten} Jahren`} <i>· mit ${x.alter}</i>`;
    const wert = document.createElement('span');
    wert.className = 'wz-wert';
    wert.innerHTML = `≈${NBSP}${euroRund(x.kapital)}${i > 0 ? `<small>−${euroRund(max - x.kapital)}</small>` : ''}`;
    kopf.append(titel, wert);
    const balken = document.createElement('div');
    balken.className = 'balken';
    balken.style.width = `${Math.max(1, (x.kapital / max) * 100)}%`;
    balken.innerHTML = '<span class="seg eigen"></span><span class="seg zulagen"></span><span class="seg ertrag"></span>';
    ['Dein Beitrag', 'Zulagen', 'Zinseszins'].forEach((l, j) => { balken.children[j].dataset.label = l; });
    zeile.append(kopf, balken);
    liste.append(zeile);
    balkenSetzen(balken, [x.eigen, x.zulagen, x.ertraege]);
  });

  const letzte = w[w.length - 1];
  const txt = $('#txt-warten');
  if (w.length < 2) { txt.hidden = true; return; }
  txt.hidden = false;
  const verlust = max - letzte.kapital;
  const weniger = w[0].eigen - letzte.eigen;
  const noetig = noetigerBeitrag(spaeterStarten(basis, letzte.warten), max, F);
  const aufholen = Number.isFinite(noetig)
    ? ` Für dasselbe Ergebnis bräuchtest du dann <b>${euro(Math.ceil(noetig))} statt ${euro(zustand.beitrag)}</b> im Monat.`
    : ' Dasselbe Ergebnis wäre dann kaum noch erreichbar.';
  txt.innerHTML = `<svg aria-hidden="true"><use href="#i-funkeln"/></svg><span>Wartest du ${letzte.warten} Jahre, hast du mit ${zustand.rente} rund <b>${euroRund(verlust)} weniger</b>, obwohl du nur ${euro(weniger)} weniger einzahlst.${aufholen}</span>`;
}

// Anlage-Profile
function profileZeichnen() {
  const liste = zustand.profil === EIGENE.id ? [...PROFILE, profilVon(EIGENE.id)] : PROFILE;
  let labels = [];
  const endwerte = [];
  profilChart.data.datasets = liste.map((p) => {
    const v = verlauf(params({ rendite: p.rendite / 100 }), F);
    labels = v.map((z) => z.alter);
    const aktiv = p.id === zustand.profil;
    const letzte = v.length - 1;
    endwerte.push(v[letzte].kapital);
    return {
      label: `${p.name} ${zinsText(p.rendite)}`,
      data: v.map((z) => z.kapital),
      aktiv,
      endLabel: `${zinsText(p.rendite)} · ${kompakt(v[letzte].kapital)}`,
      borderColor: aktiv ? FARBE.petrol : FARBE.grau,
      backgroundColor: alpha(FARBE.petrol, 0.08),
      fill: aktiv ? 'origin' : false,
      borderWidth: aktiv ? 3 : 2,
      order: aktiv ? 0 : 1,
      tension: 0,
      pointRadius: (c) => (c.dataIndex === letzte ? 4.5 : 0),
      pointBackgroundColor: aktiv ? FARBE.petrol : FARBE.grau,
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointHoverRadius: 5,
      pointHoverBorderWidth: 2,
    };
  });
  profilChart.data.labels = labels;
  profilChart.options.layout.padding.right = innerWidth < 640 ? 104 : 124;
  profilChart.update();

  const jahre = zustand.rente - zustand.alter;
  $('#profile-sub').textContent = `${euro(zustand.beitrag)} im Monat · ${jahre} Jahre · nach ${nf1.format(zustand.kosten)}${NBSP}% Kosten`;
  const min = Math.min(...endwerte.slice(0, PROFILE.length));
  const max = Math.max(...endwerte.slice(0, PROFILE.length));
  const rMin = Math.min(...PROFILE.map((p) => p.rendite));
  const rMax = Math.max(...PROFILE.map((p) => p.rendite));
  $('#txt-profile').innerHTML = `<b>Gleicher Beitrag, anderer Zins:</b> Zwischen ${zinsText(rMin)} und ${zinsText(rMax)} liegen mit ${zustand.rente} rund ${euroRund(max - min)}. Ein paar Prozentpunkte machen über die Zeit den größten Unterschied.`;
}

// Förderquote
function quoteZeichnen() {
  const nKinder = kinderMitAnspruch(zustand.kinder, 1, kinderBis());
  const punkte = (n) => {
    const d = [];
    for (let b = 10; b <= 300; b += 1) d.push({ x: b, y: foerderquote(b, n, F) * 100 });
    return d;
  };
  const linie = (label, farbe, n) => ({
    label, data: punkte(n), borderColor: farbe, backgroundColor: farbe, borderWidth: 2, tension: 0,
    pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: '#fff', pointBackgroundColor: farbe,
  });
  const b = begrenzen(zustand.beitrag, 10, 300);
  const marke = (farbe, n) => ({
    markierung: true, data: [{ x: b, y: foerderquote(b, n, F) * 100 }], showLine: false,
    pointRadius: 6, pointHoverRadius: 6, pointBackgroundColor: farbe, pointBorderColor: '#fff', pointBorderWidth: 2, borderColor: farbe,
  });
  const ds = [linie('Grundzulage', FARBE.zulagen, 0)];
  const kinderText = nKinder === 1 ? 'Mit deinem Kind' : `Mit deinen ${nKinder} Kindern`;
  if (nKinder > 0) ds.push(linie(kinderText, FARBE.kinder, nKinder));
  ds.push(marke(FARBE.zulagen, 0));
  if (nKinder > 0) ds.push(marke(FARBE.kinder, nKinder));
  quoteChart.data.datasets = ds;
  quoteChart.options.plugins.foerderMarken.marken = innerWidth < 640
    ? [{ x: 30, text: '50 %' }, { x: 150, text: 'max.' }]
    : [{ x: 30, text: 'bis 30 €: 50 %' }, { x: 150, text: 'ab 150 €: Höchstbetrag' }];
  quoteChart.update();

  const leg = $('#quote-legende');
  leg.replaceChildren();
  for (const [text, klasse] of [['Nur Grundzulage', 'zulagen'], ...(nKinder > 0 ? [[kinderText, 'kinder']] : [])]) {
    const li = document.createElement('li');
    li.innerHTML = `<i class="sw linie ${klasse}"></i>`;
    li.append(text);
    leg.append(li);
  }

  const q = foerderquote(zustand.beitrag, 0, F);
  let t = `Bei <b>${euro(zustand.beitrag)} im Monat</b> legt der Staat <b>${nf0.format(q * 100)} Cent</b> auf jeden Euro drauf.`;
  if (nKinder > 0) {
    const qk = foerderquote(zustand.beitrag, nKinder, F);
    t += ` ${kinderText} sind es <b>${prozent(qk * 100)}</b>${qk >= 1 ? ' – mehr, als du selbst einzahlst' : ''}.`;
  }
  t += ' Prozentual am meisten gibt es bis 30 € im Monat, ab 150 € steigt die Zulage nicht weiter.';
  $('#txt-quote').innerHTML = t;
}

// ───────────── Alles neu zeichnen ─────────────
function aktualisieren(opt) {
  eingabenAbgleichen(opt);
  const v = verlauf(params(), F);
  ergebnisZeichnen(v);
  wachstumZeichnen(v);
  tabelleZeichnen(v);
  wartenZeichnen();
  profileZeichnen();
  quoteZeichnen();
  linkMerken();
}

// ───────────── Teilen, PDF, Präsentation ─────────────
function zeigeToast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('sichtbar');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('sichtbar'), 2200);
}

function fuerZeigen() {
  const name = zustand.fuer.trim();
  $('#fuer-zeile').hidden = !name;
  $('#fuer-name').textContent = name;
  document.title = name ? `Modellrechnung für ${name} – Altersvorsorge` : 'Altersvorsorge-Rechner';
}

$('#k-link').addEventListener('click', async () => {
  const link = teilLink();
  try {
    await navigator.clipboard.writeText(link);
    zeigeToast('Link kopiert – du kannst ihn jetzt einfügen');
  } catch {
    window.prompt('Link kopieren:', link);
  }
});

$('#k-whatsapp').addEventListener('click', () => {
  const name = zustand.fuer.trim();
  const text = `${name ? `Hallo ${name}, hier` : 'Hier'} ist deine persönliche Modellrechnung zur Altersvorsorge – mit Zulagen vom Staat und Zinseszins: ${teilLink()}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
});

$('#k-pdf').addEventListener('click', () => window.print());

function druckDatum() {
  const heute = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  $('#druck-datum').textContent = `Erstellt am ${heute}${C.PROFIL.name ? ` von ${C.PROFIL.name}` : ''} · Modellrechnung ohne Garantie`;
}
addEventListener('beforeprint', () => {
  druckDatum();
  wachstumChart.resize(720, 300);
});
addEventListener('afterprint', () => alleCharts.forEach((c) => c.resize()));

function praesentation(an) {
  document.body.classList.toggle('praesi', an);
  const root = document.documentElement;
  if (an && root.requestFullscreen && !document.fullscreenElement) root.requestFullscreen().catch(() => {});
  if (!an && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  requestAnimationFrame(() => aktualisieren());
}
$('#k-praesi').addEventListener('click', () => praesentation(true));
$('#praesi-ende').addEventListener('click', () => praesentation(false));
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('praesi')) praesentation(false);
});
document.addEventListener('keydown', (e) => {
  const ziel = e.target;
  if (ziel instanceof HTMLInputElement && ziel.type !== 'range' && ziel.type !== 'radio' && ziel.type !== 'checkbox') return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'p' || e.key === 'P') praesentation(!document.body.classList.contains('praesi'));
  if (e.key === 'Escape' && document.body.classList.contains('praesi')) praesentation(false);
});

// Mini-Leiste, sobald das Ergebnis nach oben aus dem Bild gescrollt ist
const mini = $('#mini-leiste');
new IntersectionObserver(([eintrag]) => {
  const weg = !eintrag.isIntersecting && eintrag.boundingClientRect.bottom < 0;
  mini.classList.toggle('sichtbar', weg);
  mini.setAttribute('aria-hidden', String(!weg));
  $('#mini-hoch').tabIndex = weg ? 0 : -1;
}).observe($('#ergebnis'));
$('#mini-hoch').addEventListener('click', () => $('#ergebnis').scrollIntoView({ behavior: bewegungAus ? 'auto' : 'smooth', block: 'start' }));

// Beschriftungen in den Balken bei Größenänderung neu prüfen; Breakpoint-abhängige Diagramm-Details
let breiteVorher = innerWidth;
addEventListener('resize', () => {
  clearTimeout(window._rz);
  window._rz = setTimeout(() => {
    if (Math.abs(innerWidth - breiteVorher) > 20) { breiteVorher = innerWidth; aktualisieren(); }
  }, 150);
});

// ───────────── Kontakt + Start ─────────────
function kontaktEinrichten() {
  const P = C.PROFIL;
  $('#kontakt-foto').src = P.foto;
  $('#kontakt-foto').alt = P.name ? `Foto von ${P.name}` : '';
  $('#t-kontakt').textContent = P.name || 'Dein Ansprechpartner';
  $('#kontakt-rolle').textContent = P.rolle || '';
  $('#kontakt-stichwort').textContent = P.stichwort;
  $('#kontakt-wa').href = `https://wa.me/${P.whatsapp}?text=${encodeURIComponent(P.stichwort)}`;
  $('#kontakt-tel').href = `tel:+${P.whatsapp}`;
  $('#kontakt-nummer').textContent = P.telefon;
  $('#kontakt-link').href = C.LINK;
  if (C.ERGO_LOGO) {
    const img = document.createElement('img');
    img.src = C.ERGO_LOGO;
    img.alt = 'ERGO';
    $('#marke').replaceChildren(img);
  }
}

kontaktEinrichten();
ausLink();
kinderZeichnen();
fuerZeigen();
druckDatum();
aktualisieren();
document.documentElement.classList.add('bereit');
