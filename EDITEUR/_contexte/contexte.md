# Contexte — editeur

## Objectif (immuable sauf décision explicite)
Concevoir et développer l'éditeur de son et de musique de crea_zik : l'interface (Sound Designer,
Music Composer, Adaptive Lab, Analyse & Export) et son backend de rendu, permettant de concevoir,
écouter, comparer, analyser et exporter des musiques et effets sonores générés par code.

## Stack / contraintes techniques (stable, rarement modifié)
- Frontend : React + TypeScript + Vite ; état serveur/cache via couche de requêtes dédiée ; état
  d'édition local séparé de l'état sauvegardé ; Web Audio API pour lecture/transport/préécoute ;
  Canvas/WebGL uniquement si la densité des visualisations le justifie ; tests Vitest (unitaires) et
  Playwright (end-to-end).
- Backend : Python, API HTTP typée FastAPI + schémas Pydantic ; file de travaux pour rendus/analyses/
  exports ; progression par Server-Sent Events ; processus DSP séparé (annulation, délai maximal,
  remplacement du moteur) ; écoute limitée à `127.0.0.1` par défaut ; chemins de fichiers résolus
  uniquement dans les dossiers de projets autorisés.
- Moteurs de rendu : Csound 7 (principal), pyo (fallback), Faust (cible DSP portable). Aucun son
  externe (pas de samples, morceaux, SoundFonts, réponses impulsionnelles).
- Navigation cible : Accueil/Projets > Projet > Bibliothèque, Sound Designer, Music Composer,
  Adaptive Lab, Analyse & Export, Historique, Réglages.
- Packaging MVP : application Web locale lancée par Python ; version distribuable = backend empaqueté
  + fichiers statiques frontend + lanceur + binaires DSP verrouillés par version.
- Référence complète : `_docs/specification_ui_studio_audio.md` (architecture UI détaillée, principes
  UX, wireframes).
- État projet au 2026-07-30 (README racine) : UI locale existante crée des projets, rend une galerie
  copiée, propose un Sound Designer minimal, affiche les jobs SSE. Gate de déterminisme du rendu
  Csound réel restant avant de poursuivre la roadmap applicative.

## État actuel (réécrit intégralement à chaque /close)
Phases 9, 10 et 11 (instruments, Automations, Mixer/routage/effets) et leurs qualifications V9/V10/
V11 closes [FAIT]. Phase 12 (Rendu final, QA et export) ouverte : découpée en sept étapes
séquentielles (12.1 métriques true peak/LUFS manquantes, 12.2 modèle/manifeste étendu, 12.3 rendu
périmé, 12.4 gate promotion master, 12.5 écran Analyse & Export, 12.6 téléchargement/bundle, 12.7
non-régression) documentées dans `EDITEUR/roadmap_editeur_musical.md`. Le moteur de rendu, l'écriture
WAV et les métriques de base existent déjà ; à construire en premier : true peak et LUFS. Deux écarts
restent à trancher (voir `_contexte/signals.md`) : panneau Automations dédié plutôt que lanes dans
`Playlist.tsx`, et scope `master` d'automation validé par le schéma mais non appliqué par le moteur
de rendu.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-08-06 : Phase 12 (Rendu final, QA et export) ouverte — découpée en 7 étapes séquentielles
  après audit de l'existant (moteur de rendu, WAV, jobs, métriques de base déjà livrés ; true peak,
  LUFS, manifeste enrichi, gate promotion master, écran Analyse & Export et bundle restent à
  construire). Détail dans `EDITEUR/roadmap_editeur_musical.md`, Phase 12.
- 2026-08-06 : Phases 11 et V11 (Mixer, routage et effets) closes [FAIT] — routage topologique
  piste→bus→master avec sends, DSP réel mais minimal (EQ biquad, saturation, compresseur, délai,
  réverbération existante conservée), cycle détecté sur `output` ET `sends` (extension backend +
  portage frontend), A/B via endpoint de préécoute non persistant (`mixer-preview`), stems pré/post-
  fader. Runner canonique vert (`v1-20260806-144211.json`, Stryker 63,69 %). Phase 12 à ouvrir.
