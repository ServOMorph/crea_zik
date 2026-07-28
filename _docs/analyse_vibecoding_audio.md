# Analyse — création musicale et sonore « from scratch » en vibecoding

Date de l’analyse : 2026-07-28

## Conclusion

Il est aujourd’hui possible de construire un atelier local qui crée par code :

- des effets sonores déterministes, paramétrables et déclinables en variantes ;
- des instruments de synthèse originaux ;
- des morceaux complets et leurs stems ;
- de la musique adaptative pilotée par l’état d’une application ou d’un jeu ;
- des moteurs sonores procéduraux exécutés directement dans un navigateur ou un moteur de jeu ;
- des masters WAV et des rapports de contrôle qualité reproductibles.

La meilleure approche pour ce projet n’est pas de demander à une IA de produire directement un
fichier audio. L’IA doit écrire et modifier des descriptions musicales, du code DSP, des patches et
des tests. Un moteur audio déterministe calcule ensuite chaque échantillon. Cela garantit la
reproductibilité, le contrôle artistique, les variantes, les boucles exactes et une provenance claire.

## Définition de « from scratch »

Le pipeline proposé respecte les règles suivantes :

- aucune musique, aucun sample, aucun effet sonore et aucune réponse impulsionnelle récupérés sur le
  Web ;
- aucune banque General MIDI ou SoundFont ;
- toutes les sources sont mathématiques : oscillateurs, bruit pseudo-aléatoire avec seed, modèles
  physiques, résonateurs, enveloppes et séquenceurs ;
- les réverbérations sont algorithmiques ou utilisent une réponse impulsionnelle elle-même générée ;
- chaque asset conserve son code source, ses paramètres, sa seed et la version du moteur ;
- à paramètres et version identiques, le rendu est bit-identique.

Un enregistrement original réalisé spécialement pour le projet pourrait être admis plus tard, mais il
constituerait une autre famille de sources et devrait être explicitement étiqueté. Le socle décrit ici
n’en dépend pas.

## Ce que l’on peut créer

### Effets sonores

Très bon terrain pour le procédural :

- interfaces : clics, validations, erreurs, transitions, notifications, chargements ;
- science-fiction : lasers, moteurs, drones, champs d’énergie, téléportation, alarmes ;
- impacts : explosions, chocs métalliques, verre stylisé, bois, pierre, débris ;
- mouvements : whooshes, passages, rotations, accélérations ;
- ambiances : vent, pluie synthétique, feu, machines, ronronnements, espaces abstraits ;
- systèmes continus pilotés par le jeu : moteur selon le régime, vent selon la vitesse, danger selon la
  distance, objet selon sa matière et son énergie.

Techniques combinables :

- synthèse soustractive, additive, FM, AM et modulation en anneau ;
- wavetable calculée par formule ;
- bruit blanc, rose, brun et bruits filtrés déterministes ;
- synthèse granulaire à partir d’une matière sonore générée par le projet ;
- modèles physiques : cordes à guide d’onde, membranes, tubes, exciteur-résonateur ;
- synthèse modale pour les objets et matériaux ;
- distorsion, waveshaping, bitcrushing, délais, chorus, flanger et phaser ;
- réverbération algorithmique FDN/Schroeder et espaces synthétiques ;
- spatialisation 2D/3D, Doppler, occlusion et obstruction.

### Musique

Le code peut gérer séparément la composition et le timbre :

- grammaire rythmique, métrique, tempo et swing ;
- gammes, accords, renversements et conduite des voix ;
- motifs avec répétition, mutation, transposition, inversion et développement ;
- orchestration par instruments synthétiques ;
- automations, mixage, bus d’effets et mastering ;
- génération de stems synchronisés ;
- boucles sans couture avec points de transition exacts ;
- musique adaptative par couches verticales et segments horizontaux ;
- variations reproductibles à partir d’une seed.

Le LLM peut proposer une intention ou une structure, mais un compilateur musical doit valider les
contraintes objectives : notes autorisées, tessitures, polyphonie, collisions de voix, durée des
mesures, transitions et budget CPU.

### Audio procédural en temps réel

Un asset ne doit pas forcément être un fichier WAV figé. Pour un moteur, certains sons gagnent à être
des patches paramétriques :

- intensité, vitesse, taille, matière, santé, distance ou météo modifient le son en continu ;
- les variations ne se répètent pas exactement, tout en restant contrôlées par une seed ;
- un même patch remplace des dizaines de fichiers ;
- la musique peut effectuer ses transitions sur le prochain beat ou la prochaine mesure.

