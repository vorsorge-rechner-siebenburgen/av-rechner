// Rechenkern des Altersvorsorge-Rechners – reine Funktionen, laufen im Browser und in Node (Tests).
//
// Rechenweise wie auf der Zinseszins-Slide der Story:
// - Beitrag jeweils am Monatsende, verzinst mit dem gleichwertigen Monatszins (1 + r)^(1/12) − 1
// - Zulagen (und der Startbonus im ersten Jahr) jeweils am Jahresende
// - Kosten mindern die Rendite: Netto = (1 + r) · (1 − Kosten) − 1
// - gleichbleibende Wertentwicklung, vor Steuern, bei gleichbleibender Förderung

// Förderung nach dem Altersvorsorgereformgesetz (Stand 10/2026, gilt ab 01.01.2027)
export const FOERDERUNG_STANDARD = Object.freeze({
  stufe1Grenze: 360,        // auf die ersten 360 € Eigenbeitrag …
  stufe1Satz: 0.5,          // … gibt es 50 %
  hoechstbetrag: 1800,      // auf den Teil bis 1.800 € …
  stufe2Satz: 0.25,         // … gibt es 25 %  → höchstens 540 € Grundzulage
  kinderzulageMax: 300,     // 1 € je eingezahltem Euro, höchstens 300 € je Kind und Jahr
  mindestbeitrag: 120,      // Mindest-Eigenbeitrag pro Jahr für die Zulagen
  startbonus: 200,          // einmalig …
  startbonusVorAlter: 25,   // … wenn der Vertrag vor dem 25. Geburtstag beginnt
  kindergeldBis: 18,        // Kinderzulage, solange Kindergeldanspruch besteht
  kindergeldBisAusbildung: 25,
});

/** Grundzulage für einen Jahres-Eigenbeitrag. */
export function grundzulage(eigenbeitragJahr, f = FOERDERUNG_STANDARD) {
  if (eigenbeitragJahr < f.mindestbeitrag) return 0;
  const stufe1 = Math.min(eigenbeitragJahr, f.stufe1Grenze) * f.stufe1Satz;
  const stufe2 = Math.max(0, Math.min(eigenbeitragJahr, f.hoechstbetrag) - f.stufe1Grenze) * f.stufe2Satz;
  return stufe1 + stufe2;
}

/** Kinderzulage für einen Jahres-Eigenbeitrag und die Zahl der Kinder mit Anspruch in diesem Jahr. */
export function kinderzulage(eigenbeitragJahr, kinderMitAnspruch, f = FOERDERUNG_STANDARD) {
  if (eigenbeitragJahr < f.mindestbeitrag || kinderMitAnspruch <= 0) return 0;
  return Math.min(eigenbeitragJahr, f.kinderzulageMax) * kinderMitAnspruch;
}

/** Zulagen in % des Eigenbeitrags (0,4 = 40 Cent je eingezahltem Euro). */
export function foerderquote(beitragMonat, anzahlKinder = 0, f = FOERDERUNG_STANDARD) {
  const e = beitragMonat * 12;
  if (e <= 0) return 0;
  return (grundzulage(e, f) + kinderzulage(e, anzahlKinder, f)) / e;
}

/** Netto-Rendite nach Kosten. */
export function nettoRendite(rendite, kosten = 0) {
  return (1 + rendite) * (1 - kosten) - 1;
}

/** Anzahl der Kinder, die im Jahr j (1 = erstes Vertragsjahr) noch Anspruch auf Kinderzulage haben. */
export function kinderMitAnspruch(kinderAlter, jahr, bisAlter) {
  return kinderAlter.filter((a) => a + jahr - 1 < bisAlter).length;
}

/**
 * Verlauf Jahr für Jahr.
 * @param {object} p
 * @param {number} p.alter          Alter heute (Vertragsbeginn)
 * @param {number} p.rentenalter    Rentenbeginn
 * @param {number} p.beitragMonat   Eigenbeitrag pro Monat in €
 * @param {number[]} [p.kinder]     Alter der Kinder heute
 * @param {boolean} [p.kinderBis25] Kinderzulage bis 25 statt bis 18 (Ausbildung)
 * @param {number} p.rendite        Wertentwicklung p. a. vor Kosten, z. B. 0.07
 * @param {number} [p.kosten]       Kosten p. a., z. B. 0.01
 * @param {boolean} [p.mitZulagen]  false = ohne jede Förderung rechnen (Vergleich)
 * @param {boolean} [p.startbonus]  Startbonus; Standard: automatisch, wenn alter < 25
 * @returns {{jahr:number, alter:number, eigen:number, zulagen:number, ertraege:number, kapital:number, zulageJahr:number}[]}
 *          Zeile 0 = Vertragsbeginn, dann eine Zeile je Jahresende; Werte kumuliert.
 */
