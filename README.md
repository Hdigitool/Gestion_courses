# gestion_menu — Menus de séjour et liste de courses

Un seul fichier HTML, sans serveur ni Internet, pour composer le menu d'un séjour à partir de recettes pour 10 personnes, et exporter la liste de courses au format de l'outil de courses.

- **Utiliser l'outil** : ouvrir `dist/gestion-menu.html` dans Chrome, Edge ou Firefox. Les données sont dans un fichier `.json` que vous ouvrez et enregistrez vous-même.
- **Spécifications** : `docs/specs/` (Discovery Brief, Options Brief, Design Spec, UX/UI Spec).
- **Suivi du chantier** : `JOURNAL-DE-CONSTRUCTION.md`.

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
