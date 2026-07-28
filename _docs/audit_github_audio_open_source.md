# Audit GitHub — projets open source utilisables pour crea_zik

Date de l’audit : 2026-07-28

## Règles de sélection

Les dépôts ont été évalués selon :

- capacité à créer le son par calcul, sans sample ni morceau externe ;
- licence identifiable et compatible avec l’usage envisagé ;
- activité et maintenance récentes ;
- compatibilité Windows et avec la machine actuelle ;
- format textuel adapté au vibecoding ;
- rendu offline, temps réel ou déploiement dans une application/un jeu ;
- possibilité de tester et reproduire le résultat.

Les compteurs et dates d’activité sont un instantané de l’API GitHub au jour de l’audit. Être public sur
GitHub ne suffit pas : sans licence explicite, le code n’est pas considéré réutilisable.

## Shortlist recommandée

### 1. Faust — cœur DSP recommandé

- Dépôt : https://github.com/grame-cncm/faust
- Licence du compilateur : LGPL-2.1 ou ultérieure.
- Activité observée : push le 2026-07-28.
- Rôle : synthétiseurs, effets, modèles physiques, génération C++/Rust/WebAssembly.
- Verdict : **adopter pour le cœur DSP**.

Faust est le meilleur choix pour le vibecoding sonore : les programmes `.dsp` sont courts, auditables
et compilés vers de nombreuses cibles. La documentation officielle comporte désormais une section
spécifique à l’utilisation avec les LLM. Le compilateur vérifie les graphes et peut générer des
diagrammes SVG.

Le compilateur LGPL ne place pas automatiquement le code produit sous LGPL. La FAQ officielle précise
que la licence du code généré dépend des fichiers d’entrée. Les bibliothèques et architectures Faust
utilisées doivent donc être contrôlées par symbole/fichier avant livraison.

Sources :

- https://faustdoc.grame.fr/manual/llm/
- https://faustdoc.grame.fr/manual/faq/

### 2. pyo — laboratoire Python immédiat

- Dépôt : https://github.com/belangeo/pyo
- Licence : LGPL-3.0.
- Activité observée : push le 2026-07-20.
- Compatibilité : wheel Python 3.13 Windows amd64 publiée.
- Rôle : synthèse, filtres, délais, granulation, MIDI, OSC, rendu et préécoute.
- Verdict : **essayer immédiatement pour prototyper et écouter**.

pyo donne à Python un moteur DSP riche sans devoir réimplémenter chaque primitive en NumPy. Il est très
adapté aux boucles « décrire → coder → écouter → corriger ». L’intégration dans un produit distribué
doit respecter la LGPL ; l’utilisation comme outil interne de création est plus simple.

### 3. DawDreamer — hôte offline Python + Faust

- Dépôt : https://github.com/DBraun/DawDreamer
- Licence : GPL-3.0.
- Activité observée : push le 2026-02-07.
- Compatibilité : Python 3.11 à 3.14 sur Windows x86-64.
- Rôle : graphes audio, Faust, automation, MIDI, rendu multipiste.
- Verdict : **benchmark de productivité, outil de développement seulement par défaut**.

DawDreamer correspond presque exactement au studio offline envisagé : Python pilote un moteur JUCE,
compile des instruments/effets Faust et rend plusieurs processeurs. C’est probablement le chemin le
plus court vers une première pièce musicale complète.

Sa GPL-3.0 impose toutefois de ne pas l’embarquer silencieusement dans une application propriétaire.
Les obligations concernent l’outil et ses dérivés distribués, pas automatiquement les WAV qu’il rend.
La politique exacte devra être validée avant toute distribution.

### 4. isobar — composition algorithmique

- Dépôt : https://github.com/ideoforms/isobar
- Licence : MIT.
- Activité observée : push le 2026-05-06.
- Rôle : patterns, composition générative, MIDI, OSC et actions personnalisées.
- Verdict : **adopter ou prendre comme base du séquenceur symbolique**.

isobar peut produire la couche événements sans fournir de sons. Il est donc compatible avec la règle
« from scratch » et peut piloter nos propres synthétiseurs.

Compléments possibles :

- Mido, objets et fichiers MIDI, MIT : https://github.com/mido/mido
- music21, théorie/validation/analyse musicale, BSD-3-Clause :
  https://github.com/cuthbertLab/music21
- pretty-midi, manipulation MIDI, MIT : https://github.com/craffel/pretty-midi

