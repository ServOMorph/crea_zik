# Contexte — crea_zik

## Objectif (immuable sauf décision explicite)
Créer de la musique et des effets sonores pour des applications et des jeux vidéo.

## Stack / contraintes techniques (stable, rarement modifié)
- Aucun son, sample, morceau, SoundFont ou réponse impulsionnelle récupéré sur le Web.
- Les sources audio sont créées localement par synthèse, DSP, composition et modèles physiques codés.
- Csound 7.0.0-beta.17 pour le rendu offline ; pyo 1.0.5 comme fallback ; Faust comme cible DSP portable.

## État actuel (réécrit intégralement à chaque /close)
Les phases 0 et 1 couvrent le benchmark, les schémas métier v1, la provenance, la CLI, Csound et l’API.
Le gate de déterminisme Csound réel est validé : trois rendus indépendants du même patch produisent un WAV au SHA-256 identique.
`EXPLO/` contient un premier morceau de 30 s et son archive versionnée avec master, stems, sources et QA.
`roadmap_studio_audio_procedural.md` : phase 2 [FAIT] (réaudit 2026-07-31). Phases 3 (bibliothèque
DSP/Sound Designer) et 4 (Composition/Music Composer) réauditées le 2026-08-02 et restent [TODO] :
socle réel non négligeable mais gates non remplis (voir notes d'audit dans le roadmap). Le volet UI de
la phase 4 est piloté par `EDITEUR/roadmap_editeur_musical.md`, en tout début d'exécution. Phases 5
et 6 restent à auditer.
`EXPLO/roadmap_plugins.md` intégralement livré : phase 2 (banc de test UI, validé dans un Chromium
réel piloté par script — écoute subjective humaine encore en attente) et phase 3 (le kick est branché
sur le moteur de composition via des paramètres d'instrument opt-in `plugin_id`/`plugin_preset`, sans
copie de fichiers vers un dossier applicatif séparé ; équivalence bit-à-bit vérifiée par test entre
rendu direct et rendu via composition).

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
Entrées antérieures au 2026-07-28 archivées dans `_contexte/archive_decisions.md`.
- 2026-07-28 : Le lancement local par défaut utilise `127.0.0.1:8002` pour l’API et `127.0.0.1:5174` pour l’UI.
- 2026-07-28 : Playwright utilise les ports isolés `8001`/`5180` et une racine de projets temporaire.
- 2026-07-28 : Les projets utilisent les schémas de domaine versionnés v1 ; les exemples intégrés
  sont copiés vers un projet avant rendu et restent immuables dans la galerie.
- 2026-07-30 : Les erreurs de rendu et de CLI sont typées et journalisées en JSON ; tout export CLI
  comprend un manifeste de provenance déterministe.
- 2026-07-30 : Les explorations musicales conservent leurs sources, rendus, stems, QA et documentation
  dans une archive versionnée adressée par SHA-256 ; l’éditeur devra produire ce même descripteur.
- 2026-07-30 : Le rendu Csound réel est confirmé déterministe par hachage du WAV produit sur trois
  rendus indépendants (pas seulement le hash de spec renvoyé par le CLI).
- 2026-07-30 : Les rendus de plugins explo (numpy, sub-seconde) passent par un endpoint synchrone dédié,
  sans passer par la file de jobs Csound ; les contrôles UI sont entièrement générés depuis le manifeste
  JSON, jamais câblés en dur par plugin.
- 2026-07-31 : `roadmap_studio_audio_procedural.md` phase 2 close [FAIT] avec écart assumé face au code
  réel (pas de réécriture complète) ; les phases 3 à 6 restent à réauditer avant reprise.
- 2026-07-31 : Un plugin explo validé est promu vers le moteur de composition via des paramètres
  d’instrument opt-in (`plugin_id`, `plugin_preset`, `plugin_overrides`), sans copie de fichiers vers
  un dossier plugins applicatif séparé, pour éviter toute divergence de version avec explo.
- 2026-08-02 : Phases 3 et 4 de `roadmap_studio_audio_procedural.md` réauditées et laissées [TODO]
  (gates non remplis, détail dans le roadmap) ; le volet UI de la phase 4 est reconnu comme piloté par
  `EDITEUR/roadmap_editeur_musical.md` plutôt que redondant avec cette roadmap.
