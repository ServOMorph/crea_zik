# Crea Zik

## Objectif

Créer localement de la musique et des effets sonores pour des applications et des jeux vidéo, sans
samples, morceaux, SoundFonts ni réponses impulsionnelles externes.

## Stack cible

L’interface utilise React, TypeScript et Vite. Le backend utilise Python et FastAPI.
Csound 7 est le moteur de rendu offline, pyo le fallback et Faust la cible DSP portable.

## Structure

- `_contexte/` : état durable, décisions et prochaine action ;
- `_docs/` : recherches, sources, audit open source et spécification UI ;
- `roadmap_studio_audio_procedural.md` : plan de développement et critères de livraison ;
- `.claude/` : commandes et protocole de travail du projet.

## État actuel

Le socle CLI, worker local, galerie, promotion, validation et archivage reste opérationnel.
L’éditeur dispose des contrats versionnés, de la persistance des révisions, du rendu borné, du shell et d’un store avec historique.
Le transport et la préécoute sont implémentés et validés à l’écoute par l’utilisateur.
Le moteur rend cinq stems instrumentaux distincts, la réverbération et un mix normalisé.
La phase 0 et le gate V0 de l’éditeur sont livrés : le runner canonique couvre lint, typage, contrats,
déterminisme Csound, couverture bloquante, fuzzing OpenAPI, accessibilité, mutation et régression
visuelle, chacun avec preuve de blocage volontaire. La phase 1 de l’éditeur (domaine compositionnel,
migration de `Lignes de nuit`) est livrée : les notes et le bus master/reverb/limiteur sont désormais
des modèles typés (`NoteEvent`, `MixerChannel`) plutôt que des dictionnaires génériques, migration
vérifiée bit-exacte au rendu. La phase V1 (qualification domaine, migration et DSP) est livrée : les
propriétés Hypothesis couvrent `beats_to_samples`, le round-trip complet de `Composition` et le rejet
des références pendantes ; le mutation testing Python (mutmut) reste bloqué par incompatibilité
structurelle malgré un environnement WSL/Csound provisionné (limite documentée
`EDITEUR/docs/limites_connues.md`). La phase V2 (qualification API et persistance) est livrée :
routes nominales et erreurs typées de l'API de composition testées, fuzzing OpenAPI étendu,
révisions concurrentes, écriture interrompue/annulation/reprise, chemins hostiles et isolation des
projets qualifiés ; runner canonique complet vert (backend 111 tests, couverture 88,61 %). La
Phase 2 fonctionnelle (API de composition et persistance sûre) est close [FAIT]. La phase 3 de
l'éditeur (shell, sidebar et routage) et sa qualification V3 sont closes [FAIT] : composants et
états de page testés (Vitest + RTL), accessibilité axe-core sur l'éditeur réel et ses états,
parcours Playwright (URL directe, historique navigateur, sidebar active, conservation du projet),
snapshots visuels approuvés ; runner canonique complet vert (V0→V2 inclus, frontend 39 unitaires,
e2e 10, mutation Stryker 87,31 %). La phase V4 (store, commandes et sauvegarde) est close [FAIT] :
store 100 % lignes et branches, fast-check des inverses, cent opérations puis cent undo/redo
comparées, Stryker sur `editorStore.ts`/`transport.ts` (seuil bloquant 60 %) ; runner canonique
vert (V0→V3 inclus, rapport `EDITEUR/test-results/v1-20260804-151348.json`, 20 checks). Le noyau
d'édition de la Phase 4 est livré (store local, commandes atomiques, undo/redo, transactions,
sélection, copier/coller/dupliquer, grille, dirty state et `Ctrl+S`) ; il reste la virtualisation
des grandes listes avant d'ouvrir la Phase 5 (transport et préécoute).
La Phase 4 fonctionnelle est close [FAIT] : la virtualisation est livrée (`VirtualList` +
`computeVirtualWindow`, fenêtre scrollante avec overscan, testée sur 5000 lignes, 100 % couverture)
et intégrée aux pistes de `EditorLanding`. La phase V5 (qualification transport et Web Audio) est
close [FAIT] : machine d'état testée à horloge contrôlée, `MockAudioContext`, parcours de lecture
Chromium réel et cache/invalidation/annulation des préécoutes ; runner canonique vert (rapport
`EDITEUR/test-results/v1-20260804-224727.json`, 20 checks, e2e 12, mutation Stryker 95,37 %).
La Phase 5 fonctionnelle est close [FAIT] : le tempo et la métrique sont affichés dans la barre
de transport et couverts par un test. La Phase 6 (Channel Rack et séquenceur pas à pas) est
ouverte [EN COURS] : le Channel Rack (ordre, nom, mute, solo) et le séquenceur pas à pas
(résolution 1/1→1/8, vélocité/probabilité/accent/micro-décalage, peinture au glisser, clavier,
préécoute de pattern) sont livrés, les patterns kick/clap/charleston de `Lignes de nuit` sont
reconstitués et éditables ; le backend propage `probability` et `micro_timing_beats` (gate seedé
déterministe) et corrige le mute/solo. Restent longueur de pattern, duplication, renommage,
variation, suppression sûre, sélection multiple, remplissages, préécoute piste et couleur/nom
(migration de schéma). La qualification V6 est en cours : runner canonique vert 20 checks
(`EDITEUR/test-results/v1-20260805-102645.json`, backend 116 tests, frontend 96 unitaires, 13 e2e,
mutation ~84 %), fast-check et e2e clavier/souris/undo faits.
Le gate de déterminisme Csound réel de la phase 1 (roadmap studio audio procédural) est validé (trois rendus indépendants, même SHA-256 du WAV).
La phase 2 de `roadmap_studio_audio_procedural.md` a été réauditée et close [FAIT] : le code réel
dépasse largement sa description initiale. Les phases 3 (bibliothèque DSP/Sound Designer) et 4
(Composition/Music Composer) ont été réauditées le 2026-08-02 et restent [TODO] : un socle réel
existe (familles de sons, filtres, delay, reverb, variantes déterministes, tempo, automation,
mixer, stems) mais les gates de phase ne sont pas remplis. Le volet UI de la phase 4 est piloté par
`EDITEUR/roadmap_editeur_musical.md`. Les phases 5 et 6 restent à réauditer.
`EXPLO/roadmap_plugins.md` est intégralement livré : le banc de test plugins dans l’UI globale a été
validé dans un navigateur réel, et le plugin kick est promu sur le moteur de composition via des
paramètres d’instrument opt-in, sans copie de fichiers vers un dossier plugins applicatif séparé.
Une zone `DOCUMENTATION/` et une zone `WORKFLOW/` ont été créées pour bâtir en parallèle l’inventaire des styles musicaux (modèle de fiche défini) et l’agent de création de musique associé ; voir `roadmap_creation_musique.md`.
