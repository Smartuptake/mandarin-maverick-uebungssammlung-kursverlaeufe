// Übungstypen. Jeder Typ baut sein DOM und liefert "Items" mit einheitlicher Schnittstelle:
//   pruefe()      → 'richtig' | 'toene' | 'falsch' | 'leer'
//   markiere(erg) → 'ok' | 'toene' | 'falsch' | 'geloest' sichtbar machen
//   loese()       → Lösung einsetzen
//   sperre()      → Bedienung sperren
//   antwort()     → Text der Schülerantwort (für Moodle)
// Versuche, Punkte und Speicherung verwaltet app.js.

import { el, fmt, zh, esc, mischen, mischenUngleich, statusText, download, speicher, sprich } from './hilfen.js';
import { vergleiche, canon, allVariants, zaehleWort, enthaeltFolge } from './pinyin.js';

const TONZEICHEN = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/;
const CJK = /[㐀-鿿]/;

// Text automatisch formatieren: Markup → fmt, rein Chinesisch → zh, sonst Deutsch
export function auto(s) {
  s = String(s ?? '');
  if (/\[\[|\{\{|\*/.test(s)) return fmt(s);
  if (CJK.test(s) || TONZEICHEN.test(s)) return zh(s);
  return fmt(s);
}

function rahmen(nr, kopfHtml) {
  const box = el('div', { class: 'item' });
  if (kopfHtml !== undefined) box.appendChild(el('div', { class: 'zeile' }, `<span class="nr">${nr}.</span>${kopfHtml}`));
  const status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite', hidden: true });
  const loesung = el('div', { class: 'loesung', hidden: true });
  const erkl = el('div', { class: 'erkl', hidden: true });
  return { box, status, loesung, erkl, anhaengen() { box.append(status, loesung, erkl); } };
}

function setzeStatus(r, erg, erklaerung, extra) {
  const klasse = { ok: 'ok', toene: 'toene', falsch: 'falsch', geloest: 'falsch' }[erg];
  r.status.hidden = false;
  r.status.className = `status ${klasse}`;
  r.status.textContent = statusText(erg, extra);
  if ((erg === 'ok' || erg === 'geloest') && erklaerung) {
    r.erkl.hidden = false;
    r.erkl.innerHTML = fmt(erklaerung);
  }
}

function klassen(elm, erg) {
  elm.classList.remove('ist-ok', 'ist-falsch', 'ist-toene');
  if (erg === 'ok') elm.classList.add('ist-ok');
  else if (erg === 'toene') elm.classList.add('ist-toene');
  else if (erg === 'falsch') elm.classList.add('ist-falsch');
}

/* ───────────── Richtig / Falsch ───────────── */
function richtigfalsch(u) {
  const wrap = el('div');
  const items = u.items.map((it, i) => {
    const r = rahmen(i + 1, `<span>${auto(it.aussage)}</span>`);
    let wahl = null;
    const wahlBox = el('div', { class: 'wahl' });
    const knoepfe = [true, false].map((wert) => {
      const b = el('button', { type: 'button', 'aria-pressed': 'false' }, wert ? 'Richtig' : 'Falsch');
      b.addEventListener('click', () => {
        wahl = wert;
        knoepfe.forEach((k) => k.setAttribute('aria-pressed', String(k === b)));
      });
      wahlBox.appendChild(b);
      return b;
    });
    r.box.appendChild(wahlBox);
    r.anhaengen();
    wrap.appendChild(r.box);
    return {
      pruefe: () => (wahl === null ? 'leer' : wahl === it.richtig ? 'richtig' : 'falsch'),
      markiere(erg) {
        knoepfe.forEach((k, j) => {
          const wert = j === 0;
          if (wert === it.richtig && (erg === 'ok' || erg === 'geloest')) klassen(k, 'ok');
          else if (wert === wahl && erg !== 'ok') klassen(k, 'falsch');
        });
        setzeStatus(r, erg, it.erklaerung);
      },
      loese() { wahl = wahl ?? null; },
      sperre() { knoepfe.forEach((k) => (k.disabled = true)); },
      antwort: () => (wahl === null ? '' : wahl ? 'richtig' : 'falsch'),
    };
  });
  return { el: wrap, items, maxVersuche: 1 };
}

/* ───────────── Auswahl (Single/Multiple Choice, Ausreißer) ───────────── */
function auswahl(u) {
  const wrap = el('div');
  const items = u.items.map((it, i) => {
    const mehrfach = it.richtig.length > 1 || u.mehrfach;
    const zusatz = mehrfach ? ' <span class="muted">(mehrere Antworten möglich)</span>' : '';
    const r = rahmen(i + 1, `<span>${auto(it.frage ?? '')}${zusatz}</span>`);
    const gewaehlt = new Set();
    const wahlBox = el('div', { class: 'wahl' + (u.darstellung === 'spalte' ? ' spalte' : '') });
    const knoepfe = it.optionen.map((opt, j) => {
      const b = el('button', { type: 'button', 'aria-pressed': 'false' }, auto(opt));
      b.addEventListener('click', () => {
        if (mehrfach) {
          gewaehlt.has(j) ? gewaehlt.delete(j) : gewaehlt.add(j);
        } else {
          gewaehlt.clear();
          gewaehlt.add(j);
        }
        knoepfe.forEach((k, x) => k.setAttribute('aria-pressed', String(gewaehlt.has(x))));
        knoepfe.forEach((k) => klassen(k, null));
      });
      wahlBox.appendChild(b);
      return b;
    });
    r.box.appendChild(wahlBox);
    r.anhaengen();
    wrap.appendChild(r.box);
    const soll = new Set(it.richtig);
    return {
      pruefe() {
        if (!gewaehlt.size) return 'leer';
        const gleich = gewaehlt.size === soll.size && [...gewaehlt].every((x) => soll.has(x));
        return gleich ? 'richtig' : 'falsch';
      },
      markiere(erg) {
        knoepfe.forEach((k, j) => {
          if (erg === 'ok' || erg === 'geloest') {
            if (soll.has(j)) klassen(k, 'ok');
            else if (gewaehlt.has(j)) klassen(k, 'falsch');
          } else if (gewaehlt.has(j) && !soll.has(j)) klassen(k, 'falsch');
        });
        setzeStatus(r, erg, it.erklaerung);
      },
      loese() {},
      sperre() { knoepfe.forEach((k) => (k.disabled = true)); },
      antwort: () => [...gewaehlt].map((j) => it.optionen[j]).join(' | '),
    };
  });
  return { el: wrap, items, maxVersuche: u.maxVersuche ?? 2 };
}

/* ───────────── Zuordnen (Tippen: links, dann rechts) ───────────── */
function zuordnen(u) {
  const wrap = el('div');
  wrap.appendChild(el('p', { class: 'tipphilfe' }, 'Tippe zuerst links auf ein Element, dann rechts auf das passende Gegenstück. Nochmal tippen hebt die Zuordnung auf.'));
  const grid = el('div', { class: 'paare' });
  const colL = el('div', { class: 'spalte' });
  const colR = el('div', { class: 'spalte' });
  grid.append(colL, colR);
  wrap.appendChild(grid);
  const n = u.paare.length;
  const rechtsOrdnung = mischenUngleich([...Array(n).keys()]);
  const zu = new Array(n).fill(null); // links i → rechts j
  const gesperrt = new Array(n).fill(false);
  let aktivL = null;

  const L = u.paare.map((p, i) => {
    const b = el('button', { type: 'button', class: 'kachel' });
    b.addEventListener('click', () => {
      if (gesperrt[i]) return;
      if (zu[i] !== null) { zu[i] = null; aktivL = null; zeichne(); return; }
      aktivL = aktivL === i ? null : i;
      zeichne();
    });
    colL.appendChild(b);
    return b;
  });
  const R = [];
  rechtsOrdnung.forEach((j) => {
    const b = el('button', { type: 'button', class: 'kachel' });
    b.addEventListener('click', () => {
      if (aktivL === null) return;
      const belegt = zu.indexOf(j);
      if (belegt !== -1 && gesperrt[belegt]) return;
      if (belegt !== -1) zu[belegt] = null;
      zu[aktivL] = j;
      aktivL = null;
      zeichne();
    });
    R[j] = b;
    colR.appendChild(b);
  });

  function zeichne() {
    L.forEach((b, i) => {
      const nr = zu[i] !== null ? `<span class="paar-nr">${i + 1}</span>` : '';
      b.innerHTML = nr + auto(u.paare[i].links);
      b.classList.toggle('gewaehlt', aktivL === i);
    });
    R.forEach((b, j) => {
      const i = zu.indexOf(j);
      const nr = i !== -1 ? `<span class="paar-nr">${i + 1}</span>` : '';
      b.innerHTML = nr + auto(u.paare[j].rechts);
    });
  }
  zeichne();

  const items = u.paare.map((p, i) => ({
    pruefe: () => (zu[i] === null ? 'leer' : zu[i] === i ? 'richtig' : 'falsch'),
    markiere(erg) {
      if (erg === 'ok' || erg === 'geloest') { klassen(L[i], 'ok'); klassen(R[i], 'ok'); }
      else {
        klassen(L[i], 'falsch');
        zu[i] = null; // falsche Zuordnung lösen, damit neu probiert werden kann
        zeichne();
        setTimeout(() => klassen(L[i], null), 1500);
      }
    },
    loese() {
      const belegt = zu.indexOf(i);
      if (belegt !== -1 && belegt !== i && !gesperrt[belegt]) zu[belegt] = null;
      zu[i] = i;
      zeichne();
    },
    sperre() { gesperrt[i] = true; L[i].disabled = true; R[i].disabled = true; },
    antwort: () => (zu[i] === null ? '' : `${u.paare[i].links} → ${u.paare[zu[i]].rechts}`),
  }));
  return { el: wrap, items, maxVersuche: 2 };
}

/* ───────────── Lückentext (Auswahl oder freie Eingabe) ───────────── */
function luecke(u) {
  const wrap = el('div');
  const items = u.items.map((it, i) => {
    const r = rahmen(i + 1);
    const zeile = el('div', { class: 'zeile' });
    zeile.appendChild(el('span', { class: 'nr' }, `${i + 1}.`));
    const teile = it.text.split('___');
    const felder = [];
    teile.forEach((t, k) => {
      if (t.trim()) zeile.appendChild(el('span', {}, auto(t)));
      if (k < teile.length - 1) {
        const opts = it.optionen || u.optionen;
        let f;
        if (opts) {
          f = el('select', { class: 'luecke', 'aria-label': `Lücke ${k + 1}` });
          f.appendChild(el('option', { value: '' }, '…'));
          opts.forEach((o) => f.appendChild(el('option', { value: o }, esc(o === '—' ? '— (kein Wort)' : o))));
        } else {
          f = el('input', { class: 'eingabe', style: 'width:auto;min-width:9em;margin:0', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `Lücke ${k + 1}` });
        }
        felder.push(f);
        zeile.appendChild(f);
      }
    });
    r.box.appendChild(zeile);
    if (it.de) r.box.appendChild(el('div', { class: 'de-hilfe' }, fmt(it.de)));
    r.anhaengen();
    wrap.appendChild(r.box);
    const antworten = it.luecken.map((l) => (Array.isArray(l) ? l : [l]));
    let ergebnisse = [];
    return {
      pruefe() {
        if (felder.some((f) => !f.value.trim())) return 'leer';
        ergebnisse = felder.map((f, k) => (f.tagName === 'SELECT' ? (antworten[k].includes(f.value) ? 'richtig' : 'falsch') : vergleiche(f.value, antworten[k])));
        if (ergebnisse.every((e) => e === 'richtig')) return 'richtig';
        if (ergebnisse.every((e) => e !== 'falsch')) return 'toene';
        return 'falsch';
      },
      markiere(erg) {
        felder.forEach((f, k) => klassen(f, erg === 'geloest' ? 'ok' : ergebnisse[k] === 'richtig' ? 'ok' : ergebnisse[k] === 'toene' ? 'toene' : erg === 'ok' ? 'ok' : 'falsch'));
        setzeStatus(r, erg, it.erklaerung);
      },
      loese() { felder.forEach((f, k) => (f.value = antworten[k][0])); },
      sperre() { felder.forEach((f) => (f.disabled = true)); },
      antwort: () => felder.map((f) => f.value).join(' / '),
    };
  });
  return { el: wrap, items, maxVersuche: u.maxVersuche ?? 2 };
}

/* ───────────── Satzbau (Wörter in Reihenfolge bringen) ───────────── */
function reihenfolge(u) {
  const wrap = el('div');
  wrap.appendChild(el('p', { class: 'tipphilfe' }, 'Tippe die Wörter in der richtigen Reihenfolge an. Ein Wort in der Antwortzeile antippen = zurücklegen.'));
  const items = u.items.map((it, i) => {
    const r = rahmen(i + 1, it.de ? `<span class="de-hilfe" style="margin:0">${fmt(it.de)}</span>` : '');
    const ablage = el('div', { class: 'ablage', 'aria-label': 'Antwortzeile' });
    const vorrat = el('div', { class: 'vorrat' });
    const reihen = [it.woerter, ...(it.alternativen || [])];
    let gelegt = []; // Indizes in it.woerter
    let gesperrt = false;
    const orig = mischenUngleich([...it.woerter.keys()]).map((idx) => {
      const b = el('button', { type: 'button', class: 'kachel' }, zh(it.woerter[idx]));
      b.addEventListener('click', () => {
        if (gesperrt) return;
        gelegt.push(idx);
        zeichne();
      });
      vorrat.appendChild(b);
      return { idx, b };
    });
    function zeichne() {
      ablage.innerHTML = '';
      klassen(ablage, null);
      gelegt.forEach((idx, pos) => {
        const b = el('button', { type: 'button', class: 'kachel' }, zh(it.woerter[idx]));
        b.addEventListener('click', () => {
          if (gesperrt) return;
          gelegt.splice(pos, 1);
          zeichne();
        });
        ablage.appendChild(b);
      });
      orig.forEach((o) => o.b.classList.toggle('benutzt', gelegt.includes(o.idx)));
    }
    r.box.append(ablage, vorrat);
    r.anhaengen();
    wrap.appendChild(r.box);
    const satz = () => gelegt.map((x) => it.woerter[x]).join(' ');
    return {
      pruefe() {
        if (gelegt.length < it.woerter.length) return 'leer';
        return reihen.some((rw) => canon(rw.join(' ')) === canon(satz())) ? 'richtig' : 'falsch';
      },
      markiere(erg) {
        klassen(ablage, erg === 'geloest' ? 'ok' : erg);
        if (erg === 'geloest') {
          r.loesung.hidden = false;
          const t = it.loesungstext || it.woerter.join(' ');
          r.loesung.innerHTML = `<span class="label">Lösung:</span>${zh(t.charAt(0).toUpperCase() + t.slice(1))}`;
        }
        setzeStatus(r, erg, it.erklaerung);
      },
      loese() {
        gelegt = [...it.woerter.keys()];
        zeichne();
      },
      sperre() { gesperrt = true; ablage.querySelectorAll('button').forEach((b) => (b.disabled = true)); orig.forEach((o) => (o.b.disabled = true)); vorrat.hidden = true; },
      antwort: satz,
    };
  });
  return { el: wrap, items, maxVersuche: 2 };
}

/* ───────────── Gruppieren / geführte Mind-Map ───────────── */
function gruppieren(u) {
  const wrap = el('div');
  wrap.appendChild(el('p', { class: 'tipphilfe' }, 'Tippe eine Karte an und dann das passende Feld. Karte im Feld antippen = zurücklegen.'));
  const alle = [];
  u.gruppen.forEach((g, gi) => g.elemente.forEach((t) => alle.push({ t, soll: gi, ist: null, gesperrt: false })));
  const vorrat = el('div', { class: 'vorrat' });
  const container = el('div', { class: u.darstellung === 'mindmap' ? 'mindmap' : 'gruppen' });
  let aktiv = null;

  if (u.darstellung === 'mindmap') {
    container.appendChild(el('div', { class: 'zentrum' }, `<div>${fmt(u.zentrum)}</div>`));
  }
  const felder = u.gruppen.map((g, gi) => {
    const f = el('div', { class: `gruppe ast-${gi + 1}`, role: 'button', tabindex: '0', 'aria-label': `Feld: ${g.name.replace(/\[\[|\]\]|\{\{|\}\}|\*/g, '')}` });
    f.appendChild(el('div', { class: 'gname' }, fmt(g.name)));
    const inhalt = el('div', { class: 'ginhalt' });
    f.appendChild(inhalt);
    const ablegen = () => {
      if (aktiv === null) return;
      alle[aktiv].ist = gi;
      aktiv = null;
      zeichne();
    };
    f.addEventListener('click', (e) => { if (e.target === f || e.target.classList.contains('gname') || e.target === inhalt) ablegen(); });
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ablegen(); } });
    container.appendChild(f);
    return { f, inhalt };
  });
  const reihenfolgeKarten = mischen([...alle.keys()]);
  const knoepfe = alle.map((a, k) => {
    const b = el('button', { type: 'button', class: 'kachel' }, auto(a.t));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (a.gesperrt) return;
      if (a.ist !== null) { a.ist = null; aktiv = null; }
      else aktiv = aktiv === k ? null : k;
      zeichne();
    });
    return b;
  });
  function zeichne() {
    vorrat.innerHTML = '';
    felder.forEach((f) => (f.inhalt.innerHTML = ''));
    reihenfolgeKarten.forEach((k) => {
      const a = alle[k];
      knoepfe[k].classList.toggle('gewaehlt', aktiv === k);
      (a.ist === null ? vorrat : felder[a.ist].inhalt).appendChild(knoepfe[k]);
    });
    felder.forEach((f) => f.f.classList.toggle('ziel', aktiv !== null));
  }
  zeichne();
  wrap.append(vorrat, container);

  const items = alle.map((a, k) => ({
    pruefe: () => (a.ist === null ? 'leer' : a.ist === a.soll ? 'richtig' : 'falsch'),
    markiere(erg) {
      if (erg === 'ok' || erg === 'geloest') klassen(knoepfe[k], 'ok');
      else {
        a.ist = null;
        zeichne();
        klassen(knoepfe[k], 'falsch');
        setTimeout(() => klassen(knoepfe[k], null), 1500);
      }
    },
    loese() { a.ist = a.soll; zeichne(); },
    sperre() { a.gesperrt = true; knoepfe[k].disabled = true; },
    antwort: () => (a.ist === null ? '' : `${a.t} → ${u.gruppen[a.ist].name}`),
  }));
  return { el: wrap, items, maxVersuche: u.maxVersuche ?? (u.gruppen.length <= 2 ? 1 : 2), leerErlaubt: false };
}

