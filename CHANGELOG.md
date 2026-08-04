# Changelog

## v0.24 — 2026-08-04

### Ajouté

- `frontend/src/editor/virtualization.ts` + `VirtualList.tsx` (nouveaux) : fenêtre scrollante
  générique pour les grandes listes — fonction pure `computeVirtualWindow` (overscan 4,
  `aria-setsize`/`aria-posinset`), testée sur 5000 lignes, 100 % couverture lignes et branches.
- `frontend/src/editor/virtualization.test.ts` + `VirtualList.test.tsx` (nouveaux, 8 tests).
- `frontend/src/editor/TransportBar.test.tsx` (nouveau, 6 tests) : transport testé via
  `MockAudioContext` — synchro playhead/audio, pause fige la position, réutilisation du cache sans
  nouveau rendu, interruption sur composition modifiée, annulation d'une préécoute en file, fin de
  média.
- `frontend/e2e/studio.spec.ts` : test e2e transport dans Chromium réel (lecture → pause → reprise
  → stop → relecture jusqu'à la fin ; sélecteur playhead désambiguïsé par `output[aria-live]`).

### Modifié

- `frontend/src/editor/EditorLanding.tsx` : la liste de pistes utilise `VirtualList` à la place de
  l'ancienne pagination (`trackWindowStart` supprimé).
- `frontend/src/editor/transport.test.ts` : +4 tests à horloge contrôlée (avance exacte
  0,5 s→1 beat à 120 bpm, immobilité pause/stop, rebouclage multi-tours).
- `frontend/src/editor/TransportBar.tsx` : `cancelPreview` extrait et appelé par `stopPlayback`
  — corrige un rendu périmé qui pouvait remplacer une préécoute plus récente après un Stop.
- `EDITEUR/roadmap_editeur_musical.md` : Phase 4 fonctionnelle et Phase V5 [FAIT] (preuves :
  virtualisation livrée, runner canonique vert V5 le 2026-08-04, rapport
  `EDITEUR/test-results/v1-20260804-224727.json`, 20 checks) ; Phase 5 passée [EN COURS], il ne
  reste que l'affichage du tempo et de la métrique.

## v0.23 — 2026-08-04

### Ajouté

- `frontend/src/editor/editorStore.property.test.ts` (nouveau) : fast-check sur séquences d'actions
  générées — chaque action est annulée exactement par undo puis rejouée par redo, et une séquence
  entière est défaite puis refaite à l'identique (100 runs).

### Modifié

- `frontend/src/editor/editorStore.test.ts` : +185 lignes — cent commandes puis cent undo/redo
  comparées exactement, historique borné à 200 entrées, suppressions en cascade
  (tracks→patterns→clips), transactions, sélection multicollection et coller avec remappage des
  identifiants.
- `frontend/stryker.config.mjs` : mutation étendue à `editorStore.ts` et `transport.ts`, seuil
  bloquant break 60 %.
- `EDITEUR/roadmap_editeur_musical.md` : Phase V4 [FAIT] avec preuves (runner canonique vert le
  2026-08-04, store 100 % lignes et branches) ; Phase 4 passée [EN COURS], seule la virtualisation
  des grandes listes reste ouverte.

## v0.22 — 2026-08-04

### Ajouté

- `frontend/src/app/Sidebar.test.tsx` (nouveau, 3 tests) : repli/dépli, `aria-current` unique,
  toggle et navigation au clic sans suivre le href.
- `frontend/src/editor/EditorLanding.test.tsx` (nouveau, 6 tests) : états chargement, vide, erreur,
  projet introuvable, bannière hors ligne (événements online/offline) et écran de création de copie.
- `frontend/e2e/shell.spec.ts` (nouveau, 3 tests) : sidebar active et historique navigateur
  (goBack/goForward), URL directe vers un projet absent, conservation de la route éditeur sans query.

### Modifié

- `frontend/src/app/Application.test.tsx` : +2 tests — confirmation avant de quitter des
  modifications non enregistrées, restauration de la route éditeur après un départ direct.
- `frontend/src/app/Application.a11y.test.tsx` : axe étendu à l'éditeur réel (fetch stubé), à
  l'état projet introuvable et à l'état vide ; l'ancien test axe « éditeur » scannait l'état erreur
  par accident.
- `EDITEUR/roadmap_editeur_musical.md` : Phase V3 et Phase 3 (shell, sidebar et routage) [FAIT],
  avec preuves de qualification (runner canonique complet vert le 2026-08-04).

## v0.21 — 2026-08-04

### Ajouté

- `tests/test_api_robustness.py` (nouveau, 13 tests) : fuzz Hypothesis des entrées invalides de
  l'API de composition (UUIDs malformés, révisions et `start_beat` négatifs), concurrence réelle
  entre deux sauvegardes (exactement un 200 et un 409, pas d'écrasement), écriture interrompue
  (`os.replace` en échec → disque intact puis reprise), purge des fichiers temporaires orphelins à
  la lecture, annulation/reprise d'un rendu via l'API avec flux SSE, isolation entre projets et
  `plugin_id` hostiles (aucune écriture hors du dossier autorisé).
- `backend/src/crea_zik/errors.py` : erreur typée `CompositionIdMismatchError` (code
  `composition_id_mismatch`).

### Modifié

- `backend/src/crea_zik/cli.py` : le garde d'identifiant incohérent de `replace_composition` lève
  `CompositionIdMismatchError` au lieu d'un `ValueError` brut (corrige un 500 non typé en 422).
- `tests/test_api.py` : 4 tests ajoutés (lecture du master, 404 projet absent, 422
  `composition_not_found`, 422 track inconnu, 422 `export_artifact_missing`).
- `tests/test_schema_fuzz.py` : fuzz Schemathesis étendu des 4 aux 11 routes GET de composition
  avec état seedé.
- `EDITEUR/test_editor.ps1` : gates `python-lint-v1`, `python-types-v1` et `composition-domain`
  étendus à `errors.py` et `test_api_robustness.py`.
- `EDITEUR/roadmap_editeur_musical.md` : Phase V2 et Phase 2 (API de composition et persistance
  sûre) marquées [FAIT].

## v0.20 — 2026-08-04

### Ajouté

- `tests/test_compositions.py` : propriétés Hypothesis sur le round-trip complet de `Composition`
  (`test_composition_round_trip_preserves_structure`) et sur le rejet des références pendantes
  (`test_composition_rejects_dangling_references`, couvre pattern→track, clip→pattern, mixer→track,
  automation→track), via stratégies composites `_valid_compositions` et
  `_compositions_with_dangling_reference`.

### Modifié

- `EDITEUR/roadmap_editeur_musical.md` : Phase V1 marquée [FAIT] (dernier point actionnable rempli ;
  mutations restent bloquées, LIM-001), Phase V2 [EN COURS].

## v0.19 — 2026-08-02

### Modifié

- `roadmap_studio_audio_procedural.md` : phases 3 (bibliothèque DSP/Sound Designer) et 4
  (Composition/Music Composer) réauditées par lecture effective du code. Toutes deux restent [TODO] :
  gaps documentés (saturation/EQ/compresseur/chorus-flanger-phaser/résonateurs non branchés en phase 3 ;
  isobar, accords/gammes, quantification/swing/humanisation, allocation de voix absents en phase 4).
  Le volet UI de la phase 4 est reconnu comme piloté par `EDITEUR/roadmap_editeur_musical.md`.

## v0.18 — 2026-08-02

### Corrigé

- `EDITEUR/fixtures/lignes_de_nuit.golden.json` : golden régénéré. Root cause : désynchronisation
  avec le renderer `explo/morceau_electro` modifié la veille (intégration du plugin kick), pas une
  régression de l'éditeur. Runner canonique complet (`test_editor.ps1`, backend + frontend, mutation
  Stryker 68,66 % ≥ seuil 60 %) vert après correction.

## v0.17 — 2026-08-01

### Ajouté

- `EDITEUR/docs/limites_connues.md` : LIM-001, mutation testing Python (mutmut) bloqué par une
  incompatibilité structurelle entre `source_paths` et le mode d'import réel du projet, malgré un
  environnement WSL (Ubuntu, Python 3.13, Csound) provisionné pour l'exécuter.
- Endpoint API `GET .../compositions/{id}/master` exposant le bus master typé (`MixerChannel`).

### Modifié

- Phase 1 de `EDITEUR/roadmap_editeur_musical.md` marquée [FAIT] après audit : `Pattern.events`
  migré vers `list[NoteEvent]` (notes résolues) et `Composition.mixer` (dict générique) remplacé par
  `Composition.master_channel: MixerChannel` typé. Migration vérifiée bit-exacte au rendu (hachages
  SHA-256 identiques avant/après sur le master et les 5 stems).
- `backend/src/crea_zik/gallery.py`, `plugins.py` : résolution de racine dépôt surchargeable via
  `CREA_ZIK_REPO_ROOT` au lieu de `Path(__file__).resolve().parents[3]` en dur.

## v0.16 — 2026-07-31

### Ajouté

- Phase 3 de `EXPLO/roadmap_plugins.md` livrée : le plugin kick est promu vers le moteur de
  composition via des paramètres d'instrument opt-in (`plugin_id`, `plugin_preset`,
  `plugin_overrides`), sans copie de fichiers vers un dossier plugins applicatif séparé.
  Équivalence bit-à-bit vérifiée entre rendu direct et rendu via composition (5 nouveaux tests).
