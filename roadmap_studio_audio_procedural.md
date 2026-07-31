# Roadmap — studio de création musicale et sonore procédurale

Créée le : 2026-07-28

## Objectif

Construire un studio local avec UI pour créer, écouter, comparer, analyser et exporter des musiques et
effets sonores pour applications et jeux vidéo, sans aucun asset audio externe.

La source de vérité est une spec versionnée. Le rendu est déterministe et conserve sa seed, sa version
de moteur, son hash et son rapport qualité.

La version livrée doit être complètement fonctionnelle sans retouche extérieure : aucun passage dans
un DAW, aucun script manuel, aucun téléchargement complémentaire et aucune correction audio après
export ne doivent être nécessaires.

## Références

- `_docs/index_recherches_audio.md`
- `_docs/analyse_vibecoding_audio.md`
- `_docs/audit_github_audio_open_source.md`
- `_docs/specification_ui_studio_audio.md`

## Périmètre produit

Inclus :

- effets sonores procéduraux ;
- instruments de synthèse ;
- composition et rendu musical multipiste ;
- musique adaptative pilotée par des états de gameplay ;
- variantes déterministes ;
- UI locale complète ;
- assistant LLM proposant des modifications de specs ;
- analyse, mastering et export ;
- préécoute offline puis temps réel ;
- export WAV universel et au moins une intégration de référence.
- galerie d’exemples sonores et musicaux installée avec l’application ;
- masters prêts à l’emploi produits uniquement par le pipeline du projet.

Hors MVP :

- import de samples, SoundFonts ou réponses impulsionnelles ;
- enregistrement microphone ;
- collaboration multi-utilisateur ;
- marketplace ;
- entraînement de modèle audio neuronal ;
- DAW généraliste compatible avec tous les plugins tiers ;
- édition complexe sur smartphone ;
- intégration simultanée de tous les moteurs de jeu.

## Architecture cible

```text
React + TypeScript
        ↓ API HTTP / SSE
Backend Python
├── domaine et validation
├── composition
├── jobs de rendu
├── analyse et export
└── propositions LLM structurées
        ↓ contrat moteur
Faust / pyo / Csound / hôte offline retenu
        ↓
WAV + stems + manifests + rapports QA
        ↓
WebAssembly / miniaudio / adaptateur moteur de jeu
```

## Règles transversales

- fonctionnement offline par défaut ;
- liaison réseau locale sur `127.0.0.1` ;
- aucun chemin arbitraire fourni directement à un moteur ;
- aucune dépendance sonore externe ;
- seed obligatoire pour toute opération aléatoire ;
- mêmes entrées + mêmes versions = même hash de sortie ;
- calcul audio en float, livraison canonique 48 kHz ;
- tests Python, frontend, end-to-end et DSP intégrés à chaque phase ;
- aucune proposition LLM appliquée sans validation de schéma et acceptation utilisateur ;
- toute dépendance conserve sa licence et sa version dans un registre ;
- un moteur reste remplaçable derrière le contrat de rendu.

## Contrat de livraison sans retouche

La version 1.0 n’est livrable que si :

- l’installation contient tous les moteurs et composants nécessaires ;
- le premier lancement ne demande ni terminal ni configuration technique obligatoire ;
- la galerie d’exemples est immédiatement visible et audible ;
- chaque exemple peut être ouvert, copié, modifié, régénéré et exporté depuis l’UI ;
- chaque master passe automatiquement les contrôles QA du profil sélectionné ;
- le mastering, le dither éventuel, les stems, les boucles et les manifests sont produits par
  l’application ;
- aucun fichier ne doit être corrigé dans un DAW ou un éditeur audio externe ;
- aucun placeholder, TODO fonctionnel, écran vide ou bouton factice ne reste dans le build ;
- les erreurs bloquantes sont traitées dans l’UI avec une action compréhensible ;
- le build est installé et testé sur une machine Windows propre ;
- l’ensemble du parcours fonctionne sans Internet après installation.

