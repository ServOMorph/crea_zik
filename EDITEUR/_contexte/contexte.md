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
Phases 0/V0, 1/V1, V2, Phase 2 et Phase 3/V3 (shell, sidebar et routage) [FAIT]. Qualification du
shell complète : composants et états de page testés (Vitest+RTL), axe-core sur l'éditeur réel et ses
états, parcours Playwright URL directe/historique/sidebar active/conservation du projet, snapshots
visuels approuvés ; runner canonique complet vert — backend 111 tests (couverture 88,61 %), frontend
39 unitaires, a11y 5, e2e 10, mutation Stryker 87,31 % ≥ 60 %, build, visuel, markdownlint.

## Décisions structurantes (append only — 10 entrées max, 5 lignes max/entrée, archiver au-delà)
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
- 2026-08-02 : golden `EDITEUR/fixtures/lignes_de_nuit.golden.json` régénéré (root cause : golden
  désynchronisé par un changement du renderer `explo`, pas une régression éditeur) ; décision actée
  avec confirmation explicite de l'utilisateur, car régénérer un golden touche un gate de
  déterminisme.
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
