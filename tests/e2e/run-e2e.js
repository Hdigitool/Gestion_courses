// Tests de bout en bout dans un vrai navigateur (Chromium via Playwright), fichier ouvert en file://.
// Lancer : npm run build && npm run e2e   (Playwright doit être installé sur la machine).
// Données fictives ou extrait de catalogue public ; aucune donnée personnelle.
'use strict';
const path = require('path');
const fs = require('fs');
const assert = require('assert/strict');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..', '..');
const PAGE = 'file://' + path.join(RACINE, 'index.html');
const FIX = path.join(RACINE, 'tests', 'fixtures');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const resultats = [];
async function etape(nom, fn) {
  try { await fn(); resultats.push(['réussi', nom]); console.log('  ✓', nom); }
  catch (e) { resultats.push(['échoué', nom, e.message]); console.log('  ✕', nom, '\n     ', e.message); }
}

(async () => {
  const navigateur = await chromium.launch();
  const ctx = await navigateur.newContext({ acceptDownloads: true, viewport: { width: 1920, height: 1080 } });
  // Les tests passent par le repli « téléchargement » (le sélecteur natif ne s'automatise pas).
  await ctx.addInitScript(() => { delete window.showSaveFilePicker; window.showSaveFilePicker = undefined; });
  const p = await ctx.newPage();
  const erreurs = [];
  p.on('pageerror', (e) => erreurs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  const capture = (nom) => p.screenshot({ path: path.join(OUT, nom + '.png'), fullPage: true });
  const onglet = (nom) => p.getByRole('tab', { name: new RegExp('^' + nom) }).click();
  const telecharge = async (action) => { const [d] = await Promise.all([p.waitForEvent('download'), action()]); const f = path.join(OUT, d.suggestedFilename()); await d.saveAs(f); return { nom: d.suggestedFilename(), texte: fs.readFileSync(f, 'utf8') }; };

  await p.goto(PAGE);
  await etape('Démarrage : écran d’accueil sans erreur', async () => {
    assert.match(await p.textContent('h1'), /Ouvrez votre fichier/);
    await capture('01-demarrage');
  });

  await etape('US-08 : nouveau fichier → menu vide', async () => {
    await p.getByRole('button', { name: 'Nouveau fichier' }).click();
    await p.getByText('Aucun séjour dans ce fichier').waitFor();
  });

  await etape('US-01 : import du catalogue avec aperçu, puis confirmation', async () => {
    await onglet('Catalogue');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Importer le catalogue' }).click()]);
    await fc.setFiles(path.join(FIX, 'catalogue-extrait.csv'));
    await p.getByText('Aperçu de l’import').waitFor();
    assert.match(await p.textContent('section.carte'), /21 produits lus, dont 19 alimentaires/);
    await capture('02-apercu-import');
    await p.getByRole('button', { name: 'Confirmer l’import' }).click();
    await p.getByText('✓ Catalogue importé').waitFor();
  });

  await etape('SEC-06 : import d’un CSV sans colonne Code refusé', async () => {
    const f = path.join(OUT, 'sans-code.csv');
    fs.writeFileSync(f, fs.readFileSync(path.join(FIX, 'catalogue-extrait.csv'), 'utf8').replace('Code;', 'Ref;'));
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Importer le catalogue' }).click()]);
    await fc.setFiles(f);
    await p.getByText('la colonne « Code » est absente').waitFor();
  });

  await etape('US-02 : contenances — illisibles en tête, saisie, format refusé, validation par lot', async () => {
    const premiere = await p.locator('tbody tr').first().textContent();
    assert.match(premiere, /À saisir/);
    await p.getByLabel('Contenance de Amlou').fill('250 g');
    await p.getByLabel('Contenance de Amlou').press('Tab');
    await p.getByLabel('Contenance de Concombre').fill('beaucoup');
    await p.getByLabel('Contenance de Concombre').press('Tab');
    await p.getByText('✕ Format non reconnu').waitFor();
    await p.getByLabel('Sélectionner toutes les contenances proposées visibles').check();
    const bouton = p.getByRole('button', { name: /Valider la sélection \(\d+\)/ });
    const n = Number((await bouton.textContent()).match(/\((\d+)\)/)[1]);
    assert.ok(n >= 12, 'au moins 12 contenances proposées sélectionnées, obtenu ' + n);
    await capture('03-contenances');
    await bouton.click();
    await p.getByText(/contenance\(s\) validée\(s\)/).waitFor();
  });

  await etape('US-03 : recette pour 10 avec erreur de quantité et conversion signalée', async () => {
    await onglet('Recettes');
    await p.getByRole('button', { name: 'Nouvelle recette' }).click();
    await p.getByLabel('Nom', { exact: true }).fill('Pâtes bolognaise'); await p.getByLabel('Nom', { exact: true }).press('Tab');
    await p.getByLabel('Nouvel ingrédient', { exact: true }).fill('Pâtes');
    await p.getByLabel('Quantité pour 10 du nouvel ingrédient').fill('0');
    await p.getByRole('button', { name: '+ Ajouter l’ingrédient' }).click();
    await p.getByText('La quantité doit être supérieure à 0').waitFor();
    await p.getByLabel('Quantité pour 10 du nouvel ingrédient').fill('1');
    await p.getByLabel('Unité du nouvel ingrédient').selectOption('kg');
    await p.getByRole('button', { name: '+ Ajouter l’ingrédient' }).click();
    await p.getByLabel('Nouvel ingrédient', { exact: true }).fill('Oignon');
    await p.getByLabel('Quantité pour 10 du nouvel ingrédient').fill('3');
    await p.getByLabel('Unité du nouvel ingrédient').selectOption('pièce');
    await p.getByRole('button', { name: '+ Ajouter l’ingrédient' }).click();
    await p.getByText('△ Aucune équivalence pièce → g').waitFor();
    await p.getByLabel('Ajouter du matériel').fill('2 marmites 20 L'); await p.getByLabel('Ajouter du matériel').press('Enter');
    await capture('04-recette');
  });

  await etape('US-03 / F-04 : équivalence ajoutée, refus même famille, conversion affichée', async () => {
    await onglet('Référentiels');
    await p.getByLabel('Ingrédient').selectOption({ label: 'Oignon' });
    await p.getByLabel('Unité d’arrivée').selectOption('kg');
    await p.getByLabel('Unité de départ').selectOption('g');
    await p.locator('[data-k="eq-qb"]').fill('1');
    await p.getByRole('button', { name: 'Ajouter une équivalence' }).click();
    await p.getByText('relie deux familles d’unités différentes').waitFor();
    await p.getByLabel('Unité de départ').selectOption('pièce');
    await p.getByLabel('Unité d’arrivée').selectOption('g');
    await p.locator('[data-k="eq-qb"]').fill('150');
    await p.getByRole('button', { name: 'Ajouter une équivalence' }).click();
    await p.getByRole('cell', { name: '1 pièce = 150 g' }).waitFor();
    await onglet('Recettes');
    await p.getByText('≈ 450 g').waitFor();
    await p.getByLabel('Nouvel ingrédient', { exact: true }).fill('Oignon');
    await p.getByLabel('Quantité pour 10 du nouvel ingrédient').fill('12');
    await p.getByLabel('Unité du nouvel ingrédient').selectOption('pièce');
    await p.getByText('≈ 1,8 kg').waitFor();
    await p.getByLabel('Nouvel ingrédient', { exact: true }).fill('');
    await p.getByLabel('Quantité pour 10 du nouvel ingrédient').fill('');
  });

  await etape('US-04 : créer un séjour et placer en chaîne', async () => {
    await onglet('Menu');
    await p.getByRole('button', { name: 'Créer un séjour' }).click();
    await p.getByLabel('Nom du séjour').fill('Jupiter été');
    await p.getByLabel('Nombre de jours').fill('3');
    await p.getByRole('button', { name: 'Créer le séjour' }).click();
    assert.equal(await p.getByRole('gridcell').count(), 12);
    await p.locator('.biblio-item', { hasText: 'Pâtes bolognaise' }).click();
    await p.locator('.biblio-item', { hasText: 'Pâtes bolognaise' }).click();
    const c1 = await p.getByRole('gridcell', { name: /^J1 Petit-déjeuner/ }).textContent();
    const c2 = await p.getByRole('gridcell', { name: /^J2 Petit-déjeuner/ }).textContent();
    assert.match(c1, /Pâtes bolognaise/); assert.match(c2, /Pâtes bolognaise/);
    assert.equal(await p.getByRole('gridcell', { name: /^J3 Petit-déjeuner/ }).getAttribute('aria-selected'), 'true');
  });

  await etape('US-04 : sélection multiple et effectif appliqué ; erreur sur effectif invalide', async () => {
    await p.getByRole('gridcell', { name: /^J1 Petit-déjeuner/ }).click();
    await p.getByRole('gridcell', { name: /^J2 Petit-déjeuner/ }).click({ modifiers: ['Shift'] });
    await p.getByRole('heading', { name: '2 cases sélectionnées' }).waitFor();
    await p.getByLabel('Effectif à appliquer').fill('vingt');
    await p.getByRole('button', { name: 'Appliquer l’effectif' }).click();
    await p.getByText('✕ Saisissez un nombre entier, par exemple 42.').waitFor();
    await p.getByLabel('Effectif à appliquer').fill('23');
    await p.getByRole('button', { name: 'Appliquer l’effectif' }).click();
    assert.match(await p.getByRole('gridcell', { name: /^J2 Petit-déjeuner/ }).textContent(), /23 pers\./);
  });

  await etape('Annuler (Ctrl+Z) dans la grille', async () => {
    await p.getByRole('gridcell', { name: /^J3 Dîner/ }).click();
    await p.locator('.biblio-item', { hasText: 'Pâtes bolognaise' }).click();
    assert.match(await p.getByRole('gridcell', { name: /^J3 Dîner/ }).textContent(), /Pâtes/);
    await p.getByRole('gridcell', { name: /^J1 Dîner/ }).focus();
    await p.keyboard.press('Control+z');
    assert.match(await p.getByRole('gridcell', { name: /^J3 Dîner/ }).textContent(), /Placer une recette/);
  });

  await etape('Clavier : flèches entre les cases (un seul arrêt de tabulation)', async () => {
    await p.getByRole('gridcell', { name: /^J1 Déjeuner/ }).click();
    await p.keyboard.press('ArrowDown');
    const actif = await p.evaluate(() => document.activeElement.getAttribute('aria-label'));
    assert.match(actif, /^J2 Déjeuner/);
    const tabs = await p.locator('[role=gridcell][tabindex="0"]').count();
    assert.equal(tabs, 1);
  });

  await etape('US-06 : compteur sur les cases et détail des manques', async () => {
    await p.getByRole('gridcell', { name: /^J1 Petit-déjeuner/ }).click();
    const panneau = await p.locator('aside.col-d').textContent();
    assert.match(panneau, /2 à compléter/);         // Pâtes non rattachées, Oignon non rattaché
    assert.match(await p.getByRole('gridcell', { name: /^J1 Petit-déjeuner/ }).textContent(), /△ 2/);
    await capture('05-menu');
  });

  await etape('US-05 : rattacher depuis le panneau du repas', async () => {
    await p.locator('aside.col-d').getByRole('button', { name: 'Rattacher' }).first().click();
    await p.getByLabel('Rechercher dans le catalogue').fill('cavatappi');
    await p.getByRole('button', { name: /BONI pâtes cavatappi/ }).click();
    await p.getByText('ALM-160 · BONI pâtes cavatappi').first().waitFor();
    await capture('06-ingredients');
  });

  await etape('US-07 : export avec alerte, « Revenir » sélectionne le premier repas incomplet', async () => {
    await p.getByRole('button', { name: 'Exporter la liste de courses' }).click();
    await p.getByText('élément(s) incomplet(s)').waitFor();
    await capture('07-export-alerte');
    await p.getByRole('button', { name: 'Revenir et compléter' }).click();
    assert.equal(await p.getByRole('gridcell', { name: /^J1 Petit-déjeuner/ }).getAttribute('aria-selected'), 'true');
  });

  await etape('US-07 : export quand même → CSV au format exact, quantités réparties sur le total', async () => {
    await p.getByRole('button', { name: 'Exporter la liste de courses' }).click();
    const { nom, texte } = await telecharge(() => p.getByRole('button', { name: 'Exporter quand même' }).click());
    assert.match(nom, /^liste-courses_jupiter-ete_\d{4}-\d{2}-\d{2}\.csv$/);
    const l = texte.split('\r\n');
    assert.equal(l[0], 'Code;Article;Marque;Magasin;Quantité;Unité;Prix unitaire (EUR);Total ligne (EUR);Destination;Activité;À commander;Fiche produit');
    // 1 kg pour 10 × 23 = 2,3 kg par repas, contenance 500 g : total 9,2 → 10 paquets, répartis 5 et 5.
    assert.match(l[1], /^ALM-160;BONI pâtes cavatappi;Boni Selection;Colruyt;5;500g;1,79;8,95;Petit-déjeuner;J1;Gros achat;https:/);
    assert.match(l[2], /;5;500g;1,79;8,95;Petit-déjeuner;J2;Gros achat;/);
    assert.equal(l.length, 4); // en-tête + 2 lignes + fin de fichier
    assert.ok(!texte.startsWith('﻿'));
  });

  let json;
  await etape('US-08 : enregistrer → fichier daté, état « Enregistré »', async () => {
    const r = await telecharge(() => p.getByRole('button', { name: 'Enregistrer' }).click());
    assert.match(r.nom, /^menus_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
    json = path.join(OUT, r.nom);
    assert.equal(JSON.parse(r.texte).version, 1);
    await p.getByText(/✓ Enregistré à \d{2}:\d{2}/).waitFor();
  });

  await etape('SEC-02 : copie de secours proposée après fermeture sans enregistrer', async () => {
    await p.getByRole('gridcell', { name: /^J3 Déjeuner/ }).click();
    await p.locator('.biblio-item', { hasText: 'Pâtes bolognaise' }).click();
    let typeDialogue = null;
    p.once('dialog', (d) => { typeDialogue = d.type(); d.accept(); });
    await p.reload();
    assert.equal(typeDialogue, 'beforeunload'); // T-SEC-01 : avertissement à la fermeture
    await p.getByText('Travail non enregistré retrouvé').waitFor();
    await capture('08-reprise');
    await p.getByRole('button', { name: 'Reprendre la copie' }).click();
    assert.match(await p.getByRole('gridcell', { name: /^J3 Déjeuner/ }).textContent(), /Pâtes/);
    await p.getByText('● Non enregistré').waitFor();
  });

  await etape('US-08 / SEC-05 : rouvrir le fichier enregistré ; fichier invalide refusé sans perte', async () => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), (async () => {
      await p.getByRole('button', { name: 'Ouvrir', exact: true }).click();
      await p.getByRole('button', { name: 'Ouvrir quand même' }).click();
    })()]);
    await fc.setFiles(json);
    await p.getByText(/Fichier ouvert : menus_/).waitFor();
    assert.match(await p.getByRole('gridcell', { name: /^J3 Déjeuner/ }).textContent(), /Placer une recette/);
    const faux = path.join(OUT, 'menus_ancien.json');
    fs.writeFileSync(faux, JSON.stringify({ format: 'gestion-menu', version: 0 }));
    const [fc2] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Ouvrir', exact: true }).click()]);
    await fc2.setFiles(faux);
    await p.getByText('son format (version 0) n’est pas reconnu').waitFor();
    assert.match(await p.getByRole('gridcell', { name: /^J1 Petit-déjeuner/ }).textContent(), /Pâtes/);
  });

  await etape('SEC-04 : un nom de produit piégé s’affiche en texte, aucun script exécuté', async () => {
    const f = path.join(OUT, 'piege.csv');
    fs.writeFileSync(f, fs.readFileSync(path.join(FIX, 'catalogue-extrait.csv'), 'utf8') +
      'ALM-666;<img src=x onerror="window.__pirate=1">;;Conserves;400g;1;Colruyt;javascript:alert(1);Validé;Oui\r\n');
    await onglet('Catalogue');
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.getByRole('button', { name: 'Importer le catalogue' }).click()]);
    await fc.setFiles(f);
    await p.getByRole('button', { name: 'Confirmer l’import' }).click();
    await p.getByText('<img src=x onerror="window.__pirate=1">').first().waitFor();
    assert.equal(await p.evaluate(() => window.__pirate), undefined);
    assert.equal(await p.locator('main img').count(), 0);
    assert.equal(await p.locator('a[href^="javascript"]').count(), 0);
  });

  await etape('SEC-08 : aucune requête réseau possible', async () => {
    const r = await p.evaluate(() => fetch('https://example.com').then(() => 'autorisé').catch(() => 'bloqué'));
    assert.equal(r, 'bloqué');
  });

  await etape('Audit UX : produit choisi dans la recette, repris dans un nouveau séjour', async () => {
    await onglet('Recettes');
    await p.locator('.biblio-item', { hasText: 'Pâtes bolognaise' }).click();
    const idOi = await p.evaluate(() => GM_app.app.etat.ingredients.find((i) => i.nom === 'Oignon').id);
    await p.locator('[data-k="prod-' + idOi + '"]').click();
    await p.getByLabel('Rechercher dans le catalogue').fill('carott');
    await p.locator('.fenetre .produit-item').first().click();
    await p.getByText(/Produit retenu : Oignon/).waitFor();
    await onglet('Menu');
    await p.locator('details.menu-plus summary').click();
    await p.getByRole('button', { name: 'Nouveau séjour' }).click();
    await p.getByLabel('Nom du séjour').fill('Hiver test');
    await p.getByLabel('Nombre de jours').fill('2');
    await p.getByLabel('Effectif par défaut (facultatif)').fill('30');
    await p.getByRole('button', { name: 'Créer le séjour' }).click();
    // Clavier : Entrée → recherche → Entrée place la 1re recette et revient sur la case suivante.
    await p.keyboard.press('Enter');
    await p.keyboard.type('bolo');
    await p.keyboard.press('Enter');
    assert.match(await p.getByRole('gridcell', { name: /^J1 Petit-déjeuner/ }).textContent(), /Pâtes bolognaise[\s\S]*30 pers\./);
    assert.equal(await p.inputValue('[data-k="biblio-q"]'), '');
    const st = await p.evaluate(() => { const a = GM_app.app; const s = a.etat.sejours.find((x) => x.nom === 'Hiver test'); const oi = a.etat.ingredients.find((i) => i.nom === 'Oignon'); return s.rattachements[oi.id] || null; });
    assert.ok(st, 'Oignon pré-rattaché dans le nouveau séjour');
  });

  await etape('Audit UX : sélection d’un moment entier par l’en-tête', async () => {
    await p.getByRole('button', { name: 'Sélectionner tous les Dîner' }).click();
    await p.getByRole('heading', { name: '2 cases sélectionnées' }).waitFor();
  });

  await etape('Audit UX : coller des lignes depuis Excel dans la recette', async () => {
    await onglet('Recettes');
    await p.locator('[data-k="nl-ing"]').focus();
    await p.evaluate(() => { const el = document.activeElement; const dt = new DataTransfer(); dt.setData('text/plain', 'Ail\t2\tpc\nPersil\t50\tg\nSel\tbeaucoup\t'); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    await p.getByText('quantité illisible').waitFor();
    await p.getByRole('button', { name: 'Ajouter 2 ingrédients' }).click();
    await p.getByText('2 ingrédients ajouté(s)').waitFor();
    await p.locator('[data-k="annuler"]').click();
    await p.getByText(/Annulé : coller/).waitFor();
  });

  await etape('Aucune erreur JavaScript pendant le parcours', async () => {
    assert.deepEqual(erreurs.filter((e) => !/Content Security Policy|Failed to fetch|net::ERR/.test(e)), []);
  });

  await navigateur.close();
  const echecs = resultats.filter((r) => r[0] === 'échoué');
  console.log('\n' + (resultats.length - echecs.length) + ' / ' + resultats.length + ' étapes réussies');
  fs.writeFileSync(path.join(OUT, 'resultats.json'), JSON.stringify({ date: new Date().toISOString(), resultats }, null, 2));
  process.exit(echecs.length ? 1 : 0);
})();
