// node --test rechner/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  grundzulage, kinderzulage, foerderquote, verlauf, endstand, kipppunkt,
  wartenKostet, noetigerBeitrag, kinderMitAnspruch, nettoRendite,
} from '../rechnung.js';

// Ankerwerte aus dem Story-README („Zinseszins – so ist gerechnet“)
const slide = { alter: 27, rentenalter: 67, beitragMonat: 50, rendite: 0.06, kosten: 0 };

test('Zinseszins-Slide: 50 € im Monat + 240 € Zulage, 40 Jahre', () => {
  assert.equal(Math.round(endstand(slide).kapital), 132527);
  assert.equal(Math.round(endstand({ ...slide, rendite: 0.09 }).kapital), 292054);
});

test('Zinseszins-Slide: ohne Zulage', () => {
  assert.equal(Math.round(endstand({ ...slide, mitZulagen: false }).kapital), 95384);
  assert.equal(Math.round(endstand({ ...slide, rendite: 0.09, mitZulagen: false }).kapital), 210962);
});

test('Zinseszins-Slide: eingezahlt 24.000 €, Zulagen 9.600 €', () => {
  const e = endstand(slide);
  assert.equal(e.eigen, 24000);
  assert.equal(e.zulagen, 9600);
  assert.ok(Math.abs(e.eigen + e.zulagen + e.ertraege - e.kapital) < 1e-6);
});

test('Grundzulage', () => {
  assert.equal(grundzulage(600), 240);    // 50 € im Monat
  assert.equal(grundzulage(300), 150);    // 25 € im Monat
  assert.equal(grundzulage(360), 180);    // 30 € im Monat: Ende der 50-%-Stufe
  assert.equal(grundzulage(1800), 540);   // 150 € im Monat: Höchstbetrag
  assert.equal(grundzulage(3600), 540);   // mehr wird nicht gefördert
  assert.equal(grundzulage(120), 60);     // Mindestbeitrag
  assert.equal(grundzulage(100), 0);      // darunter keine Zulage
});

test('Kinderzulage', () => {
  assert.equal(kinderzulage(300, 2), 600);   // 25 € im Monat mit 2 Kindern
  assert.equal(kinderzulage(600, 1), 300);   // höchstens 300 € je Kind
  assert.equal(kinderzulage(200, 1), 200);   // 1:1 unter 300 €
  assert.equal(kinderzulage(100, 2), 0);     // unter Mindestbeitrag
});

test('Rechenbeispiel 25 € mit 2 Kindern: 1.050 € im Jahr', () => {
  const z = verlauf({ alter: 30, rentenalter: 67, beitragMonat: 25, kinder: [3, 6], rendite: 0, kosten: 0 })[1];
  assert.equal(z.eigen + z.zulageJahr, 1050);
});

test('Kinderzulage endet mit 18 bzw. 25', () => {
  assert.equal(kinderMitAnspruch([17], 1, 18), 1);
  assert.equal(kinderMitAnspruch([17], 2, 18), 0);
  assert.equal(kinderMitAnspruch([17], 2, 25), 1);
  // Kind ist 10 → 8 Jahre Kinderzulage à 300 € bei 50 € im Monat
  const e = endstand({ alter: 35, rentenalter: 67, beitragMonat: 50, kinder: [10], rendite: 0, kosten: 0 });
  assert.equal(e.zulagen, 32 * 240 + 8 * 300);
});

test('Startbonus nur bei Start vor 25', () => {
  const basis = { rentenalter: 67, beitragMonat: 50, rendite: 0, kosten: 0 };
  assert.equal(endstand({ ...basis, alter: 24 }).zulagen, 43 * 240 + 200);
  assert.equal(endstand({ ...basis, alter: 25 }).zulagen, 42 * 240);
});

test('Kosten mindern die Rendite', () => {
  assert.ok(Math.abs(nettoRendite(0.07, 0.01) - 0.0593) < 1e-12);
  assert.ok(endstand({ ...slide, kosten: 0.01 }).kapital < endstand(slide).kapital);
});

test('Förderquote', () => {
  assert.equal(foerderquote(30), 0.5);
  assert.equal(foerderquote(50), 0.4);
  assert.equal(foerderquote(150), 0.3);
  assert.equal(foerderquote(25, 2), 2.5);
});

test('Kipppunkt: Erträge überholen die Eigenbeiträge', () => {
  const v = verlauf(slide);
  const k = kipppunkt(v);
  assert.ok(k);
  const vorher = v[k.jahr - 1];
  assert.ok(vorher.ertraege <= vorher.eigen);
  assert.ok(k.ertraege > k.eigen);
  assert.equal(kipppunkt(verlauf({ ...slide, rendite: 0 })), null);
});

test('Warten kostet: später starten bringt weniger', () => {
  const w = wartenKostet({ ...slide, alter: 30 });
  assert.deepEqual(w.map((x) => x.warten), [0, 5, 10]);
  assert.ok(w[0].kapital > w[1].kapital && w[1].kapital > w[2].kapital);
  // zu kurze Laufzeit fällt weg
  assert.deepEqual(wartenKostet({ ...slide, alter: 60 }).map((x) => x.warten), [0, 5]);
});

test('Nötiger Beitrag ergibt rückgerechnet dasselbe Kapital', () => {
  const ziel = endstand({ ...slide, alter: 30 }).kapital;
  const spaet = { ...slide, alter: 40 };
  const b = noetigerBeitrag(spaet, ziel);
  assert.ok(b > 50);
  assert.ok(Math.abs(endstand({ ...spaet, beitragMonat: b }).kapital - ziel) < 1);
  assert.equal(noetigerBeitrag({ ...slide, alter: 66 }, 1e9), Infinity);
});
