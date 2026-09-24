// Mandarin Maverick – Übungskoffer
// Lädt koffer.json aus dem Ordner der Seite und steuert Ablauf, Punkte, Speicherung und Moodle (SCORM).

import { el, fmt, esc, speicher } from './hilfen.js';
import { TYPEN, auto } from './typen.js';
import { scorm } from './scorm.js';

const root = document.getElementById('app');
const BASIS = root.dataset.basis || './';

let koffer;
let state;
let SCHLUESSEL;

async function start() {
  try {
    const res = await fetch('koffer.json', { cache: 'no-cache' });
    koffer = await res.json();
  } catch (e) {
    root.innerHTML = '<p>Der Übungskoffer konnte nicht geladen werden. Bitte lade die Seite neu.</p>';
    return;
  }
  SCHLUESSEL = `mm-koffer:${koffer.id}`;
  const ohneMarkup = (t) => String(t || '').replace(/\[\[|\]\]|\{\{|\}\}|\*/g, '');
  koffer.titelText = ohneMarkup(koffer.titel);
  koffer.uebungen.forEach((u) => (u.titelText = ohneMarkup(u.titel)));
  state = speicher.lesen(SCHLUESSEL) || { items: {}, erledigt: {}, name: '' };
  scorm.start();
  if (scorm.aktiv && !state.name) state.name = scorm.schuelerName();
  document.title = `${koffer.titelText} – Übungskoffer · Mandarin Maverick`;
  window.addEventListener('hashchange', zeichne);
  window.addEventListener('pagehide', () => scorm.ende());
  zeichne();
}

const speichern = () => speicher.schreiben(SCHLUESSEL, state);
const uebungen = () => koffer.uebungen;
const dateiPrefix = () => `MM_${koffer.kennung}_${koffer.kurz}`;

function schritt() {
  const h = location.hash.replace('#', '');
  if (h === 'ergebnis') return { art: 'ergebnis' };
  const m = h.match(/^u(\d+)$/);
  if (m) {
    const i = Number(m[1]) - 1;
    if (i >= 0 && i < uebungen().length) return { art: 'uebung', i };
  }
  return { art: 'start' };
}

