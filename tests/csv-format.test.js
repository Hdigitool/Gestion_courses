// Tests de l'import catalogue, de l'export CSV et du format JSON (contrat d'interface, SEC-05 à SEC-07).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../src/csv.js');
const F = require('../src/format.js');
const R = require('../src/rules.js');
const H = require('./helpers.js');

const FIX = fs.readFileSync(path.join(__dirname, 'fixtures', 'catalogue-extrait.csv'), 'utf8');

test('US-01 : lecture du catalogue fourni (BOM, ;, CRLF, virgule décimale)', () => {
  const r = C.lireCatalogue(FIX);
  assert.equal(r.ok, true, r.erreur);
  assert.equal(r.produits.length, 21);
  const beurre = r.produits.find((p) => p.code === 'ALM-133');
  assert.equal(beurre.prix, 1.89);
  assert.equal(beurre.unite, '250g');
  assert.equal(beurre.sousCategorie, 'Frais (crèmerie, fromages)');
  assert.equal(r.produits.filter(R.estRattachable).length, 19);
});

test('SEC-06 : colonne manquante → refus nommant la colonne', () => {
  const sansCode = FIX.replace('﻿Code;', '﻿Ref;');
  const r = C.lireCatalogue(sansCode);
  assert.equal(r.ok, false);
  assert.match(r.erreur, /« Code »/);
});

test('SEC-06 : code en double → refus nommant le code', () => {
  const lignes = FIX.split('\r\n');
  const r = C.lireCatalogue(lignes.concat([lignes[3]]).join('\r\n'));
  assert.equal(r.ok, false);
  assert.match(r.erreur, /ALM-133/);
});

test('CSV : guillemets, point-virgule et retour à la ligne dans un champ', () => {
  const rows = C.parser('a;b\r\n"x;y";"il dit ""oui""\nfin"\r\n');
  assert.deepEqual(rows, [['a', 'b'], ['x;y', 'il dit "oui"\nfin']]);
  // Un guillemet au milieu d'un champ non cité reste un caractère ordinaire.
  assert.deepEqual(C.parser('<img onerror="x">;b\r\n'), [['<img onerror="x">', 'b']]);
});

test('US-01 : comparaison d’imports (ajoutés, modifiés, unité changée, absents)', () => {
  const avant = C.lireCatalogue(FIX).produits.map((p) => Object.assign(p, { contenance: { q: 1, u: 'kg' }, contenanceValidee: true, present: true }));
  let texte = FIX.replace('ALM-133;BONI beurre de laiterie doux;Boni Selection;Frais (crèmerie, fromages);250g;1,89',
    'ALM-133;BONI beurre de laiterie doux;Boni Selection;Frais (crèmerie, fromages);500g;3,49');
  texte = texte.replace(/ALM-147;[^\r]*\r\n/, '');
  texte = texte + 'ALM-999;Nouveau produit;;Conserves;400g;1;Colruyt;;Validé;Oui\r\n';
  const imp = C.lireCatalogue(texte);
  const d = C.comparerCatalogue(avant, imp.produits);
  assert.deepEqual(d.ajoutes.map((p) => p.code), ['ALM-999']);
  assert.ok(d.modifies.some((p) => p.code === 'ALM-133'));
  assert.deepEqual(d.uniteChangee.map((p) => p.code), ['ALM-133']);
  assert.deepEqual(d.absents.map((p) => p.code), ['ALM-147']);
  const e = F.nouvelEtat(); e.produits = avant;
  const apres = C.appliquerCatalogue(e, imp.produits, new Date('2026-10-25T10:00:00Z'));
  const beurre = apres.produits.find((p) => p.code === 'ALM-133');
  assert.equal(beurre.contenanceValidee, false);          // validation retirée
  assert.deepEqual(beurre.contenance, { q: 500, u: 'g' });  // nouvelle proposition
  const sucre = apres.produits.find((p) => p.code === 'ALM-147');
  assert.equal(sucre.present, false);                      // jamais supprimé
  const pates = apres.produits.find((p) => p.code === 'ALM-160');
  assert.equal(pates.contenanceValidee, true);              // contenance validée conservée
});

test('Import : nouvelles sous-catégories ajoutées avec le statut frais par défaut (ADR-08)', () => {
  const e = F.nouvelEtat();
  const apres = C.appliquerCatalogue(e, C.lireCatalogue(FIX).produits, new Date());
  const sc = Object.fromEntries(apres.sousCategories.map((s) => [s.nom, s.frais]));
  assert.equal(sc['Fruits & légumes'], true);
  assert.equal(sc['Frais (crèmerie, fromages)'], true);
  assert.equal(sc['Conserves'], false);
});

test('SEC-07 : neutralisation des formules à l’export, nombres intacts', () => {
  assert.equal(C.neutraliser('=HYPERLINK("http://x")'), '\'=HYPERLINK("http://x")');
  assert.equal(C.neutraliser('+33'), '\'+33');
  assert.equal(C.neutraliser('@SUM(A1)'), '\'@SUM(A1)');
  assert.equal(C.neutraliser('\tx'), '\'\tx');
  assert.equal(C.neutraliser('-5'), '-5');
  assert.equal(C.neutraliser('ALM-002'), 'ALM-002');
});

