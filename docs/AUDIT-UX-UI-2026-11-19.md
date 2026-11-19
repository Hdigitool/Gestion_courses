# Audit UX/UI — Menus de séjour (dépôt Gestion_courses, branche main)

Audit du 19 nov. 2026, sur le commit du 17 nov. 2026. Méthode : lecture complète de `src/ui.js` et `src/styles.css`, puis une vraie session dans Chrome headless (Playwright) avec le vrai catalogue (314 produits), 41 recettes à noms longs et un séjour de 7 jours × 4 moments (28 repas, effectif 42). Les mesures ont été prises sur 4 profils.
La branche `import-recettes-excel` n'est pas couverte. Le mode en ligne (base Neon) a été audité par lecture du code, sans connexion.

## 1. Verdict

**6/10.** Le point fort : le cœur du métier est solide (aperçu avant import, statuts « à compléter » qui renvoient à la bonne correction, placement en chaîne, fenêtres internes, aucun `alert()`).
Le problème principal : **le parcours « recette → produit » est cassé en deux**. On ne peut pas rattacher un produit depuis la recette (seulement dans un séjour, ingrédient par ingrédient). Le séjour est lent à remplir (28 clics Maj pour l'effectif). Et la « Liste de courses » n'est qu'un aperçu du CSV, pas une liste utilisable.

## 2. Profils et sessions réelles

| Rôle | Besoin principal |
|---|---|
| Responsable intendance (toi) | Créer les recettes pour 10, composer le menu, saisir les effectifs, sortir la liste de courses |
| Équipe cuisine | Consulter le repas du jour (ingrédients pour X, matériel) |

**Session A : créer une recette et la rattacher aux produits**
1. ✅ « Nouvelle recette » crée la fiche et met le focus sur « Nom ».
2. ❌ Le nom vaut « Nouvelle recette » et le curseur est placé **à la fin** (sélection 16-16) : il faut tout effacer. Si on oublie, des recettes « Nouvelle recette » s'accumulent (dans la base partagée en mode en ligne).
3. ✅ L'ajout d'ingrédients au clavier fonctionne : Entrée dans « Quantité » ajoute la ligne et revient sur « Ingrédient ».
4. ❌ Entrée dans le champ « Ingrédient » ne fait rien (aucun message). Il faut aussi passer par la liste d'unités à la souris ou à Tab.
5. ❌ **Coller plusieurs lignes depuis Excel** (`Ail⇥2⇥pièce`) : rien n'est ajouté, le champ reste vide (M1, M11).
6. 🔴 **Il n'y a aucun moyen de rattacher un produit depuis la recette.** L'onglet « Ingrédients du séjour » affiche « Créez d'abord un séjour dans l'onglet Menu ». Le rattachement est enregistré **par séjour**. Le « dernier produit » est mémorisé mais n'est pas reproposé (prévu en I2). Chaque nouveau séjour oblige donc à tout rattacher de nouveau.
7. ❌ Une faute de frappe dans un nom d'ingrédient crée un nouvel ingrédient, sans prévenir. On ne peut ni supprimer ni fusionner les ingrédients : ils polluent la liste de suggestions.
8. ❌ La suppression d'une ligne d'ingrédient est immédiate, sans confirmation ni Ctrl+Z (Ctrl+Z ne marche que dans la grille du menu).

Points faibles : rattachement impossible au moment où l'on pense au produit, pas de collage, pas d'annulation.

**Session B : composer le menu du séjour**
1. ✅ La fenêtre « Nouveau séjour » a de bonnes valeurs par défaut (7 jours, 4 moments).
2. ✅ Un clic sur une recette la place et passe au jour suivant : rapide pour une colonne.
3. ❌ **Au clavier** : flèches, puis Entrée, ouvre la recherche. On tape « spag » puis Entrée : **rien n'est placé** (0 repas). Pour atteindre le résultat, il faut faire Tab sur chaque bouton.
4. ❌ La recherche reste filtrée après le placement (1 recette visible) : il faut la vider à la main pour la case suivante.
5. 🟡 Le tri est alphabétique, pas naturel : « …12, 17, 2, 22 ».
6. ❌ Avec 41 recettes, **toute la page défile** (2 450 px pour 730 px visibles). La grille et le panneau de droite défilent avec, et l'en-tête des moments disparaît.
7. ❌ Le choix du séjour n'existe que dans l'onglet Menu. « Liste de courses » et « Ingrédients » travaillent sur le séjour choisi là, sans le dire ni permettre d'en changer.

**Session C : saisir l'effectif**
1. ❌ **28 clics Maj** pour sélectionner les 28 repas, puis « Appliquer ». Il n'y a ni sélection de ligne (jour) ou de colonne (moment), ni « Tout le séjour », ni effectif par défaut du séjour.
2. ❌ Une case vide n'a pas de champ « Effectif » : on ne peut pas préparer les effectifs avant les recettes. Sur une sélection mixte, les cases vides sont ignorées sans message (M8).
3. ❌ « 42 pers » est refusé (le message est clair, mais la saisie n'est pas tolérante, M8).
4. ✅ Ctrl+Z annule l'effectif, et le bouton « ↶ Annuler (effectif 42) » est explicite.

**Session D : générer la liste de courses**
1. ❌ Pastille « △ 140 à compléter dans 28 repas » alors qu'il n'y a que **5 ingrédients** à rattacher : le même manque est compté une fois par repas. Le chiffre alarme et induit en erreur.
2. 🔴 **Mauvais produit proposé en premier** : pour « Oignon », la recherche est pré-remplie et le 1ᵉʳ résultat est « BONI épices oignons ». On peut le choisir en un clic, sans sous-catégorie ni tri par pertinence. C'est le même type d'erreur que l'ancien Beurre → beurre de cacahuète.
3. ❌ L'onglet « Liste de courses » montre les **12 colonnes brutes de l'export CSV** (Code, Destination, Activité…), une ligne par produit **et par repas**. Il n'y a ni regroupement par magasin ou produit, ni total, ni impression. Résultat : « EVERYDAY spaghetti 21 cl » et « épices oignons 12,6 pièce », tous deux marqués « À vérifier ».
4. ✅ La fenêtre d'export liste les manques par repas, et « Revenir et compléter » amène au premier repas incomplet.

## 3. Mesures (Chrome, fenêtre utile)

| Relevé | PC 100 % 1920×945 | PC 125 % 1536×730 | MacBook Air 1440×775 | MacBook Pro 1512×860 | Seuil | Statut |
|---|---|---|---|---|---|---|
| Hauteur page Menu (41 recettes, 7 j) | 2 450 | 2 450 | 2 450 | 2 450 | ≤ hauteur fenêtre | KO |
| Hauteur page Recettes | 3 349 | 3 349 | 3 349 | 3 349 | ≤ fenêtre | KO |
| Hauteur page Catalogue | 14 460 | 14 460 | 14 460 | 14 460 | ≤ fenêtre (tableau qui défile seul) | KO |
| Bas de la grille J1-J7 | 956 | 1 082 | 1 082 | 1 082 | ≤ fenêtre | KO (OK seulement si ≤ 4 jours) |
| Barre du haut | 60 px, 1 ligne | 60 | 60 | 60 | ≤ 72 | OK |
| Début de la zone de travail | 107 px | 107 | 107 | 107 | ≤ 180 | OK |
| Cibles < 24 px | 0 | 0 | 0 | 0 | 0 | OK, sauf Catalogue : 452 cases à cocher de 22 px |
| Textes < 13 px | 0 | 0 | 0 | 0 | 0 | OK |
| Défilement horizontal | non | non | non | non | non | OK |
| alert / confirm / prompt | 0 | 0 | 0 | 0 | 0 | OK |
| Libellé seulement en `title` | « Ctrl+S », « Ctrl+Z » | idem | idem (affiche Ctrl sur Mac) | idem | raccourci visible, ⌘ sur Mac | KO |

## 4. Catalogue des motifs

| Motif | Résultat | Preuve |
|---|---|---|
| M1 Excel fait loi | ❌ | Pas de collage multi-lignes dans la recette ni dans les effectifs ; pas de sélection en glissant ou par ligne/colonne ; Ctrl+Z limité à la grille |
| M2 Budget vertical | ❌ | Toute la page défile (2 450 à 14 460 px) ; colonnes gauche et droite non indépendantes ; aide clavier en ligne permanente sous la grille |
| M3 Ce qui encombre | ❌ | « Mode sombre », « Ouvrir », « Enregistrer » et « Exporter » en permanence dans la barre ; « Exporter » en double (barre + onglet Liste) ; h1 = nom de la recette + champ Nom juste dessous ; « Nouveau séjour » au même niveau que « Modifier » |
| M4 Découvrabilité | ❌ | Sélection multiple seulement par Maj+clic (expliqué dans un texte gris) ; rattachement introuvable depuis la recette |
| M5 Fenêtre, pas déplacement | 🟡 | Fenêtres internes OK ; mais « Ajouter une équivalence » et « Valider la contenance » **changent d'onglet** et perdent le contexte de la recette ou du repas |
| M6 Parité entre vues | ❌ | Effectif modifiable dans Menu seulement ; ingrédients modifiables dans Recettes, en lecture seule dans le panneau Repas ; recherche présente sur certains tableaux seulement ; pas de tri sur les en-têtes |
| M7 Négatif ≠ fait | ✅ | △ orange pour les manques, ✓ vert pour « complet » |
| M8 Aucun échec silencieux | ❌ | Entrée dans Ingrédient, collage, effectif sur cases vides : rien ne se passe et rien ne l'explique |
| M9 Couleurs sémantiques | ✅ | Contrastes définis dans les deux thèmes |
| M10 Navigation | 🟡 | 6 onglets OK, mais l'ordre suit l'outil, pas la tâche (Liste de courses avant Ingrédients alors qu'il faut rattacher avant d'exporter) |
| M11 Actions en masse | ❌ | Pas d'import de recettes en main ; pas d'effectif « tout le séjour » ; pas d'impression |
| M12 Ordre naturel | 🟡 | Tri des recettes non naturel (2 après 17) |
| M13 Microcopie | ✅ | Boutons verbaux (« Revenir et compléter », « Exporter quand même ») |
| M14 Volume réaliste | ❌ | 41 recettes : la colonne Recettes fait 3 349 px ; « Utilisé dans » répète tous les noms de recettes sur 5 lignes par ingrédient |

## 5. Matrice de parité

| Capacité | Menu (panneau repas) | Recettes | Ingrédients du séjour | Liste de courses |
|---|---|---|---|---|
| Modifier les quantités | ❌ | ✅ | — | ❌ |
| Rattacher un produit | bouton → change d'onglet | ❌ | ✅ | ❌ |
| Changer de séjour | ✅ | — | ❌ | ❌ |
| Rechercher | ✅ | ✅ | ❌ | ❌ |
| Trier / filtrer | ❌ | ❌ | filtre seulement | ❌ |
| Annuler (Ctrl+Z) | ✅ | ❌ | ❌ | — |

## 6. Scores par section

| # | Section | /5 | Mot |
|---|---|---|---|
| 1 | Clarté | 3 | Bonne, sauf la liste de courses |
| 2 | Navigation | 3 | Sauts d'onglet |
| 3 | Hiérarchie / mise en page | 2 | Page entière qui défile |
| 4 | Typographie | 4 | Propre |
| 5 | Couleur | 4 | Thème sombre soigné |
| 6 | Composants | 3 | Cohérents mais lourds |
| 7 | Formulaires | 3 | Validation OK, saisie rigide |
| 8 | Retour système | 3 | Toasts qui couvrent la grille |
| 9 | Prévention d'erreur | 2 | Mauvais produit à 1 clic |
| 10 | Tableaux | 1 | Ni tri, ni en-têtes figés, ni impression |
| 11 | Responsive | 2 | Échoue sur tous les profils dès 5 jours |
| 12 | Accessibilité | 4 | Rôles ARIA, focus, fenêtres piégées |
| 13 | Microcopie | 4 | Claire |
| 14 | Finition | 3 | Identité « Brigade » cohérente |

## 7. Problèmes priorisés

1. 🔴 **Ouvrir un fichier en mode en ligne quitte la base partagée sans prévenir.** Où : `chargerFichier` → `demarrerAvec` → `nouvelleUI()` remet `enLigne` à `false`. Conséquence : les modifications suivantes ne sont plus enregistrées en base, et « Se déconnecter » disparaît. Critère : en ligne, « Ouvrir » est masqué, ou bien il demande « Remplacer la base partagée par ce fichier ? ». Correction : conserver `enLigne` dans `demarrerAvec`, ou masquer Ouvrir quand `app.ui.enLigne` vaut vrai. Effort S.
2. 🔴 **Ctrl+Z n'est pas enregistré en base.** `annuler()` met `dirty` à vrai sans appeler `sauverPartage`. Si on recharge après un Ctrl+Z, l'action annulée revient. Correction : passer par `modifier()`, ou relancer la minuterie de sauvegarde. Effort S.
3. 🔴 **Rattacher depuis la recette.** Ajouter une colonne « Produit » dans l'éditeur de recette, avec recherche dans un panneau superposé (M5). Elle mémorise le produit par ingrédient (`dernierProduit`), et chaque nouveau séjour le reprend automatiquement (pré-rattachement, modifiable). Critère : créer un séjour avec des recettes déjà rattachées donne 0 « non rattaché ». Effort M.
4. 🔴 **Mauvais produit proposé.** Résultats triés : nom qui commence par le mot > mot entier > contient ; sous-catégorie affichée ; produits de la sous-catégorie « Épices » relégués quand l'ingrédient n'en est pas une. Critère : « Oignon » ne propose pas d'épice en 1ᵉʳ. Effort S.
5. 🟠 **Effectif en masse.** Ajouter un « Effectif par défaut » dans la fenêtre séjour (appliqué aux nouveaux repas), et des clics sur les en-têtes « J3 » ou « Déjeuner » qui sélectionnent la ligne ou la colonne, plus un bouton « Tout ». Critère : 42 sur 28 repas en ≤ 3 actions (aujourd'hui 30). Effort S.
6. 🟠 **Vraie liste de courses.** Grouper par magasin, puis par produit, avec quantité totale du séjour dans l'unité du produit, colonne « À vérifier » en évidence et bouton « Imprimer ». Garder le tableau CSV dans un dépliant « Aperçu de l'export ». Effort M.
7. 🟠 **Budget vertical (M2).** Placer la page en `height:100dvh; display:grid; grid-template-rows:auto auto 1fr`, avec `overflow:auto` sur `.col-g`, `.col-c` et `.col-d` et des en-têtes de grille et de tableaux en `position:sticky`. Critère : scrollHeight ≤ hauteur de fenêtre à 1536×730 sur tous les onglets. Effort M.
8. 🟠 **Placement au clavier.** Entrée dans la recherche place le 1ᵉʳ résultat, puis la recherche est vidée et le focus revient sur la case suivante. ↓ depuis la recherche parcourt les résultats. Effort S.
9. 🟠 **Compteur de manques trompeur.** Afficher « 5 ingrédients à rattacher · 28 repas concernés » (manques distincts), pas 140. Effort S.
10. 🟠 **Coller depuis Excel dans la recette.** Un collage tabulé `nom⇥quantité⇥unité` sur plusieurs lignes ajoute N lignes, avec un résumé avant écriture et une saisie tolérante (« 1,2kg », « 3 pc »). Effort M.
11. 🟡 **Toast qui couvre la grille.** Le toast est centré en bas et masque les cases J4-J5 et le bouton « + Ajouter l'ingrédient ». Le placer en bas à droite, hors zone de travail, avec un bouton « Annuler » intégré pour les remplacements. Effort S.
12. 🟡 **Nom de recette.** Sélectionner tout le texte à la création (`el.select()`), et refuser un 2ᵉ « Nouvelle recette » non renommé. Supprimer le h1 en double, ou rendre le titre directement modifiable. Effort S.
13. 🟡 **Ingrédients en double.** Prévenir avant de créer un nouvel ingrédient (« Créer “Oigon” ? Ingrédient proche : Oignon »). Ajouter Renommer / Fusionner / Supprimer dans Référentiels. Effort M.
14. 🟡 **Retours d'onglet.** « Ajouter une équivalence » et « Valider la contenance » s'ouvrent en fenêtre au lieu de changer d'onglet (M5). Effort M.
15. 🟡 **Raccourcis Mac.** Afficher ⌘S / ⌘Z sur Mac, et rendre les raccourcis visibles ailleurs que dans `title`. Effort S.

## 8. Bugs d'affichage relevés

- La page entière défile : avec plus de 4 jours, la grille sort de l'écran et le panneau Repas défile avec elle (tous les profils).
- `.trois { min-height: calc(100vh - 110px) }` est codé en dur : il casse si la barre passe sur 2 lignes (`flex-wrap: wrap` sur `.barre` et `.onglets`).
- Ingrédients du séjour : la colonne « Utilisé dans » prend 5 lignes par ingrédient avec 7 recettes. Afficher « 7 recettes » avec le détail au survol ou au dépliage.
- Recettes : l'en-tête « Quantité pour 10 » et le bouton « + Ajouter l'ingrédient » passent sur 2 lignes à 1440 px.
- Catalogue : les cases « Sous-catégories frais » se décalent quand le libellé passe à la ligne (case non `flex-shrink:0`). La liste contient aussi « Entretien » (non alimentaire). La page est limitée à `max-width:1400px` : environ 500 px vides à droite en 1920.
- Catalogue : 452 cases à cocher de 22 px (sous le seuil de 24 px).
- Le toast de 5 s reste visible après un changement d'onglet et masque le contenu.
- Le tri des recettes n'est pas naturel (2 après 17).

## 9. Ce qui encombre / ce qui manque

**Encombre**
- « Mode sombre » en bouton texte : une icône suffit.
- « Ouvrir » / « Enregistrer » en mode en ligne : inutiles, et même dangereux (point 1).
- « Exporter » en double.
- La ligne d'aide clavier permanente : la mettre en infobulle « ? ».

**Manque**
- Rattachement dans la recette, et repris d'un séjour à l'autre.
- Effectif par défaut.
- Impression de la liste et des fiches repas.
- Annuler hors grille.
- Recherche par ingrédient.
- Duplication de séjour (prévue en I2).

## 10. Quick wins (< 15 min chacun)

1. Conserver `enLigne` à l'ouverture d'un fichier, ou masquer « Ouvrir » en ligne (point 1).
2. Sauvegarder après `annuler()` (point 2).
3. Sélectionner le texte du nom à la création d'une recette.
4. Entrée dans la recherche du menu = placer le 1ᵉʳ résultat, puis vider la recherche.
5. Compter les manques distincts (point 9).

## 11. Déjà bien (à garder)

- Aperçu avant import du catalogue.
- Statuts △ qui mènent à la correction.
- Fenêtres internes avec focus piégé et Échap.
- Placement en chaîne.
- Contrôle du remplacement avec Ctrl+Z.
- Thème sombre.
- Aucun `alert()`.
- Contrastes soignés.

Aucune régression constatée sur les corrections déjà notées (Beurre, thème, déconnexion, onglet Liste).

## 12. Hors périmètre

Sécurité de l'API et des sessions, schéma Neon, verrou de version (409) : non audités.

## 13. Sources

- [Newly — meal planner & grocery list](https://newly.app/build/meal-planner-grocery-list-app) : liste fusionnée et groupée par rayon
- [Plan to Eat — serving sizes](https://learn.plantoeat.com/doc/getting-started-the-app) : portions modifiables par repas planifié
- [Memberkitchens — meal plans](https://memberkitchens.com/features/recipes-and-meal-plans) : liste groupée par magasin/rayon
- [Wholesum](https://neura.market/ai-tools-directory/food/wholesum) : listes de courses et de colisage pour groupes et camps
- [Primer — accessible toasts](https://primer.style/accessibility/toasts/), [Coloplast — toast guidelines](https://designsystem.coloplast.com/latest/build/components/toast/usage-and-guidelines-nzaRktFz) : un toast ne doit pas masquer le contenu
- Nielsen (10 heuristiques), Loi de Fitts, WCAG 2.2 (2.5.8 taille de cible)

## 14. Prochaine étape

Corriger d'abord les 2 bugs du mode en ligne (points 1-2) et les quick wins. Ensuite, lancer iteration-adaptations pour les points 3 à 10, qui recoupent I2.
