// Minimaler SCORM-1.2-Adapter. Läuft der Übungskoffer in Moodle (SCORM-Aktivität),
// werden Punktzahl, Status und Einzelergebnisse ins Moodle-Bewertungsbuch übertragen.
// Ohne LMS (normaler Link) tut dieses Modul einfach nichts.

function findAPI(win) {
  let tries = 0;
  while (win && !win.API && win.parent && win.parent !== win && tries < 10) {
    win = win.parent;
    tries++;
  }
  return win && win.API ? win.API : null;
}

let api = null;
let aktiv = false;
let interaktionNr = 0;

export const scorm = {
  get aktiv() { return aktiv; },

  start() {
    try {
      api = findAPI(window) || (window.opener ? findAPI(window.opener) : null);
      if (!api) return false;
      const r = api.LMSInitialize('');
      aktiv = r === 'true' || r === true;
      if (aktiv) {
        const status = api.LMSGetValue('cmi.core.lesson_status');
        if (!status || status === 'not attempted') api.LMSSetValue('cmi.core.lesson_status', 'incomplete');
        const n = Number(api.LMSGetValue('cmi.interactions._count'));
        interaktionNr = Number.isFinite(n) ? n : 0;
        api.LMSCommit('');
      }
    } catch (e) {
      aktiv = false;
    }
    return aktiv;
  },

  schuelerName() {
    if (!aktiv) return '';
    try {
      // Moodle liefert "Nachname, Vorname"
      const n = api.LMSGetValue('cmi.core.student_name') || '';
      const [nach, vor] = n.split(',').map((s) => s.trim());
      return vor ? `${vor} ${nach}` : n;
    } catch (e) { return ''; }
  },

  punkte(prozent, abgeschlossen) {
    if (!aktiv) return;
    try {
      api.LMSSetValue('cmi.core.score.min', '0');
      api.LMSSetValue('cmi.core.score.max', '100');
      api.LMSSetValue('cmi.core.score.raw', String(Math.round(prozent)));
      if (abgeschlossen) api.LMSSetValue('cmi.core.lesson_status', 'completed');
      api.LMSCommit('');
    } catch (e) { /* LMS-Fehler dürfen die Übung nie blockieren */ }
  },

  interaktion(id, typ, antwort, richtig) {
    if (!aktiv) return;
    try {
      const p = `cmi.interactions.${interaktionNr}.`;
      api.LMSSetValue(p + 'id', String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 255));
      api.LMSSetValue(p + 'type', typ);
      api.LMSSetValue(p + 'student_response', String(antwort).slice(0, 255));
      api.LMSSetValue(p + 'result', richtig ? 'correct' : 'wrong');
      interaktionNr++;
    } catch (e) { /* ignorieren */ }
  },

  ende() {
    if (!aktiv) return;
    try {
      api.LMSCommit('');
      api.LMSFinish('');
    } catch (e) { /* ignorieren */ }
    aktiv = false;
  },
};
