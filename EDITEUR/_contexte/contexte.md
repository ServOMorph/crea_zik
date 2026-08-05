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
Phase 6 close [FAIT] (longueur/duplication/renommage/variation seedée/suppression sûre de
patterns, sélection multiple, remplissages, préécoute piste, couleur/nom via migration de schéma
v3) ; V6 close [FAIT] avec réserves assumées (glisser/multi-sélection en unitaire, preuve
rendu/hash frontend non formalisée). Phase 7 ouverte [EN COURS] : piano roll de base livré
(`PianoRoll.tsx` + `noteCommands.ts` + `pianoRollGeometry.ts`, e2e Chromium rendu+transposition),
fix course sauvegarde/préécoute livré (`saveInFlightRef`), runner canonique vert
(`v1-20260805-161626.json`, success true, mutation 79,17 %). Restent Phase 7 : lanes, ghost
notes, édition souris UI, qualification V7.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
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
- 2026-08-05 : Phase 5 close [FAIT] — tempo (`120 BPM`) et métrique (`4/4`) affichés et testés.
  Phase 6 ouverte [EN COURS] : Channel Rack + séquenceur pas à pas (mute/solo, résolution,
  vélocité/probabilité/accent/micro-décalage, paint/erase, clavier, préécoute pattern) ;
  `probability`/`micro_timing_beats` propagés au rendu avec gate seedé déterministe et fix du solo ;
  runner canonique vert 20 checks (`v1-20260805-102645.json`, backend 116, frontend 96 unitaires,
  13 e2e). V6 [EN COURS] : reste longueur/duplication/renommage/suppression de patterns,
  sélection multiple, remplissages, couleur (migration schéma), drag-and-drop Playwright.
- 2026-08-05 : Phases 6 et V6 closes [FAIT] — longueur/duplication/renommage/variation seedée/
  suppression sûre, sélection multiple, remplissages, préécoute piste, couleur et nom de pattern
  via migration de schéma v3 (contrat et fixture alignés, golden inchangés) ; runner canonique
  vert final (`v1-20260805-110735.json`, success true). Réserves assumées : glisser et
  multi-sélection couverts en unitaire, preuve rendu/hash frontend non formalisée (backend) ;
  couleur de piste et accès instrument reportés à la Phase 9. Phase 7 (Piano Roll) ouverte.
- 2026-08-05 : fix de la course sauvegarde/préécoute acté — `save()` partage sa promesse PUT en
  vol (`saveInFlightRef`) et `requestPreview` affiche « Sauvegarde impossible, préécoute
  annulée. » en cas d'échec : un clic « Lire la sélection » pendant une sauvegarde attend la fin
  du PUT (e2e route directe verrouillé).
