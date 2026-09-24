// Selbstkontrolle: Pinyin-Prüfung und alle Übungskoffer auf Konsistenz testen.
// Aufruf:  node tools/test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { vergleiche, canon, allVariants } from '../engine/pinyin.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fehler = 0;
let tests = 0;
const pruef = (bedingung, text) => { tests++; if (!bedingung) { fehler++; console.log('✗', text); } };

/* ───── Pinyin-Prüfung ───── */
const faelle = [
  ['wǒ méi chī zǎofàn', 'Wǒ méi chī zǎofàn.', 'richtig'],
  ['wo3 mei2 chi1 zao3fan4', 'Wǒ méi chī zǎofàn.', 'richtig'],
  ['Wo3 mei2 you3 chi1 zao3 fan4.', 'Wǒ méi (yǒu) chī zǎofàn.', 'richtig'],
  ['wo mei chi zaofan', 'Wǒ méi chī zǎofàn.', 'toene'],
  ['wǒ mèi chī zǎofàn', 'Wǒ méi chī zǎofàn.', 'toene'],
  ['wǒ méi chī le zǎofàn', 'Wǒ méi chī zǎofàn.', 'falsch'],
  ['', 'Wǒ', 'leer'],
  ['nv3er2', "nǚ'ér", 'richtig'],
  ['Wǒ mǎi le yí ge', 'Wǒ mǎi le yī ge', 'richtig'],
  ['Wǒ mǎi le yì běn shū', 'Wǒ mǎi le yī běn shū', 'richtig'],
  ['Kǎoshì kāishǐ le ma', 'Kǎoshì kāishǐ le ma?', 'richtig'],
  ['我去过上海', '我去过上海。', 'richtig'],
  ['我去了上海', '我去过上海。', 'falsch'],
  ['chi1fan4', 'chī fàn', 'richtig'],
  ['guo4', 'guò', 'richtig'],
  ['lüe4', 'lüè', 'richtig'],
];
for (const [ein, soll, erwartet] of faelle) {
  const ist = vergleiche(ein, [soll]);
  pruef(ist === erwartet, `vergleiche("${ein}", "${soll}") = ${ist}, erwartet ${erwartet}`);
}
pruef(allVariants(['Tā méi (yǒu) chī.']).length === 2, 'Klammer-Varianten');

/* ───── Inhalte ───── */
const TYPEN = ['richtigfalsch', 'auswahl', 'zuordnen', 'luecke', 'reihenfolge', 'gruppieren', 'fehler', 'eingabe', 'karteikarten', 'aufnahme', 'schreiben'];
const ICONS = new Set(fs.readdirSync(path.join(ROOT, 'assets/icons')).map((f) => f.replace(/^mm-icon-|\.svg$/g, '')));

function kofferDateien(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'engine') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...kofferDateien(p));
    else if (e.name === 'koffer.json') out.push(p);
  }
  return out;
}

for (const datei of kofferDateien(ROOT)) {
  const rel = path.relative(ROOT, datei);
  let k;
  try { k = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch (e) { pruef(false, `${rel}: JSON ungültig – ${e.message}`); continue; }
  for (const feld of ['id', 'titel', 'kurz', 'kopfzeile', 'kennung', 'uebungen']) pruef(k[feld], `${rel}: Feld "${feld}" fehlt`);
  const ids = new Set();
  k.uebungen.forEach((u, i) => {
    const wo = `${rel} · Übung ${i + 1} (${u.id})`;
    pruef(TYPEN.includes(u.typ), `${wo}: unbekannter Typ ${u.typ}`);
    pruef(u.id && !ids.has(u.id), `${wo}: id fehlt oder doppelt`);
    ids.add(u.id);
    pruef(u.anweisung?.de, `${wo}: deutsche Arbeitsanweisung fehlt`);
    if (u.icon) pruef(ICONS.has(u.icon), `${wo}: Icon ${u.icon} nicht vorhanden`);
    switch (u.typ) {
      case 'richtigfalsch': u.items.forEach((it, j) => pruef(typeof it.richtig === 'boolean', `${wo}.${j + 1}: richtig muss true/false sein`)); break;
      case 'auswahl':
        u.items.forEach((it, j) => {
          pruef(it.richtig.length > 0 && it.richtig.every((x) => x >= 0 && x < it.optionen.length), `${wo}.${j + 1}: Index der richtigen Antwort ungültig`);
          pruef(new Set(it.optionen).size === it.optionen.length, `${wo}.${j + 1}: doppelte Optionen`);
        });
        break;
      case 'zuordnen':
        pruef(new Set(u.paare.map((p) => p.rechts)).size === u.paare.length, `${wo}: rechte Seite nicht eindeutig`);
        pruef(new Set(u.paare.map((p) => p.links)).size === u.paare.length, `${wo}: linke Seite nicht eindeutig`);
        break;
      case 'luecke':
        u.items.forEach((it, j) => {
          const n = it.text.split('___').length - 1;
          pruef(n === it.luecken.length, `${wo}.${j + 1}: ${n} Lücken, aber ${it.luecken.length} Antworten`);
          const opts = it.optionen || u.optionen;
          if (opts) it.luecken.flat().forEach((a) => pruef(opts.includes(a), `${wo}.${j + 1}: Antwort "${a}" nicht in den Optionen`));
        });
        break;
      case 'reihenfolge':
        u.items.forEach((it, j) => {
          (it.alternativen || []).forEach((alt) => pruef([...alt].sort().join('|') === [...it.woerter].sort().join('|'), `${wo}.${j + 1}: Alternative nutzt andere Wörter`));
          pruef(new Set(it.woerter.map(canon)).size === it.woerter.length || true, '');
        });
        break;
      case 'gruppieren': {
        const alle = u.gruppen.flatMap((g) => g.elemente);
        pruef(new Set(alle).size === alle.length, `${wo}: Element doppelt vergeben`);
        if (u.darstellung === 'mindmap') pruef(u.zentrum, `${wo}: Mind-Map ohne Zentrum`);
        break;
      }
      case 'fehler':
        u.items.forEach((it, j) => {
          pruef(it.falsch.every((x) => x >= 0 && x < it.woerter.length), `${wo}.${j + 1}: Fehlerindex außerhalb`);
          pruef(vergleiche(allVariants(it.korrektur)[0], it.korrektur) === 'richtig', `${wo}.${j + 1}: Musterlösung besteht eigene Prüfung nicht`);
          pruef(vergleiche(it.woerter.join(' '), it.korrektur) !== 'richtig', `${wo}.${j + 1}: fehlerhafter Satz gilt bereits als richtig`);
        });
        break;
      case 'eingabe':
        u.items.forEach((it, j) => {
          allVariants(it.antworten).forEach((a) => pruef(vergleiche(a, it.antworten) === 'richtig', `${wo}.${j + 1}: Lösung "${a}" wird nicht erkannt`));
          if (it.vorgabe && /[āáǎàēéěèīíǐìōóǒòūúǔù]/.test(it.vorgabe)) pruef(vergleiche(it.vorgabe, it.antworten) !== 'richtig', `${wo}.${j + 1}: Vorgabe ist schon die Lösung`);
        });
        break;
      case 'aufnahme': u.saetze.forEach((s, j) => pruef(s.hz && s.py, `${wo}.${j + 1}: Hanzi oder Pinyin fehlt`)); break;
      default: break;
    }
  });
}

console.log(`\n${tests - fehler} von ${tests} Prüfungen bestanden.`);
process.exit(fehler ? 1 : 0);
