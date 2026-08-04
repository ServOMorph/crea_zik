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
