# Signals — explo   (MAJ 2026-08-08)

## Actions ouvertes
- [P2|ouvert] Démarrer la phase 1 de roadmap_kick_live.md (toolchain Rust, moteur en générateur
  par blocs avec état persistant pour le futur plugin `kick_live`, distinct de `kick`).
  fait quand: le crate Rust rend, en mode batch, les presets de référence avec la tolérance
  définie en phase 1, sans discontinuité de bloc ni clic sur changement de paramètre.
  réf: roadmap_kick_live.md, plugins/kick/engine.py, plugins/_common/dsp.py
- [P2|ouvert] Trois réglages de punch du kick différés (phase 5 de roadmap_plugins.md) :
  duck du corps/sub sur l'attaque, transitoire dédié sur le sub, saturation par couche
  (sub/corps séparés au lieu d'un drive global post-mix).
  fait quand: chaque réglage est implémenté, testé (non-régression + vérification
  spectrale ou écoute) et documenté dans roadmap_plugins.md
  réf: ../roadmap_plugins.md, plugins/kick/engine.py
- [P2|ouvert] Préparer l’intégration de l’archive au futur Music Composer.
  fait quand: un arrangement éditable produit une nouvelle version d’archive avec master, stems et QA
  réf: ../archives/README.md, ../archives/archive_piece.py, ../roadmap_archivage_morceaux.md
  note 2026-07-31: le chemin de promotion des plugins (`plugin_id`/`plugin_preset`/`plugin_overrides`
  dans `Track.instrument.parameters`) n’est pas encore branché sur l’archivage versionné. Un morceau
  utilisant un plugin promu n’archive donc pas la version du plugin ni ses empreintes.

## Actions fermées
- [P1|fermé 2026-08-01] Branchement du plugin kick sur le morceau démo `morceau_electro`.
  Résolue : `render.py` charge le moteur déclaré dans `plugins/kick/manifest.json` et le preset
  `techno` de `presets.json` ; la fonction locale `kick()` a été retirée.
  réf: morceau_electro/render.py, morceau_electro/spec.json, morceau_electro/test_render.py,
  plugins/kick/manifest.json, plugins/kick/presets.json
- [P1|fermé 2026-07-31] Phase 2 de la roadmap plugins (banc de test UI) côté crea_zik.
  Résolue : phases 2 et 3 de `../roadmap_plugins.md` livrées par crea_zik. Endpoints `/api/plugins`,
  écran de banc de test à contrôles générés depuis le manifeste, et promotion du kick sur le moteur
  de composition (`backend/src/crea_zik/composition_dsp.py`, `_plugin_voice`) avec équivalence
  bit-à-bit vérifiée contre le rendu direct.

## Dernière session (2026-08-08)
<!-- Écrasé intégralement par /close. Synthèse < 25 lignes. -->
# Session du 2026-08-08

## Décisions prises
- Nouveau plugin `kick_live` (temps réel, boucle + paramètres audibles en direct) : moteur DSP
  unique en Rust, compilé WASM pour AudioWorklet navigateur et lié en Python via PyO3 pour le
  rendu offline — pas de réimplémentation JS dupliquée. `plugins/kick/` reste intact.

## Livrables produits ou modifiés
- `roadmap_kick_live.md` : créé, 5 phases [TODO] (moteur Rust par blocs, liaison PyO3, WASM/
  AudioWorklet, exposition backend, banc de test temps réel).

## Hypothèses validées / invalidées
- EN ATTENTE : latence réelle changement de paramètre → audible avec l'architecture Rust/WASM
  (cible à fixer en phase 3, aucune mesure encore prise).

## Prochaine étape exacte
Démarrer la phase 1 de `roadmap_kick_live.md` (toolchain Rust, portage du moteur kick en
générateur par blocs avec état persistant).

## Question bloquante pour la session suivante
Aucune.
