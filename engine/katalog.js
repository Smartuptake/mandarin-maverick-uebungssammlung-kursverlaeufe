// Übersichtsseiten: Start → Bereich (Jahrgang / HSK-Stufe) → Gruppe (Kursverlauf / Grammatikstruktur) → Übungskoffer
import { el, fmt, esc } from './hilfen.js';

const root = document.getElementById('app');
const BASIS = root.dataset.basis || './';
const EBENE = root.dataset.ebene || 'start';
const PFAD = (root.dataset.pfad || '').split('/').filter(Boolean);

function kopf(zeile2) {
  return el('header', { class: 'mm-kopf' }, `
    <img class="logo" src="${BASIS}assets/logo/mm-logo-symbol-color.svg" alt="Mandarin Maverick">
    <div class="reihe">„Mandarin Maverick – Fast Track Chinese“</div>
    <div class="thema">${esc(zeile2)}</div>`);
}

function kachel(href, titel, unter, meta, leer) {
  return el(href ? 'a' : 'div', { class: 'kat-kachel' + (leer ? ' leer' : ''), href }, `
    <div class="t">${titel}</div>
    ${unter ? `<div class="u">${unter}</div>` : ''}
    ${meta ? `<div class="m">${meta}</div>` : ''}`);
}

const anzahlUebungen = (g) => g.koffer.length + (g.verweise || []).length;
const plural = (n, eins, mehr) => `${n} ${n === 1 ? eins : mehr}`;

async function start() {
  const kat = await (await fetch(`${BASIS}katalog.json`, { cache: 'no-cache' })).json();
  root.appendChild(kopf(kat.kurztitel || kat.titel));
  const brot = el('nav', { class: 'brot', 'aria-label': 'Brotkrumen' });
  const teile = [`<a href="${BASIS}">Übersicht</a>`];

  if (EBENE === 'start') {
    root.appendChild(el('h1', {}, esc(kat.kurztitel || kat.titel)));
    root.appendChild(el('p', {}, esc(kat.hinweisStart || '')));
    const k = el('div', { class: 'kacheln' });
    kat.bereiche.forEach((b) => {
      const n = b.gruppen.reduce((s, g) => s + anzahlUebungen(g), 0);
      k.appendChild(kachel(`${b.id}/`, esc(b.titel), esc(b.untertitel || ''), n ? plural(n, 'Übungskoffer', 'Übungskoffer') : 'Übungen folgen', !n));
    });
    root.appendChild(k);
  } else if (EBENE === 'bereich') {
    const b = kat.bereiche.find((x) => x.id === PFAD[0]);
    teile.push(esc(b.titel));
    brot.innerHTML = teile.join(' › ');
    root.appendChild(brot);
    root.appendChild(el('h1', {}, esc(b.titel)));
    root.appendChild(el('p', {}, `${b.untertitel ? esc(b.untertitel) + ' · ' : ''}Wähle ${esc(kat.ebene2)}.`));
    const k = el('div', { class: 'kacheln' });
    b.gruppen.forEach((g) => {
      const n = anzahlUebungen(g);
      const titel = (g.nr !== undefined ? `<span class="muted" style="font-weight:400">Nr. ${g.nr}</span> ` : '') + fmt(g.titel);
      k.appendChild(kachel(`${g.id}/`, titel, g.themen ? fmt(g.themen) : '', n ? plural(n, 'Übungskoffer', 'Übungskoffer') : 'Übungen folgen', !n));
    });
    root.appendChild(k);
    if (!b.gruppen.length) root.appendChild(el('p', { class: 'leer-hinweis' }, 'Hier kommen bald Übungen dazu.'));
  } else if (EBENE === 'gruppe') {
    const b = kat.bereiche.find((x) => x.id === PFAD[0]);
    const g = b.gruppen.find((x) => x.id === PFAD[1]);
    teile.push(`<a href="${BASIS}${b.id}/">${esc(b.titel)}</a>`, fmt(g.titel));
    brot.innerHTML = teile.join(' › ');
    root.appendChild(brot);
    root.appendChild(el('h1', {}, (g.nr !== undefined ? `Nr. ${g.nr} · ` : '') + fmt(g.titel)));
    if (g.themen) root.appendChild(el('p', {}, fmt(g.themen)));
    if (g.nachschlagen) root.appendChild(el('p', {}, `<a href="${esc(g.nachschlagen)}" target="_blank" rel="noopener">Im Grammatik-Nachschlagewerk nachlesen ↗</a>`));
    const k = el('div', { class: 'kacheln' });
    g.koffer.forEach((kf) => k.appendChild(kachel(`${kf.id}/`, fmt(kf.titel), kf.beschreibung ? fmt(kf.beschreibung) : '', `${kf.anzahl} Übungen · ${esc(kf.dauer)}`)));
    (g.verweise || []).forEach((v) => k.appendChild(kachel(v.url, fmt(v.titel), v.beschreibung ? fmt(v.beschreibung) : '', `${v.anzahl ? v.anzahl + ' Übungen · ' : ''}${esc(v.dauer || '')}${v.quelle ? ' · ' + esc(v.quelle) : ''}`)));
    root.appendChild(k);
    if (!anzahlUebungen(g)) root.appendChild(el('p', { class: 'leer-hinweis' }, 'Zu dieser Struktur kommen bald Übungen dazu.'));
    if (g.koffer.length) {
      const d = el('details', { class: 'spick', style: 'margin-top:32px' });
      d.innerHTML = `<summary>Für Lehrkräfte: Moodle-Pakete (SCORM)</summary>
        <div class="inhalt"><p>In Moodle: <em>Aktivität oder Material anlegen → SCORM-Paket</em> → Zip-Datei hochladen. Punkte und Bearbeitungsstand erscheinen dann im Bewertungsbuch.</p>
        <ul>${g.koffer.map((kf) => `<li><a href="${BASIS}${kf.scorm}" download>${fmt(kf.titel)} – SCORM-Paket</a></li>`).join('')}</ul></div>`;
      root.appendChild(d);
    }
  }
  root.appendChild(el('footer', { class: 'mm-fuss' }, 'Mandarin Maverick – Fast Track Chinese'));
}

start();