Unreal MetaSounds fournit un graphe DSP à précision échantillon et pilotable par le gameplay. Godot
fournit `AudioStreamGenerator`, avec la recommandation officielle d’utiliser C# ou une GDExtension
compilée pour les traitements exigeants. Dans un navigateur, `AudioWorklet` exécute le DSP hors du
thread principal et peut accueillir du WebAssembly.

## Limites qu’il faut accepter

Le procédural pur excelle dans le stylisé, l’électronique, les interfaces, les ambiances et les systèmes
réactifs. Les cibles les plus difficiles sans aucun enregistrement sont :

- une voix humaine naturelle et expressive ;
- un orchestre acoustique indiscernable d’un véritable enregistrement ;
- certains animaux ;
- un Foley hyperréaliste et très spécifique.

La modélisation physique peut produire une identité forte et crédible, mais elle demande davantage de
calibrage qu’une banque de samples. La qualité finale dépendra aussi de l’écoute, de l’itération et de
la direction artistique : aucune métrique ne remplace entièrement une validation humaine.

Les modèles neuronaux text-to-audio ne doivent pas être le cœur du projet :

- leurs poids ont été entraînés sur des corpus audio existants ;
- leur contrôle temporel, leurs stems, leurs boucles et leur reproductibilité sont moins précis ;
- leur licence peut limiter l’usage commercial ;
- les modèles AudioCraft moyens demandent officiellement au moins 16 Go de VRAM, contre 8 Go sur la
  machine actuelle ;
- ils peuvent servir plus tard à une expérimentation isolée, mais pas de source de vérité.

## Comparaison des moteurs textuels

| Outil | Point fort | Limite | Place recommandée |
|---|---|---|---|
| Python + NumPy/SciPy | orchestration, rendu offline, tests, analyse, automatisation | temps réel et déploiement natif limités | socle immédiat |
| Csound 7 | synthèse et composition très riches, rendu offline, format textuel | intégration produit et packaging à cadrer | moteur spécialisé possible |
| Faust | DSP compilé performant, export C++/WebAssembly/mobile/plugins | peu adapté à la composition de haut niveau | modules DSP portables |
| Cmajor | DSP moderne, hot reload, export C++/Wasm/plug-ins | moteur sous GPL/commercial, écosystème plus jeune | alternative à évaluer |
| SuperCollider | exploration et live coding exceptionnels | déploiement dans les jeux moins direct | laboratoire artistique |
| Web Audio + AudioWorklet | studio local interactif et intégration Web | ne doit pas être l’unique rendu de référence | préécoute et applications Web |
| MetaSounds/Godot natif | son procédural réellement réactif au gameplay | dépend du moteur cible | couche d’intégration finale |

### Choix recommandé

Commencer sans dépendance lourde :

1. Python pilote les specs, la composition, les seeds, le rendu et la QA.
2. NumPy/SciPy implémentent le premier moteur offline.
3. Les noyaux DSP qui doivent vivre dans un jeu sont ensuite portés en Faust ou en C++.
4. Une interface Web locale permet l’écoute, les macros, l’A/B et la visualisation.
5. L’intégration finale vise le moteur choisi : MetaSounds, Godot, Unity, Web Audio ou moteur natif.

Csound pourra être ajouté si sa bibliothèque d’opcodes accélère fortement la création. Faust est le
meilleur candidat lorsque la portabilité et le temps réel deviennent prioritaires. Cmajor est
techniquement séduisant, mais son choix doit attendre une décision explicite sur la licence.

## Architecture proposée

```text
intention en langage naturel
        ↓
LLM : écrit/modifie une spec versionnée
        ↓
validateur musical et sonore
        ↓
compilateur d’événements + graphe DSP
        ↓
moteur offline déterministe ─────→ stems/master WAV
        ↓                              ↓
préécoute locale                 analyse qualité automatique
        ↓                              ↓
itération humaine/LLM ←──────── rapport + graphiques
        ↓
export asset statique ou patch temps réel pour le moteur cible
```

### Organisation des sources

```text
audio/
├── specs/          # intentions, paramètres, seeds, états de gameplay
├── scores/         # tempo, mesures, motifs, harmonie, transitions
├── synths/         # oscillateurs, instruments et modèles physiques
├── effects/        # filtres, dynamique, espace et saturation
├── presets/        # valeurs artistiques, jamais de samples externes
├── renders/        # previews, stems et masters générés
├── reports/        # loudness, true peak, spectre, boucles, performance
└── tests/          # tests DSP, snapshots et critères d’acceptation
```

## Exigences de qualité

### Calcul et export

