// Assemble les sources de src/ en un seul fichier autonome : stv/index.html.
// Pourquoi : la solution retenue (ADR-01, Options Brief O4) est un fichier HTML unique,
// ouvert depuis le disque, sans serveur ni ressource Internet (SEC-08).
// Aucune dépendance : uniquement les modules natifs de Node.
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

// Ordre important : format puis règles puis CSV puis interface.
const scripts = ['format.js', 'rules.js', 'csv.js', 'ui.js'];

let html = read('index.template.html');
html = html.replace('/*__STYLES__*/', () => read('styles.css'));
html = html.replace('/*__SCRIPTS__*/', () =>
  scripts.map((f) => `\n// ===== ${f} =====\n` + read(f).replace(/<\/script/gi, '<\\/script')).join('\n'));

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
html = html.replace(/__VERSION__/g, pkg.version);

fs.mkdirSync(path.join(__dirname, 'stv'), { recursive: true });
const out = path.join(__dirname, 'stv', 'index.html');
fs.writeFileSync(out, html);
console.log('Construit :', path.relative(__dirname, out), '(' + Math.round(html.length / 1024) + ' Ko)');
