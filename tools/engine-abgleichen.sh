#!/bin/sh
# Übernimmt Übungs-Software (engine/), Werkzeuge und Assets in die anderen Übungssammlungen,
# damit alle Repositorys dieselbe Technik nutzen. Aufruf aus diesem Repository:  sh tools/engine-abgleichen.sh
set -e
HIER="$(cd "$(dirname "$0")/.." && pwd)"
for ZIEL in "$HIER/../mandarin-maverick-uebungssammlung-grammatik"; do
  [ -d "$ZIEL" ] || continue
  rsync -a --delete "$HIER/engine/" "$ZIEL/engine/"
  rsync -a "$HIER/assets/" "$ZIEL/assets/"
  cp "$HIER/tools/build.mjs" "$HIER/tools/test.mjs" "$ZIEL/tools/"
  echo "abgeglichen: $ZIEL"
done