test('Contrat d’export : en-têtes, ordre, UTF-8 sans BOM, ;, CRLF, virgule décimale', () => {
  const e = H.etatDeBase({ nbJours: 1, moments: ['Dîner'] });
  e.produits = [H.produit('ALM-002', 'BONI pâte à tartiner', '750g', 1.99, '', { q: 750, u: 'g' }, { marque: 'Boni Selection', fiche: 'https://www.colruyt.be/fr/produits/15260' })];
  H.ajouterIngredient(e, 'pat', 'Pâte à tartiner');
  H.ajouterRecette(e, 'r', 'Tartines', [['pat', 1500, 'g']]);
  H.rattacher(e, 'pat', 'ALM-002');
  H.placer(e, 1, 'm1', 'r', 40); // 6000 g → 8 pots
  const csv = C.exporterCSV(R.calculerExport(e, 's1').lignes);
  assert.ok(!csv.startsWith('﻿'));
  const lignes = csv.split('\r\n');
  assert.equal(lignes[0], 'Code;Article;Marque;Magasin;Quantité;Unité;Prix unitaire (EUR);Total ligne (EUR);Destination;Activité;À commander;Fiche produit');
  assert.equal(lignes[1], 'ALM-002;BONI pâte à tartiner;Boni Selection;Colruyt;8;750g;1,99;15,92;Dîner;J1;Gros achat;https://www.colruyt.be/fr/produits/15260');
});

test('SEC-05 : JSON valide accepté, corrompu ou d’une autre version refusé', () => {
  const e = F.nouvelEtat();
  const ok = F.lire(F.serialiser(e));
  assert.equal(ok.ok, true);
  assert.equal(F.lire('{"format":"gestion-menu",').ok, false);
  const v0 = F.lire(JSON.stringify({ format: 'gestion-menu', version: 0 }));
  assert.equal(v0.ok, false); assert.match(v0.erreur, /version 0/);
  const v9 = F.lire(JSON.stringify(Object.assign(F.nouvelEtat(), { version: 9 })));
  assert.equal(v9.ok, false);
  assert.equal(F.lire(JSON.stringify({ format: 'autre', version: 1 })).ok, false);
  const casse = JSON.parse(F.serialiser(e)); casse.recettes = 'x';
  assert.equal(F.lire(JSON.stringify(casse)).ok, false);
});

test('SEC-03 : nom de fichier daté proposé', () => {
  assert.equal(F.nomFichier(new Date(2026, 9, 25, 21, 58)), 'menus_2026-10-25_2158.json');
});

test('Sauvegarde puis relecture : état identique (aller-retour)', () => {
  const e = H.etatDeBase();
  H.ajouterIngredient(e, 'pates', 'Pâtes');
  H.ajouterRecette(e, 'r', 'Pâtes', [['pates', 1, 'kg']]);
  H.placer(e, 1, 'm1', 'r', 42);
  const relu = F.lire(F.serialiser(e));
  assert.equal(relu.ok, true);
  delete relu.etat.enregistreLe; const copie = JSON.parse(F.serialiser(e)); delete copie.enregistreLe;
  assert.deepEqual(relu.etat, copie);
});

test('Revue #4 / SEC-05 : validation en profondeur, refus sans planter', () => {
  const base = () => {
    const e = H.etatDeBase(); H.ajouterIngredient(e, 'p', 'Pâtes'); H.ajouterRecette(e, 'r', 'Pâtes', [['p', 1, 'kg']]); H.placer(e, 1, 'm1', 'r', 10);
    return JSON.parse(F.serialiser(e));
  };
  const casse = [
    (o) => { o.sejours[0].rattachements = null; },
    (o) => { o.sejours[0].moments = [null]; },
    (o) => { o.sejours[0].nbJours = 10000000; },
    (o) => { o.sejours[0].repas[0].jour = 9; },
    (o) => { o.sejours[0].repas[0].effectif = -3; },
    (o) => { o.recettes[0].lignes[0].unite = 'tonne'; },
    (o) => { o.recettes[0].lignes[0].quantite = 0; },
    (o) => { o.recettes[0].materiel = 'casserole'; },
    (o) => { o.ingredients[0] = { id: 'p' }; },
    (o) => { o.equivalences.push({ id: 'x', ingredientId: 'p', qA: 1, uA: 'pièce', qB: -1, uB: 'g' }); },
    (o) => { o.produits.push({ code: 'ALM-1', contenance: { q: 0, u: 'g' } }); },
    (o) => { o.sousCategories.push({ nom: 3, frais: true }); }
  ];
  assert.equal(F.lire(JSON.stringify(base())).ok, true);
  casse.forEach((f, i) => { const o = base(); f(o); assert.equal(F.lire(JSON.stringify(o)).ok, false, 'cas ' + i); });
});

test('Revue #8 : un changement d’unité à l’import reste signalé jusqu’à validation', () => {
  const avant = C.lireCatalogue(FIX).produits.map((p) => Object.assign(p, { contenance: { q: 250, u: 'g' }, contenanceValidee: true, present: true }));
  const imp = C.lireCatalogue(FIX.replace(';250g;1,89', ';500g;3,49'));
  const e = F.nouvelEtat(); e.produits = avant;
  const beurre = C.appliquerCatalogue(e, imp.produits, new Date()).produits.find((p) => p.code === 'ALM-133');
  assert.equal(beurre.ancienneUnite, '250g');
});
