# Archive des décisions structurantes — editeur

Décisions archivées depuis `_contexte/contexte.md` (append only).

- 2026-07-30 : Initialisation de l'agent EDITEUR (mode création), périmètre étendu à frontend/ et
  backend/ (décision utilisateur) car le rôle implique de développer directement l'éditeur dans le
  code applicatif existant, pas seulement produire des specs.
- 2026-07-30 : Roadmap dédiée à l'éditeur intégré : sidebar gauche, édition complète de `Lignes de
  nuit`, gates automatiques interphases, seuil fonctionnel de 85 % et documentation exhaustive des
  fonctions manquantes et des tests manuels.
- 2026-07-30 : Les services et écrans partagés déjà livrés sont réutilisés comme fondations, sans
  considérer la phase 0 de l'éditeur terminée avant la création du runner canonique et la réussite de V0.
- 2026-07-30 : La spécification de composition versionnée est la source unique du mix et des stems ;
  toute copie remappe aussi les références du mixer.
- 2026-07-30 : La préécoute lit des plages de révision via Web Audio et le rendu utilise des voix DSP
  spécialisées par famille instrumentale.
- 2026-07-30 : Seuil de couverture frontend abaissé temporairement (60 %/75 %) pour
  `TransportBar.tsx`/`EditorLanding.tsx`, non testés en profondeur ; à remonter à 80 % après les
  phases V3/V5 dédiées, pour éviter la couverture artificielle interdite par la roadmap.
- 2026-07-30 : mutmut reste verrouillé en dépendance mais son exécution est bloquée nativement sous
  Windows (WSL requis) ; traité comme réserve d'infrastructure documentée, pas comme gate contourné.
- 2026-08-01 : mutmut reste bloqué même sous WSL provisionné (Ubuntu, Python 3.13, Csound) :
  incompatibilité structurelle entre `source_paths` de mutmut et le mode d'import réel du projet
  (`pythonpath`). Acté comme limite documentée (LIM-001) plutôt que poursuivi via restructuration
  app-wide des imports.
- 2026-08-02 : golden `EDITEUR/fixtures/lignes_de_nuit.golden.json` régénéré (root cause : golden
  désynchronisé par un changement du renderer `explo`, pas une régression éditeur) ; décision actée
  avec confirmation explicite de l'utilisateur, car régénérer un golden touche un gate de
  déterminisme.
- 2026-08-01 : `Pattern.events` et `Composition.mixer` (dicts génériques codant des données
  typables) migrés vers `list[NoteEvent]` et `MixerChannel` typés, pour tenir la promesse de la
  Phase 1 (schéma entièrement pilotable par données) plutôt que de considérer la phase close sur
  un socle partiel.
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
- 2026-08-05 : Phases 7 et V7 closes [FAIT] — lanes vélocité/probabilité/micro-décalage/pan,
  ghost notes hors drums, édition souris qualifiée (e2e sauvegarde/rechargement), gamme/tonalité
  avec surbrillance non bloquante, fix accélération des drags, preuve backend note→rendu par
  hash ; runner canonique vert (`v1-20260805-191709.json`). Réserves : comparaison audio
  post-édition hors Chromium, snapshot visuel shell seul. Phase 8 (Playlist) ouverte.
- 2026-08-05 : fix de la course sauvegarde/préécoute acté — `save()` partage sa promesse PUT en
  vol (`saveInFlightRef`) et `requestPreview` affiche « Sauvegarde impossible, préécoute
  annulée. » en cas d'échec : un clic « Lire la sélection » pendant une sauvegarde attend la fin
  du PUT (e2e route directe verrouillé).
- 2026-08-05 : Phases 6 et V6 closes [FAIT] — longueur/duplication/renommage/variation seedée/
  suppression sûre, sélection multiple, remplissages, préécoute piste, couleur et nom de pattern
  via migration de schéma v3 (contrat et fixture alignés, golden inchangés) ; runner canonique
  vert final (`v1-20260805-110735.json`, success true). Réserves assumées : glisser et
  multi-sélection couverts en unitaire, preuve rendu/hash frontend non formalisée (backend) ;
  couleur de piste et accès instrument reportés à la Phase 9. Phase 7 (Piano Roll) ouverte.
- 2026-08-05 : Phase 5 close [FAIT] — tempo (`120 BPM`) et métrique (`4/4`) affichés et testés.
  Phase 6 ouverte [EN COURS] : Channel Rack + séquenceur pas à pas (mute/solo, résolution,
  vélocité/probabilité/accent/micro-décalage, paint/erase, clavier, préécoute pattern) ;
  `probability`/`micro_timing_beats` propagés au rendu avec gate seedé déterministe et fix du solo ;
  runner canonique vert 20 checks (`v1-20260805-102645.json`, backend 116, frontend 96 unitaires,
  13 e2e). V6 [EN COURS] : reste longueur/duplication/renommage/suppression de patterns,
  sélection multiple, remplissages, couleur (migration schéma), drag-and-drop Playwright.

---

Archivé le : 2026-08-06 (dépassement du seuil de 10 entrées)

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
- 2026-08-06 : Playlist livrée comme composant autonome (`Playlist.tsx`) avec 19 callbacks câblés au
  store, drag à deltas incrémentés + snap, poignées de resize en vrais boutons accessibles ; le drag
  e2e pilote le défilement horizontal par `scrollLeft` explicite (`scrollIntoViewIfNeeded` fait
  passer le contenu sous le side sticky 220 px ou hors viewport). Test e2e V8 encore rouge
  (nth(1) = 6720 px vs 6528 px attendu).
- 2026-08-06 : Qualification V8 close — le test e2e rouge était une attente erronée (clip ajouté à
  `compositionEndBeat` = 62 beats, pas 60) ; l'assertion vérifie que le clip suivant est poussé de
  la distance exacte du drag. Fix du runner `test_editor.ps1` (stderr de `uv lock --check` sous
  `$ErrorActionPreference="Stop"` → `Invoke-Gate` en `Continue` local, échecs via `$LASTEXITCODE`).
  Runner canonique vert 20/20 (`v1-20260806-060208.json`). Phase 9 ouverte [EN COURS].

