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
Phases 0→3/V0→V3, V4, Phase 4 et V5 [FAIT]. Virtualisation livrée (`VirtualList` +
`computeVirtualWindow`) et intégrée à la liste de pistes de `EditorLanding` (fini : pagination).
Transport et préécoute qualifiés : machine d'état à horloge contrôlée, `MockAudioContext`,
parcours Chromium réel, cache/invalidation/annulation ; runner canonique vert (rapport
`test-results/v1-20260804-224727.json`, 20 checks). Phase 5 fonctionnelle [EN COURS] : il ne reste
que l'affichage du tempo et de la métrique dans la barre de transport avant d'ouvrir la Phase 6.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-30 : mutmut reste verrouillé en dépendance mais son exécution est bloquée nativement sous
  Windows (WSL requis) ; traité comme réserve d'infrastructure documentée, pas comme gate contourné.
- 2026-08-01 : mutmut reste bloqué même sous WSL provisionné (Ubuntu, Python 3.13, Csound) : incompatibilité
  structurelle entre `source_paths` de mutmut et le mode d'import réel du projet (`pythonpath`).
  Acté comme limite documentée (LIM-001) plutôt que poursuivi via restructuration app-wide des imports.
- 2026-08-01 : `Pattern.events` et `Composition.mixer` (dicts génériques codant des données typables)
  migrés vers `list[NoteEvent]` et `MixerChannel` typés, pour tenir la promesse de la Phase 1 (schéma
  entièrement pilotable par données) plutôt que de considérer la phase close sur un socle partiel.
- 2026-08-02 : golden `EDITEUR/fixtures/lignes_de_nuit.golden.json` régénéré (root cause : golden
  désynchronisé par un changement du renderer `explo`, pas une régression éditeur) ; décision actée
  avec confirmation explicite de l'utilisateur, car régénérer un golden touche un gate de
  déterminisme.
- 2026-08-04 : Phase V1 close [FAIT] — propriétés Hypothesis (round-trip `Composition` + validation
  des références) ajoutées via stratégies composites respectant le graphe de références ; le point
  mutations reste bloqué et documenté (LIM-001). Phase V2 ouverte.
- 2026-08-04 : Phase V2 et Phase 2 (API de composition et persistance sûre) closes [FAIT] —
  qualification complète de l'API de composition (routes nominales, erreurs typées, fuzz, concurrence,
  interruption/reprise, chemins hostiles, isolation) ; runner canonique complet vert. 500 non typé
  corrigé via `CompositionIdMismatchError` (422 `composition_id_mismatch`).
- 2026-08-04 : Phase V3 et Phase 3 (shell, sidebar et routage) closes [FAIT] — composants et états
  de page testés (Vitest+RTL), axe-core sur l'éditeur réel et ses états introuvable/vide, parcours
  Playwright URL directe/historique/sidebar active/conservation du projet, snapshots visuels
  approuvés ; runner canonique complet vert (V0→V2 inclus).
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