export function verlauf(p, f = FOERDERUNG_STANDARD) {
  const jahre = Math.max(0, Math.round(p.rentenalter - p.alter));
  const kinder = p.kinder ?? [];
  const bis = p.kinderBis25 ? f.kindergeldBisAusbildung : f.kindergeldBis;
  const mitZulagen = p.mitZulagen !== false;
  const bonus = mitZulagen && (p.startbonus ?? p.alter < f.startbonusVorAlter) ? f.startbonus : 0;
  const rNetto = nettoRendite(p.rendite, p.kosten ?? 0);
  const iMonat = Math.pow(1 + rNetto, 1 / 12) - 1;
  const eJahr = p.beitragMonat * 12;

  let kapital = 0;
  let eigen = 0;
  let zulagen = 0;
  const zeilen = [{ jahr: 0, alter: p.alter, eigen: 0, zulagen: 0, ertraege: 0, kapital: 0, zulageJahr: 0 }];

  for (let j = 1; j <= jahre; j++) {
    for (let m = 0; m < 12; m++) {
      kapital = kapital * (1 + iMonat) + p.beitragMonat;
    }
    eigen += eJahr;
    let zulageJahr = 0;
    if (mitZulagen) {
      zulageJahr = grundzulage(eJahr, f) + kinderzulage(eJahr, kinderMitAnspruch(kinder, j, bis), f);
      if (j === 1) zulageJahr += bonus;
    }
    kapital += zulageJahr;
    zulagen += zulageJahr;
    zeilen.push({
      jahr: j,
      alter: p.alter + j,
      eigen,
      zulagen,
      ertraege: kapital - eigen - zulagen,
      kapital,
      zulageJahr,
    });
  }
  return zeilen;
}

/** Endstand des Verlaufs (letzte Zeile). */
export function endstand(p, f = FOERDERUNG_STANDARD) {
  const v = verlauf(p, f);
  return v[v.length - 1];
}

/** Erstes Jahr, in dem die Erträge größer sind als alle Eigenbeiträge – oder null. */
export function kipppunkt(zeilen) {
  return zeilen.find((z) => z.jahr > 0 && z.ertraege > z.eigen) ?? null;
}

/** Kaufkraft-Faktor: 1 € in `jahren` Jahren entspricht so viel in heutigem Geld. */
export function kaufkraftFaktor(jahre, inflation) {
  return 1 / Math.pow(1 + inflation, jahre);
}

/**
 * Szenario „später starten“: gleicher Beitrag und gleicher Rentenbeginn, aber Start erst in `jahre` Jahren.
 * Die Kinder sind dann älter, der Startbonus fällt ggf. weg.
 */
export function spaeterStarten(p, jahre) {
  return {
    ...p,
    alter: p.alter + jahre,
    kinder: (p.kinder ?? []).map((a) => a + jahre),
    startbonus: undefined,
  };
}

/** Warten kostet: Endstände bei Start heute und nach den angegebenen Wartezeiten (nur sinnvolle Laufzeiten). */
export function wartenKostet(p, wartezeiten = [0, 5, 10], f = FOERDERUNG_STANDARD) {
  return wartezeiten
    .map((w) => ({ warten: w, params: spaeterStarten(p, w) }))
    .filter(({ params }) => params.rentenalter - params.alter >= 1)
    .map(({ warten, params }) => ({ warten, alter: params.alter, ...endstand(params, f), jahre: params.rentenalter - params.alter }));
}

/**
 * Monatsbeitrag, mit dem Szenario `p` das Zielkapital erreicht (Bisektion).
 * Gibt Infinity zurück, wenn es auch mit `max` € im Monat nicht reicht.
 */
export function noetigerBeitrag(p, zielKapital, f = FOERDERUNG_STANDARD, max = 10000) {
  const kapitalBei = (b) => endstand({ ...p, beitragMonat: b }, f).kapital;
  if (kapitalBei(max) < zielKapital) return Infinity;
  let lo = 0;
  let hi = max;
  for (let n = 0; n < 60 && hi - lo > 1e-7; n++) {
    const mitte = (lo + hi) / 2;
    if (kapitalBei(mitte) < zielKapital) lo = mitte;
    else hi = mitte;
  }
  return hi;
}