### 5. tiks — référence pour les sons d’interface Web

- Dépôt : https://github.com/rexa-developer/tiks
- Licence : MIT.
- Activité observée : push le 2026-06-11.
- Rôle : sons UI créés à l’exécution par oscillateurs, bruit, filtres et enveloppes.
- Verdict : **utiliser comme référence et éventuellement comme dépendance Web**.

Le projet annonce explicitement « zero audio files, pure synthesis ». Il fournit clic, toggle,
succès, erreur, alerte, swoosh et notification, avec thèmes paramétriques. Sa portée est volontairement
limitée : ce n’est ni un moteur musical ni une référence de mastering.

Pour garantir une identité sonore entièrement originale, il vaut mieux réutiliser son architecture ou
son moteur et écrire nos propres recettes plutôt que livrer ses presets tels quels.

### 6. FunDSP — alternative Rust et moteur de jeu

- Dépôt : https://github.com/SamiPerttu/fundsp
- Licence : MIT ou Apache-2.0.
- Activité observée : push le 2026-03-03.
- Rôle : graphes DSP composables, oscillateurs band-limités, bruit déterministe, rendu de waves.
- Verdict : **adopter si la cible utilise Rust ou Bevy ; sinon garder comme référence**.

FunDSP est particulièrement aligné avec nos exigences :

- seeds explicites et pseudo-aléatoire déterministe ;
- oscillateurs PolyBLEP et wavetable band-limités ;
- usage déclaré pour jeux et applications ;
- intégrations Bevy disponibles ;
- licence permissive.

### 7. miniaudio — hôte audio natif léger

- Dépôt : https://github.com/mackron/miniaudio
- Licence : domaine public ou MIT No Attribution.
- Activité observée : push le 2026-07-20.
- Rôle : périphériques, streaming, mixage, resampling, graphe de nœuds et spatialisation 3D.
- Verdict : **adopter plus tard comme hôte C/C++ des DSP générés**.

miniaudio n’est pas un compositeur. Il fournit la plomberie portable qui manque à Faust : périphérique
audio, callback temps réel, mixage, ressources et spatialisation. Sa faible empreinte et sa licence
permissive conviennent bien à une intégration dans une application ou un moteur maison.

### 8. Bibliothèques de contrôle qualité

#### librosa

- Dépôt : https://github.com/librosa/librosa
- Licence : ISC.
- Activité observée : push le 2026-07-23.
- Usage : spectres, features, tempo, détection d’événements et analyse.
- Verdict : **adopter pour l’analyse, pas pour produire le son**.

#### pyloudnorm

- Dépôt : https://github.com/csteinmetz1/pyloudnorm
- Licence : MIT.
- Activité observée : push le 2026-01-04.
- Usage : loudness ITU-R BS.1770-4.
- Verdict : **adopter avec tests complémentaires**.

Le projet annonce BS.1770-4 alors que la référence actuelle est BS.1770-5. Il faut donc conserver nos
propres tests de conformité et de true peak.

#### libebur128

- Dépôt : https://github.com/jiixyj/libebur128
- Licence : MIT.
- Dernier push observé : 2023-06-25.
- Usage : mesure EBU R128 en C.
- Verdict : **référence ou backend secondaire**, à tester contre les signaux officiels actuels.

## Bibliothèques utiles comme références DSP

### STK — Synthesis ToolKit

- Dépôt : https://github.com/thestk/stk
- Licence : permissive de type MIT.
- Dernier push observé : 2025-03-29.
- Usage : synthèse algorithmique et modèles physiques C++.
- Verdict : **référence importante pour les instruments physiques**.

STK contient aussi des rawwaves et exemples audio. Ils sont hors périmètre. Seuls les algorithmes
compatibles avec une excitation entièrement synthétique doivent être étudiés ou intégrés.

### NESS

- Dépôt : https://github.com/Edinburgh-Acoustics-and-Audio-Group/ness
- Licence : MIT.
- Dernier push observé : 2025-01-28.
- Usage : synthèse par modélisation physique issue d’un projet universitaire.
- Verdict : **laboratoire de recherche**, utile pour cordes, membranes et objets complexes.

### DaisySP

- Dépôt : https://github.com/electro-smith/DaisySP
- Licence : MIT.
- Dernier push observé : 2025-05-29.
- Usage : oscillateurs, filtres, réverbérations et effets C++ conçus pour l’embarqué.
- Verdict : **bonne référence pour les algorithmes efficaces et temps réel**.

