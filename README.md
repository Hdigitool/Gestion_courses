# gestion_menu — Menus de séjour et liste de courses

Un seul fichier HTML, sans serveur ni Internet, pour composer le menu d'un séjour à partir de recettes pour 10 personnes, et exporter la liste de courses au format de l'outil de courses.

- **Utiliser l'outil** : ouvrir `dist/gestion-menu.html` dans Chrome, Edge ou Firefox. Les données sont dans un fichier `.json` que vous ouvrez et enregistrez vous-même.
- **Spécifications** : `docs/specs/` (Discovery Brief, Options Brief, Design Spec, UX/UI Spec).
- **Suivi du chantier** : `JOURNAL-DE-CONSTRUCTION.md`.

## Reprendre le projet (à lire en premier)

1. `JOURNAL-DE-CONSTRUCTION.md` : état du projet, décisions, prochaine étape.
2. `docs/specs/3-solution-design-spec.md` : la référence pour coder (données, règles, stories US-01 à US-16, tests TR-xx, sécurité).
3. `docs/specs/4-ux-ui-spec.md` : écrans, états, textes, couleurs. Captures de l'outil actuel : `docs/captures/`.

**Fichiers**
- `src/rules.js` : calculs (le cœur) · `src/csv.js` : import/export · `src/format.js` : fichier de données JSON · `src/ui.js` + `src/styles.css` : interface.
- `build.js` → génère `dist/gestion-menu.html`, le fichier qu'on utilise.
- `tests/` : 43 tests de règles (`npm test`), parcours navigateur (`npm run e2e`).

**Ce qu'il reste à faire**
1. Tester l'import de l'export CSV dans l'outil de courses, et l'outil dans Firefox.
2. Construire I2 : variantes de recettes, recherche, duplication de séjour (US-09 à US-12).
3. Construire I3 : vue des besoins, fiche repas imprimable, réglage de l'arrondi (US-13 à US-16).
4. Écrire les guides et la documentation finale.

## Pour développer

```bash
npm test          # tests des règles et du format (Node 18+, aucune dépendance)
npm run build     # assemble src/ en dist/gestion-menu.html
npm run e2e       # parcours complet dans Chromium (Playwright doit être installé)
```

| Dossier | Contenu |
| --- | --- |
| `src/format.js` | Format des données JSON (version 1), validation, migration |
| `src/rules.js` | Règles et calculs (fonctions pures) : besoins, conversions, arrondi, répartition, manques, export |
| `src/csv.js` | Import du catalogue, export de la liste de courses |
| `src/ui.js`, `src/styles.css` | Interface (tokens de design en variables CSS) |
| `tests/` | Tests unitaires (`*.test.js`), parcours navigateur (`e2e/`), données de test (`fixtures/`) |