/* ───────────── Fehlersuche ───────────── */
function fehler(u) {
  const wrap = el('div');
  const items = u.items.map((it, i) => {
    const r = rahmen(i + 1);
    r.box.appendChild(el('div', { class: 'tipphilfe' }, 'Tippe auf das fehlerhafte Wort (oder das Wort, nach dem etwas fehlt).'));
    const woerter = el('div', { class: 'woerter' });
    let gewaehlt = null;
    const wk = it.woerter.map((w, j) => {
      const b = el('button', { type: 'button', 'aria-pressed': 'false' }, esc(w));
      b.addEventListener('click', () => {
        gewaehlt = gewaehlt === j ? null : j;
        wk.forEach((x, y) => x.setAttribute('aria-pressed', String(y === gewaehlt)));
      });
      woerter.appendChild(b);
      return b;
    });
    const input = el('input', { class: 'eingabe', placeholder: 'Schreibe den korrigierten Satz.', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Korrigierter Satz' });
    r.box.append(woerter, input);
    r.box.appendChild(el('div', { class: 'tipphilfe' }, 'Töne mit Zeichen (ǎ) oder Zahlen (a3). Beispiel: wo3 → wǒ'));
    r.anhaengen();
    wrap.appendChild(r.box);
    let letztes = null;
    return {
      pruefe() {
        if (!input.value.trim()) return 'leer';
        letztes = vergleiche(input.value, it.korrektur);
        return letztes;
      },
      markiere(erg) {
        klassen(input, erg === 'geloest' ? 'ok' : erg);
        let extra = '';
        if (erg !== 'ok' && erg !== 'geloest' && gewaehlt !== null && !it.falsch.includes(gewaehlt)) extra = 'Tipp: Das markierte Wort ist nicht die Fehlerstelle.';
        if (erg === 'ok' || erg === 'geloest') it.falsch.forEach((j) => klassen(wk[j], 'ok'));
        setzeStatus(r, erg, it.erklaerung, extra);
      },
      loese() {
        r.loesung.hidden = false;
        r.loesung.innerHTML = `<span class="label">Lösung:</span>${zh(allVariants(it.korrektur)[0])}`;
      },
      sperre() { input.disabled = true; wk.forEach((b) => (b.disabled = true)); },
      antwort: () => input.value,
    };
  });
  return { el: wrap, items, maxVersuche: 2 };
}

/* ───────────── Freie Eingabe (Umformen, Übersetzen, Satz bilden) ───────────── */
function eingabe(u) {
  const wrap = el('div');
  const items = u.items.map((it, i) => {
    const kopf = [
      it.aufgabe ? `<span class="muted">${fmt(it.aufgabe)}:</span>` : '',
      `<span>${auto(it.vorgabe)}</span>`,
    ].join(' ');
    const r = rahmen(i + 1, kopf);
    const hanzi = allVariants(it.antworten).some((a) => CJK.test(a));
    const input = el('input', {
      class: 'eingabe' + (hanzi ? ' hz-eingabe' : ''),
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      placeholder: hanzi ? '汉字' : 'Pinyin …', 'aria-label': 'Deine Antwort',
    });
    r.box.appendChild(input);
    const hinweis = el('div', { class: 'erkl', hidden: true });
    r.box.appendChild(hinweis);
    r.anhaengen();
    wrap.appendChild(r.box);
    return {
      pruefe: () => vergleiche(input.value, it.antworten),
      markiere(erg) {
        klassen(input, erg === 'geloest' ? 'ok' : erg);
        if ((erg === 'falsch' || erg === 'toene') && it.hinweis) {
          hinweis.hidden = false;
          hinweis.innerHTML = `<span class="muted">Hinweis:</span> ${fmt(it.hinweis)}`;
        }
        if (erg === 'ok' || erg === 'geloest') hinweis.hidden = true;
        setzeStatus(r, erg, it.erklaerung);
      },
      loese() {
        r.loesung.hidden = false;
        const v = allVariants(it.antworten);
        r.loesung.innerHTML = `<span class="label">Lösung:</span>${zh(v[0])}` +
          (v.length > 1 ? `<div class="muted" style="font-size:15px;margin-top:4px">Auch möglich: ${v.slice(1, 4).map((x) => zh(x)).join(' · ')}</div>` : '');
      },
      sperre() { input.disabled = true; },
      antwort: () => input.value,
    };
  });
  return { el: wrap, items, maxVersuche: 2 };
}

/* ───────────── Karteikarten (unbewertet) ───────────── */
function karteikarten(u) {
  const wrap = el('div');
  let karten = u.karten.slice();
  let pos = 0;
  const karte = el('div', { class: 'karte-flip' });
  const innen = el('div', { class: 'innen', role: 'button', tabindex: '0', 'aria-label': 'Karte umdrehen' });
  const v = el('div', { class: 'seite-v' });
  const rs = el('div', { class: 'seite-r' });
  innen.append(v, rs);
  karte.appendChild(innen);
  const zaehler = el('div', { class: 'karte-zaehler' });
  const drehen = () => karte.classList.toggle('gedreht');
  innen.addEventListener('click', drehen);
  innen.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drehen(); } });
  const leiste = el('div', { class: 'leiste', style: 'justify-content:center' });
  const zurueck = el('button', { type: 'button', class: 'btn sek' }, '← Zurück');
  const weiter = el('button', { type: 'button', class: 'btn sek' }, 'Weiter →');
  const misch = el('button', { type: 'button', class: 'btn sek' }, 'Mischen');
  zurueck.onclick = () => { pos = (pos - 1 + karten.length) % karten.length; zeige(); };
  weiter.onclick = () => { pos = (pos + 1) % karten.length; zeige(); };
  misch.onclick = () => { karten = mischen(karten); pos = 0; zeige(); };
  leiste.append(zurueck, misch, weiter);
  function zeige() {
    karte.classList.remove('gedreht');
    const k = karten[pos];
    v.innerHTML = `<div>${auto(k.vorne)}</div><div class="muted" style="font-size:14px">antippen zum Umdrehen</div>`;
    rs.innerHTML = `<div>${auto(k.hinten)}</div>${k.beispiel ? `<div>${auto(k.beispiel)}</div>` : ''}`;
    zaehler.textContent = `Karte ${pos + 1} von ${karten.length}`;
  }
  zeige();
  wrap.append(karte, zaehler, leiste);
  return { el: wrap, items: [], unbewertet: true };
}