## Galerie d’exemples obligatoire

La galerie fait partie du produit, pas seulement des tests ou de la documentation.

Exemples sonores :

1. clic d’interface tactile ;
2. validation lumineuse ;
3. erreur sourde ;
4. impact métallique paramétrique ;
5. whoosh de transition ;
6. moteur science-fiction piloté par intensité ;
7. ambiance mécanique bouclable.

Exemples musicaux :

8. instrument polyphonique original ;
9. thème de menu de 30 à 45 secondes avec stems ;
10. boucle d’exploration de 45 à 60 secondes ;
11. musique adaptative exploration/tension/combat.

Chaque exemple livré comprend spec, seed, master, stems applicables, manifeste, rapport QA, scénario de
démonstration et hash de référence. Les exemples intégrés sont immuables ; l’utilisateur édite une
copie.

## Phase 0 — Benchmark et décisions techniques [TERMINÉ]

But : choisir le moteur d’authoring sur des preuves audibles et verrouiller l’environnement.

Tâches :

- [x] Créer les environnements Python et Node reproductibles.
- [x] Remplacer ou isoler le FFmpeg 2013 avant toute dépendance au binaire.
- [x] Installer dans des environnements séparés pyo, Faust+DawDreamer et Csound 7.
- [x] Définir un contrat commun minimal : spec, seed, événements, paramètres, sortie WAV.
- [x] Produire avec chaque route :
  - clic UI ;
  - impact modal ;
  - moteur continu ;
  - instrument polyphonique huit voix ;
  - boucle musicale de huit mesures.
- [x] Mesurer qualité audible, aliasing, déterminisme, temps de rendu, lignes de code, automation,
  stems, portabilité et contraintes de licence.
- [x] Écrire une ADR choisissant :
  - moteur d’authoring ;
  - moteur DSP portable ;
  - stratégie de rendu offline ;
  - politique GPL/LGPL ;
  - versions verrouillées.
- [x] Définir les budgets de performance à partir des mesures réelles.
- [x] Exécuter le benchmark trois fois par route et vérifier la reproductibilité.

Livrables :

- `benchmarks/engine_selection/` ;
- rapport audio et métriques ;
- ADR de stack ;
- fichiers de dépendances verrouillés ;
- cinq cas de test réutilisables.

Gate :

- les trois routes exécutent le même contrat ;
- les sorties et métriques sont conservées ;
- un moteur principal et un fallback sont choisis ;
- les licences sont compatibles avec la distribution envisagée.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 1 — Fondation du domaine et CLI [TERMINÉ]

But : établir les contrats stables avant de multiplier les fonctions et écrans.

Tâches :

- [x] Créer l’arborescence `backend/`, `frontend/`, `audio/`, `projects/`, `tests/` et `tools/`.
- [x] Définir les schémas versionnés :
  - Project ;
  - Patch ;
  - Score ;
  - Instrument ;
  - EffectChain ;
  - AdaptiveGraph ;
  - RenderJob ;
  - Artifact ;
  - QaReport.
- [x] Implémenter identifiants, seeds, résolution des chemins et migrations de schéma.
- [x] Définir l’interface `RenderEngine` indépendante du moteur retenu.
- [x] Implémenter validation puis normalisation canonique des specs.
- [x] Implémenter le calcul de hash de provenance.
- [x] Créer les commandes CLI `new`, `validate`, `render`, `analyze` et `export`.
- [x] Gérer erreurs typées, timeouts, annulation et logs structurés.
- [x] Fournir un projet exemple minimal sans fichier audio source.
- [x] Tester schémas, migrations, chemins hostiles, seeds, hashes et CLI de bout en bout.

Livrables :

- noyau Python installable ;
- schémas documentés ;
- moteur branché derrière un adaptateur ;
- CLI fonctionnelle ;
- premier WAV déterministe.

Gate :

