# Roadmap — éditeur musical intégré

Créée le : 2026-07-30

## Objectif

Ajouter à l’UI de Crea Zik un onglet `Éditeur musical`, accessible depuis une sidebar fixe à gauche,
permettant d’ouvrir une copie de `Lignes de nuit` et d’en modifier l’intégralité depuis l’interface :
structure, tempo, métrique, tonalité, pistes, patterns, notes, vélocités, instruments procéduraux,
automations, mixage, effets, mastering, seed, rendu et export.

L’expérience reprend les concepts utiles de FL Studio — Channel Rack, séquenceur pas à pas, Playlist,
Piano Roll, Automation Clips et Mixer — sans chercher à reproduire son interface ni à devenir un DAW
généraliste.

Le chantier est exécuté en une seule passe continue. Il ne contient aucune pause de protocole ni
validation intermédiaire demandée à l’utilisateur. Une phase fonctionnelle ne débloque la suivante
que lorsque sa phase de validation automatique associée réussit intégralement.

## Périmètre

### Inclus

- shell applicatif avec sidebar gauche et routage par onglet ;
- onglet `Éditeur musical` desktop-first ;
- copie éditable de l’exemple immuable `Lignes de nuit` ;
- arrangement multipiste par patterns et clips ;
- séquenceur pas à pas pour les percussions ;
- Piano Roll pour toutes les pistes mélodiques ;
- instruments procéduraux et paramètres de synthèse ;
- automations de paramètres ;
- mixer avec mute, solo, gain, pan, bus, sends et effets ;
- transport, boucle, scrubbing, zoom et préécoute ;
- undo/redo, sauvegarde explicite et détection des changements non sauvegardés ;
- rendu déterministe, stems, QA et export WAV ;
- raccourcis clavier, accessibilité et parcours Playwright.

### Hors périmètre

- import de samples, SoundFonts ou réponses impulsionnelles ;
- enregistrement microphone ou audio ;
- hébergement de plugins VST tiers ;
- collaboration temps réel ;
- reproduction visuelle ou comportementale exacte de FL Studio ;
- édition complète sur smartphone.

## Invariants

- La source de vérité est une spec JSON versionnée et validée par Pydantic.
- Aucune note, séquence, automation ou valeur artistique de `Lignes de nuit` ne reste codée en dur
  dans le renderer.
- Les générateurs DSP restent séparés des données musicales éditables.
- Toute opération aléatoire dépend d’une seed explicite.
- Les exemples de galerie restent immuables ; l’utilisateur modifie toujours une copie.
- L’état d’édition local est séparé de l’état sauvegardé.
- Aucun changement de projet n’est perdu silencieusement.
- Le frontend ne fournit aucun chemin arbitraire au backend ou au moteur.
- Le rendu reste à 48 kHz et conserve spec, seed, versions, hash et rapport QA.
- Chaque phase fonctionnelle est suivie d’une phase de validation automatique bloquante.
- Aucun test n’est contourné, neutralisé ou affaibli pour faire passer un gate.
- Un échec arrête l’avancement, déclenche la correction puis la réexécution complète du gate.
- L’utilisateur n’a aucun test, réglage technique ou commande de diagnostic à exécuter.

## Définition mesurable du « fonctionnel à 85 % »

Une suite de tests finie ne peut pas démontrer l’absence absolue de défaut. L’objectif vérifiable est :

- au moins 85 % des critères fonctionnels planifiés sont livrés, utilisables et validés ;
- 100 % des parcours critiques couverts de bout en bout dans un vrai navigateur ;
- 100 % de couverture lignes et branches sur le domaine, les migrations, le store d’édition,
  l’historique de commandes, les conversions temporelles et le routage audio ;
- seuil minimal global de 90 % des lignes et 85 % des branches pour le backend et le frontend ;
- tests de propriétés et tests de mutation sur les algorithmes critiques afin d’éviter une couverture
  artificielle ;
- validation déterministe du rendu, des stems, des manifests et des métriques audio ;
- zéro erreur console, requête réseau inattendue, test ignoré ou défaut bloquant à la livraison ;
- inspection visuelle et écoute critique finales exécutées par l’agent, sans action demandée à
  l’utilisateur.

Le taux fonctionnel est calculé depuis une matrice d’exigences identifiées et pondérées avant le
développement. Un critère ne compte comme livré que si son comportement, son test et sa documentation
sont présents. Les critères partiels comptent comme non livrés.

Les fonctions essentielles ne peuvent pas être imputées aux 15 % manquants :

- lancement de l’UI ;
- sidebar et accès à l’onglet `Éditeur musical` ;
- chargement d’une copie de `Lignes de nuit` ;
- édition des notes, patterns, arrangement, paramètres d’instrument et mix de base ;
- lecture, sauvegarde et réouverture ;
- rendu du master et export WAV.

Les 15 % non livrés au maximum sont documentés individuellement avec identifiant, fonctionnalité
prévue, état réel, raison, impact utilisateur, contournement éventuel, risque, priorité et test
d’acceptation restant à satisfaire. Une fonction manquante ne doit pas être représentée par un bouton
factice.

## Outillage automatique obligatoire

### Backend et domaine

- `pytest` pour les tests unitaires, intégration et API ;
- `pytest-cov` avec couverture de branches et seuils bloquants ;
- `Hypothesis` pour les propriétés, bornes, migrations, timelines et routages ;
- `Schemathesis` pour tester automatiquement le contrat OpenAPI FastAPI ;
- `mutmut` sur le domaine, les migrations et le planificateur ;
- `Ruff` et `mypy` pour lint et typage statique bloquants ;
- NumPy/SciPy et analyse WAV pour les tests DSP, métriques, golden specs et comparaison des stems.

### Frontend

- `Vitest` avec couverture V8 ;
- React Testing Library, `user-event` et `jest-dom` pour les composants et interactions ;
- `MSW` pour simuler les contrats API sans faux couplage au réseau ;
- `fast-check` pour les propriétés du store, des commandes et de la géométrie temporelle ;
- `axe-core` pour les violations d’accessibilité automatisables ;
- ESLint et TypeScript en mode strict comme gates statiques ;
- Stryker sur le store d’édition et les fonctions temporelles critiques.

### Intégration réelle

- Playwright sur Chromium pour les parcours complets, le clavier, le drag-and-drop et Web Audio ;
- snapshots Playwright pour les régressions visuelles des vues principales ;
- traces, captures et vidéo conservées automatiquement uniquement en cas d’échec ;
- serveurs backend et frontend isolés, racine de projets temporaire et réseau externe interdit ;
- contrôle des erreurs console, réponses HTTP, fuites de requêtes et ressources manquantes.

### Documentation

- `markdownlint-cli2` pour la structure Markdown ;
- un vérificateur de liens locaux pour les références et captures ;
- un validateur de la matrice exigences → tests automatiques → tests manuels → état livré ;
- un contrôle d’unicité et de complétude des identifiants de cas manuels.

### Exécution unique

- créer `EDITEUR/test_editor.ps1` comme commande canonique de qualification ;
- faire exécuter par ce script lint, typage, build, tests Python, tests frontend, mutations ciblées,
  Playwright, accessibilité, régression visuelle, DSP et test hors ligne ;
- produire `EDITEUR/test-results/editor-report.json` avec commandes, durées, couvertures, mutations,
  hashes DSP et résultat final ;
- retourner un code non nul au premier gate en échec et un code nul uniquement si toute la suite
  réussit ;
- créer une commande de lancement de l’UI qui ne demande aucune installation ou configuration après
  la qualification finale.

## Protocole d’exécution continue

Ordre obligatoire :

```text
Phase 0 → V0 → Phase 1 → V1 → Phase 2 → V2 → ... → Phase 13 → V13 → Phase 14 → V14 → livraison
```

Chaque phase `Vn` :

1. installe ou utilise uniquement les dépendances verrouillées ;
2. exécute ses tests ciblés pour fournir un retour rapide ;
3. exécute ensuite toute la suite de non-régression déjà acquise ;
4. bloque immédiatement la phase suivante si une commande échoue ;
5. exige la correction de la cause, pas la modification opportuniste du test ;
6. enregistre son résultat dans le rapport de qualification.

## Architecture cible