/* ───────────── Vorlesen und aufnehmen (unbewertet) ───────────── */
function aufnahme(u, ctx) {
  const wrap = el('div', { class: 'saetze-lesen' });
  u.saetze.forEach((s, i) => {
    const z = el('div', { class: 'satz' });
    const text = el('div', {}, `<span class="hz">${esc(s.hz)}</span><span class="py">${esc(s.py)}</span>${s.de ? `<span class="de">${fmt(s.de)}</span>` : ''}`);
    const hoer = el('button', { type: 'button', class: 'btn sek', 'aria-label': `Satz ${i + 1} anhören` }, `<img src="${ctx.basis}assets/icons/mm-icon-hoeren.svg" alt="">Anhören`);
    hoer.onclick = () => sprich(s.hz, s.audio);
    z.append(text, hoer);
    wrap.appendChild(z);
  });
  const rec = el('div', { class: 'rueck' });
  rec.innerHTML = `<h3>Deine Aufnahme</h3><p>Lies alle Sätze nacheinander laut vor. Nimm dich dabei auf, hör dir die Aufnahme an und lade die Datei danach in Moodle hoch.</p>`;
  const leiste = el('div', { class: 'leiste' });
  const start = el('button', { type: 'button', class: 'btn' }, `<img src="${ctx.basis}assets/icons/mm-icon-audio-aufnehmen.svg" alt="">Aufnahme starten`);
  const stopp = el('button', { type: 'button', class: 'btn sek', disabled: true }, '<span class="rec"></span> Stopp');
  const laden = el('button', { type: 'button', class: 'btn sek', disabled: true }, `<img src="${ctx.basis}assets/icons/mm-icon-herunterladen.svg" alt="">Aufnahme speichern`);
  const player = el('audio', { controls: true, hidden: true });
  leiste.append(start, stopp, laden);
  rec.append(leiste, player);
  wrap.appendChild(rec);
  let mr = null; let teile = []; let blob = null;
  start.onclick = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Dein Browser erlaubt hier keine Aufnahme. Nutze die Sprachmemo-App deines Geräts und lade die Datei in Moodle hoch.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      teile = [];
      mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => e.data.size && teile.push(e.data);
      mr.onstop = () => {
        blob = new Blob(teile, { type: mr.mimeType || 'audio/webm' });
        player.src = URL.createObjectURL(blob);
        player.hidden = false;
        laden.disabled = false;
        stream.getTracks().forEach((t) => t.stop());
        ctx.erledigt?.();
      };
      mr.start();
      start.disabled = true; stopp.disabled = false;
      stopp.querySelector('.rec').classList.add('an');
    } catch (e) {
      alert('Kein Zugriff auf das Mikrofon. Bitte erlaube den Zugriff in den Browser-Einstellungen.');
    }
  };
  stopp.onclick = () => {
    if (mr && mr.state !== 'inactive') mr.stop();
    start.disabled = false; stopp.disabled = true;
    start.innerHTML = start.innerHTML.replace('Aufnahme starten', 'Neu aufnehmen');
    stopp.querySelector('.rec').classList.remove('an');
  };
  laden.onclick = () => {
    if (!blob) return;
    const endung = /mp4|m4a|aac/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm';
    download(`${ctx.dateiPrefix}_Aufnahme_${ctx.name() || 'Name'}.${endung}`.replace(/\s+/g, '-'), blob);
  };
  return { el: wrap, items: [], unbewertet: true };
}