### SFXR et variantes

- Rust/MIT : https://github.com/bzar/sfxr-rs
- Qt/MIT : https://github.com/agateau/sfxr-qt

Verdict : **référence pédagogique pour les sons de jeu courts et rétro**. SFXR est trop limité et trop
marqué esthétiquement pour devenir notre moteur principal, mais ses macros sont utiles pour comprendre
la génération paramétrique de variantes.

## Projets à considérer selon la cible

### Csound

- Dépôt : https://github.com/csound/csound
- Licence : LGPL-2.1.
- Activité observée : push le 2026-07-27.
- Verdict : **excellent moteur complet, à comparer avec Faust+pyo**.

Csound est plus autonome que Faust pour combiner partition, instruments et rendu offline. Il est
cependant plus lourd à intégrer dans un jeu et les installateurs Windows de Csound 7 sont encore
présentés comme bêta par le projet.

### DISTRHO Plugin Framework

- Dépôt : https://github.com/DISTRHO/DPF
- Licence : ISC.
- Activité observée : push le 2026-07-26.
- Verdict : **excellent choix futur pour emballer nos DSP en plugins**, pas nécessaire au prototype.

### Signalsmith Stretch

- Dépôt : https://github.com/Signalsmith-Audio/signalsmith-stretch
- Licence : MIT.
- Activité observée : push le 2026-01-24.
- Verdict : **à ajouter uniquement si time-stretch et pitch-shift polyphoniques deviennent nécessaires**.

### SoLoud

- Dépôt : https://github.com/jarikomppa/soloud
- Licence : zlib/libpng.
- Dernier push observé : 2024-08-13.
- Verdict : **portable et permissif, mais miniaudio est actuellement prioritaire**.

## Projets non retenus comme fondation

| Projet | Motif |
|---|---|
| SuperCollider | excellent laboratoire, mais GPL-3.0 et déploiement produit moins direct |
| Sonic Pi | remarquable pour apprendre/live coder, mais application complète trop lourde à intégrer |
| Glicol | MIT et intéressant, mais dernière activité de code observée en avril 2025 et écosystème plus petit |
| Cmajor | très bon DSP, mais moteur GPL-3/commercial ; à garder en benchmark |
| Pedalboard | effets et I/O excellents, mais GPL-3.0 et moins adapté à la synthèse source |
| Soundpipe | dépôt actuel archivé |
| Tidal GitHub | dépôt archivé |
| Strudel GitHub | dépôt archivé et déplacé vers Codeberg |
| Godot Mixing Desk | conçu pour Godot 3.3, dernier push en 2022 |
| web-synth | techniquement intéressant mais licence non clairement détectée |

Cmajor précise que le C++ généré à partir de notre propre code nous appartient, mais embarquer son
moteur dans un produit non-GPL demande une licence adaptée :
https://github.com/cmajor-lang/cmajor/blob/main/LICENSE.md

## Assemblage recommandé

### Prototype

```text
Python
├── isobar/music21         composition et validation
├── pyo                    prototypage et préécoute
├── Faust                  instruments et effets auditables
└── librosa/pyloudnorm     QA
```

DawDreamer peut remplacer temporairement pyo comme hôte Faust offline afin de mesurer le gain de
productivité. Il reste isolé derrière une interface de rendu pour pouvoir être remplacé.

### Déploiement

```text
specs + partitions Python
        ↓
DSP Faust compilé en C++ ou WebAssembly
        ↓
miniaudio / AudioWorklet / moteur de jeu
        ↓
application, Web, Godot, Unity ou Unreal
```

Si le projet cible finalement Rust/Bevy, FunDSP peut remplacer une partie du couple Faust+miniaudio.

## Essai technique proposé

Comparer trois routes avec un même cahier des charges sonore :

1. pyo seul ;
2. Faust hébergé par DawDreamer ;
3. Csound 7.

Cas test :

- un clic UI ;
- un impact modal ;
- un moteur continu ;
- un instrument polyphonique de huit voix ;
- une boucle musicale de huit mesures.

Mesures :

- qualité audible et aliasing ;
- quantité de code ;
- facilité de modification par LLM ;
- déterminisme ;
- vitesse de rendu ;
- stems et automation ;
- portabilité temps réel ;
- contraintes de licence.

Le résultat permettra de choisir le moteur d’authoring sur des preuves, tout en conservant Faust comme
format DSP portable si son test est concluant.

