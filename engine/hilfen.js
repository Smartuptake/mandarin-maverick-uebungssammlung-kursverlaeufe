// Kleine DOM- und Text-Helfer

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CJK_RUN = /([㐀-鿿　-〿！-～]+)/g;

// Gemischter Text nach Farbsemantik 3.4:
//   [[pīnyīn]]  → Pinyin (blau)
//   {{汉字}}     → Hanzi (Kaiti, rot)
//   *kursiv*    → Hervorhebung (kursiv, nie fett)
//   Rest        → Deutsch (schwarz)
export function fmt(s) {
  let h = esc(s);
  h = h.replace(/\[\[(.+?)\]\]/g, '<span class="py" lang="zh-Latn-pinyin">$1</span>');
  h = h.replace(/\{\{(.+?)\}\}/g, '<span class="hz" lang="zh-Hans">$1</span>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/\n/g, '<br>');
  return h;
}

// Reiner chinesischer Text: Hanzi-Anteile rot/Kaiti, Rest als Pinyin (blau)
export function zh(s) {
  const teile = String(s ?? '').split(CJK_RUN);
  return teile
    .map((t, i) => {
      if (!t) return '';
      if (i % 2 === 1) return `<span class="hz" lang="zh-Hans">${esc(t)}</span>`;
      return t.trim() ? `<span class="py" lang="zh-Latn-pinyin">${esc(t)}</span>` : esc(t);
    })
    .join('');
}

export function el(tag, attrs = {}, html) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function mischen(arr, seed) {
  const a = arr.slice();
  let s = seed ?? Math.floor(Math.random() * 1e9);
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Mischen, aber nie in der Lösungsreihenfolge lassen
export function mischenUngleich(arr) {
  if (arr.length < 2) return arr.slice();
  for (let n = 0; n < 20; n++) {
    const m = mischen(arr);
    if (m.some((x, i) => x !== arr[i])) return m;
  }
  return arr.slice().reverse();
}

export function statusText(ergebnis, extra = '') {
  const t = {
    ok: 'Richtig!',
    toene: 'Fast richtig – prüfe die Töne.',
    falsch: 'Noch nicht richtig. Versuch es noch einmal.',
    geloest: 'Hier ist die Lösung.',
  }[ergebnis];
  return `${t}${extra ? ' ' + extra : ''}`;
}

export function download(dateiname, inhalt, typ = 'text/plain;charset=utf-8') {
  const blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: dateiname });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export const speicher = {
  lesen(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  schreiben(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat/gesperrt */ } },
  loeschen(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
};

// Chinesische Sprachausgabe des Geräts (Fallback, solange keine Audiodatei vorliegt)
export function sprich(text, audioUrl) {
  if (audioUrl) {
    const a = new Audio(audioUrl);
    a.play();
    return;
  }
  if (!('speechSynthesis' in window)) {
    alert('Dein Browser unterstützt keine Sprachausgabe.');
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 0.8;
  const stimme = speechSynthesis.getVoices().find((v) => /zh[-_]CN/i.test(v.lang));
  if (stimme) u.voice = stimme;
  speechSynthesis.speak(u);
}
