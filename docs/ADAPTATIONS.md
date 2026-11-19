# Adaptations — Menus de séjour (Gestion_courses)

## Itération 1 — ouverte le 19/11/2026

| ID | Adaptation | Catégorie | Priorité | Statut | Mise à jour |
|---|---|---|---|---|---|
| AD-001 | Glisser-déposer une recette sur une case du menu, ou un repas d'une case à l'autre | Ergonomie | Haute | À tester | 19/11/2026 |
| AD-002 | Poubelle visible pendant le glissement d'un repas, pour le retirer du menu | Ergonomie | Haute | À tester | 19/11/2026 |
| AD-003 | Ingrédients du séjour : une ligne par repas, colonnes Repas puis Ingrédient | Affichage | Haute | À tester | 19/11/2026 |
| AD-004 | Trier et filtrer chaque colonne du tableau des ingrédients | Ergonomie | Haute | À tester | 19/11/2026 |
| AD-005 | Produit par repas : produit du séjour par défaut, remplaçable pour un repas | Règle métier | Haute | À tester | 19/11/2026 |
| AD-006 | Afficher les images des produits | Données | Moyenne | À reformuler | 19/11/2026 |
| AD-007 | Onglet Recettes : grille de cartes, puis la fiche au clic | Nouvelle fonction | Moyenne | À tester | 19/11/2026 |
| AD-008 | Clic sur un repas : recette en fenêtre, modifiable « partout » ou « ce repas seulement » | Nouvelle fonction | Haute | À tester | 19/11/2026 |
| AD-009 | Analyser l'usage et ajouter des fenêtres là où elles évitent un changement d'onglet | Ergonomie | Moyenne | À valider | 19/11/2026 |
| AD-010 | Liste de courses : fenêtre de justification du calcul d'un produit | Nouvelle fonction | Haute | À tester | 19/11/2026 |

### Détail
**AD-001** — Glisser-déposer
- Remarque d'origine : « fonctionner avec un système de drag and drop »
- Ce qui change : une recette de la liste se glisse sur une case ; un repas se glisse sur une autre case (déplacement, ou échange si la case est occupée). Clic et clavier restent possibles ; Ctrl+Z annule.
- Règle métier touchée : aucune
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-002** — Poubelle
- Remarque d'origine : « une petite icône poubelle lorsque je drop […] pour qu'il puisse être retiré du menu »
- Ce qui change : pendant le glissement d'un repas, une poubelle apparaît en bas de l'écran ; y déposer le repas le retire (annulable).
- Règle métier touchée : aucune
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-003 / AD-004** — Ingrédients par repas, tri et filtres
- Remarque d'origine : « la première colonne soit le repas, le deuxième ingrédient […] trier et filtrer chacune de ces colonnes »
- Ce qui change : colonnes Repas, Ingrédient, Recette, Quantité, Produit, Statut ; clic sur l'en-tête = tri ; ligne de filtres (listes ou texte) ; « Effacer les filtres ».
- Règle métier touchée : aucune
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-005** — Produit par repas
- Remarque d'origine : « les oignons d'un repas X ne sont pas les mêmes oignons d'un repas Y »
- Ce qui change : chaque repas peut remplacer le produit du séjour (`repas.produits`). Calcul, manques et export suivent le produit de chaque repas.
- Règle métier touchée : « un seul produit par ingrédient et par séjour » devient « un produit par défaut par séjour, remplaçable par repas » (décision du 19/11/2026).
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À reformuler → 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-006** — Images
- Remarque d'origine : « je ne vois pas les images, vérifier si dans le CSV il y a bien le lien vers l'image web »
- Constat : le CSV n'a pas de colonne image ; « Fiche produit » pointe vers la page web du produit (1 seul lien d'image sur 314).
- Question : l'outil de courses peut-il exporter une colonne « Image » avec le lien direct de l'image ?
- Historique : 19/11 À reformuler

**AD-007** — Grille des recettes
- Remarque d'origine : « d'abord un affichage et un récap de toutes les recettes en grille kanban vignette »
- Ce qui change : cartes (initiale, ingrédients, vignettes des produits, nombre de repas, alertes) ; « ← Toutes les recettes » depuis la fiche.
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-008** — Recette du repas en fenêtre
- Remarque d'origine : « lorsque je clique sur un repas, voir directement la recette en pop-up, et pouvoir changer les différentes composantes »
- Ce qui change : fenêtre avec effectif, manques, produits du repas, ingrédients ; si la recette sert ailleurs : « Modifier partout » ou « Modifier ce repas seulement » (variante liée à la recette d'origine, marquée « adaptée »).
- Règle métier touchée : variantes de recettes (prévues en I2), choix « à chaque fois » du 19/11/2026.
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-009** — Plus de fenêtres
- Remarque d'origine : « il n'y a pas beaucoup de pop-up. Sais-tu analyser l'usage et en ajouter »
- Ce qui change : liste de propositions à valider (voir conversation du 19/11).
- Historique : 19/11 À valider

**AD-010** — Justification des quantités
- Remarque d'origine : « un pop-up qui me montre la source du produit, quels sont les repas, les jours et les calculs »
- Ce qui change : clic sur un produit de la liste → tableau repas par repas (pour 10 × effectif ÷ 10, conversion), total, contenance, arrondi au paquet et répartition exportée.
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester
