# Solution Options Brief — Menus et courses de séjour

Oct 25, 2026 · @Houssam

## Résumé

Option retenue : **O4, un fichier HTML local sur mesure**, construit avec l'aide de l'IA (score 4,31/5, contre 3,71 pour le tableur structuré). C'est la seule option qui couvre les deux priorités du demandeur : un calcul juste (recette pour 10 → effectif → agrégation → conversion) et un vrai confort pour composer un menu. L'outil s'arrête à un export CSV vers l'outil de courses existant, qui gère le stock et les achats. Concession principale : les évolutions passent par l'IA, et la sauvegarde du fichier de données doit être conçue dès le départ. Plan B : O1, tableur Excel structuré ; test d'une soirée prévu avant de s'engager.

## Rappel du besoin

Référence : Discovery Brief — Menus et courses de séjour (24 oct. 2026). Le périmètre a été resserré pendant cette analyse \[Fait, confirmé par le demandeur\].

**Reste dans cet outil** : BE-01 à BE-03 (recettes, menu, effectif), BE-05 (rattachement), BE-06 (conversions), BE-07 et BE-08 sous forme d'export, BE-12 (fiche et matériel) ; règles RM-01, RM-02, RM-03, RM-05, RM-06, RM-07, RM-09, RM-12.

**Passe dans l'outil de courses existant** : suivi du stock et déduction (BE-11, RM-04, RM-11), recalcul des achats restants (BE-10, RM-10), achat et coche au magasin. Le catalogue produits (BE-04) y est tenu et importé ici. La répartition frais / gros achat (BE-09, RM-08) suit le statut du produit, porté par le catalogue \[Hypothèse\].

**Nouvelles exigences** : un compteur d'ingrédients non rattachés sur chaque carte du menu ; à l'export, une alerte qui liste les ingrédients sans conversion et laisse le choix de continuer ou de revenir corriger.

**Critères de succès** inchangés : plus de calcul manuel, ni manque ni gaspillage, préparation plus rapide, autonomie des rôles.

## Cadre de décision

Le demandeur construit et maintient seul, avec l'aide de l'IA, sans budget, et veut un seul outil local.

**Profil** \[Fait\]

- Construction et maintenance : le demandeur, assisté par l'IA.
- Budget : gratuit uniquement.
- Forme souhaitée : un fichier HTML sur son PC, données facilement exportables.
- Utilisation : le demandeur centralise la saisie, pas d'édition simultanée ; plusieurs navigateurs (Chrome/Edge et Firefox/Safari).
- Connexion : généralement bonne sur les lieux de séjour (peu d'impact, l'outil est local).
- Rôles de terrain : ils consultent leurs listes dans l'outil de courses, pas ici.

**Sécurité éliminatoire** \[Fait\] : aucune donnée personnelle (recettes, menus, effectifs anonymes). Aucune contrainte d'hébergement ni de conservation. Toutes les options passent le filtre.

**Critères et poids** (validés par le demandeur)

| Critère | Poids |
| --- | --- |
| Couverture du besoin | 30 |
| Expérience des concepteurs | 25 |
| Indépendance | 15 |
| Robustesse | 10 |
| Évolutivité | 8 |
| Adoption | 5 |
| Coût total | 4 |
| Délai | 3 |

## État de l'art

Le calcul est simple ; la justesse dépend surtout de la gestion des unités et de la sauvegarde des données.