- trois rendus successifs d’une même spec produisent le même hash ;
- une spec invalide échoue avant le moteur avec une erreur actionnable ;
- aucun chemin ne peut sortir du projet autorisé.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 2 — Première tranche verticale avec UI [TERMINÉ]

Audit du 2026-07-31 : cases réauditées par lecture effective de `backend/src/crea_zik/api.py`,
`backend/src/crea_zik/gallery.py`, `frontend/src/main.tsx`, `frontend/src/app/`, `frontend/src/editor/`
et `frontend/package.json`. Le code dépasse la description initiale de cette phase : la structure réelle
a divergé (éditeur multipiste dans une zone `EDITEUR` dédiée avec son propre roadmap, système de plugins
dans `EXPLO`/`api.py` non prévu ici). Décision : reprise directe malgré l’écart, pas de réécriture
complète — le gate de la phase est rempli et une réécriture n’apporterait aucune valeur pour débloquer
la suite (promotion des plugins). Les phases 3+ ci-dessous restent à réauditer une par une avant reprise,
au même titre, plutôt que d’être reprises telles quelles.

But : livrer tôt un parcours complet utilisable sans terminal.

Tâches backend :

- [x] Créer l’API FastAPI pour projets, specs, jobs, artifacts et rapports.
- [x] Ajouter une file de jobs locale avec progression SSE et annulation.
- [x] Servir les rendus en lecture seule avec vérification de chemin.
- [x] Implémenter un patch de clic UI paramétrable et ses variantes.

Tâches frontend :

- [x] Initialiser React, TypeScript, Vite, lint, formatage et tests.
- [x] Créer le shell : navigation, espace central, inspecteur, transport et jobs.
- [x] Créer l’écran Projets.
- [x] Créer la Galerie d’exemples et son mécanisme « Ouvrir une copie ».
- [x] Créer un Sound Designer minimal avec paramètres, seed et bouton de rendu.
- [x] Ajouter lecture, pause, stop, boucle, volume et indicateur de clipping.
- [x] Afficher waveform, durée, peak et hash.
- [x] Ajouter génération de dix variantes, favoris et comparaison A/B.
- [x] Livrer les trois premiers exemples : clic, validation et erreur.
- [x] Exporter un WAV et son manifeste.
- [x] Ajouter états loading, empty, erreur et annulation.
- [x] Tester API, composants, clavier et parcours Playwright complet.

Livrables :

- application locale lançable par une commande ;
- premier son créé, modifié, écouté, comparé et exporté depuis l’UI ;
- galerie initiale avec trois exemples jouables et copiables ;
- système de jobs visible.

Gate :

- un utilisateur crée un projet et exporte une variante sans terminal ;
- les trois exemples se lisent et se régénèrent depuis l’UI ;
- une annulation ne bloque pas les jobs suivants ;
- l’application fonctionne sans Internet.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 3 — Bibliothèque DSP et Sound Designer complet [TODO]

But : couvrir les principales familles d’effets sonores avec une qualité contrôlée.

Tâches moteur :

- [ ] Implémenter oscillateurs sine, triangle, wavetable et formes band-limitées.
- [ ] Implémenter bruits blanc, rose, brun et bruit filtré avec seed.
- [ ] Implémenter enveloppes, LFO, FM, AM, ring modulation et modulation de paramètres.
- [ ] Implémenter filtres, égalisation, dynamique, saturation et waveshaping.
- [ ] Ajouter oversampling local et resampling de qualité.
- [ ] Implémenter délais, chorus, flanger, phaser et réverbération algorithmique.
- [ ] Ajouter résonateurs, synthèse modale et premiers modèles physiques.
- [ ] Créer les familles UI, impact, whoosh, moteur, drone et ambiance.
- [ ] Finaliser les sept exemples SFX de la galerie avec masters et rapports QA.
- [ ] Exposer des macros artistiques indépendantes des paramètres internes.

