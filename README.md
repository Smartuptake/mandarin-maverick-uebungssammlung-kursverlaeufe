# Mandarin Maverick Übungssammlung · Kursverläufe

Digitale Übungskoffer zu den Kursverläufen von **Mandarin Maverick – Fast Track Chinese**.
Gestaltung nach **MM-Designhandbuch v1.5**.

© 2026 Mandarin Maverick · Stefan Happel · Alle Rechte vorbehalten

## Aufbau

```
jg-10/ jg-11/ jg-12/                  Jahrgangsstufen (1.–3. Lernjahr)
jg-11/kv-006/gruppe.json              ein Kursverlauf: Titel und Themen
jg-11/kv-006/01-le-guo/koffer.json    ein Übungskoffer: alle Inhalte
engine/                               die Übungs-Software (für alle Koffer gleich)
assets/                               Logo, Icons, Figuren
scorm/                                fertige Moodle-Pakete (werden erzeugt)
tools/                                build.mjs, test.mjs, engine-abgleichen.sh
```

Jede Ebene hat ihre eigene Adresse und kann einzeln verschickt werden:
`…/` (alles) · `…/jg-11/` · `…/jg-11/kv-006/` · `…/jg-11/kv-006/01-le-guo/`

## Übungstypen

| Typ | Übungsform | Auswertung |
|---|---|---|
| `karteikarten` | Wiederhole mit Flashcards | unbewertet |
| `richtigfalsch` | Richtig oder falsch? | automatisch, 1 Versuch |
| `auswahl` | Single/Multiple Choice, „Welches Wort passt nicht?“ | automatisch |
| `zuordnen` | Begriffe/Sätze/Hanzi ↔ Pinyin matchen | automatisch |
| `luecke` | Lückentext mit Wortspeicher oder freier Eingabe | automatisch |
| `reihenfolge` | Wörter in die richtige Reihenfolge bringen | automatisch |
| `gruppieren` | Gruppieren nach Logik, geführte Mind-Map | automatisch |
| `fehler` | Fehler finden und korrigierten Satz notieren | automatisch |
| `eingabe` | Umformen, Übersetzen, Satz bilden (Pinyin oder Hanzi) | automatisch |
| `aufnahme` | Vorlesen, aufnehmen, Datei für Moodle speichern | unbewertet |
| `schreiben` | Text/Dialog mit Checkliste, als Datei speichern | unbewertet |

Pinyin wird fair geprüft: Tonzahlen (`hao3`) und Tonzeichen (`hǎo`) gelten gleich,
Leerzeichen, Groß-/Kleinschreibung und Satzzeichen zählen nicht, `yí ge`/`yī ge` sind gleichwertig.
Stimmt alles außer den Tönen, heißt es „Fast richtig – prüfe die Töne“.
Beim ersten Versuch richtig = 1 Punkt, beim zweiten = ½ Punkt, danach wird die Lösung gezeigt.

Markup in `koffer.json`: `[[pīnyīn]]` = blau, `{{汉字}}` = Kaiti/rot, `*kursiv*`; alles andere ist Deutsch.
Lösungsvarianten: `"Wǒ méi (yǒu) chī."` akzeptiert mit und ohne *yǒu*.

## Nach jeder Änderung

```bash
node tools/test.mjs     # Selbstkontrolle: jede Lösung muss die eigene Prüfung bestehen
node tools/build.mjs    # Übersichtsseiten, katalog.json und SCORM-Pakete neu erzeugen
```

## Moodle

Im Kursverlauf unten „Für Lehrkräfte: Moodle-Pakete (SCORM)“ → Zip-Datei herunterladen →
in Moodle *Aktivität anlegen → SCORM-Paket* → hochladen. Punkte und Status erscheinen im Bewertungsbuch.
Audio, eigene Mind-Maps und Texte geben die Lernenden über eine Moodle-Aufgabe ab.

## Datenschutz

Keine Anmeldung, kein Tracking, keine Speicherung auf einem Server. Der Lernstand liegt nur im
Browser des Geräts; Aufnahmen verlassen das Gerät nur, wenn die Lernenden sie selbst hochladen.
