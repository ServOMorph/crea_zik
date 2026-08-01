# Contexte — explo

## Objectif (immuable sauf décision explicite)
Faire des recherches et des explorations sonores pour crea_zik : identifier, tester et documenter
des techniques de synthèse, de DSP et de composition algorithmique permettant de créer des sons et
des musiques originaux, réutilisables dans le projet crea_zik.

## Stack / contraintes techniques (stable, rarement modifié)
Contrainte permanente du projet parent : aucun son, sample, morceau, SoundFont ni réponse
impulsionnelle récupéré sur le Web — tout son final est créé localement par synthèse, DSP,
composition algorithmique ou modélisation physique. Les recherches Web ne servent qu'à consulter
code, licences et documentation technique ; aucun asset audio externe ne doit être téléchargé.

Moteurs du projet parent : Csound 7 (rendu offline, moteur principal), pyo (fallback), Faust
(cible DSP portable). Backend Python (uv/pyproject.toml).

Recherches déjà produites côté crea_zik, à consulter avant de dupliquer :
`_docs/index_recherches_audio.md` (index), `_docs/analyse_vibecoding_audio.md`,
`_docs/audit_github_audio_open_source.md`.

## État actuel (réécrit intégralement à chaque /close)
Le premier morceau est archivé sous `archives/morceaux/lignes-de-nuit/versions/v001/`. Le kick
codé en dur de `morceau_electro/render.py` n'est pas encore remplacé par le plugin kick.
`roadmap_plugins.md` : phases 1 à 3 terminées côté explo/crea_zik (manifeste, banc de test UI,
promotion sur le moteur de composition). Phase 4 (socle commun `plugins/_common/dsp.py`) terminée :
validation et primitives DSP mutualisées, couches de synthèse restent propres à chaque plugin.
Phase 5 (punch du kick) en cours : bandpass sur le click et sweep de hauteur sur le sub faits et
testés (45 tests verts) ; duck d'attaque, transitoire sub dédié et saturation par couche différés.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-30 : Création de l'agent explo via /create_agent.
- 2026-07-30 : Les archives de morceaux sont immuables par version, adressées par SHA-256 et contiennent
  l’intention, l’inspiration traduite, les sources, les rendus, les stems et les mesures QA.
- 2026-07-30 : Les plugins explo exposent un manifeste JSON générique comme contrat d'UI ; aucune UI
  n'est codée dans explo. La promotion vers le dossier plugins applicatif est faite par la zone crea_zik.
- 2026-07-30 : Moteur kick livré en un seul chemin de synthèse déterministe (corps/sub/transitoire/bruit)
  couvrant les trois presets sans divergence de code ; validé par tests de non-régression sur empreintes SHA-256.
- 2026-08-01 : Socle commun des plugins (`plugins/_common/dsp.py`) : validation de paramètres et
  primitives DSP mutualisées entre plugins ; pas de modèle générique de « couche » de synthèse,
  qui reste propre à chaque instrument.
- 2026-08-01 : Amélioration du kick choisie parmi 5 réglages proposés : bandpass de présence sur le
  click et enveloppe de hauteur sur le sub ; 3 réglages restants (duck, transitoire sub, saturation
  par couche) différés et documentés en phase 5 de `roadmap_plugins.md`.