function geh(ziel) {
  location.hash = ziel;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ───── Punkte ───── */
function itemKey(u, idx) { return `${u.id}-${idx}`; }

function uebungStand(u) {
  if (u._anzahl === undefined) {
    // Itemanzahl ohne DOM ermitteln
    u._anzahl = (u.items || u.paare || []).length || (u.gruppen ? u.gruppen.reduce((s, g) => s + g.elemente.length, 0) : 0);
  }
  const unbewertet = ['karteikarten', 'aufnahme', 'schreiben'].includes(u.typ);
  if (unbewertet) return { unbewertet, fertig: !!state.erledigt[u.id], punkte: 0, max: 0 };
  let punkte = 0; let geloest = 0;
  for (let k = 0; k < u._anzahl; k++) {
    const s = state.items[itemKey(u, k)];
    if (s && (s.zustand === 'ok' || s.zustand === 'geloest')) { geloest++; punkte += s.punkte || 0; }
  }
  return { unbewertet, fertig: geloest === u._anzahl, punkte, max: u._anzahl, geloest };
}

function gesamt() {
  let p = 0; let m = 0; let alleFertig = true;
  uebungen().forEach((u) => {
    const s = uebungStand(u);
    p += s.punkte; m += s.max;
    if (!s.fertig) alleFertig = false;
  });
  return { prozent: m ? (100 * p) / m : 0, punkte: p, max: m, alleFertig };
}

function scormMelden() {
  const g = gesamt();
  scorm.punkte(g.prozent, g.alleFertig);
}

/* ───── Kopf und Navigation ───── */
function kopf() {
  return el('header', { class: 'mm-kopf' }, `
    <img class="logo" src="${BASIS}assets/logo/mm-logo-symbol-color.svg" alt="Mandarin Maverick">
    <div class="reihe">„Mandarin Maverick – Fast Track Chinese“ – ${esc(koffer.kopfzeile)}</div>
    <div class="thema">Übungskoffer: ${fmt(koffer.titel)}</div>`);
}

function navi(aktuell) {
  const n = el('nav', { class: 'navi no-print', 'aria-label': 'Übungen' });
  const knopf = (label, ziel, klassen, titel) => {
    const b = el('button', { type: 'button', class: klassen, title: titel, 'aria-label': titel }, label);
    b.onclick = () => geh(ziel);
    n.appendChild(b);
  };
  knopf('Start', 'start', aktuell.art === 'start' ? 'aktuell' : '', 'Start');
  let etappe = null;
  uebungen().forEach((u, i) => {
    if (u.etappe && u.etappe !== etappe) {
      etappe = u.etappe;
      n.appendChild(el('span', { class: 'etappe' }, esc(etappe.split('·')[0].trim()) + ':'));
    }
    const s = uebungStand(u);
    const kl = [aktuell.art === 'uebung' && aktuell.i === i ? 'aktuell' : '', s.fertig ? 'fertig' : ''].join(' ');
    knopf(String(i + 1), `u${i + 1}`, kl, `Übung ${i + 1}: ${u.titelText || ''}`);
  });
  n.appendChild(el('span', { class: 'etappe' }, ''));
  knopf('Ergebnis', 'ergebnis', aktuell.art === 'ergebnis' ? 'aktuell' : '', 'Ergebnis');
  return n;
}

function zeichne() {
  const s = schritt();
  root.innerHTML = '';
  root.appendChild(kopf());
  root.appendChild(navi(s));
  if (s.art === 'start') startseite();
  else if (s.art === 'uebung') uebungsseite(s.i);
  else ergebnisseite();
  root.appendChild(el('footer', { class: 'mm-fuss' }, s.art === 'uebung' ? `Übung ${s.i + 1} von ${uebungen().length}` : esc(koffer.kennung)));
}

/* ───── Startseite ───── */
function startseite() {
  const e = koffer.einstieg || {};
  const box = el('section');
  box.appendChild(el('div', { class: 'einstieg' }, `
    <img src="${BASIS}assets/figuren/mm-figur-happel-laoshi-06.png" alt="Happel lǎoshī">
    <div class="blase">
      ${e.py ? `<span class="py">${esc(e.py)}</span>` : ''}
      ${e.hz ? `<span class="hz">${esc(e.hz)}</span>` : ''}
      ${e.de ? `<span class="de">${fmt(e.de)}</span>` : ''}
    </div>`));
  box.appendChild(el('h1', {}, fmt(koffer.titel)));
  if (koffer.beschreibung) box.appendChild(el('p', {}, fmt(koffer.beschreibung)));
  box.appendChild(el('div', { class: 'eckdaten' }, `
    ${koffer.jahrgang ? `<span>Jahrgangsstufe ${esc(koffer.jahrgang)}</span>` : ''}<span>${esc(koffer.kopfzeile)}</span>
    <span>${uebungen().length} Übungen</span><span>${esc(koffer.dauer || '')}</span>`));
  if (koffer.lernziele) {
    box.appendChild(el('h2', { style: 'margin-top:24px' }, 'Das kannst du danach'));
    box.appendChild(el('ul', {}, koffer.lernziele.map((z) => `<li>${fmt(z)}</li>`).join('')));
  }
  if (koffer.spickzettel) {
    const d = el('details', { class: 'spick' });
    d.innerHTML = `<summary><img src="${BASIS}assets/icons/mm-icon-idee.svg" alt="">Spickzettel: deine Grammatik-Checkliste</summary>
      <div class="inhalt"><table class="tab"><thead><tr><th>Struktur</th><th>Funktion</th><th>Beispiel</th></tr></thead><tbody>
      ${koffer.spickzettel.map((z) => `<tr><td>${fmt(z[0])}</td><td>${fmt(z[1])}</td><td>${auto(z[2])}</td></tr>`).join('')}
      </tbody></table></div>`;
    box.appendChild(d);
  }
  box.appendChild(el('p', { class: 'muted', style: 'font-size:15px' }, 'Dein Fortschritt wird auf diesem Gerät gespeichert. Du kannst jederzeit pausieren und später weitermachen.'));
  const l = el('div', { class: 'leiste' });
  const los = el('button', { type: 'button', class: 'btn' }, 'Los geht’s →');
  los.onclick = () => geh('u1');
  l.appendChild(los);
  box.appendChild(l);
  root.appendChild(box);
}

/* ───── Übungsseite ───── */
function uebungsseite(i) {
  const u = uebungen()[i];
  const sec = el('section');
  const k = el('div', { class: 'uebung-kopf' });
  k.innerHTML = `<div>
      <div class="marke">Übung ${i + 1} von ${uebungen().length}${u.etappe ? ' · ' + esc(u.etappe) : ''}</div>
      <h2>${fmt(u.titel)}</h2>
      <div class="anw">${u.anweisung?.py ? `<span class="py">${esc(u.anweisung.py)}</span>` : ''}${u.anweisung?.de ? `<span class="de">${fmt(u.anweisung.de)}</span>` : ''}</div>
    </div>
    ${u.icon ? `<img class="icon" src="${BASIS}assets/icons/mm-icon-${u.icon}.svg" alt="">` : ''}`;
  sec.appendChild(k);
  if (u.hinweis) sec.appendChild(el('div', { class: 'hinweis' }, fmt(u.hinweis)));

  const ctx = {
    basis: BASIS,
    kofferId: koffer.id,
    dateiPrefix: dateiPrefix(),
    name: () => state.name,
    erledigt: () => { if (!state.erledigt[u.id]) { state.erledigt[u.id] = true; speichern(); scormMelden(); aktualisiereNavi(); } },
  };
  const bau = TYPEN[u.typ](u, ctx);
  sec.appendChild(bau.el);
  const rueck = el('div', { class: 'rueck', hidden: true, role: 'status', 'aria-live': 'polite' });
  sec.appendChild(rueck);

  // gespeicherten Stand wiederherstellen
  bau.items.forEach((it, idx) => {
    const s = state.items[itemKey(u, idx)];
    if (s && (s.zustand === 'ok' || s.zustand === 'geloest')) {
      it.loese(); it.markiere(s.zustand); it.sperre();
    }
  });

  const leiste = el('div', { class: 'leiste no-print' });
  const zurueck = el('button', { type: 'button', class: 'btn sek' }, '← Zurück');
  zurueck.onclick = () => geh(i === 0 ? 'start' : `u${i}`);
  leiste.appendChild(zurueck);

  if (!bau.unbewertet) {
    const pruefen = el('button', { type: 'button', class: 'btn' }, `<img src="${BASIS}assets/icons/mm-icon-richtig.svg" alt="">Prüfen`);
    pruefen.onclick = () => pruefeUebung(u, bau, rueck, pruefen);
    leiste.appendChild(pruefen);
    if (uebungStand(u).fertig) { pruefen.disabled = true; zeigeRueck(u, rueck); }
  } else {
    const fertig = el('button', { type: 'button', class: 'btn' }, state.erledigt[u.id] ? 'Erledigt ✓' : 'Als erledigt markieren');
    fertig.onclick = () => { ctx.erledigt(); fertig.textContent = 'Erledigt ✓'; };
    leiste.appendChild(fertig);
  }
  const weiter = el('button', { type: 'button', class: 'btn sek rechts' }, i === uebungen().length - 1 ? 'Zum Ergebnis →' : 'Weiter →');
  weiter.onclick = () => geh(i === uebungen().length - 1 ? 'ergebnis' : `u${i + 2}`);
  leiste.appendChild(weiter);
  sec.appendChild(leiste);
  root.appendChild(sec);
}

function aktualisiereNavi() {
  const alt = root.querySelector('nav.navi');
  if (alt) alt.replaceWith(navi(schritt()));
}

const SCORM_TYP = { richtigfalsch: 'true-false', auswahl: 'choice', zuordnen: 'matching', luecke: 'fill-in', reihenfolge: 'sequencing', gruppieren: 'matching', fehler: 'fill-in', eingabe: 'fill-in' };

function pruefeUebung(u, bau, rueck, knopf) {
  const max = bau.maxVersuche ?? 2;
  let leer = 0; let neuRichtig = 0; let offen = 0;
  bau.items.forEach((it, idx) => {
    const key = itemKey(u, idx);
    const s = state.items[key] || { zustand: 'offen', versuche: 0, punkte: 0 };
    if (s.zustand === 'ok' || s.zustand === 'geloest') return;
    const erg = it.pruefe();
    if (erg === 'leer') { leer++; offen++; return; }
    if (erg === 'richtig') {
      s.zustand = 'ok';
      s.punkte = s.versuche === 0 ? 1 : 0.5;
      it.markiere('ok'); it.sperre();
      neuRichtig++;
      scorm.interaktion(key, SCORM_TYP[u.typ] || 'other', it.antwort(), true);
    } else {
      s.versuche++;
      if (s.versuche >= max) {
        s.zustand = 'geloest'; s.punkte = 0;
        it.loese(); it.markiere('geloest'); it.sperre();
        scorm.interaktion(key, SCORM_TYP[u.typ] || 'other', it.antwort(), false);
      } else {
        it.markiere(erg === 'toene' ? 'toene' : 'falsch');
        offen++;
      }
    }
    state.items[key] = s;
  });
  speichern();
  scormMelden();
  aktualisiereNavi();
  if (uebungStand(u).fertig) {
    knopf.disabled = true;
    zeigeRueck(u, rueck);
  } else {
    rueck.hidden = false;
    rueck.className = 'rueck';
    const teile = [];
    const st = uebungStand(u);
    teile.push(`Bisher geschafft: ${st.geloest} von ${st.max}.`);
    if (leer) teile.push(`${leer} ${leer === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} noch nicht bearbeitet.`);
    if (offen - leer > 0) teile.push('Korrigiere die markierten Stellen und prüfe noch einmal. Nach dem zweiten Versuch siehst du die Lösung.');
    if (max === 1 && offen - leer > 0) teile.pop();
    rueck.innerHTML = teile.join(' ') || 'Weiter so!';
  }
}

function zeigeRueck(u, rueck) {
  const s = uebungStand(u);
  rueck.hidden = false;
  const quote = s.max ? s.punkte / s.max : 1;
  rueck.className = 'rueck' + (quote >= 0.8 ? ' gut' : '');
  const lob = quote >= 0.9 ? ['Tài bàng le!', 'Hervorragend!']
    : quote >= 0.7 ? ['Hěn hǎo!', 'Gut gemacht.']
    : quote >= 0.5 ? ['', 'Nicht schlecht – schau dir die Lösungen noch einmal genau an.']
    : ['Jiā yóu!', 'Wiederhole die Regel im Spickzettel und versuche die Übung später noch einmal.'];
  rueck.innerHTML = `<div>${lob[0] ? `<span class="py">${lob[0]}</span> ` : ''}${lob[1]}</div>
    <div class="muted" style="font-size:15px;margin-top:4px">Punkte in dieser Übung: ${fmtZahl(s.punkte)} von ${s.max}</div>`;
}

const fmtZahl = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace('.', ','));

