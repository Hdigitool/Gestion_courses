# Adaptations — Menus de séjour (Gestion_courses)

Documents liés : [Audit UX/UI du 19/11/2026](AUDIT-UX-UI-2026-11-19.md) · [Journal de construction](../JOURNAL-DE-CONSTRUCTION.md)

## Itération 0 — Corrections de l'audit UX/UI — ouverte le 19/11/2026

Corrections issues de l'audit (« Fais le tout », 19/11). Livrées dans la branche `audit-ux-corrections`, en ligne depuis le 19/11.

| ID | Adaptation | Catégorie | Priorité | Statut | Mise à jour |
|---|---|---|---|---|---|
| AU-01 | En ligne : « Ouvrir » ne fait plus quitter la base partagée sans prévenir | Bug | Haute | À tester | 19/11/2026 |
| AU-02 | En ligne : l'annulation (Ctrl+Z) est enregistrée dans la base | Bug | Haute | À tester | 19/11/2026 |
| AU-03 | Choisir le produit dès la recette, repris dans chaque séjour | Nouvelle fonction | Haute | À tester | 19/11/2026 |
| AU-04 | Recherche de produit classée (épices reléguées), sous-catégorie affichée | Ergonomie | Haute | À tester | 19/11/2026 |
| AU-05 | Effectif par défaut du séjour, sélection par jour / moment / tout | Ergonomie | Haute | À tester | 19/11/2026 |
| AU-06 | Liste de courses groupée par magasin, total, impression | Nouvelle fonction | Haute | À tester | 19/11/2026 |
| AU-07 | La page ne défile plus : seules les zones de travail défilent | Affichage | Haute | À tester | 19/11/2026 |
| AU-08 | Entrée dans la recherche du menu place la recette et passe à la case suivante | Ergonomie | Moyenne | À tester | 19/11/2026 |
| AU-09 | Compteur des manques : ingrédients distincts, pas un total par repas | Affichage | Moyenne | À tester | 19/11/2026 |
| AU-10 | Coller des lignes depuis Excel dans une recette (avec aperçu) | Nouvelle fonction | Moyenne | À tester | 19/11/2026 |
| AU-11 | Messages en bas à droite, sans masquer la grille | Affichage | Basse | À tester | 19/11/2026 |
| AU-12 | Nom de la nouvelle recette présélectionné, pas de doublon « Nouvelle recette » | Ergonomie | Basse | À tester | 19/11/2026 |
| AU-13 | Ingrédients : alerte faute de frappe, renommer / fusionner / supprimer | Données | Moyenne | À tester | 19/11/2026 |
| AU-14 | Équivalence et contenance en fenêtre (plus de changement d'onglet) | Ergonomie | Moyenne | À tester | 19/11/2026 |
| AU-15 | Raccourcis ⌘ sur Mac, visibles sur les boutons | Affichage | Basse | À tester | 19/11/2026 |
| AU-16 | Bugs d'affichage : tri naturel, « Utilisé dans » compact, cases du catalogue, cibles ≥ 24 px | Bug | Basse | À tester | 19/11/2026 |
| AU-17 | Vignettes produits (colonne « Image » facultative du catalogue) | Données | Basse | À tester | 19/11/2026 |

## Itération 1 — ouverte le 19/11/2026

| ID | Adaptation | Catégorie | Priorité | Statut | Mise à jour |
|---|---|---|---|---|---|
| AD-001 | Glisser-déposer une recette sur une case du menu, ou un repas d'une case à l'autre | Ergonomie | Haute | À tester | 19/11/2026 |
| AD-002 | Poubelle visible pendant le glissement d'un repas, pour le retirer du menu | Ergonomie | Haute | À tester | 19/11/2026 |
| AD-003 | Ingrédients du séjour : une ligne par repas, colonnes Repas puis Ingrédient | Affichage | Haute | À tester | 19/11/2026 |
| AD-004 | Trier et filtrer chaque colonne du tableau des ingrédients | Ergonomie | Haute | À tester | 19/11/2026 |
| AD-005 | Produit par repas : produit du séjour par défaut, remplaçable pour un repas | Règle métier | Haute | À tester | 19/11/2026 |
| AD-006 | Afficher les images des produits — retirée (« pas besoin ») | Données | — | À reformuler | 19/11/2026 |
| AD-007 | Onglet Recettes : grille de cartes, puis la fiche au clic | Nouvelle fonction | Moyenne | À tester | 19/11/2026 |
| AD-008 | Clic sur un repas : recette en fenêtre, modifiable « partout » ou « ce repas seulement » | Nouvelle fonction | Haute | À tester | 19/11/2026 |
| AD-009 | Analyser l'usage et ajouter des fenêtres là où elles évitent un changement d'onglet | Ergonomie | Moyenne | À tester | 19/11/2026 |
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
- Décision du 19/11 : pas besoin d'images (la colonne « Image » facultative reste supportée).
- Historique : 19/11 À reformuler (retirée)

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
- Ce qui change : choix laissé à Claude (« à toi de voir », 19/11). Retenu : aide du menu en fenêtre, nouvelle recette en fenêtre depuis le menu, fiche produit (catalogue), fiche ingrédient (ingrédients du séjour). Écarté : aperçu au survol, confirmation de retrait.
- Livré dans : branche iteration-3-fenetres
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-010** — Justification des quantités
- Remarque d'origine : « un pop-up qui me montre la source du produit, quels sont les repas, les jours et les calculs »
- Ce qui change : clic sur un produit de la liste → tableau repas par repas (pour 10 × effectif ÷ 10, conversion), total, contenance, arrondi au paquet et répartition exportée.
- Livré dans : branche iteration-2-menu
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

## Itération 2 — ouverte le 19/11/2026

| ID | Adaptation | Catégorie | Priorité | Statut | Mise à jour |
|---|---|---|---|---|---|
| AD-011 | Onglet Recettes en premier | Affichage | Basse | À tester | 19/11/2026 |
| AD-012 | Clic sur l'onglet Recettes depuis une fiche = retour à la vue d'ensemble | Ergonomie | Moyenne | À tester | 19/11/2026 |
| AD-013 | Étiquettes des recettes (choisir ou créer), gestion dans Référentiels | Nouvelle fonction | Haute | À tester | 19/11/2026 |
| AD-014 | Vue « Par catégorie » : étiquettes à cocher, chaque recette affichée une fois | Nouvelle fonction | Haute | À tester | 19/11/2026 |
| AD-015 | Vue « Tableau » des recettes, triable et filtrable | Nouvelle fonction | Moyenne | À tester | 19/11/2026 |
| AD-016 | Plusieurs recettes et/ou produits seuls dans un même repas | Règle métier | Haute | À tester | 19/11/2026 |
| AD-017 | Recherche du menu par nom, #étiquette, ingrédient ; produits seuls à ajouter | Nouvelle fonction | Haute | À tester | 19/11/2026 |
| AD-018 | Pas d'alerte d'équivalence quand le produit a la même unité (œufs en pièces) | Bug | Haute | À tester | 19/11/2026 |
| AD-019 | Critères des recettes = étiquettes (fusionné avec AD-013) | Nouvelle fonction | — | À tester | 19/11/2026 |

### Détail
**AD-016** — Plusieurs éléments par repas
- Remarque d'origine : « pour un même jour et un même repas insérer plusieurs recettes et/ou plusieurs produits ex : pour le diner : Entrée, plat dessert »
- Ce qui change : un repas = recette principale (`recetteId`, facultative) + `extras` (recettes ou produits seuls avec quantité pour 10). Glisser sur une case remplie ajoute ; la fenêtre du repas permet d'ajouter, retirer, réordonner. Calcul, manques, export et justification couvrent tous les éléments. Anciens fichiers compatibles sans conversion.
- Règle métier touchée : « un repas = une recette » devient « un repas = une liste d'éléments » (décision du 19/11/2026).
- Livré dans : branche iteration-3-recettes
- Historique : 19/11 À valider → 19/11 À développer → 19/11 À tester

**AD-018** — Équivalence inutile
- Remarque d'origine : « ne pas demander d'équivalence aux ingrédients qui ont la même unité que le produit choisi » — œufs en pièce, produit en pièces.
- Cause : l'affichage de la fiche recette réclamait « pièce → g » sans regarder le produit ; le calcul était déjà juste.
- Livré dans : branche iteration-3-recettes
- Historique : 19/11 À reformuler → 19/11 À valider → 19/11 À tester

**AD-011 à AD-015, AD-017, AD-019** — voir conversation du 19/11/2026 (plan de l'itération 2). Livrés dans la branche iteration-3-recettes.
