# Spécification UI — studio audio procédural

Date : 2026-07-28
Statut : proposition de référence pour la roadmap

## Objectif

Créer une interface locale permettant de concevoir, écouter, comparer, analyser et exporter des
musiques et effets sonores entièrement générés par code.

L’interface ne masque pas la nature procédurale du projet : chaque rendu reste lié à une spec, une
seed, une version du moteur et un rapport qualité.

## Choix d’architecture UI

### Frontend

- React + TypeScript + Vite ;
- état serveur et cache via une couche de requêtes dédiée ;
- état d’édition local séparé de l’état sauvegardé ;
- Web Audio API pour la lecture, le transport et la préécoute ;
- Canvas ou WebGL uniquement lorsque la densité des visualisations le justifie ;
- tests unitaires avec Vitest et tests end-to-end avec Playwright.

### Backend local

- Python ;
- API HTTP typée avec FastAPI et schémas Pydantic ;
- file de travaux pour les rendus, analyses et exports ;
- progression par Server-Sent Events ;
- processus DSP séparé pour permettre annulation, délai maximal et remplacement du moteur ;
- écoute limitée à `127.0.0.1` par défaut ;
- chemins de fichiers résolus uniquement dans les dossiers de projets autorisés.

### Packaging

Le MVP est une application Web locale lancée par Python. La version distribuable regroupera :

- le backend Python empaqueté ;
- les fichiers statiques du frontend ;
- un lanceur ouvrant l’URL locale ;
- les binaires DSP verrouillés par version.

Un wrapper desktop natif n’est ajouté que s’il apporte un besoin concret absent du navigateur local.

## Principes UX

- résultat audible rapidement ;
- paramètres artistiques visibles avant les paramètres techniques ;
- aucune opération longue sans progression ni possibilité d’annulation ;
- toutes les variations importantes sont réversibles ;
- le LLM propose un diff de spec, jamais un changement silencieux ;
- les erreurs de QA sont reliées au contrôle susceptible de les corriger ;
- les fonctions accessibles au clavier ne dépendent pas d’un glisser-déposer ;
- l’audio ne constitue jamais l’unique moyen de transmettre une information ;
- aucune ressource sonore externe ne peut être importée par le workflow principal.

## Navigation

```text
Accueil / Projets
├── Galerie d’exemples
└── Projet
    ├── Bibliothèque
    ├── Sound Designer
    ├── Music Composer
    ├── Adaptive Lab
    ├── Analyse & Export
    ├── Historique
    └── Réglages
```