- **Échelle** : quelques dizaines de recettes et un séjour de 1 à 3 semaines. Une multiplication puis une somme par ingrédient suffisent ; aucune méthode d'optimisation n'est utile \[Hypothèse sur les volumes\].
- **Agrégation multi-unités** : les outils spécialisés n'additionnent des unités différentes que si une conversion ou une densité est connue. Sinon ils gardent des lignes séparées marquées « unités mixtes » à vérifier ([gram](https://abiwab.codeberg.page/gram/explanation/shopping-list-aggregation), consulté le 25 oct. 2026). GNOME Recipes plantait sur ce cas ([ticket #70](https://gitlab.gnome.org/GNOME/recipes/issues/70)). Le référentiel de conversions est donc au cœur de la justesse.
- **Gestionnaires de recettes** : [Mealie](https://mealie.io/documentation/getting-started/features/) ajuste les portions par repas planifié et alimente des listes de courses ; il ne fait plus de sauvegarde automatique. [Tandoor](https://docs.tandoor.dev/features/shopping/) classe les listes par rayon de magasin, mais sa documentation des courses est marquée « en cours ». Les deux demandent un serveur.
- **Outils d'intendance scouts** : [Super Intendant Scout](https://snapcraft.io/superintendantscout) (Linux seul, licence CC BY-NC-ND, dernière version le 17 oct. 2024, signalé comme peut-être abandonné) ; [Cambusa Eventi](https://wordpress.org/plugins/cambusa-eventi/) (extension WordPress, v1.0.0, moins de 10 installations). Aucun ne lit un catalogue externe ni n'exporte le format produit demandé \[Non vérifié en détail\].
- **HTML local** : les données gardées dans le navigateur peuvent être effacées en cas de manque d'espace, sauf si le stockage persistant est accordé ([web.dev](https://web.dev/articles/persistent-storage), mis à jour en 2020). L'enregistrement direct dans un fichier n'existe que sous Chrome et Edge ; Firefox et Safari passent par un téléchargement ([web.dev](https://web.dev/articles/files/save-a-file?hl=es), mis à jour le 29 juil. 2026).
- **Cause d'échec typique** \[Hypothèse, retours de praticiens non trouvés\] : un outil sur mesure dont les données ne vivent que dans le navigateur, perdues lors d'un nettoyage ou d'un changement de PC.

## Options étudiées

Cinq options ont été générées ; deux ont été écartées d'emblée par le demandeur.

| Option | Statut | Raison |
| --- | --- | --- |
| O0 Tableur actuel + règles | Évaluée (référence) | Option sans nouvel outil |
| O1 Tableur Excel structuré | Évaluée, plan B | — |
| O2 Grist Desktop | Écartée | Un outil de plus à apprendre |
| O3 Mealie / Tandoor | Écartée | Serveur à gérer, contraire à « un fichier local » |
| O4 HTML local sur mesure | **Retenue** | — |

### O0 — Tableur actuel + règles

- **Principe** : chaque recette est saisie directement dans l'unité du produit (pas de conversion) ; une feuille « besoins » standard multiplie et additionne.
- **Couverture** : RM-01 et RM-02 couverts ; RM-03 partiel (agrégation semi-manuelle) ; RM-09 et RM-12 non couverts ; pas de compteur sur le menu.
- **Indépendance et coût** : maximales, rien à apprendre.
- **Risque** : les irritants A-I1 et A-I2 restent en partie.
- **Réversibilité** : totale.

### O1 — Tableur Excel structuré

- **Principe** : tables Recettes, Lignes de recette, Catalogue (import CSV), Conversions, Menu (jour × moment × recette × effectif) ; calcul par formules ou Power Query ; export CSV.
- **Couverture** : RM-01 à RM-03, RM-06, RM-09 couverts ; RM-07 partiel (dernier choix par recherche) ; RM-12 partiel (variante = copie de lignes) ; compteur et alerte limités à une mise en forme conditionnelle.
- **Expérience** : composer un menu dans des cellules reste laborieux.
- **Indépendance** : formules lisibles par le demandeur ; versions OneDrive.
- **Réversibilité** : bonne, le modèle de données est le même qu'en O4.

### O4 — HTML local sur mesure (retenue)

- **Principe** : un fichier HTML unique ; bibliothèque de recettes avec variantes et classement ; grille jours × moments ; conversions proposées à la saisie ; import du catalogue CSV ; compteur d'ingrédients non rattachés sur chaque carte ; export CSV avec alerte « continuer ou revenir ».
- **Couverture** : tous les BE et RM restés dans le périmètre, plus les deux nouvelles exigences.
- **Expérience** : interface pensée pour composer un menu.
- **Indépendance** : modifier le code demande l'IA ; les données restent dans un fichier JSON lisible et exportable en CSV.
- **Ce qui échoue d'habitude** : des données qui ne vivent que dans le navigateur. Parade : un fichier JSON comme source de vérité, plus une sauvegarde rappelée.
- **Hypothèse fragile** : la discipline de sauvegarde du fichier JSON.
- **Réversibilité** : bonne, le JSON et le CSV se reprennent dans Excel (O1).

## Contrat d'interface avec l'outil de courses

L'échange va dans les deux sens, par fichier, à la demande : le catalogue arrive de l'outil de courses, les besoins y repartent.

| Élément | Contenu |
| --- | --- |
| Entrée : catalogue | Import du catalogue de l'outil de courses : Code, Nom, Marque, Sous-catégorie, Unité, Prix unitaire (EUR), Magasin, Fiche produit \[Fait\] |
| Sortie : besoins | Une ligne par produit × repas : les 8 colonnes produit + quantité à acheter + jour + moment de repas \[Fait\] |
| Identifiant commun | Code produit \[Hypothèse : unique et stable dans l'outil de courses\] |
| Forme | Fichier CSV \[Hypothèse : séparateur et encodage à confirmer\] |
| Moment | À la demande, après composition ou modification du menu |
| Changement après export | Nouvel export complet ; le recalcul des achats restants se fait dans l'outil de courses (RM-10) |
| Alerte | Avant export : liste des ingrédients non rattachés ou sans conversion ; l'utilisateur continue ou revient corriger |

Point d'attention \[Fait\] : l'outil de courses ne distingue pas encore jour et repas ; le demandeur envisage de l'y ajouter. Le format exact sera montré plus tard.

## Matrice de décision

O4 l'emporte avec 4,31/5, porté par la couverture et l'expérience des concepteurs. Notes de 1 à 5.

| Critère (poids) | O0 Tableur actuel | O1 Tableur structuré | O4 HTML local |
| --- | --- | --- | --- |
| Couverture (30) | 2 — ni conversion ni variantes | 4 — compteur et alerte rudimentaires | 5 — tout, plus compteur et alerte |
| Expérience concepteurs (25) | 2 | 3 — menu saisi en cellules | 5 — grille de composition |
| Indépendance (15) | 5 | 4 — formules lisibles | 3 — code modifié via l'IA |
| Robustesse (10) | 3 | 4 — versions OneDrive | 3 — dépend de la sauvegarde JSON |
| Évolutivité (8) | 1 | 3 | 4 |
| Adoption (5) | 5 | 4 | 4 |
| Coût (4) | 5 | 5 | 5 |
| Délai (3) | 5 | 4 | 3 |
| **Score** | **2,83** | **3,71** | **4,31** |

**Sensibilité** : O4 reste en tête si l'on double le poids de l'indépendance (4,01 contre 3,86) ou celui de la robustesse (4,01 contre 3,86), le surplus étant pris sur l'expérience. O1 ne passe devant (3,96 contre 3,81) que si l'expérience tombe à 0 et que l'indépendance et la robustesse sont doublées ensemble.

**Ce qui sépare O4 et O1** : la composition du menu et les signaux visuels (compteur, alerte). O1 calcule aussi juste, mais il est moins agréable à utiliser et ne signale les manques que par des couleurs.

## Décision

Le demandeur a retenu O4, conformément à la recommandation, le 25 oct. 2026.

- **Option retenue** : O4, fichier HTML local sur mesure, construit avec l'IA.
- **Plan B** : O1, tableur Excel structuré (même modèle de données, reprise du JSON ou du CSV).
- **Raisons** : couverture complète, confort de composition du menu, un seul outil local, gratuit.
- **Risques acceptés** : dépendance à l'IA pour faire évoluer le code ; risque de perte de données si la sauvegarde du fichier JSON n'est pas tenue ; comportement différent de la sauvegarde selon le navigateur.
- **Condition** : test d'une soirée réussi avant de poursuivre.

## Test préalable

Le test vise deux hypothèses risquées : l'aller-retour des données avec l'outil de courses, et la sauvegarde du fichier dans plusieurs navigateurs.

**Prototype d'une soirée**

1. Importer le vrai catalogue de l'outil de courses (CSV).
2. Saisir 3 recettes, dont une utilisant une conversion (ex. œufs en pièces, produit au poids) et une variante.
3. Composer 2 jours de menu avec des effectifs différents par repas.
4. Laisser un ingrédient non rattaché : vérifier le compteur sur la carte et l'alerte à l'export.
5. Exporter le CSV et l'importer dans l'outil de courses.
6. Enregistrer le fichier JSON, fermer, rouvrir, sous Chrome puis sous Firefox.

**Résultat attendu** : quantités justes sans retouche, import accepté par l'outil de courses, aucune donnée perdue à la réouverture dans les deux navigateurs. Si l'import ou la sauvegarde échoue, revoir le contrat d'interface ou basculer sur O1.

## Questions ouvertes restantes

Aucune ne remet en cause l'option ; la première conditionne l'interface.

| Question | Impact | Qui peut répondre |
| --- | --- | --- |
| Format exact attendu par l'outil de courses (séparateur, encodage, en-têtes, une ligne par repas ou agrégée) ? | Contrat d'interface | Demandeur (exemple promis) |
| L'outil de courses gérera-t-il jour et repas ? | Utilité des colonnes jour/moment | Demandeur |
| Le code produit est-il unique et stable ? | Rattachement et RM-07 | Demandeur |
| Où est porté le statut frais / gros achat : catalogue importé ou cet outil ? | BE-09, RM-08 | Demandeur |
| L'arrondi au conditionnement (RM-05) se fait-il ici ou dans l'outil de courses, et avec quelle tolérance ? | Quantité exportée | Demandeur |
| Critères de classement des recettes ? | BE-01 | Concepteurs |
| Le matériel vient-il d'une liste commune ou d'une saisie libre ? | BE-12 | Concepteurs, cuisiniers |

## Transmission au Solution & Security Architect

La forme est décidée (un fichier HTML local) ; la conception doit garantir que les données survivent au navigateur.

**Décidé**

- Un seul fichier HTML autonome, sans serveur, sans dépendance payante, maintenu par le demandeur avec l'IA.
- Périmètre : recettes (pour 10, variantes, classement, matériel), conversions, menu jours × moments avec effectif, rattachement au catalogue importé, export CSV.
- Hors périmètre : stock, achats, recalcul des achats restants (outil de courses).

**Contraintes à respecter**

- Fichier JSON comme source de vérité, ouvert et enregistré explicitement ; le stockage du navigateur ne sert que de cache.
- Fonctionner sous Chrome/Edge (enregistrement direct possible) et Firefox/Safari (téléchargement).
- Respecter le contrat d'interface : 8 colonnes produit + quantité + jour + moment ; import du catalogue au même format.
- Aucune donnée personnelle ; pas de contrainte d'hébergement.

**Hypothèses fragiles**

- La discipline de sauvegarde : prévoir un indicateur de modifications non enregistrées et une sauvegarde horodatée.
- Le format exact de l'outil de courses, pas encore vu.

**Points d'attention**

- Agrégation multi-unités : ne jamais additionner sans conversion connue ; signaler plutôt que deviner.
- Compteur d'ingrédients non rattachés sur chaque carte du menu ; alerte « continuer ou revenir » à l'export.
- Une variante ne modifie jamais l'original (RM-12) ; le dernier produit choisi est proposé par défaut (RM-07).
- Garder un modèle de données tabulaire simple, pour que le plan B (Excel) reste possible.

## Sources

Toutes consultées le 25 oct. 2026.

- [gram — Shopping list aggregation](https://abiwab.codeberg.page/gram/explanation/shopping-list-aggregation)
- [GNOME Recipes — ticket #70, unités mixtes](https://gitlab.gnome.org/GNOME/recipes/issues/70)
- [Mealie — Features](https://mealie.io/documentation/getting-started/features/)
- [Tandoor — Shopping](https://docs.tandoor.dev/features/shopping/)
- [Super Intendant Scout — Snapcraft](https://snapcraft.io/superintendantscout)
- [Cambusa Eventi — WordPress.org](https://wordpress.org/plugins/cambusa-eventi/)
- [web.dev — Persistent storage](https://web.dev/articles/persistent-storage) (mis à jour le 12 mai 2020)
- [web.dev — Enregistrer un fichier](https://web.dev/articles/files/save-a-file?hl=es) (mis à jour le 29 juil. 2026)
- [Grist core — GitHub](https://github.com/gristlabs/grist-core)
