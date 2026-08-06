# Changelog

## v0.34 — 2026-08-06

### Modifié

- `EDITEUR/roadmap_editeur_musical.md` : Phase 12 (Rendu final, QA et export) ouverte et découpée en
  sept étapes séquentielles (12.1 métriques true peak/LUFS manquantes, 12.2 modèle de rendu et
  manifeste étendus, 12.3 comparaison rendu périmé, 12.4 gate de promotion master, 12.5 écran
  Analyse & Export, 12.6 téléchargement et bundle, 12.7 non-régression) avec constat de l'existant.

### Notes

- Audit de l'existant : moteur de rendu, écriture WAV float32/PCM24, jobs progression/annulation et
  métriques peak/RMS/DC/clipping déjà livrés. True peak et LUFS absents du dépôt — à implémenter en
  premier (étape 12.1). Aucun code applicatif modifié cette session.

## v0.33 — 2026-08-06

### Ajouté

- Backend : `effect_registry.py` (registre typé d'effets — bornes, sanitize, defaults par kind) ;
  `composition_dsp.py` étendu (`eq_band`, `saturate`, `compress`, `delay_line`,
  `apply_balance_pan`) ; `GET /api/effect-registry` ; `POST .../mixer-preview` (préécoute mixer
  sans persistance, pour la comparaison A/B).
- Backend : `compositions.py` — routage topologique piste→bus→master avec sends,
  `_apply_effect_chain` (chaîne d'effets ordonnée, bypass respecté), stems pré/post-fader
  (`RenderSettings.stem_fader`).
- Backend : `models.py` — `MixerChannel.name`, `RenderSettings.stem_fader` ; détection de cycle du
  mixer (`_has_mixer_cycle`) étendue aux arêtes `sends` en plus de `output`.
- Frontend : `Mixer.tsx` (tranches piste/bus/master, fader, pan, mute/solo, routage, sends, chaîne
  d'effets, vu-mètres peak/RMS, comparaison A/B) ; `mixerRouting.ts` (portage de la détection de
  cycle) ; `effectRegistry.ts` (fetch du registre d'effets).
- Frontend : `editorStore.ts` — type `ChannelSelector` (piste/bus/master) et commandes mixer
  génériques (`setChannelFlag`/`setChannelField`/`setChannelOutput`/`setChannelSend`/
  `addChannelEffect`/etc.) ; `transport.ts` — `peakOf`/`rmsOf`/`meterStatsFromBuffer`.
- Tests : `tests/test_editor_mixer.py`, `tests/test_effect_registry.py`, `Mixer.test.tsx`,
  `mixerRouting.test.ts`, extensions `editorStore.property.test.ts`/`transport.test.ts`/
  `studio.spec.ts` (parcours mixer Playwright).

### Notes

- Phase 11 (Mixer, routage et effets) et qualification V11 closes [FAIT] : runner canonique complet
  vert (`EDITEUR/test-results/v1-20260806-144211.json`, success true, 20 checks, mutation Stryker
  63,69 % ≥ 60 %, 283 tests unitaires frontend, 17 e2e, visuel, markdownlint). Trois décisions de
  portée validées avec l'utilisateur : DSP réel mais minimal, vu-mètres post-rendu, A/B via préécoute
  non persistante. Phase 12 (Rendu final, QA et export) ouverte.

## v0.32 — 2026-08-06

### Ajouté

- `frontend/src/editor/editorStore.property.test.ts` : générateurs `fast-check` pour les commandes
  d'automation (ajouter/déplacer/modifier/supprimer un point, dupliquer/copier/mettre à l'échelle/
  inverser/supprimer une lane) intégrés au test d'inverses undo/redo.
- `frontend/e2e/studio.spec.ts` : test Playwright « automations create, move and delete a point with
  working undo/redo ».

### Corrigé

- `frontend/src/editor/editorStore.ts` : `execute()` assignait l'objet muté brut à l'état courant
  (`composition: after`) sans le cloner, alors que l'historique stockait `clone(after)` — une valeur
  `-0` issue d'une mise à l'échelle par facteur négatif (`scaleAutomationValues`) survivait dans
  l'état courant mais pas dans l'état reconstruit par un undo/redo ultérieur. Corrigé en clonant
  `after` avant assignation. Bug trouvé par le test de propriétés `fast-check` ajouté cette session.
- Lint Markdown de `EDITEUR/roadmap_editeur_musical.md` (ligne vide manquante avant le titre de la
  Phase V11).

### Notes

- Phase 10 (Automations) et qualification V10 closes [FAIT] : runner canonique complet vert
  (`EDITEUR/test-results/v1-20260806-112817.json`, success true, 260 tests unitaires, mutation
  Stryker 74,89 % ≥ 60 %, 16 e2e, visuel, markdownlint). Phase 11 (Mixer, routage et effets) ouverte
  [EN COURS]. Deux écarts assumés restent à trancher : panneau `Automations.tsx` dédié plutôt que
  lanes dans la Playlist, scope `master` d'automation non appliqué par le moteur de rendu.

## v0.31 — 2026-08-06

### Ajouté

- `frontend/src/editor/Automations.tsx` : panneau d'automation — lanes par piste/paramètre, courbes
  SVG step/linéaire/lissée, points ajoutés/déplacés/supprimés au clic et au glisser avec snap sur la
  grille, panneau d'édition précise (temps/valeur/interpolation), dupliquer/copier/×2/÷2/inverser,
  valeur évaluée affichée sous le playhead.
- `frontend/src/editor/Automations.test.tsx` : 12 tests.
- `frontend/src/editor/editorStore.ts` : `automationLaneLabel`, `automationTarget`,
  `groupWithPrevious` sur `updateAutomationPoint` ; 9 nouveaux tests dans `editorStore.test.ts`.

### Corrigé

- Régression préexistante sur `EMPTY_SELECTION` (ajout de `automation_lanes` non répercuté sur 2
  assertions de test de sélection).
- Lint bloquant (`playheadBeat` assigné mais jamais consommé dans `EditorLanding.tsx`), symptôme
  d'un chantier Automations laissé sans vue par une session interrompue — corrigé en construisant
  le panneau manquant plutôt qu'en supprimant le state.

### Notes

- Phase 10 (Automations) reste [EN COURS] : moteur backend et store frontend complets et testés
  (hérités d'une session précédente, vérifiés cette session), panneau UI livré ; manquent les tests
  `fast-check` et le parcours Playwright exigés par la Phase V10. Deux écarts assumés à trancher :
  panneau dédié plutôt que lanes dans la Playlist, scope `master` d'automation non appliqué par le
  moteur de rendu.

## v0.30 — 2026-08-06

### Ajouté

- `backend/src/crea_zik/instrument_registry.py` : registre typé des instruments (Phase 9) — groupes
  par kind (drums/bass/pad/arp/lead), scalaires et listes avec bornes/unités/défauts, `sanitize_parameters`
  (NaN→défaut, clamp, bursts triés, bandpass ordonné), `default_parameters`, `registry_payload`.
- `backend/src/crea_zik/api.py` : `GET /api/instrument-registry` ; `POST .../instrument-preview`
  acceptant des `parameters` explicites (préécoute sans sauvegarde).
- `frontend/src/editor/InstrumentInspector.tsx` : inspecteur d'instrument — sliders + saisie précise
  bornées, reset, comparaison avant/après avec restauration, bypass « écouter l'original », préécoute
  note/pattern/piste.
- `frontend/src/editor/instrumentRegistry.ts` : types TS du payload + fetch mémoïsé.
- `tests/test_editor_instruments.py` (50 tests), `frontend/src/editor/editorStore.instrument.test.ts`
  (9 tests), `frontend/src/editor/InstrumentInspector.test.tsx` (13 tests).

### Modifié

- `backend/src/crea_zik/composition_dsp.py` : `synthesize` applique `sanitize_parameters` en début
  de corps (burst protection).
- `frontend/src/editor/editorStore.ts` : `Track.instrument`, `setInstrumentParameter` (NaN ignoré,
  clamp, undo/redo, groupement drag), reset, `setInstrumentListLength`, `restoreInstrumentParameters`.
- `frontend/src/editor/EditorLanding.tsx` + `frontend/src/styles.css` : intégration de l'inspecteur
  (affiché quand une seule piste est sélectionnée).
- Phase 9 et qualification V9 closes [FAIT] : runner canonique complet vert
  (`EDITEUR/test-results/v1-20260806-073005.json`, success true, 21 checks), backend 179 tests,
  frontend 239 unitaires, e2e 15/15, mutation Stryker 77.02. Phase 10 (Automations) ouverte.

## v0.29 — 2026-08-06

### Corrigé

- `frontend/e2e/studio.spec.ts` : assertion V8 du drag-and-drop Playlist rendue dynamique — le test
  rouge n'était pas un bug du ripple mais une attente erronée (le clip ajouté démarre à
  `compositionEndBeat` = 62 beats, pad déplacé à 2..62, pas à 60) ; l'assertion vérifie que le clip
  suivant est poussé de la distance exacte du drag. Désambiguïsation du checkbox « Boucle sélection »
  (collision avec le checkbox « Ripple » de la Playlist en strict mode).
- `EDITEUR/test_editor.ps1` : gate `python-lock` échouait à tort — `uv lock --check` écrit sa
  progression sur stderr même en succès, transformé en exception par `$ErrorActionPreference="Stop"` ;
  `Invoke-Gate` abaisse localement la préférence à `Continue` (les échecs réels restent détectés via
  `$LASTEXITCODE`).

### Modifié

- Qualification V8 close : runner canonique complet vert (`EDITEUR/test-results/v1-20260806-060208.json`,
  success true, 20 checks), e2e 15/15, backend 130 tests, golden `Lignes de nuit` inchangé. Phase 9
  (Instruments procéduraux et inspecteur) ouverte.

## v0.28 — 2026-08-06

### Ajouté

- `frontend/src/editor/Playlist.tsx` : Playlist multipiste (Phase 8) — lanes synchronisées au
  Channel Rack, clips déplacement/redimensionnement/découpe, insert/delete time, ripple,
  mute/lock, marqueurs éditables (intro/groove/montée/climax/outro), création/renommage/
  réorganisation de pistes, chevauchements `is-obscured`, alerte de densité (limite 300) ;
  drag à deltas incrémentés + snap, poignées de resize en vrais boutons.
- `frontend/src/editor/Playlist.test.tsx` : 17 tests du composant (drags, split, marqueurs,
  pistes, overlap).
- `frontend/src/editor/clipCommands.ts` : `resizeClip` clamp aux bornes
  (`CLIP_LENGTH_MIN`/`CLIP_LENGTH_MAX`) ; `clipMute` inutilisée supprimée.
- `frontend/src/editor/editorStore.ts` : `EMPTY_SELECTION` inclut `markers`.
- `frontend/src/editor/EditorLanding.tsx` : intégration de la Playlist (callbacks → store).
- `frontend/src/styles.css` : styles `.playlist*`.
- `frontend/e2e/studio.spec.ts` : test e2e V8 drag-and-drop Playwright (clips + marqueurs,
  sauvegarde/rechargement) — en cours de qualification.

## v0.27 — 2026-08-05

### Ajouté

- `frontend/src/editor/PianoRoll.tsx` : lanes vélocité/probabilité/micro-décalage/pan sous la
  grille (drag borné, undo groupé via 4e paramètre `groupWithPrevious` de `onSetNoteFields`) ;
  ghost notes des autres pistes (hors drums, pointillés non interactifs) ; sélecteurs tonique +
  mode avec surbrillance `is-offscale` des touches et notes hors gamme (non bloquante).
- `frontend/src/editor/PatternEditor.tsx` : prop `ghostNotes` et propagation de `groupWithPrevious`
  ; `frontend/src/editor/EditorLanding.tsx` : propagation de `groupWithPrevious`.
- `frontend/e2e/studio.spec.ts` : e2e d'édition souris — création, déplacement, resize, sauvegarde
  puis rechargement identique (« the piano roll edits notes with the mouse and keeps them after
  reload »).
- `tests/test_compositions.py` : preuve backend « note modifiée → rendu » — déplacement et
  transposition d'une note mélodique modifient stem et mix (hash).
- `frontend/src/editor/PianoRoll.test.tsx` : +2 tests (anti-accélération des drags, surbrillance
  de gamme).

### Corrigé

- Accélération des drags de déplacement/redimensionnement : les deltas étaient cumulés à chaque
  `pointermove` ; corrigé via `lastDeltaBeat`/`lastDeltaMidi`/`lastDelta` dans `DragState`.
- Libellés de notes du e2e piano roll : « Si3 » → « Sol#3 » (midi 56) — notation française exacte.

### Modifié

- `frontend/src/styles.css` : styles `.piano-roll__lane*`, `.piano-roll__ghost-note`, `.is-offscale`.
- `frontend/e2e/debug.spec.ts` : supprimé (fichier de debug temporaire).
- `EDITEUR/roadmap_editeur_musical.md` : Phase 7 et V7 [FAIT], Phase 8 ouverte [EN COURS] avec
  constat de session ; `EDITEUR/_contexte/signals.md` et `contexte.md` mis à jour.

## v0.26 — 2026-08-05

### Ajouté

- `frontend/src/editor/PianoRoll.tsx` + `PianoRoll.test.tsx` (nouveaux) : piano roll — clavier
  vertical, grille, rendu de toutes les notes mélodiques de `Lignes de nuit` et transposition
  exacte dans Chromium (e2e `studio.spec.ts` « the piano roll renders every melodic note and
  transposes exactly »).
- `frontend/src/editor/noteCommands.ts` + `noteCommands.test.ts` (nouveaux) : commandes notes —
  sélection, addNote/moveNotes/resizeNotes/duplicateNotes/deleteNotes, setNoteFields,
  quantizeNotes/swingNotes/humanizeNotes seedés, transposeNotes, legatoNotes, uniformDuration,
  invertNotes, buildChord.
- `frontend/src/editor/pianoRollGeometry.ts` + `pianoRollGeometry.test.ts` (nouveaux) :
  conversions beat/pixel, snap, bornes MIDI, clavier vertical, gamme/tonalité (fast-check).
- `frontend/src/editor/TransportBar.test.tsx` : +1 test — « Sauvegarde impossible, préécoute
  annulée. » quand `ensureSaved` échoue, sans appel de rendu.
- `frontend/e2e/studio.spec.ts` : test Chromium du piano roll (rendu des notes et transposition).

### Corrigé

- Course sauvegarde/préécoute : `EditorLanding.save()` partage la promesse PUT en vol
  (`saveInFlightRef`) — un clic « Lire la sélection » pendant la sauvegarde attend la fin du PUT
  au lieu d'avorter silencieusement (avant : transport bloqué sur « Rendu de la préécoute… »,
  e2e route directe en échec) ; `TransportBar.requestPreview` affiche « Sauvegarde impossible,
  préécoute annulée. » en cas d'échec de sauvegarde.
- Corruption UTF-8 réparée dans `EditorLanding.tsx`/`TransportBar.tsx` (6 chaînes avec U+FFFD,
  introduite par une conversion PowerShell antérieure) — cause réelle de 2 échecs unitaires ;
  import `redo` inutilisé retiré de `noteCommands.test.ts`.

### Modifié

- `frontend/src/editor/editorStore.ts` : patterns (longueur, nom, couleur, duplication, variation
  FNV-1a seedée, remplissages), `fillPatternRow`/`clearPatternRow`, `patternName`.
- `frontend/src/editor/StepSequencer.tsx`/`StepSequencer.test.tsx`, `stepSequencer.test.ts` :
  sélection multiple, remplissages, longueurs, nom/couleur/duplication/variation.
- `frontend/src/editor/EditorLanding.tsx` : intégration `PatternEditor`, fix course, réparation
  UTF-8. `TransportBar.tsx` : préécoute piste (`track_ids` + cache `:track:<id>`), fix, réparation
  UTF-8.
- `backend/src/crea_zik/models.py` : migration de schéma 2 → 3 (`CURRENT_SCHEMA_VERSION = 3`,
  `Pattern.name`/`color`/`length_beats`) ; `EDITEUR/contracts/composition.schema.json` et
  `EDITEUR/fixtures/lignes_de_nuit.composition.json` alignés ;
  `tests/test_compositions.py` + `tests/test_foundation.py` (migration, version future).
- `tests_manuels.md` : contrôles manuels des propriétés de patterns ajoutés en file d'attente.
- `EDITEUR/roadmap_editeur_musical.md` : Phase 6 et V6 [FAIT] (migration v3, PatternEditor,
  remplissages), Phase 7 [EN COURS] avec constat de session (piano roll de base livré).

## v0.25 — 2026-08-05

### Ajouté

- `frontend/src/editor/ChannelRack.tsx` + `ChannelRack.test.tsx` (nouveaux) : canaux des pistes
  avec mute/solo (flags `setTrackChannelFlag`, canal mixer créé à la première bascule).
- `frontend/src/editor/StepSequencer.tsx` + `StepSequencer.test.tsx` (nouveaux) : grille pas à pas
  avec résolution 1/1→1/8, regroupement par temps, peinture/effacement au glisser, équivalent
  clavier Entrée/Espace, sliders vélocité/probabilité/micro-décalage et bouton accent.
- `frontend/src/editor/stepSequencer.test.ts` (nouveau, 11 tests dont fast-check) : toggles,
  champs bornés par `STEP_FIELD_BOUNDS`, undo/redo, canaux, propriétés 100 runs.
- `backend/src/crea_zik/compositions.py` : gate `_event_plays` seedé (SHA-256) pour la probabilité
  et propagation de `micro_timing_beats` (décalage d'onset) ; `tests/test_editor_sequencer.py`
  (nouveau, 5 tests) ajouté aux gates lint/domain du runner canonique.
- `frontend/e2e/studio.spec.ts` : test Chromium du séquenceur (toggle clic + clavier, undo, mute,
  sauvegarde) — a détecté et corrigé l'inaccessibilité clavier du séquenceur.

### Modifié

- `frontend/src/editor/editorStore.ts` : types `NoteEvent`/`Pattern.events`/`MixerChannel`,
  commandes `setStep`, `setStepField`, `setTrackChannelFlag`, `addPattern`, helpers
  `stepBeat`/`patternLengthBeats`/`stepEvent`.
- `frontend/src/editor/TransportBar.tsx` : affichage du tempo (`120 BPM`) et de la métrique
  (`4/4`) — Phase 5 close [FAIT] ; prop `patternRequest` pour la préécoute du pattern.
- `frontend/src/editor/EditorLanding.tsx` : ChannelRackRow dans la VirtualList (rowHeight 48),
  séquenceur affiché par défaut sur la première piste drums ; `frontend/src/styles.css` :
  styles `.channel-rack__*` et `.step-sequencer__*`.
- `backend/src/crea_zik/compositions.py` : fix mute/solo — les pistes sans canal mixer sont
  muettes dès qu'un solo est actif.
- `EDITEUR/roadmap_editeur_musical.md` : Phase 5 [FAIT] (tempo/métrique testés) ; Phase 6 et
  Phase V6 passées [EN COURS] (Channel Rack + séquenceur livrés, runner canonique vert 20 checks,
  rapport `EDITEUR/test-results/v1-20260805-102645.json`).
- `tests_manuels.md` : contrôles manuels Channel Rack ajoutés en file d'attente.

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