- 2026-08-06 : Phases 10 et V10 (Automations) closes [FAIT] — tests `fast-check` sur les commandes
  d'automation et parcours Playwright (création/déplacement/suppression/undo-redo) ajoutés ; bug réel
  mineur corrigé dans `execute()` (`editorStore.ts`) trouvé par le test de propriétés : `composition:
  after` non cloné désynchronisait l'état courant de l'état reconstruit par undo/redo sur les valeurs
  `-0`. Runner canonique vert (`v1-20260806-112817.json`).
- 2026-08-06 : Automations (Phase 10) — moteur backend et store frontend hérités d'une session
  interrompue (lint cassé, aucune vue), vérifiés complets et verts puis complétés par le panneau
  `Automations.tsx`. Écart assumé : panneau dédié plutôt que lanes dans `Playlist.tsx` ; scope
  `master` d'automation exclu de l'UI car non appliqué par le moteur. V10 reste ouverte (fast-check
  et Playwright manquants).
- 2026-08-06 : Phases 9 et V9 closes [FAIT] — registre typé des instruments (`instrument_registry.py`),
  sanitize NaN→défaut + clamp, exposé par `GET /api/instrument-registry` ; inspecteur d'instrument
  (sliders/saisie précise, reset, A/B, bypass original, préécoute note/pattern/piste) intégré ;
  parité bornes UI/backend, valeurs non finies neutralisées ; runner canonique vert 21/21
  (`v1-20260806-073005.json`). Phase 10 ouverte.
- 2026-08-06 : Qualification V8 close — le test e2e rouge était une attente erronée (clip ajouté à
  `compositionEndBeat` = 62 beats, pas 60) ; l'assertion vérifie que le clip suivant est poussé de
  la distance exacte du drag. Fix du runner `test_editor.ps1` (stderr de `uv lock --check` sous
  `$ErrorActionPreference="Stop"` → `Invoke-Gate` en `Continue` local, échecs via `$LASTEXITCODE`).
  Runner canonique vert 20/20 (`v1-20260806-060208.json`). Phase 9 ouverte [EN COURS].
- 2026-08-06 : Playlist livrée comme composant autonome (`Playlist.tsx`) avec 19 callbacks câblés au
  store, drag à deltas incrémentés + snap, poignées de resize en vrais boutons accessibles ; le drag
  e2e pilote le défilement horizontal par `scrollLeft` explicite (`scrollIntoViewIfNeeded` fait
  passer le contenu sous le side sticky 220 px ou hors viewport). Test e2e V8 encore rouge
  (nth(1) = 6720 px vs 6528 px attendu).
- 2026-08-04 : Phase V4 (store, commandes et sauvegarde) close [FAIT] — store 100 % lignes et
  branches, fast-check des inverses, cent opérations puis cent undo/redo comparées, Stryker sur
  `editorStore.ts`/`transport.ts` (break 60 %) ; runner canonique vert (20 checks). La Phase 4
  fonctionnelle reste ouverte : seule la virtualisation des grandes listes manque.
- 2026-08-04 : Phase 4 fonctionnelle et Phase V5 closes [FAIT] — virtualisation livrée
  (`VirtualList` + `computeVirtualWindow`, couverture 100 %, 5000 lignes) et intégrée à
  `EditorLanding` ; transport et préécoute qualifiés (horloge contrôlée, `MockAudioContext`,
  Chromium réel, cache/invalidation/annulation) ; runner canonique vert
  (`EDITEUR/test-results/v1-20260804-224727.json`, 20 checks). La Phase 5 fonctionnelle reste
  ouverte sur un point : affichage du tempo et de la métrique dans `TransportBar`.
- 2026-08-05 : Phase 5 close [FAIT] — tempo (`120 BPM`) et métrique (`4/4`) affichés et testés.
  Phase 6 ouverte [EN COURS] : Channel Rack + séquenceur pas à pas (mute/solo, résolution,
  vélocité/probabilité/accent/micro-décalage, paint/erase, clavier, préécoute pattern) ;
  `probability`/`micro_timing_beats` propagés au rendu avec gate seedé déterministe et fix du solo ;
  runner canonique vert 20 checks (`v1-20260805-102645.json`, backend 116, frontend 96 unitaires,
  13 e2e). V6 [EN COURS] : reste longueur/duplication/renommage/suppression de patterns,
  sélection multiple, remplissages, couleur (migration schéma), drag-and-drop Playwright.