Tâches UI :

- [ ] Finaliser les vues macros, graphe, variantes, code/spec et QA contextuelle.
- [ ] Ajouter randomisation par plages avec verrouillage de paramètres.
- [ ] Ajouter grille de variantes, notes, tags, favoris et promotion en master.
- [ ] Ajouter édition avancée du code Faust si Faust est retenu.
- [ ] Afficher la provenance et les licences des primitives.
- [ ] Ajouter undo/redo local et sauvegarde explicite.
- [ ] Tester stabilité numérique, aliasing, clics, bornes de paramètres et six parcours Sound Designer.

Livrables :

- bibliothèque de primitives DSP ;
- six familles de sons ;
- sept exemples SFX installés dans la galerie ;
- Sound Designer conforme à la spécification UI ;
- presets uniquement constitués de paramètres et de code.

Gate :

- chaque famille génère au moins dix variantes déterministes ;
- chaque exemple intégré se régénère avec le hash attendu ;
- aucun test ne produit NaN, infini, DC excessif ou clipping non signalé ;
- les contrôles artistiques restent stables sur toute leur plage.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 4 — Composition, instruments et Music Composer [TODO]

But : créer une musique multipiste entièrement synthétique avec stems.

Tâches moteur :

- [ ] Implémenter tempo, métrique, grille et conversion beat/sample.
- [ ] Intégrer ou adapter isobar pour les patterns déterministes.
- [ ] Ajouter notes, accords, gammes, motifs et transformations.
- [ ] Ajouter validation des mesures, tessitures, voix et polyphonie.
- [ ] Ajouter quantification, swing et humanisation avec seed.
- [ ] Implémenter instruments polyphoniques et allocation de voix.
- [ ] Ajouter automation sample-accurate, bus, sends, mixer et stems.
- [ ] Ajouter marqueurs, régions et boucles sans couture.

Tâches UI :

- [ ] Créer arrangement multipiste, piste de tempo et marqueurs.
- [ ] Créer éditeur de patterns et piano roll.
- [ ] Ajouter accord/gamme, transposition et mutations de motif.
- [ ] Ajouter mixer, solo, mute, gain, pan, sends et bus.
- [ ] Ajouter automation et inspection des instruments.
- [ ] Exporter mix et stems de longueur identique.
- [ ] Livrer l’instrument polyphonique, le thème de menu et la boucle d’exploration dans la galerie.
- [ ] Tester une pièce de huit mesures puis une pièce de 30 à 60 secondes.

Livrables :

- Music Composer ;
- instruments de référence ;
- pièce multipiste ;
- stems synchronisés ;
- boucle musicale exacte.
- trois exemples musicaux jouables, copiables et régénérables depuis l’UI.

Gate :

- le total des durées de mesures est exact au sample ;
- les stems se recombinent au mix de référence dans la tolérance numérique définie ;
- deux rendus à seed identique sont bit-identiques.
- les masters musicaux sortent directement du pipeline sans étape externe.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 5 — Musique adaptative et Adaptive Lab [TODO]

But : piloter musique et sons par des paramètres de gameplay.

Tâches moteur :

- [ ] Définir états, couches, segments, conditions et transitions.
- [ ] Implémenter transitions immédiates, au beat, à la mesure et en fin de segment.
- [ ] Ajouter crossfade, stingers synthétiques et conservation de phase.
- [ ] Exposer intensité, vitesse, santé, distance et paramètres personnalisés.
- [ ] Créer un simulateur déterministe de chronologie gameplay.
- [ ] Détecter états inaccessibles, cycles interdits et transitions ambiguës.
- [ ] Produire manifeste, cue points et données d’intégration.
- [ ] Livrer l’exemple adaptatif exploration/tension/combat avec scénario reproductible.

Tâches UI :

