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
Phase 0 et gate V0 [FAIT]. Phase 1 (domaine compositionnel, migration de `Lignes de nuit`) [FAIT] :
`Pattern.events` est désormais `list[NoteEvent]` (notes résolues) et `Composition.master_channel`
(typé `MixerChannel`) remplace l'ancien dict `mixer` ; migration vérifiée bit-exacte à l'écoute
programmatique (hachages SHA-256 identiques avant/après). Phase V1 [EN COURS] : tests domaine et
déterminisme couverts, mutation testing Python (mutmut) bloqué de façon structurelle et documenté
comme limite connue (`EDITEUR/docs/limites_connues.md`, LIM-001) malgré un environnement WSL/Csound
provisionné ; le runner canonique complet (`test_editor.ps1`) reste à relancer avant la Phase 2.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
- 2026-07-30 : Initialisation de l'agent EDITEUR (mode création), périmètre étendu à frontend/ et
  backend/ (décision utilisateur) car le rôle implique de développer directement l'éditeur dans le
  code applicatif existant, pas seulement produire des specs.
- 2026-07-30 : Roadmap dédiée à l’éditeur intégré : sidebar gauche, édition complète de `Lignes de
  nuit`, gates automatiques interphases, seuil fonctionnel de 85 % et documentation exhaustive des
  fonctions manquantes et des tests manuels.
- 2026-07-30 : Les services et écrans partagés déjà livrés sont réutilisés comme fondations, sans
  considérer la phase 0 de l’éditeur terminée avant la création du runner canonique et la réussite de V0.
- 2026-07-30 : La spécification de composition versionnée est la source unique du mix et des stems ;
  toute copie remappe aussi les références du mixer.
- 2026-07-30 : La préécoute lit des plages de révision via Web Audio et le rendu utilise des voix DSP
  spécialisées par famille instrumentale.
- 2026-07-30 : Seuil de couverture frontend abaissé temporairement (60 %/75 %) pour
  `TransportBar.tsx`/`EditorLanding.tsx`, non testés en profondeur ; à remonter à 80 % après les
  phases V3/V5 dédiées, pour éviter la couverture artificielle interdite par la roadmap.
- 2026-07-30 : mutmut reste verrouillé en dépendance mais son exécution est bloquée nativement sous
  Windows (WSL requis) ; traité comme réserve d'infrastructure documentée, pas comme gate contourné.
- 2026-08-01 : mutmut reste bloqué même sous WSL provisionné (Ubuntu, Python 3.13, Csound) : incompatibilité
  structurelle entre `source_paths` de mutmut et le mode d'import réel du projet (`pythonpath`).
  Acté comme limite documentée (LIM-001) plutôt que poursuivi via restructuration app-wide des imports.
- 2026-08-01 : `Pattern.events` et `Composition.mixer` (dicts génériques codant des données typables)
  migrés vers `list[NoteEvent]` et `MixerChannel` typés, pour tenir la promesse de la Phase 1 (schéma
  entièrement pilotable par données) plutôt que de considérer la phase close sur un socle partiel.