- Banc de test plugins validé dans un navigateur Chromium réel piloté par script (sélection
  plugin/preset, ajustement de paramètre, rendu, téléchargement, intégrité du WAV vérifiée par
  analyse programmatique).

### Modifié

- Phase 2 de `roadmap_studio_audio_procedural.md` réauditée après lecture effective du code réel
  et marquée [FAIT], avec écart assumé face à sa description initiale.

## v0.15 — 2026-07-30

### Ajouté

- Gate V0 de l'éditeur musical complété : fuzzing OpenAPI (Schemathesis), couverture bloquante
  Python/frontend, accessibilité (axe-core), mutation testing (Stryker sur `transport.ts`),
  régression visuelle (Playwright) et markdownlint, chacun avec preuve de blocage volontaire dans
  `EDITEUR/test_editor.ps1`. Rendu instrumental et transport validés à l'écoute par l'utilisateur.

### Corrigé

- Correctifs lint/typage sur `backend/src/crea_zik/api.py` (tri d'imports, variance de `dict`) pour
  débloquer le runner de qualification.

## v0.14 — 2026-07-30

### Ajouté

- Zones `DOCUMENTATION/` et `WORKFLOW/` créées pour la documentation des styles musicaux et l'agent
  de création de musique, développés en parallèle. Modèle de fiche de style validé, roadmap dédiée
  `roadmap_creation_musique.md` (Phase 1 terminée).

## v0.13 — 2026-07-30

### Ajouté

- Phase 2 de `EXPLO/roadmap_plugins.md` livrée : endpoints `/api/plugins` (liste, manifeste, preset,
  rendu synchrone), écran « Plugins » avec contrôles générés depuis le manifeste JSON, non-régression
  du rendu kick vérifiée contre la référence SHA-256 de la phase 1.

## v0.12 — 2026-07-30

### Ajouté

- Phase 1 de `explo/roadmap_plugins.md` livrée : schéma de manifeste JSON générique, moteur kick
  (corps, sub, transitoire, bruit), trois presets (techno, 808_sub, acoustique) avec WAV et
  empreintes SHA-256 de référence, 11 tests (schéma, bornes, déterminisme, non-clipping, non-régression).

## v0.11 — 2026-07-30

### Corrigé

- Gate de déterminisme Csound réel de la phase 1 validé par hachage du WAV rendu (trois rendus indépendants), et non plus seulement du hash de spec renvoyé par le CLI.

## v0.10 — 2026-07-30

### Ajouté

- Roadmap `explo/roadmap_plugins.md` : contrat de plugin par manifeste JSON, moteur kick (couches corps,
  sub, transitoire, bruit), trois presets (techno, 808_sub, acoustique), promotion prévue via crea_zik.

## v0.9 — 2026-07-30

### Ajouté

- Contrats et persistance des compositions versionnées, rendu du mix et des stems, copie sûre des projets.
- Shell éditeur, store avec historique, sauvegarde, transport et préécoute.
- Runner canonique couvrant les contrats, le rendu, le frontend et le parcours E2E.

### Corrigé

- Rendu spécialisé des cinq familles instrumentales avec effets et normalisation, au lieu d’un oscillateur générique.
- Remappage des envois du mixer lors de la copie d’une composition.

## v0.8 — 2026-07-30

### Ajouté

- Sept familles SFX, variantes déterministes, métadonnées, QA et export depuis le studio local.
- Composition de scores avec stems synchronisés et simulation de graphes musicaux adaptatifs.
- Assistant Ollama local avec aperçu, acceptation, rejet et historique persistant.
- Compaction automatique du contexte Codex à partir de 64 000 tokens.

### Modifié

- Interface enrichie avec transport, waveform, Composer, Adaptive Lab et métriques QA.
- Qualification frontend isolée des sorties générées par Prettier.

## v0.7 — 2026-07-30

### Ajouté

- Roadmap complète de l’éditeur musical intégré avec sidebar gauche et édition de `Lignes de nuit`.
- Gates automatiques interphases, seuil fonctionnel de 85 % et phase finale de documentation et de
  recette manuelle exhaustive.

## v0.6 — 2026-07-30

### Ajouté

- Premier morceau électro procédural de 30 secondes avec master WAV, stems, spec, renderer et QA.
- Archivage musical versionné : catalogue, manifestes SHA-256, déduplication, documentation et contrôle d’intégrité.

## v0.5 — 2026-07-30

### Ajouté

- Erreurs typées, logs JSON, timeout Csound et couverture des erreurs de rendu.
- Parcours CLI testé de bout en bout et manifeste de provenance JSON créé à chaque export.

### Modifié

- Les erreurs de jobs structurées sont affichées par l’interface.
- La recette manuelle non reproductible a été retirée après validation de la reprise automatique.

## v0.4 — 2026-07-28

### Ajouté

- Schémas de domaine versionnés, migration de lecture, validation et confinement d’écriture des projets.
- Galerie rendable, Sound Designer minimal et liste de jobs avec progression, état et annulation.
- Couverture des schémas et trois parcours E2E : clic, galerie et Sound Designer.

### Modifié

- Recette manuelle réduite au test résiduel d’annulation de rendu long.

## v0.3 — 2026-07-28

### Ajouté

- Jobs de rendu à progression SSE, annulation coopérative et tests de non-blocage de file.
- Lanceur local `run.py`, recette manuelle et test E2E Playwright du parcours création/rendu/écoute/export.

### Corrigé

- Proxy Vite des fichiers WAV `/projects` : le lecteur HTML charge et lit désormais les rendus.

## v0.2 — 2026-07-28

### Ajouté

- Benchmark pyo, Faust+DawDreamer et Csound 7 avec ADR de stack et runtime Csound isolé.
- Noyau Python, CLI, API FastAPI, jobs de rendu et tests de provenance/confinement.
- Frontend React/Vite : projets, rendu de clic, lecture WAV, galerie initiale et variantes déterministes.

## v0.1 — 2026-07-28

### Ajouté

- Analyse des techniques actuelles de création musicale et sonore par code.
- Audit de projets GitHub open source et index consolidé des sources.
- Spécification de l’interface du studio et galerie de onze exemples reproductibles.
- Roadmap complète en douze phases avec contrat de livraison sans retouche externe.
- Contexte de projet, signaux de reprise et documentation de racine.
