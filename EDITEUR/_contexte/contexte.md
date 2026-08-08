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
Phases 9, 10, 11, 12 closes [FAIT] (V9/V10/V11/V12 validées).
Phase 13 (Durcissement, accessibilité et livraison) ouverte.
- Correction du `AudioContext` suspendu en local (test e2e transport validé).
- Correction du regex invalide dans `studio.spec.ts:567` et des types TypeScript dans `RenderAnalysis.tsx`.
- Exclusion de `.stryker-tmp` des vérifications ESLint et de la couverture de code.
- Correction des tests `editorStore.test.ts` et `stepSequencer.test.ts` pour résister aux mutations Stryker (gate frontend-mutation).

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-08-06 : **Panneau Automations dédié acté** — Décision d'assumer définitivement le panneau
  `Automations.tsx` comme solution d'intégration visuelle, plutôt que des lanes dans `Playlist.tsx`.
- 2026-08-06 : **Scope master des automations retiré** — Le scope `master` a été retiré du schéma
  `AutomationLane.target` avec validation explicite pour rejeter les cibles `master.*`.
- 2026-08-06 : **Comportement rendu sérié acté** — les rendus sont toujours traités en file sériée
  (1 worker, séquentiel). L'executor actuel est validé comme solution définitive. UI mise à jour
  pour afficher le nombre de jobs en attente. Voir `jobs.py` et `api.py`.
- 2026-08-08 : **Tests résistants aux mutations** — Remplacement de `.toHaveLength(0)` par `.toEqual([])`
  pour les stacks d'historique (`undoStack`, `redoStack`) dans `editorStore.test.ts` et `stepSequencer.test.ts`
  afin de tuer les mutants Stryker et passer la gate frontend-mutation.
- 2026-08-06 : Étape 12.5 (écran « Analyse & Export ») close [FAIT] après reprise d'une session
  interrompue par une panne de crédits d'un agent tiers dont la livraison, malgré des tests verts,
  restait partielle au regard du gate (portée/format/annulation/état périmé absents). Le parcours
  Playwright ajouté a détecté un bug réel masqué par les tests unitaires stubés : `GET .../renders`
  n'exposait jamais `qa_url` côté backend (`api.py`) depuis l'étape 12.3 — corrigé et testé.
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