## Structure générale de l’écran

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Projet / Asset                 Commande d’intention          Render / CPU    │
├──────────────┬───────────────────────────────────────┬───────────────────────┤
│ Navigation   │                                       │ Inspecteur            │
│              │          Espace de travail            │ paramètres            │
│ Bibliothèque │                                       │ automation            │
│ Collections  │                                       │ seed / variantes      │
│ Rendus       │                                       │ QA contextuelle       │
├──────────────┴───────────────────────────────────────┴───────────────────────┤
│ Transport | temps | boucle | A/B | volume | jobs | messages                │
└──────────────────────────────────────────────────────────────────────────────┘
```

La disposition centrale change selon le module, mais le transport, la file de rendu et les
notifications restent cohérents.

## Écrans

### 1. Accueil et projets

Fonctions :

- créer, ouvrir, renommer, dupliquer et archiver un projet ;
- écouter immédiatement les exemples installés ;
- afficher le moteur, la fréquence d’échantillonnage et la date du dernier rendu ;
- signaler une spec invalide ou un rendu obsolète ;
- accéder aux créations récentes ;
- sauvegarder et restaurer un projet sous forme d’archive sans assets externes.

Gate UX :

- un nouveau projet est prêt à produire un son en moins de trois actions ;
- aucune configuration de périphérique n’est obligatoire pour un rendu offline.

### 2. Galerie d’exemples

La galerie est installée avec l’application et fonctionne sans connexion ni téléchargement.

Chaque carte d’exemple affiche :

- nom et intention sonore ;
- type : SFX, instrument, musique ou adaptatif ;
- lecteur et waveform ;
- durée, seed, moteur et statut QA ;
- paramètres principaux ;
- bouton « Ouvrir une copie » ;
- bouton « Régénérer et vérifier » ;
- accès à la spec, au graphe, aux stems et au rapport qualité.

Les exemples intégrés sont en lecture seule. Toute modification commence par une copie afin de
préserver une référence toujours fonctionnelle.

Catalogue minimal livré :

#### Effets sonores

1. clic d’interface tactile ;
2. validation lumineuse ;
3. erreur sourde ;
4. impact métallique paramétrique ;
5. whoosh de transition ;
6. moteur science-fiction piloté par intensité ;
7. ambiance mécanique bouclable.

#### Instruments et musiques

8. instrument polyphonique original ;
9. thème de menu de 30 à 45 secondes avec stems ;
10. boucle d’exploration de 45 à 60 secondes ;
11. musique adaptative exploration/tension/combat.

Chaque exemple contient :

- spec source ;
- seed par défaut ;
- rendu master inclus ;
- stems lorsqu’ils s’appliquent ;
- manifeste de provenance ;
- rapport QA ;
- scénario de démonstration ;
- test de régénération comparant le hash attendu.

### 3. Bibliothèque

Contenu :

- effets sonores ;
- instruments ;
- morceaux et stems ;
- graphes adaptatifs ;
- presets internes ;
- rendus et rapports.

Fonctions :

- recherche textuelle ;
- filtres par type, durée, seed, statut QA, tags et version du moteur ;
- vue grille et vue tableau ;
- collections ;
- comparaison de deux versions ;
- identification claire entre source, rendu temporaire et master validé.

### 4. Sound Designer

Sous-vues :

- macros artistiques ;
- graphe DSP ;
- variantes ;
- waveform/spectrogramme ;
- code/spec ;
- QA.

Fonctions principales :

- partir d’un template ou d’une spec vide ;
- contrôler matière, masse, énergie, brillance, durée, espace et mouvement ;
- verrouiller certains paramètres avant randomisation ;
- générer une grille de variantes à seeds différentes ;
- écouter au survol uniquement si l’utilisateur l’active ;
- sélectionner, comparer A/B, noter et promouvoir une variante ;
- éditer le graphe ou le code Faust dans un mode avancé ;
- afficher les métadonnées et licences des primitives utilisées.

Workflow :

```text
template → macros → préécoute → variantes → A/B → QA → master → export
```

### 5. Music Composer

Zones :

- arrangement multipiste ;
- éditeur de patterns ;
- piano roll ;
- accords et gammes ;
- automation ;
- inspecteur d’instrument ;
- mixer et bus ;
- gestion des stems.

Fonctions :

- tempo, métrique et grille ;
- création et mutation de motifs ;
- génération contrôlée de variations ;
- validation des mesures, tessitures et polyphonie ;
- quantification, swing et humanisation avec seed ;
- transitions et points de boucle à précision échantillon ;
- solo, mute, gain, panoramique et sends ;
- export du mix et des stems synchronisés.

### 6. Adaptive Lab

Représentation :

- graphe d’états ;
- transitions ;
- conditions ;
- paramètres exposés au jeu ;
- simulateur d’événements.

Fonctions :

- définir des états comme exploration, tension et combat ;
- associer couches, segments ou macros à chaque état ;
- choisir une quantification de transition : immédiate, beat, mesure ou fin de segment ;
- simuler une chronologie de valeurs de gameplay ;
- écouter les transitions et afficher leur décision ;
- détecter les états inaccessibles, transitions ambiguës et ruptures audibles ;
- exporter le manifeste d’intégration.

### 7. Analyse & Export

Visualisations :

- waveform ;
- spectrogramme ;
- crête et true peak ;
- LUFS ;
- RMS et crest factor ;
- corrélation stéréo ;
- énergie spectrale ;
- continuité de boucle ;
- coût de rendu ou coût CPU temps réel.

Fonctions :

- sélectionner un profil de livraison ;
- voir les contrôles bloquants et avertissements ;
- naviguer directement vers la zone temporelle fautive ;
- comparer avant/après mastering ;
- lancer un export unitaire ou batch ;
- produire WAV 32-bit float, WAV PCM 24 bits et manifeste ;
- conserver le rapport QA avec le rendu.

### 8. Historique

Fonctions :

- liste des versions de specs ;
- auteur de la modification : utilisateur, migration ou proposition LLM ;
- diff sémantique des paramètres ;
- écoute A/B entre deux versions ;
- restauration non destructive ;
- liens vers les rendus et rapports issus de chaque version.

### 9. Réglages

Sections :

- périphérique audio ;
- fréquence d’échantillonnage et buffer de préécoute ;
- moteur DSP sélectionné ;
- emplacements de projets et exports ;
- profils de qualité ;
- assistant local Ollama ;
- licences et versions des dépendances ;
- accessibilité ;
- diagnostics.

## Commande d’intention et assistant LLM

Une barre de commande permet des demandes comme :

- « rends cet impact plus lourd sans augmenter sa durée » ;
- « crée quatre variations moins brillantes » ;
- « transforme ce motif en montée de tension sur huit mesures ».

Contrat :

1. l’UI envoie au backend l’intention et la spec courante ;
2. le modèle retourne un patch JSON conforme au schéma autorisé ;
3. le backend valide le patch sans l’appliquer ;
4. l’UI affiche le diff et les avertissements ;
5. l’utilisateur accepte, modifie ou rejette ;
6. un preview est rendu ;
7. la proposition et la décision sont ajoutées à l’historique.

Le modèle ne reçoit pas l’autorisation d’écrire un fichier arbitraire, d’exécuter une commande ou de
remplacer directement un master.

## Transport audio

Contrôles communs :

- lecture/pause/stop ;
- retour au début ;
- boucle et région de boucle ;
- position en temps, samples, beats et mesures selon le contexte ;
- sélection A/B ;
- volume de monitoring ;
- mono ;
- bypass mastering ;
- indicateur de clipping ;
- état du périphérique et latence estimée.

La lecture d’un rendu offline et la préécoute temps réel doivent être clairement distinguées.

## Gestion des travaux

Chaque rendu, analyse ou export devient un job :

- en attente ;
- en cours ;
- terminé ;
- échoué ;
- annulé.

Le panneau de jobs affiche :

- opération et asset ;
- moteur ;
- progression ;
- temps écoulé ;
- bouton d’annulation ;
- logs utiles ;
- résultat ou erreur actionnable.

Un échec d’un job n’interrompt pas les autres.

## Modèle de données visible dans l’UI

### Project

- identifiant ;
- nom ;
- fréquence canonique ;
- profil qualité ;
- moteur ;
- version de schéma.

### Patch

- type de son ;
- graphe DSP ;
- paramètres exposés ;
- seed ;
- limites de randomisation ;
- métadonnées.

### Score

- tempo et métrique ;
- pistes ;
- patterns et événements ;
- automations ;
- instruments ;
- marqueurs et boucles.

### AdaptiveGraph

- états ;
- transitions ;
- conditions ;
- quantification ;
- paramètres de gameplay.

### Artifact

- format ;
- nombre de samples ;
- hash ;
- spec source ;
- seed ;
- version moteur ;
- rapport QA ;
- statut master.

## Gestion des erreurs

Catégories :

- validation de spec ;
- compilation DSP ;
- périphérique audio ;
- rendu ;
- analyse ;
- export ;
- assistant LLM ;
- licence ou dépendance.

Chaque erreur doit fournir :

- ce qui a échoué ;
- l’asset concerné ;
- l’étape ;
- une cause lisible ;
- le détail technique dépliable ;
- une action proposée si elle est sûre.

## Accessibilité

- navigation complète au clavier ;
- focus visible ;
- raccourcis documentés et remappables pour les commandes principales ;
- libellés accessibles sur tous les contrôles ;
- palette compatible avec les déficiences de perception des couleurs ;
- informations de QA exprimées par texte et non par couleur seule ;
- animations réduites selon la préférence système ;
- contrôle global du volume et mute ;
- aucun son d’interface obligatoire.

## Responsive

Priorité : bureau, largeur minimale fonctionnelle à définir lors du prototype.

- grand écran : trois panneaux et timeline ;
- écran moyen : inspecteur escamotable ;
- petit écran : consultation, lecture et jobs seulement ;
- l’édition complexe de graphes et timelines n’est pas ciblée sur smartphone dans le MVP.

## Critères d’acceptation globaux de l’UI

- lire tous les exemples intégrés dès le premier lancement ;
- ouvrir une copie d’un exemple, la modifier et l’exporter sans altérer l’original ;
- régénérer un exemple à partir de sa spec et obtenir le hash attendu ;
- créer un son, l’écouter, générer des variantes et l’exporter sans terminal ;
- créer une boucle musicale multipiste et exporter ses stems ;
- simuler au moins trois états de musique adaptative ;
- annuler un rendu sans redémarrer l’application ;
- restaurer une version antérieure sans perdre la version courante ;
- expliquer tout échec de compilation ou de QA dans l’interface ;
- fonctionner sans connexion Internet ;
- ne charger aucun asset audio externe ;
- passer les tests clavier, contraste et parcours end-to-end principaux.
