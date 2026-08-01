# Signals — explo   (MAJ 2026-08-01)

## Actions ouvertes
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

## Dernière session (2026-08-01)
<!-- Écrasé intégralement par /close. Synthèse < 25 lignes. -->
# Session du 2026-08-01

## Décisions prises
- Le rendu de `morceau_electro` utilise désormais le plugin kick par manifeste et preset `techno` ; la
  synthèse locale a été retirée.

## Livrables produits ou modifiés
- `morceau_electro/render.py` : chargement mis en cache du plugin, du preset et du moteur déclaré.
- `morceau_electro/spec.json` : kick déclaré par `plugin_id`, `plugin_preset` et `plugin_overrides`.
- `morceau_electro/test_render.py` : test d'égalité entre le stem kick et le moteur de plugin.

## Hypothèses validées / invalidées
- VALIDE : le rendu déterministe appelle le moteur kick avec le preset configuré.
- VALIDE : le rendu 30 s est fini, sans clipping ; stems et rapport QA sont produits.
- EN ATTENTE : évaluer à l'écoute le sweep de hauteur sur le sub.

## Prochaine étape exacte
Implémenter et mesurer les trois réglages de punch ouverts de la phase 5 : duck d'attaque,
transitoire sub et saturation par couche.

## Question bloquante pour la session suivante
Aucune.