- [ ] Créer éditeur de graphe d’états utilisable au clavier.
- [ ] Ajouter inspecteur de conditions et quantification.
- [ ] Créer simulateur de paramètres et journal des décisions.
- [ ] Visualiser beat, mesure, état courant et transition planifiée.
- [ ] Enregistrer et rejouer des scénarios.
- [ ] Tester la matrice complète des états et transitions sur des scénarios verrouillés.

Livrables :

- Adaptive Lab ;
- graphes adaptatifs versionnés ;
- démo exploration/tension/combat ;
- exemple adaptatif intégré à la galerie ;
- manifeste d’intégration.

Gate :

- toutes les transitions autorisées sont audibles sans rupture ;
- les scénarios rejoués prennent les mêmes décisions ;
- aucune transition non définie ne produit un silence ou un état incohérent.
- le scénario de galerie peut être joué et modifié sans terminal.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 6 — QA audio, mastering et exports [TODO]

But : rendre la qualité mesurable et actionnable dans l’UI.

Tâches :

- [ ] Calculer sample peak, true peak, LUFS, RMS, crest factor et DC.
- [ ] Calculer spectre, énergie par bandes, corrélation stéréo et compatibilité mono.
- [ ] Vérifier continuité de boucle en valeur et en pente.
- [ ] Détecter silence inattendu, queue coupée, clipping, NaN et infini.
- [ ] Valider l’implémentation loudness avec les signaux de référence officiels.
- [ ] Créer une chaîne de mastering transparente et bypassable.
- [ ] Définir profils SFX, musique, preview et master, sans imposer une même cible LUFS à tous.
- [ ] Générer waveform et spectrogramme mis en cache.
- [ ] Créer l’écran Analyse & Export et ses liens vers les erreurs.
- [ ] Ajouter comparaison avant/après et A/B loudness-matchée.
- [ ] Exporter WAV 32-bit float, WAV PCM 24 bits, stems, manifests et rapports.
- [ ] Ajouter rendu batch, reprise partielle et rapport global.
- [ ] Exécuter la QA et le mastering final sur les onze exemples de la galerie.
- [ ] Interdire la promotion en master lorsqu’une retouche externe serait encore nécessaire.
- [ ] Tester les métriques sur signaux analytiques et cas audio verrouillés.

Livrables :

- moteur QA ;
- mastering ;
- écran Analyse & Export ;
- profils de livraison ;
- rapports machine lisibles JSON et humains lisibles.

Gate :

- les mesures passent les tests de référence ;
- un asset bloqué ne peut pas être marqué master sans dérogation explicite tracée ;
- chaque export est relié à sa spec, seed, version et rapport.
- les onze exemples sortent prêts à l’emploi sans correction externe.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 7 — Assistant de vibecoding dans l’UI [TODO]

But : permettre des modifications en langage naturel sans perdre contrôle ni reproductibilité.

Tâches :

- [ ] Définir un format JSON Patch limité aux schémas du projet.
- [ ] Brancher Ollama local comme premier fournisseur.
- [ ] Construire les prompts à partir de la spec et du vocabulaire autorisé.
- [ ] Refuser champs inconnus, code arbitraire, chemins et commandes.
- [ ] Afficher diff sémantique, justification courte et impacts attendus.
- [ ] Ajouter accepter, modifier, rejeter, preview et annuler.
- [ ] Historiser intention, patch proposé, modèle, version et décision.
- [ ] Étendre les commandes au son, à la musique et aux graphes adaptatifs.
- [ ] Créer un benchmark verrouillé d’intentions simples, ambiguës et hostiles.
- [ ] Tester que zéro proposition ne contourne validation, historique ou confirmation.

Livrables :

- barre de commande d’intention ;
- proposition structurée ;
- diff/preview ;
- historique des décisions ;
- benchmark de sécurité et pertinence.

Gate :

- toutes les modifications acceptées restent des specs valides ;
- aucun prompt ne peut déclencher une écriture arbitraire ;
- une proposition refusée ne modifie aucun état persistant.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 8 — Préécoute temps réel et DSP portable [TODO]