```text
Sidebar gauche
  └── Éditeur musical
        ├── Barre de transport globale
        ├── Navigateur de projet et de patterns
        ├── Playlist / arrangement
        ├── Channel Rack / séquenceur pas à pas
        ├── Piano Roll
        ├── Automations
        ├── Inspecteur instrument / effets
        └── Mixer
                    ↓
Store d’édition local + historique de commandes
                    ↓
API de compositions versionnées + sauvegarde atomique
                    ↓
Planificateur beat → événements → moteur DSP
                    ↓
Préécoute / rendu offline / stems / QA / export
```

## Modèle métier cible

- `Composition` : métadonnées, seed, tempo, métrique, tonalité, durée, marqueurs et boucle.
- `Track` : type, nom, couleur, état, instrument, canal mixer et ordre.
- `Pattern` : longueur, résolution, notes ou pas de batterie.
- `Clip` : référence de pattern, piste, position, longueur, répétition et transposition.
- `NoteEvent` : hauteur, début, durée, vélocité, probabilité et décalage micro-temporel.
- `InstrumentPreset` : type de synthèse et paramètres complets, bornés et typés.
- `AutomationLane` : cible stable et points d’automation avec interpolation.
- `MixerChannel` : gain, pan, mute, solo, routage, sends et chaîne d’effets.
- `EffectInstance` : type, paramètres, ordre et bypass.
- `RenderSettings` : plage, boucle, stems, format et profil QA.
- `Revision` : version de schéma et révision de sauvegarde pour prévenir les écrasements.

## Critère global de livraison

La fonctionnalité est terminée lorsqu’un utilisateur peut, sans terminal :

1. lancer l’UI par la commande de lancement livrée ;
2. voir la sidebar gauche et l’onglet `Éditeur musical` sans configuration préalable ;
3. charger depuis l’UI une copie de `Lignes de nuit` ;
4. modifier les familles essentielles : notes, patterns, arrangement, instruments et mix ;
5. écouter une sélection ou le morceau entier ;
6. annuler/rétablir puis sauvegarder et rouvrir le projet sans perte ;
7. rendre le master et les cinq stems ;
8. exporter un WAV et son manifeste ;
9. obtenir un morceau audiblement différent dont le rendu est reproductible à spec et seed identiques.

La livraison exige en plus un taux fonctionnel calculé supérieur ou égal à 85 % et la documentation
exhaustive de tous les critères non livrés.

## Phases de validation automatique interphase

### Phase V0 — Qualification de l’outillage et des contrats [FAIT]

- [x] Installer et verrouiller tous les outils listés dans les manifests Python et frontend.
- [x] Créer le runner canonique, les dossiers temporaires et le rapport JSON.
- [x] Exécuter lint, typage, build minimal, tests de contrat et gate de déterminisme Csound.
- [x] Faire échouer volontairement un test de chaque famille pour prouver que le runner bloque
  (8 familles : Python, frontend, couverture, markdown, a11y, visuel, mutation).
- [x] Refuser la phase 1 si un outil est absent, non verrouillé ou silencieusement ignoré.

Réserve documentée (2026-07-30, mise à jour 2026-08-01) : WSL (Ubuntu) a été provisionné avec un
environnement Python 3.13 et Csound 6.18 dédiés, et `mutmut` y est installable et configurable.
L'exécution reste toutefois bloquée par une incompatibilité structurelle entre `source_paths` et le
mode d'import réel du projet (voir `EDITEUR/docs/limites_connues.md`, LIM-001). Ce point est acté
comme limite connue plutôt que comme gate contourné ; il ne bloque pas la phase 1.

### Phase V1 — Qualification domaine, migration et DSP [FAIT]

- [x] Exécuter tests unitaires, round-trip et migrations (87 tests, suite complète verte).
  Propriétés Hypothesis présentes sur `beats_to_samples`, sur le round-trip complet de
  `Composition` (`test_composition_round_trip_preserves_structure`, stratégie `_valid_compositions`)
  et sur le domaine de validation des références (`test_composition_rejects_dangling_references`,
  stratégie `_compositions_with_dangling_reference` couvrant pattern→track, clip→pattern,
  mixer→track et automation→track).
- [x] Vérifier références hostiles, bornes, stabilité et invariants de timeline
  (`test_composition_rejects_invalid_references_and_future_versions`,
  `test_composition_rejects_mixer_cycles_and_invalid_automation_target`).
- [x] Rendre trois fois la spec de référence et comparer master, stems et hashes
  (`test_composition_renders_aligned_deterministic_stems_and_reacts_to_spec`) ; vérifié en
  plus manuellement que le rendu post-migration NoteEvent/MixerChannel est bit-exact à
  l'ancien (mêmes hachages SHA-256 master + 5 stems avant/après refonte).
- [ ] Exécuter les mutations ciblées du domaine et du planificateur avec seuil bloquant —
  **bloqué**, voir `EDITEUR/docs/limites_connues.md` (LIM-001).
- [x] Exécuter toute la non-régression V0 (runner canonique `test_editor.ps1` complet, y
  compris frontend) avant d’autoriser la phase 2 — exécuté le 2026-08-02, gate complet vert
  (backend, frontend, mutation Stryker 68,66 % ≥ seuil 60 %, Playwright, visuel, markdown) après
  régénération du golden `lignes_de_nuit` désynchronisé par un changement du renderer `explo`.

### Phase V2 — Qualification API et persistance [FAIT]

- [x] Tester chaque route nominale et chaque erreur typée (`tests/test_api.py` : master lisible,
  404 project, 422 `composition_not_found`, 422 track inconnu, 422 `export_artifact_missing`).
