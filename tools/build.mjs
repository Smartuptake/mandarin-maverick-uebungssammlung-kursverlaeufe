// Baut aus den Inhaltsordnern die Übersichtsseiten, den Katalog und die SCORM-Pakete.
// Aufruf:  node tools/build.mjs
//
// Ordnerstruktur (Beispiel Kursverläufe):
//   jg-11/                               Bereich (Ebene 1, in sammlung.json)
//   jg-11/kv-006/gruppe.json             Gruppe (Ebene 2: Titel, Themen)
//   jg-11/kv-006/01-le-guo/koffer.json   Übungskoffer (Ebene 3)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'sammlung.json'), 'utf8'));

const lies = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ordner = (p) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []);
const ohneMarkup = (t) => String(t || '').replace(/\[\[|\]\]|\{\{|\}\}|\*/g, '');
const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function seite({ titel, basis, body, script }) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(titel)}</title>
<link rel="icon" href="${basis}assets/logo/mm-logo-symbol-color.svg" type="image/svg+xml">
<link rel="stylesheet" href="${basis}engine/mm.css">
</head>
<body>
${body}
<script type="module" src="${basis}engine/${script}"></script>
</body>
</html>
`;
}

/* ───── Katalog einsammeln ───── */
// Ebene 1 = Bereich (z. B. Jahrgangsstufe, HSK-Stufe), Ebene 2 = Gruppe (Kursverlauf, Grammatikstruktur),
// Ebene 3 = Übungskoffer. Eine Gruppe ist jeder Unterordner mit gruppe.json.
const katalog = { titel: cfg.titel, kurztitel: cfg.kurztitel, ebene1: cfg.ebene1, ebene2: cfg.ebene2, hinweisStart: cfg.hinweisStart, bereiche: [] };
for (const b of cfg.bereiche) {
  const bPfad = path.join(ROOT, b.id);
  fs.mkdirSync(bPfad, { recursive: true });
  const eintrag = { ...b, gruppen: [] };
  for (const gId of ordner(bPfad)) {
    const gPfad = path.join(bPfad, gId);
    if (!fs.existsSync(path.join(gPfad, 'gruppe.json'))) continue;
    const g = { id: gId, ...lies(path.join(gPfad, 'gruppe.json')), koffer: [] };
    for (const kId of ordner(gPfad)) {
      const kf = path.join(gPfad, kId, 'koffer.json');
      if (!fs.existsSync(kf)) continue;
      const k = lies(kf);
      g.koffer.push({
        id: kId,
        titel: k.titel,
        beschreibung: k.kurzbeschreibung || '',
        anzahl: k.uebungen.length,
        dauer: k.dauer || '',
        scorm: `scorm/MM_${k.kennung}_${k.kurz}_SCORM_${k.version || 'v01'}.zip`,
      });
    }
    eintrag.gruppen.push(g);
  }
  eintrag.gruppen.sort((x, y) => (x.sortierung ?? 0) - (y.sortierung ?? 0) || x.id.localeCompare(y.id));
  katalog.bereiche.push(eintrag);
}
fs.writeFileSync(path.join(ROOT, 'katalog.json'), JSON.stringify(katalog, null, 2));

/* ───── Seiten schreiben ───── */
const katalogSeite = (ebene, pfad, basis, titel) =>
  seite({ titel, basis, script: 'katalog.js', body: `<div id="app" class="seite" data-basis="${basis}" data-ebene="${ebene}" data-pfad="${pfad}"></div>` });

fs.writeFileSync(path.join(ROOT, 'index.html'), katalogSeite('start', '', './', cfg.titel));
for (const b of katalog.bereiche) {
  fs.writeFileSync(path.join(ROOT, b.id, 'index.html'), katalogSeite('bereich', b.id, '../', `${b.titel} · ${cfg.titel}`));
  for (const g of b.gruppen) {
    fs.writeFileSync(path.join(ROOT, b.id, g.id, 'index.html'), katalogSeite('gruppe', `${b.id}/${g.id}`, '../../', `${ohneMarkup(g.titel)} · ${cfg.titel}`));
    for (const k of g.koffer) {
      fs.writeFileSync(
        path.join(ROOT, b.id, g.id, k.id, 'index.html'),
        seite({ titel: `${ohneMarkup(k.titel)} – Übungskoffer · Mandarin Maverick`, basis: '../../../', script: 'app.js', body: '<div id="app" class="seite" data-basis="../../../"></div>' }),
      );
    }
  }
}

/* ───── SCORM-Pakete ───── */
if (!process.argv.includes('--ohne-scorm')) {
  const tmpRoot = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'mm-scorm-'));
  fs.mkdirSync(path.join(ROOT, 'scorm'), { recursive: true });
  for (const b of katalog.bereiche) {
    for (const g of b.gruppen) {
      for (const k of g.koffer) {
        const quelle = path.join(ROOT, b.id, g.id, k.id);
        const kdat = lies(path.join(quelle, 'koffer.json'));
        const ziel = path.join(tmpRoot, k.id);
        fs.rmSync(ziel, { recursive: true, force: true });
        fs.mkdirSync(ziel, { recursive: true });
        fs.cpSync(path.join(ROOT, 'engine'), path.join(ziel, 'engine'), { recursive: true });
        fs.cpSync(path.join(ROOT, 'assets'), path.join(ziel, 'assets'), { recursive: true });
        fs.cpSync(quelle, path.join(ziel), { recursive: true, filter: (s) => !s.endsWith('index.html') });
        fs.writeFileSync(
          path.join(ziel, 'index.html'),
          seite({ titel: `${ohneMarkup(kdat.titel)} – Übungskoffer`, basis: './', script: 'app.js', body: '<div id="app" class="seite" data-basis="./"></div>' }),
        );
        const titel = escHtml(`MM ${kdat.kennung} – ${ohneMarkup(kdat.titel)} (Übungskoffer)`);
        fs.writeFileSync(path.join(ziel, 'imsmanifest.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="MM_${kdat.kennung}_${kdat.kurz}" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1">
      <title>${titel}</title>
      <item identifier="ITEM1" identifierref="RES1" isvisible="true">
        <title>${titel}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`);
        const zip = path.join(ROOT, k.scorm);
        fs.rmSync(zip, { force: true });
        execFileSync('zip', ['-qr', '-X', zip, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: ziel });
        console.log('SCORM:', path.relative(ROOT, zip));
      }
    }
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
console.log('Katalog und Seiten aktualisiert.');
