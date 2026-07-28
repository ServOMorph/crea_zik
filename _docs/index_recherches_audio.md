# Index des recherches audio et des sources

Dernière mise à jour : 2026-07-28

## Périmètre

Ces recherches portent sur la création, par vibecoding, de musiques et d’effets sonores pour
applications et jeux vidéo.

Contrainte permanente :

- aucun son, sample, morceau, SoundFont ou réponse impulsionnelle récupéré sur le Web ;
- le son final est créé localement par synthèse, DSP, composition algorithmique ou modélisation
  physique ;
- les recherches Web servent uniquement à consulter le code, les licences et la documentation
  technique ;
- aucun asset audio externe n’a été téléchargé pendant ces recherches.

## Rapports produits

### Possibilités techniques et architecture

[analyse_vibecoding_audio.md](analyse_vibecoding_audio.md)

Contient :

- l’état actuel de la création audio par code ;
- les familles de synthèse et d’effets utilisables ;
- la musique adaptative et l’audio procédural temps réel ;
- les limites du procédural pur ;
- l’architecture proposée ;
- les exigences de rendu et de QA ;
- l’audit de la machine ;
- la première preuve de faisabilité recommandée.

### Projets open source trouvés sur GitHub

[audit_github_audio_open_source.md](audit_github_audio_open_source.md)

Contient :

- les critères de sélection ;
- les licences et dates d’activité vérifiées ;
- la shortlist des projets directement utilisables ;
- les projets utilisables seulement comme références ;
- les projets écartés et les raisons ;
- l’assemblage logiciel recommandé ;
- le benchmark pyo / Faust+DawDreamer / Csound proposé.

### Plan de développement et interface

- [Spécification fonctionnelle de l’UI](specification_ui_studio_audio.md)
- [Roadmap complète du studio](../roadmap_studio_audio_procedural.md)

Ces documents transforment les recherches en onze phases de développement après le benchmark initial,
depuis les contrats du moteur jusqu’au packaging, à l’accessibilité et à l’intégration dans un jeu.

## Résultat consolidé

### Principe de fonctionnement

Le LLM ne doit pas être le moteur qui invente directement une forme d’onde opaque. Il écrit ou modifie :

- une intention musicale ;
- une partition ou un pattern ;
- une spec sonore paramétrique ;
- un programme DSP ;
- une seed ;
- des tests et critères de qualité.

Un moteur déterministe calcule ensuite chaque échantillon. Ce partage donne :

- une provenance claire ;
- des résultats reproductibles ;
- des variations contrôlées ;
- des boucles et transitions exactes ;
- des stems ;
- un portage possible vers les moteurs de jeux.

### Stack recommandée à ce stade

```text
Python
├── isobar / music21       composition et validation
├── pyo                    prototypage et écoute
├── Faust                  synthétiseurs, effets et modèles physiques
└── librosa / loudness     analyse et QA

Faust compilé
├── C++ + miniaudio        applications et moteurs natifs
├── WebAssembly            applications Web / AudioWorklet
└── intégration dédiée     Godot, Unity ou Unreal
```

DawDreamer et Csound doivent être comparés au prototype avant de choisir le moteur d’authoring
offline définitif.

### Projets prioritaires

| Projet | Fonction | Licence | Statut proposé |
|---|---|---|---|
| Faust | DSP portable et compilé | LGPL pour le compilateur ; entrées à vérifier pour le code généré | cœur recommandé |
| pyo | laboratoire DSP Python | LGPL-3.0 | essai immédiat |
| DawDreamer | hôte Python, Faust, MIDI, automation | GPL-3.0 | benchmark/dev uniquement par défaut |
| Csound | synthèse, partition et rendu complet | LGPL-2.1 | benchmark |
| isobar | composition algorithmique | MIT | adopter |
| music21 | théorie et validation musicale | BSD-3-Clause | adopter au besoin |
| librosa | analyse audio | ISC | adopter |
| pyloudnorm | loudness Python | MIT | adopter avec tests BS.1770-5 |
| miniaudio | hôte natif, streaming et spatialisation | domaine public/MIT-0 | déploiement futur |
| FunDSP | DSP Rust déterministe | MIT/Apache-2.0 | cible Rust/Bevy |
| tiks | sons UI Web sans fichiers audio | MIT | référence/dépendance Web possible |

### Références algorithmiques

- STK : synthèse algorithmique et modèles physiques ;
- NESS : modèles physiques universitaires ;
- DaisySP : DSP C++ temps réel efficace ;
- SFXR : macros paramétriques pour petits effets de jeu ;
- Signalsmith Stretch : time-stretch et pitch-shift ;
- DISTRHO DPF : emballage futur en plugins ;
- libebur128 : mesure loudness EBU R128.

### Projets non retenus comme fondation

- SuperCollider et Sonic Pi : excellents laboratoires, déploiement produit moins direct ;
- Cmajor : moteur GPL/commercial, à conserver comme comparaison ;
- Pedalboard : GPL-3.0 et davantage orienté traitement que synthèse source ;
- Soundpipe : dépôt archivé ;
- Tidal et le miroir GitHub de Strudel : dépôts archivés ou déplacés ;
- Godot Mixing Desk : conçu pour Godot 3.3 et ancien ;
- web-synth : licence non clairement détectée lors de l’audit ;
- modèles MusicGen/AudioCraft : contrôle et licences moins adaptés, besoins VRAM supérieurs à la
  machine pour les modèles moyens.

### Qualité cible