/* ───── Ergebnisseite ───── */
function ergebnisseite() {
  const g = gesamt();
  const sec = el('section');
  sec.appendChild(el('h1', {}, 'Dein Ergebnis'));
  const nameZeile = el('div', { class: 'leiste' });
  const name = el('input', { class: 'namefeld', placeholder: 'Dein Name', value: state.name || '', 'aria-label': 'Dein Name' });
  name.oninput = () => { state.name = name.value; speichern(); };
  nameZeile.append(el('label', {}, 'Name:'), name);
  sec.appendChild(nameZeile);
  sec.appendChild(el('div', { class: 'ergebnis-zahl' }, `${Math.round(g.prozent)} %`));
  sec.appendChild(el('p', {}, `${fmtZahl(g.punkte)} von ${g.max} Punkten in den automatisch geprüften Übungen. Beim ersten Versuch richtig = 1 Punkt, beim zweiten = ½ Punkt.`));
  const tab = el('table', { class: 'tab', style: 'margin-top:16px' });
  tab.innerHTML = `<thead><tr><th>Übung</th><th style="width:40%">Stand</th></tr></thead>`;
  const tb = el('tbody');
  uebungen().forEach((u, i) => {
    const s = uebungStand(u);
    let stand;
    if (s.unbewertet) stand = s.fertig ? '<span style="color:var(--mm-correct)">✓ erledigt</span>' : '<span class="muted">offen</span>';
    else {
      const p = s.max ? Math.round((100 * s.punkte) / s.max) : 0;
      stand = s.geloest ? `<div class="balken"><span style="width:${p}%"></span></div><div style="font-size:14px;margin-top:4px">${fmtZahl(s.punkte)} / ${s.max}${s.fertig ? '' : ' (unvollständig)'}</div>` : '<span class="muted">noch nicht bearbeitet</span>';
    }
    tb.appendChild(el('tr', {}, `<td><a href="#u${i + 1}">${i + 1}. ${fmt(u.titel)}</a></td><td>${stand}</td>`));
  });
  tab.appendChild(tb);
  sec.appendChild(tab);

  const abgabe = uebungen().filter((u) => u.abgabe);
  if (abgabe.length) {
    sec.appendChild(el('h2', { style: 'margin-top:28px' }, 'Für Moodle: bitte hochladen'));
    sec.appendChild(el('ul', {}, abgabe.map((u) => `<li>${fmt(u.titel)}: ${fmt(u.abgabe)}</li>`).join('')));
  }
  sec.appendChild(el('p', { style: 'margin-top:20px' }, g.alleFertig ? fmt('Du hast alle Übungen bearbeitet. [[Wǒ zhù nǐ chénggōng!]]') : 'Einige Übungen sind noch offen. Du kannst sie über die Nummern oben jederzeit fortsetzen.'));
  const l = el('div', { class: 'leiste no-print' });
  const druck = el('button', { type: 'button', class: 'btn' }, 'Ergebnis drucken / als PDF speichern');
  druck.onclick = () => window.print();
  const reset = el('button', { type: 'button', class: 'btn sek rechts' }, 'Alles zurücksetzen');
  reset.onclick = () => {
    if (!confirm('Wirklich alle Antworten löschen und neu beginnen?')) return;
    const n = state.name;
    state = { items: {}, erledigt: {}, name: n };
    speichern();
    geh('start');
  };
  l.append(druck, reset);
  sec.appendChild(l);
  sec.appendChild(el('p', { class: 'muted', style: 'font-size:14px;margin-top:16px' }, `Stand: ${new Date().toLocaleString('de-DE')}`));
  root.appendChild(sec);
}

start();