But : rapprocher l’écoute UI du comportement réel dans une application ou un jeu.

Tâches :

- [ ] Compiler les DSP retenus en WebAssembly.
- [ ] Héberger le traitement dans `AudioWorklet`.
- [ ] Implémenter paramètres lissés, événements et voix polyphoniques.
- [ ] Synchroniser transport UI et horloge audio.
- [ ] Ajouter hot reload avec crossfade sans clic.
- [ ] Afficher CPU, underruns, voix et latence.
- [ ] Conserver un fallback vers rendu offline.
- [ ] Comparer numériquement rendu offline et rendu temps réel sur graphes compatibles.
- [ ] Effectuer un stress test de dix minutes et documenter les limites.

Livrables :

- moteur de preview temps réel ;
- DSP WebAssembly ;
- diagnostics de performance ;
- rapport de parité offline/temps réel.

Gate :

- aucune coupure sur le scénario de stress de référence ;
- les paramètres continus ne produisent pas de clic ;
- les divergences offline/temps réel sont expliquées et bornées.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 9 — Bibliothèque, historique et provenance [TODO]

But : gérer un catalogue croissant sans perdre les sources ni les décisions.

Tâches :

- [ ] Finaliser recherche, tags, collections, favoris et filtres.
- [ ] Finaliser la galerie en lecture seule et le workflow « Ouvrir une copie ».
- [ ] Distinguer source, preview, rendu validé, stem et master.
- [ ] Implémenter snapshots de specs et restauration non destructive.
- [ ] Ajouter diff sémantique et A/B entre versions.
- [ ] Détecter artifacts obsolètes après changement de spec ou moteur.
- [ ] Générer inventaire des dépendances et licences par asset.
- [ ] Vérifier la présence et l’intégrité des specs, masters, stems, rapports et hashes des exemples.
- [ ] Ajouter sauvegarde/restauration d’un projet sans ressources externes.
- [ ] Tester migrations, historique, restauration et corruption partielle.

Livrables :

- bibliothèque complète ;
- historique ;
- provenance ;
- export/import de projet.

Gate :

- tout master remonte à une source exacte ;
- une restauration ne supprime jamais la version courante ;
- une mise à jour moteur invalide visiblement les rendus concernés.
- aucun exemple intégré ne peut être modifié ou supprimé par erreur.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 10 — Intégration applications et jeux [TODO]

But : prouver que les créations quittent le studio proprement.

Tâches communes :

- [ ] Définir un manifeste runtime indépendant du moteur cible.
- [ ] Exporter assets statiques, stems, boucles, cue points et paramètres.
- [ ] Créer un SDK minimal de lecture et transitions.
- [ ] Ajouter profils de compression et budgets CPU/mémoire par plateforme.
- [ ] Créer une démo d’intégration reproductible.

Ordre :

- [ ] Intégration Web de référence via WebAssembly/AudioWorklet.
- [ ] Choisir avec l’utilisateur un premier moteur de jeu : Godot, Unity ou Unreal.
- [ ] Implémenter uniquement cet adaptateur et ses tests avant d’ouvrir les suivants.
- [ ] Documenter le contrat pour les futurs adaptateurs.

Tests :

- [ ] chargement et lecture ;
- [ ] boucle ;
- [ ] transition adaptative ;
- [ ] changement de périphérique ;
- [ ] budget CPU/mémoire ;
- [ ] build de production de la démo.

Livrables :

- export runtime universel ;
- intégration Web ;
- un adaptateur moteur de jeu ;
- démos et documentation.

Gate :

- la démo reproduit le scénario adaptatif de référence ;
- aucun fichier source externe n’est requis au runtime ;
- les budgets définis en phase 0 sont respectés ou renégociés explicitement.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Phase 11 — Packaging, accessibilité et livraison 1.0 [TODO]

But : produire une application locale installable et une démonstration complète.

Tâches :