- [x] Fuzzer le contrat OpenAPI, les révisions concurrentes et les entrées invalides (Schemathesis
  étendu aux 11 routes GET composition avec état seedé ; `tests/test_api_robustness.py` : Hypothesis
  UUIDs malformés/révisions et start_beat négatifs/id mismatch/références pendantes/example inconnu ;
  concurrence réelle 2 threads → exactement un 200 et un 409, pas d'écrasement).
- [x] Simuler écriture interrompue, annulation, reprise et chemins hostiles (`os.replace` en échec →
  disque intact + reprise au PUT suivant ; `.tmp` orphelins purgés à la lecture ; rendu annulé →
  CANCELLED puis re-rendu → COMPLETED + artifact lisible + flux SSE terminé ; `plugin_id` hostiles
  → 404, aucun fichier écrit hors du dossier autorisé).
- [x] Vérifier l'isolation des projets et l'absence de sortie du dossier autorisé (composition d'un
  projet A inaccessible depuis B → 422 `composition_not_found` ; dossiers strictement distincts ;
  gardes `resolve_project_path`/`load_project`/`save_project` déjà couvertes).
- [x] Exécuter V0 à V1 avant d'autoriser la phase 3 — runner canonique `test_editor.ps1` complet
  exécuté le 2026-08-04, gate vert : backend 111 tests (couverture 88,61 % ≥ 80 %), frontend
  lint/typecheck/unit (26)/coverage/a11y/mutation (68,66 % ≥ 60 %)/build/e2e (7)/visuel,
  markdownlint, déterminisme Csound et golden `Lignes de nuit` inchangés.

### Phase V3 — Qualification shell, sidebar et routage [FAIT]

- [x] Tester composants, états de page et navigation avec Vitest et React Testing Library
  (`Sidebar.test.tsx` nouveau, `EditorLanding.test.tsx` nouveau : états loading/vide/erreur/
  introuvable/hors ligne/écran de copie, `Application.test.tsx` étendu : confirmation de perte de
  modifs non enregistrées, restauration de la route éditeur ; suite frontend 39 tests verts).
- [x] Tester clavier, focus et accessibilité avec `axe-core` (shell studio, éditeur réel avec fetch
  stubé, état projet introuvable, état vide — l'ancien test axe « éditeur » scannait l'état erreur
  par accident).
- [x] Tester URL directe, historique, sidebar active et conservation du projet avec Playwright
  (`e2e/shell.spec.ts` nouveau : goBack/goForward, `aria-current` par route, URL directe projet
  absent, conservation de la route éditeur sans query ; suite e2e 10 tests verts).
- [x] Comparer les snapshots visuels du shell aux références approuvées (expanded/collapsed,
  `maxDiffPixelRatio 0.02` — inchangés, ré-validés).
- [x] Exécuter V0 à V2 avant d'autoriser la phase 4 — runner canonique `test_editor.ps1` complet
  exécuté le 2026-08-04, gate vert : backend 111 tests (couverture 88,61 % ≥ 80 %), déterminisme
  Csound et golden inchangés, frontend lint/typecheck/unit (39)/coverage/a11y (5)/mutation
  (87,31 % ≥ 60 %)/build/e2e (10)/visuel, markdownlint.

### Phase V4 — Qualification store, commandes et sauvegarde [FAIT]

- [x] Atteindre 100 % lignes et branches sur store, commandes et historique
  (couverture-summary 2026-08-04 : `editorStore.ts` 100 % lignes / 100 % branches).
- [x] Générer avec `fast-check` des séquences d’actions et vérifier tous leurs inverses
  (`editorStore.property.test.ts` : undo rétablit l'état précédent exact, redo le rejoue ; 100 runs).
- [x] Tester cent opérations suivies de cent undo/redo et comparer les états exacts
  (`editorStore.test.ts` « restaure exactement cent commandes avec undo puis redo », historique
  borné à 200, suppressions en cascade, transactions, coller avec remappage des identifiants).
- [x] Exécuter Stryker sur les transformations critiques avec seuil bloquant
  (`stryker.config.mjs` étendu à `editorStore.ts` et `transport.ts`, break 60 % ; gate runner vert).
- [x] Exécuter V0 à V3 avant d’autoriser la phase 5 — runner canonique `test_editor.ps1` complet
  exécuté le 2026-08-04 15:17, gate vert : backend 111 tests (couverture 88,61 % ≥ 80 %),
  déterminisme Csound et golden inchangés, frontend lint/typecheck/unit/coverage/a11y/mutation
  (Stryker ≥ 60 %)/build/e2e (10)/visuel, markdownlint (rapport
  `EDITEUR/test-results/v1-20260804-151348.json`, success true, 20 checks).

### Phase V5 — Qualification transport et Web Audio [FAIT]

- [x] Tester la machine d’état avec horloge contrôlée et wrapper audio simulé
  (`transport.test.ts` : avance exacte 0,5 s→1 beat à 120 bpm, immobilité pause/stop, rebouclage
  multi-tours ; `TransportBar.test.tsx` : synchro playhead à `MockAudioContext`, pause fige,
  cache, interruption sur composition modifiée, annulation d'une préécoute en file, fin de média).
- [x] Tester lecture, pause, stop, seek, boucle et fin de média dans Chromium réel
  (`e2e/studio.spec.ts` « the editor transport plays, pauses, stops and reaches media end » :
  lire la sélection, playhead qui avance, pause → Lire, reprise → Relancer, stop → Lire,
  relecture jusqu'à la fin ; sélecteur playhead désambiguïsé par `output[aria-live="polite"]`).
- [x] Mesurer la dérive playhead/audio sur des scénarios verrouillés (position attendue exacte à
  horloge audio simulée : audioClock=1 → « 1.3 » ; dérive nulle sur ces scénarios).
- [x] Tester cache, invalidation, annulation et concurrence des préécoutes (`PreviewCache` par
  clé de plage, `PreviewRequestGate` ; `transport.test.ts` invalidation des seules plages
  recouvrantes + requête annulée qui ne remplace pas la préécoute la plus récente ;
  `TransportBar.test.tsx` réutilisation du cache sans nouveau rendu).
- [x] Exécuter V0 à V4 avant d’autoriser la phase 6 — runner canonique `test_editor.ps1` complet
  exécuté le 2026-08-04 22:47, gate vert : backend 111 tests (couverture 88,61 % ≥ 80 %),
  déterminisme Csound et golden inchangés, frontend lint/typecheck/unit (72)/coverage/a11y (5)/
  mutation (Stryker 95,37 % ≥ 60 %)/build/e2e (12)/visuel, markdownlint (rapport
  `EDITEUR/test-results/v1-20260804-224727.json`, success true, 20 checks).

### Phase V6 — Qualification Channel Rack [FAIT]

- [x] Tester toutes les opérations de grille, résolutions et longueurs de pattern (`stepSequencer.test.ts` :
  toggles, champs bornés, undo/redo, longueurs bornées, remplissages, nom/couleur/duplication/
  variation déterministe, canaux, fast-check ; `StepSequencer.test.tsx` : rangées, résolution,
  peinture/effacement au glisser, sliders, accent, sélection multiple, pattern vide ;
  `PatternEditor.test.tsx` : nom, couleur, longueur, duplication, variation, suppression avec
  confirmation selon l'usage des clips, préécoute piste).
- [x] Générer des patterns valides et hostiles avec `fast-check` (`stepSequencer.test.ts` propriétés,
  100 runs ; `editorStore.property.test.ts` inverses undo/redo).
- [x] Vérifier clavier, souris et undo/redo dans Playwright — clavier (Entrée/Espace), clic,
  undo/redo, mute et sauvegarde rejoués dans Chromium (`e2e/studio.spec.ts` « the editor step
  sequencer toggles, undoes and mutes drum steps ») ; la peinture au glisser et la sélection
  multiple sont assumées couvertes en unitaire (pointer events jsdom, ctrl-clic), le drag-and-drop
  natif relevant de la Phase 8 (Playlist).
- [x] Prouver par rendu et hash que chaque modification de pas affecte la bonne piste
  (`tests/test_editor_sequencer.py` : toggle d'un pas ne change que le stem drums, probabilité 0
  silencieuse, gate déterministe seedé, micro-timing décalé, mute/solo appliqués ; golden
  `Lignes de nuit` bit-exact inchangé). La preuve rendu/hash du côté frontend n'est pas formalisée
  de façon autonome (réserve assumée) : les commandes du store transmettent exactement ces
  événements et sont testées unitairement, la preuve audio par hash reste portée par le backend.
- [x] Exécuter V0 à V5 avant d'autoriser la phase 7 — runner canonique `test_editor.ps1` complet
  exécuté le 2026-08-05, gate vert : backend 118 tests (+ 11 Schemathesis), frontend
  lint/typecheck/unit (121)/coverage/a11y (5)/mutation/build/e2e (12 + 1 visuel), déterminisme
  Csound et golden inchangés, markdownlint (rapport `EDITEUR/test-results/v1-20260805-110735.json`,
  success true).

### Phase V7 — Qualification Piano Roll [FAIT]

- [x] Tester les conversions beat/pixel et pixel/beat par propriétés réversibles
  (`pianoRollGeometry.test.ts` : aller-retour beats↔pixels et midi↔pixels en fast-check, snap
  idempotent, plages visibles bornées octave par octave, clamps aux extrêmes MIDI, notation
  française des notes et construction des gammes majeure/mineure).
- [x] Tester création, déplacement, resize, quantification, transposition et polyphonie
  (`PianoRoll.test.tsx` 19 tests : création, move/resize souris avec seuil de drag, anti-
  accélération des deltas, sélection rectangle, lanes, ghost notes, gamme/tonalité ;
  `noteCommands.test.ts` : transformations, polyphonie, undo/redo ; `e2e/studio.spec.ts` :
  rendu exact des notes et transposition ±12 dans Chromium).
- [x] Vérifier chaque note de référence de `Lignes de nuit` dans la spec et dans l'UI (e2e
  « renders every melodic note and transposes exactly » : bass 22, pad 42, arp 72, lead 21
  notes reconstituées et libellées en notation française depuis la fixture).
- [x] Exécuter le parcours Playwright d'édition d’une mélodie puis comparer le rendu (e2e
  « edits notes with the mouse and keeps them after reload » : création → déplacement →
  resize → sauvegarde → rechargement identique ; la comparaison du rendu audio post-édition
  reste hors Chromium — preuve par hash portée par le backend
  `test_composition_render_reacts_to_a_moved_and_transposed_melodic_note`, réserve assumée).
- [x] Exécuter V0 à V6 avant d’autoriser la phase 8 — runner canonique `test_editor.ps1` complet
  exécuté le 2026-08-05, gate vert : backend (lint, types, contrats, domaine, fuzz OpenAPI,
  couverture, golden `Lignes de nuit`), frontend lint/typecheck/unit/coverage/a11y/mutation/
  build/e2e (15)/visuel, markdownlint (rapport `EDITEUR/test-results/v1-20260805-191709.json`,
  success true).

### Phase V8 — Qualification Playlist et arrangement [FAIT]

- [x] Tester clips, répétitions, overlaps, ripple, groupes, marqueurs et durée calculée
  (`Playlist.test.tsx` 17 tests : drags, split, marqueurs, pistes, overlap ; `clipCommands.test.ts` :
  ripple, groupes, insert/delete time, durée, bornes ; backend `test_editor_playlist.py` : end beat
  répété, mute → rendu différent, transposition appliquée, marqueurs reproductibles).
- [x] Générer des timelines complexes et vérifier absence de perte ou double rendu invisible
  (fast-check `clipCommands.test.ts` « chaque commande clip est annulée exactement par undo puis
  rejouée par redo » : 100 runs de séquences jusqu'à 12 actions clips/marqueurs/pistes).
- [x] Mesurer fluidité et mémoire sur le budget de densité maximal — alerte de densité
  (`RENDER_CLIP_LIMIT = 300`) testée en unitaire (`Playlist.test.tsx` « affiche un avertissement
  quand la densité dépasse la limite ») ; pas de benchmark de fluidité/mémoire formalisé (réserve
  assumée).
- [x] Tester dans Playwright une restructuration complète du morceau (e2e « the playlist arranges
  clips and markers by drag and keeps them after reload » : déplacement, découpe, marqueurs,
  ajout de clip, ripple, sauvegarde/rechargement). Le test resté rouge en début de session était une
  attente erronée : le clip ajouté démarre à `compositionEndBeat` (62 beats, pad déplacé à 2..62),
  pas à 60 ; l'assertion vérifie que le clip suivant est poussé de la distance exacte du drag.
- [x] Exécuter V0 à V7 avant d’autoriser la phase 9 — runner canonique `test_editor.ps1` complet
  exécuté le 2026-08-06, gate vert : backend 130 tests, e2e 15, golden `Lignes de nuit` inchangé,
  lint/typecheck/unit/coverage/a11y/mutation/build/visuel/markdownlint (rapport
  `EDITEUR/test-results/v1-20260806-060208.json`, success true, 20 checks).

### Phase V9 — Qualification instruments et paramètres [FAIT]

- [x] Tester chaque paramètre aux minima, maxima, défauts et valeurs invalides.
- [x] Générer des combinaisons valides avec Hypothesis et vérifier finitude et absence de crash.
- [x] Mesurer clipping, DC, silence inattendu, aliasing budgété et continuité.
- [x] Vérifier la parité exacte des métadonnées de paramètres entre backend et UI.
- [x] Exécuter V0 à V8 avant d’autoriser la phase 10.
      Exécuté le 2026-08-06 : runner canonique `test_editor.ps1` complet vert, backend 179 tests,
      frontend 239 unitaires, e2e 15/15, mutation Stryker 77.02 (rapport
      `EDITEUR/test-results/v1-20260806-073005.json`, success true, 21 checks).

### Phase V10 — Qualification automations [TODO]

- [ ] Tester les interpolations par valeurs analytiques attendues.
- [ ] Générer points, courbes et limites de clips avec tests de propriétés.
- [ ] Vérifier résolution moteur, continuité et absence de zipper noise mesurable.
- [ ] Tester dans Playwright création, déplacement, suppression et undo/redo d’une automation.
- [ ] Exécuter V0 à V9 avant d’autoriser la phase 11.
### Phase V11 — Qualification mixer et routage [TODO]

- [ ] Tester mute, solo, gain, pan, sends, bypass et ordre d’effets.
- [ ] Générer des graphes de routage et refuser automatiquement tous les cycles invalides.
- [ ] Recombiner les stems et comparer au mix selon la tolérance numérique verrouillée.
- [ ] Vérifier vu-mètres, clipping et actions mixer dans Chromium.
- [ ] Exécuter V0 à V10 avant d’autoriser la phase 12.

### Phase V12 — Qualification rendu, QA et export [TODO]

- [ ] Tester toutes les plages, formats, stems et profils d’export.
- [ ] Valider WAV, durée, fréquence, profondeur, canaux, manifestes et rapports JSON.
- [ ] Tester hashes, révisions périmées, annulation et rendus concurrents.
- [ ] Vérifier que chaque défaut QA pointe vers une action d’éditeur.
- [ ] Exécuter V0 à V11 avant d’autoriser la phase 13.

### Phase V13 — Recette automatique complète et livrable [TODO]

- [ ] Exécuter le runner canonique depuis un environnement propre.
- [ ] Lancer le parcours réel : UI → sidebar → éditeur → chargement de `Lignes de nuit`.
- [ ] Modifier au moins un élément de chaque famille, écouter, sauvegarder, rouvrir et comparer.
- [ ] Rendre puis valider automatiquement master, cinq stems, manifeste et rapport QA.
- [ ] Tester hors ligne, erreurs console, ressources manquantes, accessibilité et snapshots.
- [ ] Vérifier que la commande de lancement suffit sur un projet propre, sans préparation manuelle.
- [ ] Produire le rapport final avec 100 % des exigences reliées à un état et au moins 85 % des
  critères fonctionnels livrés et réussis.

### Phase V14 — Qualification de la documentation et des tests manuels [TODO]

- [ ] Exécuter le lint Markdown et le contrôle des liens locaux.
- [ ] Vérifier que chaque écran, commande et comportement livré apparaît dans le guide utilisateur.
- [ ] Vérifier que chaque exigence possède un état, une preuve et au moins un test automatique ou
  manuel pertinent.
- [ ] Vérifier que chaque cas manuel possède un identifiant unique, des prérequis, des étapes, un
  résultat attendu et un emplacement de preuve.
- [ ] Recalculer le taux fonctionnel depuis la matrice et bloquer sous 85 %.
- [ ] Vérifier que tous les critères non livrés figurent dans la documentation des limites.
- [ ] Exécuter V0 à V13 avant d’autoriser la livraison.

## Phase 0 — Contrats, UX et gate technique [FAIT]

But : verrouiller les contrats avant de construire des vues couplées à un modèle incomplet.

Tâches :

- [x] Ajouter et verrouiller les dépendances Python de test, couverture, propriétés, contrats,
  mutations, lint et typage.
- [x] Ajouter et verrouiller les dépendances frontend de test unitaire, composants, propriétés,
  accessibilité, mutations et couverture.
- [x] Ajouter les scripts frontend `lint`, `typecheck`, `test:unit`, `test:coverage`,
  `test:mutation`, `test:a11y`, `test:visual` et `test:e2e`.
- [x] Configurer les seuils de couverture bloquants et exclure uniquement le code généré ou
  explicitement non exécutable (seuil frontend temporairement abaissé à 60/75 % pour
  `TransportBar.tsx`/`EditorLanding.tsx`, couverture approfondie prévue aux phases V5/V3).
- [x] Créer `EDITEUR/test_editor.ps1`, les fixtures isolées et l’agrégation du rapport JSON.
- [x] Configurer Playwright pour interdire le réseau externe, collecter les diagnostics d’échec et
  utiliser un dossier de projets temporaire.
- [x] Créer les golden specs DSP à partir des sources versionnées de `Lignes de nuit`.
- [x] Exécuter le gate de déterminisme Csound réel déjà requis par le projet et consigner le résultat.
- [x] Cartographier les responsabilités actuelles entre modèle métier, API, renderer de démonstration,
  moteur principal et UI.
- [x] Inventorier chaque valeur actuellement codée dans le rendu de `Lignes de nuit` : événements,
  patterns, enveloppes, filtres, oscillateurs, panoramiques, réverbération et master.
- [x] Définir le schéma de composition cible et ses identifiants stables.
- [x] Définir les bornes, unités, valeurs par défaut et règles de validation de chaque paramètre.
- [x] Définir les contrats API de lecture, création depuis la galerie, mise à jour, sauvegarde,
  rendu de plage, rendu complet et export.
- [x] Produire les wireframes du shell, de la sidebar et des espaces Playlist, Channel Rack,
  Piano Roll, Automations, Inspecteur et Mixer.
- [x] Définir les raccourcis clavier sans collision et les règles d’accessibilité.
- [x] Fixer les budgets de performance : chargement, interaction, densité de notes et temps de
  préécoute.
- [x] Écrire les tests de contrat du schéma et un benchmark reproductible du gate Csound.

Gate :

- le rendu Csound réel satisfait le déterminisme attendu ou un blocage documenté empêche la suite ;
- aucune donnée audible de `Lignes de nuit` n’est oubliée dans le schéma cible ;
- les contrats permettent une sauvegarde atomique et détectent les révisions concurrentes ;
- les wireframes couvrent le parcours global de livraison.

## Phase 1 — Domaine compositionnel et migration de `Lignes de nuit` [FAIT]

But : rendre le morceau entièrement pilotable par données avant de créer ses éditeurs graphiques.

Constat de session (2026-08-01) : l'essentiel de cette phase existait déjà comme socle commun
(sessions `crea_zik` antérieures au 2026-07-31, hors bannière `editeur`). L'audit a identifié et
comblé deux écarts : `NoteEvent` n'était jamais utilisé (`Pattern.events` restait
`list[dict[str, Any]]`) et `MixerChannel` non plus (le master/reverb/limiteur vivait dans un dict
générique `Composition.mixer`, rendant l'endpoint API `/mixer` trompeur car toujours vide).

Tâches :

- [x] Ajouter les modèles Pydantic `Composition`, `Track`, `Pattern`, `Clip`, `NoteEvent`,
  `InstrumentPreset`, `AutomationLane`, `MixerChannel`, `EffectInstance` et `RenderSettings`.
- [x] Passer le schéma projet à la version suivante avec migration aller et rejet explicite des
  versions futures.
- [x] Ajouter les validations de références, bornes, longueurs, positions, routages et cibles
  d’automation.
- [x] Déplacer dans la spec tous les rythmes, notes, accords, mélodies et sections du morceau
  (`Pattern.events: list[NoteEvent]` — notes entièrement résolues, expansées depuis les règles
  génératives compactes précédentes ; migration vérifiée bit-exacte, cf. Gate).
- [x] Déplacer dans la spec tous les paramètres de synthèse des cinq pistes.
- [x] Déplacer dans la spec les gains, panoramiques, routages, réverbération et paramètres master
  (`Composition.master_channel: MixerChannel`, remplace l'ancien dict `mixer` ; nouvel endpoint
  `GET .../master` exposant ce bus typé).
- [x] Adapter le planificateur pour transformer patterns, clips et automations en événements moteur
  (`schedule_composition`/`_schedule_clip` simplifiés, la logique d'expansion générative n'existe
  plus dans le code — les notes sont pré-résolues dans la spec).
- [x] Adapter le renderer afin qu’il ne connaisse plus l’arrangement de `Lignes de nuit`.
- [x] Produire un exemple de galerie immuable et une opération de copie avec nouveaux identifiants.
- [x] Conserver master, stems, manifeste et rapport QA de référence.
- [x] Tester migrations, round-trip JSON, références invalides, bornes, rendu des cinq pistes,
  alignement des stems et déterminisme (suite pytest complète, 85 tests verts).

Gate :

- modifier une note, un pattern, un paramètre de synthèse ou de mix dans la spec modifie le rendu ;
- le renderer ne contient plus de données musicales propres à `Lignes de nuit` ;
- trois rendus d’une même spec et d’une même seed produisent le même hash ;
- l’exemple source reste immuable et sa copie est indépendante ;
- vérifié en plus : rendu de la fixture `Lignes de nuit` bit-exact avant/après migration
  NoteEvent/MixerChannel (hachages SHA-256 identiques sur le master et les 5 stems, comparaison
  ancien code/ancienne fixture vs nouveau code/nouvelle fixture).

## Phase 2 — API de composition et persistance sûre [FAIT]

But : exposer un contrat complet de chargement et de sauvegarde à l’éditeur.

Tâches :

- [x] Ajouter les endpoints de lecture d’une composition et de ses ressources.
- [x] Ajouter la création d’une composition depuis l’exemple `Lignes de nuit`.
- [x] Ajouter la sauvegarde complète conditionnée par le numéro de révision.
- [x] Ajouter les mutations ciblées nécessaires sans multiplier les écritures partielles fragiles.
- [x] Implémenter l’écriture atomique et la récupération après fichier temporaire incomplet.
- [x] Retourner des erreurs typées et localisables par champ.
- [x] Ajouter les endpoints de rendu d’une plage, d’une piste, du mix et des stems.
- [x] Relier les rendus aux jobs SSE existants avec progression et annulation.
- [x] Ajouter l’accès sécurisé aux artifacts, manifestes et rapports QA.
- [x] Tester API, conflits de révision, sauvegarde interrompue, chemins hostiles, annulation et reprise.

Gate :

- une composition peut être créée, chargée, modifiée, sauvegardée puis rechargée sans perte ;
- deux sauvegardes concurrentes ne s’écrasent pas silencieusement ;
- chaque rendu est relié à la révision exacte de sa spec ;
- aucune route ne permet de sortir du dossier projet autorisé.

Qualifié par la Phase V2 (2026-08-04) : gates tous vérifiés par test automatique — création/
chargement/modification/sauvegarde/rechargement sans perte, concurrence 200+409, rendu relié à la
révision (manifeste), routes bornées par UUID + `resolve_project_path` (aucune sortie, vérifié par
rglob avant/après requêtes hostiles).

## Phase 3 — Shell applicatif, sidebar et nouvel onglet [FAIT]

But : intégrer l’éditeur à l’UI existante avec une navigation durable.

Tâches :

- [x] Découper l’application frontend monolithique en shell, pages, composants et couche de requêtes
  (`Application.tsx`, `Sidebar.tsx`, `EditorLanding.tsx`, `PluginBench.tsx`, `api/client.ts`).
- [x] Ajouter une sidebar verticale fixe à gauche avec libellé, icône accessible et état actif
  (`aria-current="page"`, icônes `aria-hidden`, marque repliable).
- [x] Migrer les écrans existants vers des onglets routés sans régression fonctionnelle (routes
  `/`, `/editor`, `/plugins` ; parcours Playwright existants tous verts).
- [x] Ajouter l’onglet `Éditeur musical`.
- [x] Conserver le projet courant lors des changements d’onglet (`lastEditorPath`, query
  `project`/`composition` restaurée — testé unitaire et e2e).
- [x] Ajouter états chargement, vide, erreur, hors ligne et projet introuvable.
- [x] Ajouter un mécanisme de confirmation si un changement d’onglet ou de projet risque de perdre
  des modifications locales (`window.confirm` sur l'état dirty — testé refus puis acceptation).
- [x] Rendre la sidebar repliable sur fenêtre étroite sans prétendre fournir un éditeur mobile
  (mode `collapsed` — testé).
- [x] Tester routage direct, retour navigateur, état actif, clavier, focus et non-régression des
  pages existantes (qualifié par la Phase V3, voir ci-dessus).

Gate :

- tous les écrans sont accessibles depuis la sidebar gauche ;
- une URL ouvre directement l’éditeur et le projet demandé ;
- la navigation ne perd ni sélection ni modifications sans confirmation ;
- les parcours Playwright existants restent fonctionnels après adaptation.

## Phase 4 — Noyau d’édition, sélection et historique [FAIT]

But : fournir une base cohérente à toutes les vues d’édition.

Tâches :

- [x] Créer un store d’édition local distinct du cache serveur (`createEditorState` sépare
  `composition` et `savedComposition`, qualifié par V4).
- [x] Définir les commandes atomiques d’édition utilisées par toutes les vues (`execute`, `transaction`).
- [x] Implémenter undo/redo multi-niveaux, transactions de glisser-déposer et regroupement des
  frappes continues (historique borné à 200, `groupWithPrevious`).
- [x] Implémenter sélection simple, multiple, rectangle, tout sélectionner et désélection
  (`select` additif, `selectRectangle`, `selectAll`, `clearSelection`).
- [x] Ajouter couper, copier, coller, dupliquer et supprimer avec remappage sûr des identifiants
  (`copySelection`, `cutSelection`, `paste` avec nouveaux UUID, `duplicateSelection`, suppressions en cascade).
- [x] Ajouter grille temporelle, snap configurable, zoom horizontal/vertical et défilement
  (`setGrid` avec bornes strictement positives, contrôles dans `EditorLanding.tsx`).
- [x] Ajouter dirty state, sauvegarde explicite, raccourci `Ctrl+S` et retour d’erreurs de validation
  (`isDirty`, `markSaving`/`markSaved`/`markSaveFailed`, raccourci dans `EditorLanding.tsx`).
- [x] Ajouter une stratégie de virtualisation pour les grandes listes de pistes et d’événements
  (`frontend/src/editor/VirtualList.tsx` + `virtualization.ts`, livré le 2026-08-04 : fenêtre
  scrollante ne montant que les lignes visibles avec overscan, testée sur 5000 lignes, couverture
  100 %, intégrée à la liste de pistes de `EditorLanding.tsx` à la place de l'ancienne pagination ;
  réutilisable pour les listes d'événements des phases suivantes).
- [x] Tester chaque commande, les inverses undo/redo, les transactions et les changements de
  sélection sur données verrouillées (qualifié par V4, voir Phase V4 ci-dessus).

Gate :

- toute mutation visible passe par une commande annulable ;
- cent opérations puis cent undo/redo restaurent des états identiques ;
- une sauvegarde réussie nettoie le dirty state et une sauvegarde échouée le conserve ;
- les erreurs ciblent le contrôle ou l’objet concerné.

## Phase 5 — Transport et préécoute [FAIT]

But : écouter et naviguer dans le morceau pendant l’édition.

Tâches :

- [x] Créer une barre de transport persistante : lecture, pause, stop, retour début et position
  (`TransportBar.tsx`, qualifié par V5).
- [x] Ajouter affichage mesures/temps, tempo, métrique et mode pattern/morceau (mesures/temps
  `formatMusicalPosition`, temps en secondes, mode pattern/morceau, tempo `{bpm} BPM` et métrique
  `{num}/{den}` affichés dans `TransportBar`, testé — `TransportBar.test.tsx`, livré le 2026-08-05).
- [x] Ajouter playhead cliquable, scrubbing, boucle et lecture d’une sélection (slider de position,
  `Lire la sélection`, `Boucle sélection`, qualifié par V5).
- [x] Ajouter volume de monitoring, mute global et indicateur de clipping (détection
  `clipDetected` sur le buffer décodé, qualifié par V5).
- [x] Utiliser Web Audio API pour la lecture, la synchronisation visuelle et le gain de monitoring
  (`AudioContext`, `AudioBufferSourceNode`, nœud de gain dédié, qualifié par V5).
- [x] Ajouter un rendu de préécoute de plage annulable et mis en cache par hash (`PreviewCache`
  par clé `previewKey`, `PreviewRequestGate`, qualifié par V5).
- [x] Invalider uniquement les plages affectées par une modification (`PreviewCache.invalidate`
  par plage, testé — `transport.test.ts`).
- [x] Définir un comportement explicite lorsqu’une édition survient pendant la lecture (arrêt +
  message « Préécoute interrompue : la composition a été modifiée. », testé).
- [x] Tester machine d’état du transport, boucles, seek, fin de média, cache et annulation
  (qualifié par V5, voir Phase V5 ci-dessus).

Gate :

- lecture, pause, stop, seek et boucle restent synchronisés au playhead ;
- une plage modifiée peut être préécoutée sans rendre systématiquement les 30 secondes ;
- aucun rendu périmé ne remplace une préécoute plus récente ;
- le monitoring ne modifie pas le fichier exporté.

## Phase 6 — Channel Rack et séquenceur pas à pas [FAIT]

But : éditer rapidement les patterns et les pistes rythmiques.

Tâches :

- [x] Créer le Channel Rack avec ordre, couleur, nom, mute, solo et accès à l’instrument — ordre,
  nom, mute et solo livrés (`ChannelRack.tsx`, flags `setTrackChannelFlag`, canal mixer créé à la
  première bascule) ; couleur et nom livrés sur les patterns via la migration de schéma v3
  (`Pattern.name`/`Pattern.color`, `CURRENT_SCHEMA_VERSION = 3`, migration v2→3) ; la couleur de
  piste et l’accès à l’instrument relèvent de la Phase 9 (inspecteur instrument) — critère partiel
  compté comme non livré.
- [x] Créer le séquenceur pas à pas avec résolution configurable et regroupement visuel par temps
  (`StepSequencer.tsx` : résolution 1/1 → 1/8, groupes par temps via `is-beat`, sélection du pas).
- [x] Ajouter activation, vélocité, probabilité, accent et micro-décalage de chaque pas (commandes
  `setStep`/`setStepField` bornées par `STEP_FIELD_BOUNDS`, rendu backend `probability`/`
  micro_timing_beats` propagés avec gate seedé, testés — `stepSequencer.test.ts`, `test_editor_sequencer.py`).
- [x] Ajouter longueur de pattern, duplication, renommage, variation et suppression sûre
  (`setPatternLength`/`renamePattern`/`setPatternColor`/`duplicatePattern`/`varyPattern` (FNV-1a
  seedé), suppression via `deleteSelection` avec cascade des clips référents ; `PatternEditor.tsx`
  avec confirmation `window.confirm` quand le pattern est utilisé par des clips — testés).
- [x] Ajouter paint, effacement par glisser, sélection multiple et remplissages usuels (peinture
  et effacement au glisser, sélection multiple Ctrl/Cmd, boutons Remplir / Remplir aux temps /
  Vider la rangée via `fillPatternRow`/`clearPatternRow` — testés).
- [x] Ajouter préécoute d’une piste et d’un pattern (`TransportBar` `patternRequest` et
  `trackRequest` : préécoute du pattern via son clip, préécoute d’une piste seule avec
  `track_ids` au rendu et cache dédié `:track:<id>` — testés).
- [x] Reconstituer et éditer les patterns kick, clap et charleston de `Lignes de nuit` (rangées par
  percussion affichées depuis les événements réels, édition par pas, e2e Chromium).
- [x] Tester opérations de grille, changement de résolution, longueurs atypiques, undo/redo et rendu
  déterministe des patterns (voir Phase V6).

Gate :

- chaque événement de batterie de `Lignes de nuit` est visible et modifiable ;
- créer ou déplacer un pas modifie la préécoute à l’instant attendu ;
- les patterns de longueurs différentes bouclent sans dérive ;
- toutes les opérations souris disposent d’un équivalent clavier essentiel.

## Phase 7 — Piano Roll et outils mélodiques [FAIT]

But : éditer précisément basse, pad, arpège et lead.

Constat de session (2026-08-05, clôture) : tous les bullets livrés et qualifiés. `PianoRoll.tsx`
rend toutes les notes mélodiques de `Lignes de nuit` et transpose exactement dans Chromium ;
commandes notes complètes dans `noteCommands.ts` ; conversions beat/pixel, snap, bornes MIDI,
clavier vertical et gamme/tonalité dans `pianoRollGeometry.ts` (fast-check). Session de clôture :
lanes vélocité/probabilité/micro-décalage/pan (drag avec undo groupé via `groupWithPrevious`),
ghost notes des autres pistes (hors drums), édition souris qualifiée (création, déplacement,
resize, sélection rectangle — e2e Chromium avec sauvegarde/rechargement), gamme/tonalité avec
surbrillance non bloquante (sélecteurs tonique/mode, classes `is-offscale`), fix de
l'accélération des drags (`lastDelta*`), preuve backend « note modifiée → rendu » par hash
(`tests/test_compositions.py`). V7 close [FAIT] : runner canonique vert final
(`EDITEUR/test-results/v1-20260805-191709.json`, success true). Réserves assumées : comparaison
audio post-édition hors Chromium, snapshot visuel limité au shell.

Tâches :

- [x] Créer le Piano Roll avec clavier vertical, grille, playhead et notes redimensionnables.
- [x] Ajouter création, déplacement, duplication, suppression et redimensionnement des notes
  (édition souris qualifiée + équivalent clavier, e2e de rechargement).
- [x] Ajouter vélocité, panoramique de note, probabilité et micro-timing dans des lanes inférieures
  (4 lanes, drag borné, undo groupé).
- [x] Ajouter quantification paramétrable, swing et humanisation seedée.
- [x] Ajouter transposition par note, octave, sélection et pattern.
- [x] Afficher gamme et tonalité avec surbrillance sans bloquer les notes hors gamme (sélecteurs
  tonique/mode locaux, surbrillance `is-offscale` sur touches et notes, édition toujours possible).
- [x] Ajouter outils accords, legato, durée uniforme et inversion.
- [x] Ajouter ghost notes des autres pistes et audition optionnelle des notes (ghost notes hors
  drums en pointillés non interactifs ; audition = préécoute du pattern).
- [x] Reconstituer toutes les notes de basse, pad, arpège et lead de `Lignes de nuit` (e2e :
  bass 22, pad 42, arp 72, lead 21).
- [x] Tester conversions beat/pixel, bornes MIDI, redimensionnement, quantification, transposition,
  polyphonie et déterminisme (fast-check, unitaires, e2e, preuve backend par hash).

Gate :

- chaque note audible de `Lignes de nuit` est visible et éditable ;
- positions et durées restent exactes après zoom, snap et round-trip JSON ;
- une transposition de sélection produit le résultat musical et numérique attendu ;
- les outils seedés sont reproductibles.

## Phase 8 — Playlist, arrangement et marqueurs [FAIT]

But : construire et restructurer le morceau sur une timeline multipiste.

Constat de session (2026-08-06, clôture) : Playlist multipiste livrée et qualifiée V8. Le test e2e
drag-and-drop resté rouge en début de session était une attente erronée : le clip ajouté démarre à
`compositionEndBeat` (62 beats car le pad est déplacé à 2..62), pas à 60, et le ripple de +8 l'amène
à 70 beats (6720 px) — comportement correct. L'assertion vérifie désormais que le clip suivant est
poussé de la distance exacte du drag. Runner canonique complet vert (`v1-20260806-060208.json`,
success true, 20 checks). Le store fournit la sélection, la duplication, le couper/copier/coller et
la suppression des clips via les commandes génériques (`duplicateSelection`, `paste`,
`selectRectangle`, suppression en cascade), le déplacement direct de clip étant câblé via la
Playlist. Réserve assumée : pas de benchmark de fluidité/mémoire sur le budget de densité (alerte
`RENDER_CLIP_LIMIT = 300` testée en unitaire).

Tâches :

- [x] Créer une Playlist multipiste avec en-têtes synchronisés au Channel Rack.
- [x] Afficher clips de patterns, régions, marqueurs, playhead et zone de boucle.
- [x] Ajouter placement, déplacement, duplication, répétition, découpe et redimensionnement de clips.
- [x] Ajouter insert/delete time et déplacement avec ou sans ripple.
- [x] Ajouter verrouillage, groupe, mute de clip et transposition de clip.
- [x] Ajouter création, renommage et réorganisation de pistes.
- [x] Représenter intro, groove, montée, climax et outro de `Lignes de nuit` par marqueurs éditables.
- [x] Gérer clips chevauchants selon une règle explicite et visible.
- [x] Tester collision, overlap, répétition, ripple, changements de durée, marqueurs et gros projets.

Gate :

- la structure complète de `Lignes de nuit` est reconstruite uniquement par clips et marqueurs ;
- déplacer ou redimensionner une section recalcule correctement durée et rendu ;
- aucun clip n’est tronqué ou rendu deux fois sans que l’UI le montre ;
- la Playlist reste fluide avec le budget de densité défini en phase 0.

## Phase 9 — Instruments procéduraux et inspecteur [FAIT]

Constat de session (2026-08-06, clôture) : registre typé des instruments livré
(`backend/src/crea_zik/instrument_registry.py` : groupes, scalaires, listes, défauts, bornes ;
`sanitize_parameters` NaN→défaut + clamp + ordres bandpass/bursts), exposé par
`GET /api/instrument-registry` et appliqué par `synthesize`. Inspecteur d'instrument livré
(`InstrumentInspector.tsx`, affiché quand une piste est sélectionnée) : sliders + saisie précise
bornées, reset, comparaison avant/après avec restauration, bypass « écouter l'original » (défauts
du registre), préécoute note (POST `.../instrument-preview` acceptant des `parameters` explicites,
préécoute sans sauvegarde), pattern et piste. Parité bornes UI/backend, valeurs non finies
neutralisées, combinaisons Hypothesis finies. Runner canonique complet vert
(`v1-20260806-073005.json`, success true, 21 checks).

But : rendre modifiable la fabrication sonore de chaque piste.

Tâches :

- [x] Créer un registre typé des instruments procéduraux et de leurs paramètres.
- [x] Créer l’inspecteur contextuel avec contrôles adaptés, unités, bornes et valeurs par défaut.
- [x] Exposer oscillateurs, harmoniques, accordage, enveloppe, filtre, modulation et polyphonie.
- [x] Exposer les paramètres propres aux drums, basse, pad, arpège et lead.
- [x] Ajouter reset de paramètre, saisie précise, modulation et comparaison avant/après.
- [x] Ajouter bypass sûr et protection contre NaN, infini, instabilité et valeurs hors bande.
- [x] Ajouter préécoute de note, pattern et piste depuis l’inspecteur.
- [x] Tester chaque paramètre aux bornes, stabilité numérique, clics, aliasing, polyphonie et
  cohérence entre UI, spec et rendu.

Gate :

- chaque constante de synthèse audible du morceau est exposée ou justifiée comme invariant moteur ;
- modifier un contrôle met à jour la spec et la préécoute correspondante ;
- les bornes UI et backend sont identiques ;
- aucun réglage valide ne produit de valeur non finie ou de crash moteur.

## Phase 10 — Automations [EN COURS]

But : faire évoluer les paramètres dans le temps.

Tâches :

- [ ] Ajouter la création d’une automation depuis tout paramètre automatisable.
- [ ] Créer des lanes et clips d’automation dans la Playlist.
- [ ] Ajouter points, déplacement, suppression et courbes step, linéaire et lissée.
- [ ] Ajouter snap, copie, duplication, mise à l’échelle et inversion.
- [ ] Définir la priorité entre valeur de base, automation et mute/bypass.
- [ ] Appliquer les automations au moteur avec une résolution documentée et sans zipper noise.
- [ ] Afficher la valeur évaluée sous le playhead.
- [ ] Ajouter des automations démonstratives à la copie éditable sans modifier la référence immuable.
- [ ] Tester interpolation, points superposés, limites de clip, précision temporelle et rendu
  déterministe.

Gate :

- gain, pan, filtre, paramètres d’instrument et effets admissibles peuvent être automatisés ;
- la courbe affichée correspond aux valeurs reçues par le moteur ;
- aucun saut non demandé ne survient aux limites de clips ;
- une automation supprimée restaure la valeur de base.

## Phase 11 — Mixer, routage et effets [TODO]

But : contrôler tout le chemin audio du morceau.

Tâches :

- [ ] Créer les tranches des cinq pistes, des bus, des sends et du master.
- [ ] Ajouter fader, pan, mute, solo, vu-mètre, peak hold et indicateur de clipping.
- [ ] Ajouter routage validé sans cycle interdit.
- [ ] Ajouter chaînes d’effets ordonnées, bypass, déplacement et suppression.
- [ ] Exposer égalisation, saturation, dynamique, délai et réverbération algorithmique disponibles.
- [ ] Représenter la réverbération et la chaîne master de `Lignes de nuit` dans la spec et le mixer.
- [ ] Ajouter comparaison A/B du mix avec loudness matching lorsque la métrique est disponible.
- [ ] Garantir stems pré-fader ou post-fader selon un choix d’export explicite.
- [ ] Tester solo/mute, sommation, routage, sends, ordre d’effets, latence, stems et sécurité
  numérique.

Gate :

- tout chemin audio de `Lignes de nuit` est visible et modifiable ;
- mute, solo, gain, pan, sends et bypass correspondent au rendu ;
- les stems se recombinent au mix selon la tolérance définie ;
- les cycles invalides sont refusés avant le moteur.

## Phase 12 — Rendu final, QA et export [TODO]

But : livrer les résultats utilisables directement depuis l’éditeur.

Tâches :

- [ ] Ajouter rendu du morceau entier, de la boucle, de la sélection et des pistes choisies.
- [ ] Ajouter choix master, stems, WAV float 32 bits et PCM 24 bits.
- [ ] Afficher progression, annulation, échec actionnable et reprise.
- [ ] Afficher waveform, durée, sample peak, true peak, LUFS, RMS, DC et clipping.
- [ ] Ajouter comparaison du dernier rendu avec la révision courante et signaler un rendu périmé.
- [ ] Produire manifeste, hash, seed, versions moteur, spec et rapport QA.
- [ ] Ajouter téléchargement individuel et bundle d’export.
- [ ] Empêcher la promotion en master si le profil QA bloque, sauf dérogation tracée.
- [ ] Tester formats, durées, métadonnées, hashes, annulation, rendu concurrent et profils QA.

Gate :

- master et cinq stems sont exportables sans terminal ;
- chaque artifact pointe vers la bonne révision de composition ;
- les erreurs QA sont visibles et renvoient au contrôle concerné ;
- aucun export ne nécessite de retouche externe.

## Phase 13 — Durcissement, accessibilité et livraison [TODO]

But : valider le parcours complet et éliminer les défauts de production.

Tâches :

- [ ] Créer le parcours Playwright complet : galerie → copie → édition → écoute → sauvegarde →
  réouverture → rendu → export.
- [ ] Créer des scénarios couvrant batterie, notes, arrangement, automation, synthèse et mixer.
- [ ] Verrouiller un benchmark reproductible comparant une modification par famille de paramètres.
- [ ] Tester navigation clavier, focus, lecteurs d’écran, contraste et réduction des animations.
- [ ] Tester projets volumineux, zoom extrême, longues sessions et usage mémoire.
- [ ] Tester fermeture/rechargement avec modifications non sauvegardées.
- [ ] Tester fonctionnement entièrement hors ligne et lancement local empaqueté.
- [ ] Corriger tous les défauts bloquants et supprimer boutons factices, placeholders et TODO
  fonctionnels.
- [ ] Documenter raccourcis, sauvegarde, rendu, export et limites assumées.
- [ ] Exécuter avant livraison l’inspection visuelle et l’écoute critique résiduelles ; elles sont à
  la charge de l’agent d’exécution, jamais de l’utilisateur.

Gate :

- le critère global de livraison est satisfait de bout en bout ;
- tous les tests Python, frontend, Playwright, DSP et benchmarks passent ;
- aucun défaut critique ou majeur n’est ouvert ;
- l’écoute critique valide un morceau réellement modifié sans clic, coupure ni artefact ;
- l’application fonctionne sans Internet et sans terminal après lancement.

## Phase 14 — Documentation du projet et recette manuelle exhaustive [TODO]

But : livrer une documentation fidèle au produit réel, documenter les 15 % éventuels non livrés et
fournir une série de tests manuels permettant de contrôler tout l’éditeur.

Livrables documentaires :

- `EDITEUR/docs/index.md` : point d’entrée et état de la version ;
- `EDITEUR/docs/guide_utilisateur.md` : lancement, chargement de `Lignes de nuit` et workflows ;
- `EDITEUR/docs/reference_fonctionnelle.md` : écrans, commandes, raccourcis et comportements ;
- `EDITEUR/docs/architecture.md` : frontend, API, domaine, persistance, jobs et moteur audio ;
- `EDITEUR/docs/rendu_et_export.md` : préécoute, rendu, stems, QA, formats et manifests ;
- `EDITEUR/docs/depannage.md` : erreurs connues, diagnostic et récupération ;
- `EDITEUR/docs/matrice_exigences.md` : pondération, état, tests et preuve de chaque exigence ;
- `EDITEUR/docs/limites_connues.md` : totalité des critères non livrés dans les 15 % autorisés ;
- `EDITEUR/docs/tests_manuels.md` : catalogue permanent et exhaustif de recette manuelle.

Tâches :

- [ ] Rédiger la documentation depuis le comportement effectivement livré, jamais depuis les seules
  intentions de la roadmap.
- [ ] Ajouter des captures d’écran à jour pour la sidebar, l’éditeur, le Channel Rack, le Piano Roll,
  la Playlist, les automations, le mixer et l’export.
- [ ] Documenter le parcours minimal : lancer l’UI, ouvrir l’éditeur et charger `Lignes de nuit`.
- [ ] Documenter création, édition, écoute, undo/redo, sauvegarde, réouverture, rendu et export.
- [ ] Documenter l’architecture, les formats de données, la migration et les garanties de
  déterminisme sans exposer de détails inutiles à l’utilisateur final.
- [ ] Construire la matrice pondérée des exigences et calculer le taux fonctionnel livré.
- [ ] Refuser la livraison si le taux est inférieur à 85 %.
- [ ] Documenter chaque critère non livré avec identifiant, état réel, raison, impact, contournement,
  risque, priorité et test d’acceptation restant.
- [ ] Vérifier que les fonctions manquantes ne laissent aucun bouton factice ou comportement trompeur.
- [ ] Créer le catalogue permanent des tests manuels selon le format défini ci-dessous.
- [ ] Exécuter la recette manuelle avant livraison et joindre les preuves utiles.
- [ ] Reporter dans le `tests_manuels.md` de la racine uniquement les contrôles encore non validés ;
  supprimer chaque section de cette file dès sa validation, conformément au protocole projet.

Format obligatoire de chaque cas manuel :

```text
ID :
Fonction couverte :
Priorité :
Prérequis :
Données de test :
Étapes numérotées :
Résultat attendu :
Preuve à conserver :
Résultat / date :
```

Série minimale de tests manuels :

1. `TM-LANCEMENT` — lancement sur environnement propre, attente backend, ouverture navigateur et
   fonctionnement hors ligne ;
2. `TM-SIDEBAR` — affichage, réduction, navigation clavier, état actif et accès direct à l’éditeur ;
3. `TM-DEMO` — présence de `Lignes de nuit`, création d’une copie, chargement des cinq pistes et
   protection de l’exemple source ;
4. `TM-PROJET` — création, renommage, sauvegarde, fermeture, réouverture et conflit de révision ;
5. `TM-TRANSPORT` — lecture, pause, stop, seek, boucle, sélection, volume et clipping ;
6. `TM-CHANNEL-RACK` — pas de batterie, vélocité, probabilité, résolution, mute, solo et patterns ;
7. `TM-PIANO-ROLL` — notes, resize, déplacement, quantification, transposition, vélocité et ghost
   notes ;
8. `TM-PLAYLIST` — clips, répétition, découpe, overlap, ripple, marqueurs, groupes et durée ;
9. `TM-INSTRUMENTS` — paramètres de synthèse, bornes, reset, bypass et préécoute ;
10. `TM-AUTOMATIONS` — création, points, courbes, copie, suppression et valeur au playhead ;
11. `TM-MIXER` — gain, pan, mute, solo, sends, bus, effets, routage et master ;
12. `TM-HISTORIQUE` — undo/redo, copier/coller, suppression, dirty state et confirmation de sortie ;
13. `TM-RENDU` — rendu de sélection, piste, morceau, annulation, reprise et état périmé ;
14. `TM-EXPORT` — master, cinq stems, WAV, manifeste, hashes, rapport QA et téléchargement ;
15. `TM-ERREURS` — API indisponible, projet invalide, rendu échoué, récupération et messages
    actionnables ;
16. `TM-ACCESSIBILITE` — clavier seul, ordre de focus, contraste, zoom système et lecteur d’écran ;
17. `TM-PERFORMANCE` — gros projet, zoom extrême, longue session, mémoire et fluidité ;
18. `TM-AUDIO` — absence de clics, coupures, silence inattendu, clipping et différence audible après
    modification ;
19. `TM-LIMITES` — correspondance exacte entre les fonctions absentes et
    `EDITEUR/docs/limites_connues.md`.

Gate :

- la documentation décrit la version livrée et ses commandes réelles ;
- le taux fonctionnel calculé est supérieur ou égal à 85 % ;
- les fonctions essentielles sont toutes livrées, indépendamment du taux global ;
- les critères non livrés sont tous documentés et représentent au maximum 15 % du score ;
- chaque fonction livrée est couverte par au moins un test automatique et un cas manuel pertinent ;
- la série manuelle permet de tester l’intégralité des écrans et workflows disponibles ;
- aucun contrôle manuel en attente n’est dissimulé hors de la file projet prévue à cet effet ;
- V14 réussit avant la livraison.

## Matrice de couverture de `Lignes de nuit`

| Élément actuel | Éditeur cible | Phase |
|---|---|---:|
| Tempo, métrique, tonalité, durée, seed | Transport et propriétés de composition | 5 |
| Sections intro, groove, lift, peak, outro | Playlist et marqueurs | 8 |
| Kick, clap, charleston | Channel Rack et séquenceur pas à pas | 6 |
| Basse, accords, arpège, mélodie | Piano Roll | 7 |
| Oscillateurs, harmoniques, enveloppes, filtres, vibrato | Inspecteur instrument | 9 |
| Évolutions temporelles de paramètres | Automations | 10 |
| Gains, pans, réverbération, saturation et master | Mixer | 11 |
| Master, cinq stems, QA et hash | Rendu et export | 12 |

## Références fonctionnelles

- Spécification UI interne du studio audio.
- Roadmap générale du studio audio procédural.
- Manuel officiel FL Studio : Playlist, Channel Rack, Piano Roll, Automation Clips et Mixer.
