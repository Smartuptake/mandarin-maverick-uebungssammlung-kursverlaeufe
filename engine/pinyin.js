// Mandarin Maverick – Pinyin- und Antwortvergleich
// Ziel: fair prüfen. Tonzahlen (hao3) und Tonzeichen (hǎo) gelten gleich,
// Groß-/Kleinschreibung, Leerzeichen und Satzzeichen werden ignoriert.
// Stimmt alles bis auf die Töne, lautet das Ergebnis "toene" (fast richtig).

const TONE_MARKS = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
};

// Eine Silbe mit Tonzahl in Tonzeichen umwandeln (Regel: a/e zuerst, dann "ou", sonst letzter Vokal)
function markSyllable(syl, tone) {
  let s = syl.replace(/u:|v/g, 'ü');
  if (tone === 5 || tone === 0) return s;
  let idx = -1;
  if (s.includes('a')) idx = s.indexOf('a');
  else if (s.includes('e')) idx = s.indexOf('e');
  else if (s.includes('ou')) idx = s.indexOf('o');
  else {
    for (let i = s.length - 1; i >= 0; i--) {
      if ('iouü'.includes(s[i])) { idx = i; break; }
    }
  }
  if (idx < 0) return s;
  const ch = s[idx];
  return s.slice(0, idx) + TONE_MARKS[ch][tone - 1] + s.slice(idx + 1);
}

export function numberedToMarked(str) {
  return str.replace(/([a-zü:v]+)([0-5])/gi, (m, syl, t) => markSyllable(syl.toLowerCase(), Number(t)));
}

// Tonsandhi-Varianten von yī und bù als gleichwertig behandeln (yí ge = yī ge, bú shì = bù shì)
function normalizeSandhi(str) {
  return str
    .split(/\s+/)
    .map((w) => w.replace(/^y[íì]/, 'yī').replace(/^bú/, 'bù'))
    .join(' ');
}

const HAS_CJK = /[㐀-鿿]/;

// Kanonische Form mit Tönen
export function canon(str) {
  let s = String(str ?? '').normalize('NFC').toLowerCase().trim();
  s = s.replace(/[’'`´]/g, "'");
  s = numberedToMarked(s);
  s = normalizeSandhi(s);
  // alles außer Buchstaben (inkl. Hanzi) entfernen
  s = s.replace(/[^\p{L}]/gu, '');
  return s.normalize('NFC');
}

// Kanonische Form ohne Töne
export function toneless(str) {
  let s = canon(str);
  s = s.replace(/[üǖǘǚǜ]/g, 'v');
  s = s.normalize('NFD').replace(/\p{M}/gu, '');
  return s;
}

// "Tā méi (yǒu) chī." → ["Tā méi yǒu chī.", "Tā méi chī."]
export function expandOptional(answer) {
  const m = answer.match(/\(([^()]*)\)/);
  if (!m) return [answer.replace(/\s+/g, ' ').trim()];
  const withPart = answer.slice(0, m.index) + m[1] + answer.slice(m.index + m[0].length);
  const without = answer.slice(0, m.index) + answer.slice(m.index + m[0].length);
  return [...expandOptional(withPart), ...expandOptional(without)];
}

export function allVariants(answers) {
  const list = Array.isArray(answers) ? answers : [answers];
  return [...new Set(list.flatMap(expandOptional))];
}

// Ergebnis: 'richtig' | 'toene' | 'falsch' | 'leer'
export function vergleiche(eingabe, answers) {
  if (!String(eingabe ?? '').trim()) return 'leer';
  const variants = allVariants(answers);
  const c = canon(eingabe);
  if (variants.some((a) => canon(a) === c)) return 'richtig';
  if (!HAS_CJK.test(eingabe)) {
    const t = toneless(eingabe);
    if (variants.some((a) => toneless(a) === t)) return 'toene';
  }
  return 'falsch';
}

// Zählt Vorkommen eines Pinyin-Wortes unabhängig von Tönen (für Checklisten)
export function zaehleWort(text, wort) {
  const woerter = String(text).split(/[^\p{L}\d]+/u).map(toneless).filter(Boolean);
  const ziel = toneless(wort);
  return woerter.filter((w) => w === ziel).length;
}

export function enthaeltFolge(text, folge) {
  // prüft zeilenweise, ob die Wortfolge (tonunabhängig) vorkommt.
  // "hái méi … guò" = erst "hai mei", danach irgendwo in derselben Zeile "guo".
  const teile = String(folge).split('…').map((t) => t.trim().split(/\s+/).map(toneless).join(' ')).filter(Boolean);
  return String(text).split(/\n/).some((zeile) => {
    const w = ' ' + zeile.split(/[^\p{L}\d]+/u).map(toneless).filter(Boolean).join(' ') + ' ';
    let pos = 0;
    for (const t of teile) {
      const i = w.indexOf(' ' + t + ' ', pos);
      if (i === -1) return false;
      pos = i + t.length + 1;
    }
    return true;
  });
}