- [ ] Empaqueter backend, frontend et moteurs verrouillés.
- [ ] Créer lanceur, diagnostics et gestion des ports locaux.
- [ ] Ajouter migration et sauvegarde avant mise à jour.
- [ ] Finaliser navigation clavier, focus, contraste et préférences de mouvement.
- [ ] Vérifier comportement sans périphérique audio et sans réseau.
- [ ] Auditer licences des dépendances et générer les notices.
- [ ] Créer documentation utilisateur et guide de dépannage.
- [ ] Intégrer et valider les onze exemples obligatoires de la galerie.
- [ ] Produire au moins dix variantes de chaque asset paramétrique.
- [ ] Vérifier que tous les exemples sont visibles, lisibles, copiables et régénérables au premier
  lancement.
- [ ] Vérifier que chaque master est exploitable tel quel sans DAW ni éditeur externe.
- [ ] Exécuter tests unitaires, intégration, E2E, DSP, accessibilité et stress.
- [ ] Faire une recette d’écoute humaine documentée sur plusieurs systèmes de restitution.
- [ ] Installer le build sur une machine Windows propre et exécuter la recette complète hors ligne.

Livrables :

- version 1.0 installable ;
- projets de démonstration ;
- galerie de onze exemples avec sources, masters, stems, manifests et rapports ;
- documentation ;
- notices de licences ;
- rapport de recette.

Gate :

- installation et premier rendu sur une machine propre ;
- lecture immédiate de tous les exemples après installation ;
- parcours Sound Designer, Music Composer et Adaptive Lab complets ;
- zéro dépendance à un asset audio externe ;
- zéro retouche audio externe requise ;
- zéro placeholder ou contrôle non fonctionnel ;
- tous les tests automatiques verts ;
- recette humaine acceptée.

**⏸ Checkpoint** — Demander à l’utilisateur de faire `/compact` avant de continuer.
Attendre sa réponse écrite. Ne pas commencer la phase suivante sans confirmation.

## Risques principaux

### Dispersion technologique

Risque : cumuler pyo, Faust, Csound et DawDreamer en production.

Réponse : le benchmark de phase 0 choisit un moteur principal et un fallback ; les autres restent hors
du chemin critique.

### Licence

Risque : intégrer du GPL dans un produit distribué sans décision.

Réponse : registre de licences, séparation des outils de développement, ADR et audit final.

### Qualité subjective

Risque : tests verts mais sons artistiquement faibles.

Réponse : gates audibles, comparaison A/B et recette humaine à chaque famille importante.

### Complexité de l’UI musicale

Risque : reconstruire prématurément un DAW généraliste.

Réponse : limiter les écrans aux workflows procéduraux, livrer par tranches verticales et garder les
fonctions DAW hors MVP.

### Divergence offline/temps réel

Risque : un patch ne sonne pas pareil dans l’UI et dans le jeu.

Réponse : code DSP partagé, tests de parité, versions verrouillées et fallback offline explicite.

### Performance

Risque : graphes trop coûteux pour le navigateur ou le moteur cible.

Réponse : budgets issus du benchmark, profiling visible, pages de qualité et exports statiques lorsque
le temps réel n’apporte pas de valeur.

## Définition de terminé

Le projet est considéré livré lorsque :

- l’application fonctionne localement sans Internet ;
- un utilisateur non développeur peut créer et exporter effets et musique depuis l’UI ;
- les onze exemples intégrés sont immédiatement audibles, copiables et reproductibles ;
- les sources sont exclusivement mathématiques ou procédurales ;
- le rendu est reproductible et traçable ;
- le studio couvre SFX, musique multipiste et musique adaptative ;
- la QA est visible et bloque les défauts critiques ;
- un runtime Web et un moteur de jeu de référence lisent les exports ;
- l’application est empaquetée, documentée et testée.
- les masters exportés sont utilisables directement dans une application ou un jeu sans retouche.
