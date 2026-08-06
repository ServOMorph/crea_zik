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
