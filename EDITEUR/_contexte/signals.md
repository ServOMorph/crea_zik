# Signals — editeur (MAJ 2026-08-06)

## Actions ouvertes
- [P2|ouvert] Réévaluer l'intégration visuelle des automations : elles vivent dans un panneau
  `Automations.tsx` dédié sous la Playlist plutôt que comme lanes dans la timeline `Playlist.tsx`
  comme envisagé initialement. Décider si cet écart est assumé définitivement ou si les lanes
  doivent être déplacées dans la Playlist.
  - fait quand: décision actée et documentée (assumée ou lanes déplacées dans `Playlist.tsx`)
  - réf: `frontend/src/editor/Automations.tsx`, `frontend/src/editor/Playlist.tsx`
- [P2|ouvert] Le scope `master` des cibles d'automation est accepté par la validation Pydantic
  (`AutomationLane.target`) mais jamais appliqué par le moteur de rendu (`compositions.py` n'applique
  que le scope `track`). Décider si c'est un gap backend à combler ou un scope à retirer du schéma.
  - fait quand: le scope `master` est soit appliqué au rendu, soit retiré du pattern de validation
  - réf: `backend/src/crea_zik/models.py` (AutomationLane.target), `backend/src/crea_zik/compositions.py`
- [P1|ouvert] Démarrer la Phase 12 (Rendu final, QA et export) : rendu morceau entier/boucle/
  sélection/pistes choisies, formats master/stems/WAV float32/PCM24, waveform, sample peak, true
  peak, LUFS, RMS, DC, clipping, progression/annulation/échec actionnable/reprise.
  - fait quand: Phase 12 fonctionnelle livrée et qualification V12 close (runner canonique vert)
  - réf: `EDITEUR/roadmap_editeur_musical.md` (Phase 12, Phase V12)

## Contexte chaud
- `mixer_channels` reste vide par défaut pour `Lignes de nuit` (aucun canal par piste tant qu'aucune
  action mixer explicite n'a été effectuée) : toute piste/bus sans canal est traitée avec
  gain=1/pan=0/output=master directement au rendu (`render_composition`, `compositions.py`). Tout
  futur test ou développement sur le mixer doit compter avec cet état vide par défaut.
- Sémantique pré/post-fader (`RenderSettings.stem_fader`) définie pragmatiquement : `"pre"` = buffer
  sec avant la chaîne d'effets d'insertion du canal, mais le gain/pan de piste reste inclus (déjà
  appliqué lors de la synthèse par événement, non séparable sans réécrire `_render_event`) — ne pas
  confondre avec la convention DAW stricte « avant fader ».
- La détection de cycle du mixer (`_has_mixer_cycle` backend, `hasMixerCycle` frontend
  `mixerRouting.ts`) suit désormais à la fois `output` ET `sends` (étendue cette session, un cycle
  pouvait auparavant se former par une combinaison des deux non détectée). Tout nouveau champ de
  routage doit être ajouté aux deux implémentations en parallèle.

## Dernière session
# Session du 2026-08-06

## Décisions prises
- Phase 11 (Mixer, routage et effets) et qualification V11 closes [FAIT] : chemin audio complet
  (pistes, bus, sends, master), DSP réel mais minimal (EQ, saturation, compresseur, délai,
  réverbération existante), routage topologique validé sans cycle, comparaison A/B sans risque de
  perte via un endpoint de préécoute qui ne persiste jamais la composition.
- Trois décisions de portée validées avec l'utilisateur avant implémentation : DSP réel mais minimal
  (pas de multi-bandes), vu-mètres peak/RMS post-rendu (pas d'`AnalyserNode` temps réel), A/B rendu
  via préécoute non persistante plutôt que sauvegarde/restauration.
- Les deux écarts P2 (panneau Automations, scope `master`) restent ouverts, non traités cette
  session.

## Livrables produits ou modifiés
- Backend : `effect_registry.py` (nouveau, bornes/sanitize/defaults par kind d'effet),
  `composition_dsp.py` (`eq_band`, `saturate`, `compress`, `delay_line`, `apply_balance_pan`),
  `compositions.py` (routage topologique piste→bus→master, `_apply_effect_chain`, stems pré/post-
  fader), `models.py` (`MixerChannel.name`, `RenderSettings.stem_fader`, cycle étendu aux `sends`),
  `api.py` (`GET /api/effect-registry`, `POST .../mixer-preview`).
- Frontend : `Mixer.tsx`, `mixerRouting.ts`, `effectRegistry.ts` (nouveaux) ; `editorStore.ts`
  (type `ChannelSelector` piste/bus/master, commandes mixer génériques) ; `transport.ts`
  (`peakOf`/`rmsOf`/`meterStatsFromBuffer`) ; `EditorLanding.tsx` (montage `Mixer`) ; `styles.css`.
- Tests : `tests/test_editor_mixer.py`, `tests/test_effect_registry.py` (backend) ; `Mixer.test.tsx`,
  `mixerRouting.test.ts`, extensions `editorStore.property.test.ts`/`transport.test.ts`/
  `studio.spec.ts` (frontend).
- `EDITEUR/roadmap_editeur_musical.md` : Phases 11 et V11 cochées [FAIT] avec preuves.
- `EDITEUR/contracts/composition.schema.json` : champs `name`/`stem_fader` ajoutés au contrat.

## Hypothèses validées / invalidées
- VALIDE : le pipeline de rendu refactoré (routage topologique) préserve la bit-exactitude des
  rendus existants sans bus — 216 tests backend restés verts avant et après refactor, y compris les
  golden hashes de `Lignes de nuit`.
- INVALIDE : les sends seuls suffisaient à garantir l'absence de cycle indépendamment de `output` —
  un cycle réel peut se former par combinaison des deux ; `_has_mixer_cycle` étendu en conséquence
  (voir Contexte chaud).
- VALIDE : runner canonique complet vert (`EDITEUR/test-results/v1-20260806-144211.json`,
  success true, 20 checks, mutation Stryker 63,69 % ≥ 60 %, 283 tests unitaires frontend, 17 e2e,
  visuel, markdownlint).

## Prochaine étape exacte
Ouvrir la Phase 12 (Rendu final, QA et export) ; trancher les deux écarts P2 encore ouverts au
moment jugé opportun.

## Question bloquante pour la session suivante
Aucune.
