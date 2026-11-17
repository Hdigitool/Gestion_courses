# Journal de construction — gestion_menu

Ce journal permet de reprendre le chantier dans une nouvelle conversation à partir de lui seul.

## Références

- Discovery Brief — Menus et courses de séjour (24 oct. 2026)
- Solution Options Brief (25 oct. 2026) : option O4, un fichier HTML local
- Solution Design Spec (25 oct. 2026) : F-01 à F-14, US-01 à US-16, RM, SEC-01 à SEC-08, ENF-01 à ENF-07, ADR-01 à ADR-10, TR-01 à TR-14
- UX/UI Spec et maquette (25 oct. 2026) : zoning B, direction Brigade, tokens, textes

## Où est quoi

- Dépôt GitHub privé : `Houssam-ALC/Gestion_courses` (nom choisi par le demandeur le 25 oct. 2026 à la place de `gestion_menu`).
- Sources : `src/` ; fichier livré : `stv/index.html` (`npm run build`).
- Tests : `npm test` (règles, sans dépendance) ; `npm run e2e` (navigateur, Playwright requis sur la machine).

## État

| Incrément | Statut | Preuve |
| --- | --- | --- |
| I1 Parcours complet | Construit, en attente de validation | 43 tests unitaires + 21 étapes e2e vertes |
| I2 Réutilisation | À faire | — |
| I3 Confort et terrain | À faire | — |

**Prochaine action** : voir la dernière entrée datée ci-dessous.

## Capacités vérifiées en premier (25 oct. 2026)

Test `file://` dans Chromium 1243 (Playwright), page avec la politique de sécurité du contenu prévue :

| Capacité | Résultat |
| --- | --- |
| Contexte sécurisé en `file://` | Oui |
| `showSaveFilePicker` / `showOpenFilePicker` (enregistrement direct) | Disponibles |
| Stockage local conservé entre deux ouvertures du même fichier | Oui |
| Requête réseau bloquée par la politique (`connect-src 'none'`) | Oui, « Failed to fetch » + violation signalée |
| Firefox | Non testable ici (navigateur absent) : repli par téléchargement à vérifier en recette |
| Import du CSV dans l'outil de courses | Non testable ici : à vérifier par le demandeur |

## Écarts et décisions

| Date | Écart | Options | Décision | Statut |
| --- | --- | --- | --- | --- |
| 2026-10-25 | Polices Barlow non intégrables : le registre npm et Google Fonts sont inaccessibles depuis l'espace de construction | a) polices système en attendant ; b) le demandeur fournit les fichiers woff2 | a) pile de repli `Barlow, "Segoe UI", system-ui` et `"Barlow Condensed", "Bahnschrift SemiCondensed", "Arial Narrow"` ; intégration dès réception des fichiers | Validé par le demandeur (25 oct. 2026) : police système conservée |
| 2026-10-25 | Contenance non validée à l'export : la Design Spec ne dit pas comment exporter la ligne si l'utilisateur continue | Traiter comme « sans conversion » (quantité exacte dans l'unité de la recette, « À vérifier », hors arrondi) | Retenu par le Builder | Validé par le demandeur (25 oct. 2026) |
| 2026-10-25 | Ligne « À vérifier » : `Total ligne (EUR)` sans sens (quantité dans l'unité de la recette) | Laisser vide | Retenu par le Builder | Validé par le demandeur (25 oct. 2026) |
| 2026-10-25 | Ligne « À vérifier » : la colonne `Unité` portait l'unité du produit (« 2300 » à côté de « 1kg », trompeur) — revue #7 | Mettre l'unité de la recette (« g ») | Retenu par le Builder | Validé par le demandeur (25 oct. 2026) |
| 2026-10-25 | Remplacer une recette dans une case remplie : la Design Spec (US-04) demande une confirmation, la UX/UI Spec (H4) demande un remplacement immédiat annulable (Ctrl+Z) avec message — revue #1 | a) remplacement immédiat + message + Ctrl+Z (UX) ; b) confirmation avant remplacement (Design Spec) | a) retenu par le demandeur (25 oct. 2026) ; à répercuter dans la Design Spec (US-04) | Tranché |
| 2026-10-25 | Recherche par ingrédient dans la bibliothèque (F-03) relève d'I2 — revue, hors périmètre | Retirer en I1 | Retirée, recherche par nom seulement | Fait |

## Propositions hors périmètre

(aucune pour l'instant)

## Revue indépendante de I1 (25 oct. 2026)

Réviseur parti de zéro, contre la Design Spec. 4 majeurs, 7 mineurs ; corrigés avec un test à chaque fois :

| # | Gravité | Problème | Correction | Preuve |
| --- | --- | --- | --- | --- |
| 1 | Majeur | Remplacement sans confirmation (contradiction Design Spec / UX Spec) | Écart à trancher (voir tableau) | — |
| 2 | Majeur | Un ingrédient présent en deux unités n'était contrôlé que pour la première | Contrôle par unité | test « Revue #2 » |
| 3 | Majeur | « 12 pièces ≈ 720 g » non affiché | Équivalence affichée sur chaque ligne et pendant la saisie | test « Revue #3 », e2e US-03/F-04 |
| 4 | Majeur | Validation JSON superficielle (fichier abîmé accepté) | Contrôle en profondeur de chaque objet | test « Revue #4 » (12 cas) |
| 5 | Mineur | Ouvrir un fichier effaçait la copie de secours | Copie gardée jusqu'au prochain enregistrement | relecture |
| 6 | Mineur | Produit devenu inactif non signalé | Statut « produit introuvable » | test « Revue #6 » |
| 7 | Mineur | Unité trompeuse sur ligne « À vérifier » | Unité de la recette | test « Revue #7 » |
| 8 | Mineur | Changement d'unité non signalé durablement | Pastille « Unité changée : avant → après » jusqu'à validation | test « Revue #8 » |
| 9 | Mineur | Repas à effectif 0 compté comme incomplet | Aucun manque pour effectif 0 | test « Revue #9 » |
| 10 | Mineur | Ctrl+Z pouvait annuler une action d'un autre séjour | Annulation limitée au séjour affiché | relecture |
| 11 | Mineur | T-SEC-01 non automatisé ; 314/251 non vérifié | T-SEC-01 automatisé (e2e) ; 314/251 à vérifier en recette avec le vrai catalogue | e2e |

Résultat après corrections : `npm test` 43/43, `npm run e2e` 21/21.

## Historique

- 2026-10-25 : chantier préparé, capacités navigateur testées.
- 2026-10-25 : I1 construit (US-01 à US-08), revue indépendante, corrections. Prochaine action : démo I1, trancher les écarts « À valider », puis I2.
- 2026-10-25 : démo I1 envoyée ; écarts tranchés. **Prochaine action : retour du demandeur après son essai (dont l'import du CSV dans l'outil de courses et Firefox), puis validation d'I1 et démarrage d'I2.**
- 2026-11-17 : **Déploiement Vercel préparé.** Le fichier livré passe de `dist/gestion-menu.html` à `stv/index.html` (seul fichier servi, Root Directory `stv`, sans build Vercel). Dossier `dist/` supprimé. Tests : 43/43 unitaires, 21/21 e2e. Le fichier ne contient aucune ressource externe. Point à trancher : ADR-01 et SEC-08 prévoient un outil local sans serveur ; la version Vercel reste sans réseau côté page (CSP inchangée), mais elle est servie en ligne. Branche `vercel-deploy` (non fusionnée dans `main`).