/* ───────────── Schreiben mit Checkliste (unbewertet) ───────────── */
function schreiben(u, ctx) {
  const wrap = el('div');
  if (u.rollenkarte) {
    const rk = el('div', { class: 'rollenkarte' });
    rk.innerHTML = `${u.rollenkarte.bild ? `<img src="${ctx.basis}${u.rollenkarte.bild}" alt="">` : '<span></span>'}
      <div><h3>${fmt(u.rollenkarte.titel)}</h3><ul>${u.rollenkarte.punkte.map((p) => `<li>${fmt(p)}</li>`).join('')}</ul></div>`;
    wrap.appendChild(rk);
  }
  if (u.muster) wrap.appendChild(el('div', { class: 'hinweis', style: 'margin-top:12px' }, `<span class="muted">So könnte es anfangen:</span><br>${u.muster.map((z) => auto(z)).join('<br>')}`));
  const schluessel = `mm-text:${ctx.kofferId}:${u.id}`;
  const ta = el('textarea', { class: 'text', 'aria-label': 'Dein Text', placeholder: u.platzhalter || 'Schreibe hier in Pinyin …' });
  ta.value = speicher.lesen(schluessel) || '';
  const liste = el('ul', { class: 'checkliste' });
  const punkte = u.pflicht.map((p) => {
    const li = el('li', {}, fmt(p.text));
    liste.appendChild(li);
    return { p, li };
  });
  function pruefeListe() {
    const t = ta.value;
    let alle = true;
    punkte.forEach(({ p, li }) => {
      let n = 0;
      if (p.typ === 'wort') n = [].concat(p.wort).reduce((s, w) => s + zaehleWort(t, w), 0);
      else if (p.typ === 'folge') n = [].concat(p.folgen).filter((f) => enthaeltFolge(t, f)).length;
      else if (p.typ === 'fragen') n = (t.match(/[?？]/g) || []).length;
      else if (p.typ === 'zeilen') n = t.split(/\n/).filter((z) => z.trim()).length;
      const ok = n >= (p.min ?? 1);
      li.classList.toggle('erfuellt', ok);
      if (!ok) alle = false;
    });
    speicher.schreiben(schluessel, t);
    if (alle && t.trim()) ctx.erledigt?.();
  }
  ta.addEventListener('input', pruefeListe);
  const leiste = el('div', { class: 'leiste' });
  const kopie = el('button', { type: 'button', class: 'btn sek' }, 'Text kopieren');
  const laden = el('button', { type: 'button', class: 'btn sek' }, `<img src="${ctx.basis}assets/icons/mm-icon-herunterladen.svg" alt="">Als Datei speichern`);
  kopie.onclick = async () => {
    try { await navigator.clipboard.writeText(ta.value); kopie.textContent = 'Kopiert ✓'; }
    catch (e) { ta.select(); document.execCommand('copy'); kopie.textContent = 'Kopiert ✓'; }
    setTimeout(() => (kopie.textContent = 'Text kopieren'), 2000);
  };
  laden.onclick = () => download(`${ctx.dateiPrefix}_Text_${ctx.name() || 'Name'}.txt`.replace(/\s+/g, '-'), ta.value);
  leiste.append(kopie, laden);
  wrap.append(el('h3', { style: 'margin-top:20px' }, 'Checkliste'), liste, ta, leiste);
  pruefeListe();
  return { el: wrap, items: [], unbewertet: true };
}

export const TYPEN = { richtigfalsch, auswahl, zuordnen, luecke, reihenfolge, gruppieren, fehler, eingabe, karteikarten, aufnahme, schreiben };