- fréquence de travail canonique : 48 kHz ;
- intermédiaires : flottant 32 bits minimum, 64 bits lorsque le calcul le justifie ;
- master d’archive : WAV 32-bit float ;
- livraison courante : WAV PCM 24 bits, puis compression dans le moteur si nécessaire ;
- oscillateurs discontinus band-limités (`polyBLEP`, tables limitées par octave ou équivalent) ;
- suréchantillonnage local 2× à 8× pour les non-linéarités et sources sujettes à l’aliasing ;
- resampling par filtre polyphasé de qualité ;
- lissage de tous les paramètres temps réel pour éviter les clics ;
- dither uniquement lors d’une réduction finale en entier.

Rendre systématiquement tout le morceau à 192 kHz serait coûteux et rarement utile. Il vaut mieux
suréchantillonner les blocs qui en ont besoin, puis livrer un flux 48 kHz propre.

### Contrôles automatiques

Chaque rendu doit vérifier :

- absence de NaN, d’infini, de clipping et de DC excessif ;
- sample peak, true peak, LUFS, RMS, crest factor et plage dynamique ;
- énergie spectrale et aliasing anormal ;
- compatibilité mono, corrélation stéréo et phase ;
- continuité des boucles en valeur et en pente ;
- durée, points de cue, tempo et nombre exact d’échantillons ;
- marge de fin de réverbération ;
- temps de rendu et budget CPU pour les patches temps réel ;
- reproductibilité à seed identique.

La mesure doit suivre ITU-R BS.1770-5. Pour un mix de jeu complet, la recommandation ITU-T H.872
donne un repère de sécurité à −23 LUFS sur une fenêtre intégrée de 30 minutes, avec un true peak ne
dépassant pas −1 dBTP. Ce n’est pas une cible à imposer séparément à chaque petit effet sonore : les
assets doivent conserver de la marge pour le mix dynamique du jeu.

## Audit de la machine au 2026-07-28

Disponible :

- Python 3.13.14 ;
- NumPy 2.5.1 et SciPy 1.18.0 ;
- PyAV et PyAudioWPatch ;
- Node.js 22.16.0 et npm 10.9.2 ;
- NVIDIA RTX 4060, 8 Go de VRAM ;
- Ollama local utilisable comme assistant de génération de specs/code.

Absent :

- Csound, Faust, SuperCollider, SoX, FluidSynth et DAW dédié.

Point à corriger :

- le `ffmpeg.exe` résolu par le `PATH` date d’août 2013. Il ne doit pas devenir une dépendance du
  pipeline avant remplacement par une version actuelle et verrouillée.

Le matériel suffit largement à un moteur procédural offline de haute qualité. Le GPU n’est pas
nécessaire au DSP classique ; il n’apporte un avantage que pour les modèles neuronaux, qui ne sont pas
la voie principale recommandée.

## Première preuve de faisabilité recommandée

Construire un mini-studio local qui génère six livrables sans aucun asset externe :

1. un son d’interface court ;
2. un impact avec variantes de matière et d’énergie ;
3. un moteur continu piloté par une valeur de 0 à 1 ;
4. une ambiance procédurale bouclable ;
5. un instrument polyphonique original ;
6. une pièce adaptative de 30 à 60 secondes avec trois niveaux d’intensité et stems.

Le gate de réussite :

- un seul fichier de spec par livrable ;
- au moins dix variantes contrôlées par seed ;
- rendu WAV 48 kHz propre ;
- rapport QA généré automatiquement ;
- boucle ou transition sans clic ;
- reproduction bit-identique ;
- préécoute locale et modification de paramètres sans éditer manuellement le DSP.

Cette preuve permettra de choisir sur des résultats audibles si NumPy/SciPy suffit au socle ou si
Csound/Faust doit être intégré dès la phase suivante.

## Sources techniques officielles consultées

- Faust : https://faust.grame.fr/
- Csound 7 : https://csound.com/manual/
- SuperCollider, rendu non temps réel :
  https://doc.sccode.org/Guides/Non-Realtime-Synthesis.html
- Cmajor : https://cmajor.dev/
- Web Audio `AudioWorklet` :
  https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- Unreal MetaSounds :
  https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine
- Godot `AudioStreamGenerator` :
  https://docs.godotengine.org/en/stable/classes/class_audiostreamgenerator.html
- ITU-R BS.1770-5 :
  https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en
- ITU-T H.872, safe listening for gameplay and esports :
  https://www.itu.int/epublications/publication/itu-t-h-872-2024-10-safe-listening-for-video-gameplay-and-esports
- AudioCraft/MusicGen : https://github.com/facebookresearch/audiocraft