- fréquence canonique : 48 kHz ;
- master d’archive : WAV 32-bit float ;
- livraison : WAV PCM 24 bits avant compression éventuelle dans le moteur ;
- oscillateurs band-limités ;
- suréchantillonnage local des blocs non linéaires ;
- resampling polyphasé ;
- lissage des paramètres ;
- seeds explicites ;
- contrôle de clipping, DC, phase, mono, spectre, LUFS et true peak ;
- validation des boucles en valeur et en pente ;
- conformité mesurée selon ITU-R BS.1770-5 ;
- tests contre le budget CPU réel pour les patches temps réel.

### État de la machine

- Python 3.13.14 ;
- NumPy 2.5.1 et SciPy 1.18.0 ;
- Node.js 22.16.0 ;
- RTX 4060 avec 8 Go de VRAM ;
- pyo, Faust, Csound et DawDreamer non encore installés ;
- FFmpeg actuellement résolu par le `PATH` : build d’août 2013, à remplacer avant utilisation.

## Sources techniques officielles

### DSP, synthèse et outils

- Faust, site : https://faust.grame.fr/
- Faust, GitHub : https://github.com/grame-cncm/faust
- Faust et les LLM : https://faustdoc.grame.fr/manual/llm/
- Faust, licence du code généré : https://faustdoc.grame.fr/manual/faq/
- Faust, utilisation du compilateur : https://faustdoc.grame.fr/manual/compiler/
- Faust, options de génération : https://faustdoc.grame.fr/manual/options/
- Csound : https://github.com/csound/csound
- Csound 7 Manual : https://csound.com/manual/
- Csound API : https://csound.com/docs/api/index.html
- SuperCollider : https://github.com/supercollider/supercollider
- SuperCollider NRT :
  https://doc.sccode.org/Guides/Non-Realtime-Synthesis.html
- Cmajor : https://github.com/cmajor-lang/cmajor
- Cmajor, documentation : https://cmajor.dev/
- Cmajor, licence :
  https://github.com/cmajor-lang/cmajor/blob/main/LICENSE.md
- pyo : https://github.com/belangeo/pyo
- DawDreamer : https://github.com/DBraun/DawDreamer
- FunDSP : https://github.com/SamiPerttu/fundsp
- miniaudio : https://github.com/mackron/miniaudio

### Composition et données musicales

- isobar : https://github.com/ideoforms/isobar
- Mido : https://github.com/mido/mido
- music21 : https://github.com/cuthbertLab/music21
- pretty-midi : https://github.com/craffel/pretty-midi

### Audio Web et moteurs de jeux

- Web Audio `AudioWorklet` :
  https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet
- Guide `AudioWorklet` :
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
- tiks : https://github.com/rexa-developer/tiks
- Unreal MetaSounds :
  https://dev.epicgames.com/documentation/en-us/unreal-engine/metasounds-the-next-generation-sound-sources-in-unreal-engine
- Unreal, musique procédurale MetaSounds :
  https://dev.epicgames.com/documentation/unreal-engine/creating-procedural-music-with-metasounds
- Godot `AudioStreamGenerator` :
  https://docs.godotengine.org/en/stable/classes/class_audiostreamgenerator.html
- Godot, synchronisation audio :
  https://docs.godotengine.org/en/stable/tutorials/audio/sync_with_audio.html
- Microsoft XAudio2 :
  https://learn.microsoft.com/windows/win32/xaudio2/xaudio2-introduction

### Analyse, loudness et qualité

- librosa : https://github.com/librosa/librosa
- pyloudnorm : https://github.com/csteinmetz1/pyloudnorm
- libebur128 : https://github.com/jiixyj/libebur128
- ITU-R BS.1770-5 :
  https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en
- EBU R128 : https://tech.ebu.ch/loudness/
- ITU-T H.872, safe listening for gameplay and esports :
  https://www.itu.int/epublications/publication/itu-t-h-872-2024-10-safe-listening-for-video-gameplay-and-esports

### Références DSP et modèles physiques

- STK : https://github.com/thestk/stk
- NESS : https://github.com/Edinburgh-Acoustics-and-Audio-Group/ness
- DaisySP : https://github.com/electro-smith/DaisySP
- SFXR Rust : https://github.com/bzar/sfxr-rs
- SFXR Qt : https://github.com/agateau/sfxr-qt
- Signalsmith Stretch :
  https://github.com/Signalsmith-Audio/signalsmith-stretch
- DISTRHO DPF : https://github.com/DISTRHO/DPF
- SoLoud : https://github.com/jarikomppa/soloud

### Modèles neuronaux étudiés mais non retenus comme socle

- AudioCraft : https://github.com/facebookresearch/audiocraft
- MusicGen, documentation :
  https://facebookresearch.github.io/audiocraft/api_docs/audiocraft/models/musicgen.html
- Stable Audio Tools :
  https://github.com/Stability-AI/stable-audio-tools

### Référence sur les licences GitHub

- GitHub, licensing a repository :
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository

Cette source rappelle qu’un dépôt public sans licence n’autorise pas automatiquement la réutilisation,
la modification ou la distribution de son code.

## Prochaine validation

Le prochain travail proposé est un benchmark audible et mesuré entre :

1. pyo ;
2. Faust hébergé par DawDreamer ;
3. Csound 7.

Les cinq cas communs seront :

- clic d’interface ;
- impact modal ;
- moteur continu ;
- instrument polyphonique ;
- boucle musicale de huit mesures.

Le choix final doit être fondé sur la qualité, la quantité de code, la facilité de modification par
LLM, le déterminisme, le temps de rendu, les stems, la portabilité et les licences.
