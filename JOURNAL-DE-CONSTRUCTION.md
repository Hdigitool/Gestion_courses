# Journal de construction — gestion_menu

Ce journal permet de reprendre le chantier dans une nouvelle conversation à partir de lui seul.

## Références

- Discovery Brief — Menus et courses de séjour (24 oct. 2026)
- Solution Options Brief (25 oct. 2026) : option O4, un fichier HTML local
- Solution Design Spec (25 oct. 2026) : F-01 à F-14, US-01 à US-16, RM, SEC-01 à SEC-08, ENF-01 à ENF-07, ADR-01 à ADR-10, TR-01 à TR-14
- UX/UI Spec et maquette (25 oct. 2026) : zoning B, direction Brigade, tokens, textes

## Où est quoi

- Dépôt GitHub privé : `Houssam-ALC/Gestion_courses` (nom choisi par le demandeur le 25 oct. 2026 à la place de `gestion_menu`).
- Sources : `src/` ; fichier livré : `dist/gestion-menu.html` (`npm run build`).
- Tests : `npm test` (règles, sans dépendance) ; `npm run e2e` (navigateur, Playwright requis sur la machine).

## État

| Incrément | Statut | Preuve |
| --- | --- | --- |
| I1 Parcours complet | En cours | — |
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
| 2026-10-25 | Polices Barlow non intégrables : le registre npm et Google Fonts sont inaccessibles depuis l'espace de construction | a) polices système en attendant ; b) le demandeur fournit les fichiers woff2 | a) pile de repli `Barlow, "Segoe UI", system-ui` et `"Barlow Condensed", "Bahnschrift SemiCondensed", "Arial Narrow"` ; intégration dès réception des fichiers | À valider en démo I1 |
| 2026-10-25 | Contenance non validée à l'export : la Design Spec ne dit pas comment exporter la ligne si l'utilisateur continue | Traiter comme « sans conversion » (quantité exacte dans l'unité de la recette, « À vérifier », hors arrondi) | Retenu par le Builder | À valider en démo I1 |
| 2026-10-25 | Ligne « À vérifier » : `Total ligne (EUR)` sans sens (quantité dans l'unité de la recette) | Laisser vide | Retenu par le Builder | À valider en démo I1 |

## Propositions hors périmètre

(aucune pour l'instant)

## Historique

- 2026-10-25 : chantier préparé, capacités navigateur testées.
