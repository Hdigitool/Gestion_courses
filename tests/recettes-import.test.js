// Import de recettes par modèle Excel : aller-retour du modèle, contrôles, application.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const X = require('../src/xlsx.js');
const F = require('../src/format.js');
const RI = require('../src/recettes-import.js');
const R = require('../src/rules.js');

const enc = (t) => new Uint8Array(Buffer.from(t, 'utf8'));
const ENTETES = {
  Recettes: [['Nom de la recette']],
  Lignes: [['Recette', 'Ingrédient', 'Quantité pour 10', 'Unité']],
  Matériel: [['Recette', 'Matériel']]
};

// Feuilles telles qu'écrites dans un modèle : en-têtes + lignes saisies.
function classeurDeTest(saisies) {
  const f = Object.assign({ Recettes: [], Lignes: [], Matériel: [] }, saisies);
  return ['Recettes', 'Lignes', 'Matériel'].map((n) => ({ nom: n, lignes: ENTETES[n].concat(f[n]) }));
}
// Octets d'un classeur, puis relecture par le même chemin que l'import.
async function lireSaisies(saisies, etat) {
  const octets = X.ecrireClasseur(classeurDeTest(saisies));
  return RI.lireRecettes(octets, etat || F.nouvelEtat(), R.UNITES);
}
const etatVide = () => F.nouvelEtat();

test('XLSX : aller-retour d’un classeur avec accents, esperluette et cellules vides', async () => {
  const octets = X.ecrireClasseur([{ nom: 'Données & « test »', lignes: [['Nom', 'Qté'], ['Crêpe <3', '2,5'], ['', 'x']] }]);
  const lu = await X.lireClasseur(octets);
  assert.deepStrictEqual(lu['Données & « test »'], [['Nom', 'Qté'], ['Crêpe <3', '2,5'], ['', 'x']]);
});

test('Modèle : quatre feuilles, en-têtes exacts, listes d’unités et de recettes', async () => {
  const octets = RI.modeleRecettes(R.UNITES);
  const lu = await X.lireClasseur(octets);
  assert.deepStrictEqual(Object.keys(lu), ['Lisez-moi', 'Recettes', 'Lignes', 'Matériel']);
  assert.deepStrictEqual(lu.Lignes[0], ENTETES.Lignes[0]);
  assert.deepStrictEqual(lu.Recettes[0], ENTETES.Recettes[0]);
  // La liste des unités et la plage des recettes sont bien dans les contrôles de saisie.
  const xml = await zipTexte(octets, 'xl/worksheets/sheet3.xml');
  assert.ok(xml.includes('<formula1>&quot;g,kg,ml,cl,l,pièce&quot;</formula1>'), 'liste des unités');
  assert.ok(xml.includes('<formula1>Recettes!$A$2:$A$300</formula1>'), 'liste des recettes');
  assert.ok(xml.includes('type="decimal" operator="greaterThan"'), 'quantité > 0');
});

// Lit un fichier interne du classeur écrit sans compression (XML brut des contrôles).
function zipTexte(octets, nom) {
  const buf = Buffer.from(octets);
  let pos = 0;
  while ((pos = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]), pos)) >= 0) {
    const nomLong = buf.readUInt16LE(pos + 26);
    const nomFichier = buf.toString('utf8', pos + 30, pos + 30 + nomLong);
    if (nomFichier === nom) {
      const taille = buf.readUInt32LE(pos + 18);
      return Promise.resolve(buf.toString('utf8', pos + 30 + nomLong, pos + 30 + nomLong + taille));
    }
    pos += 4;
  }
  return Promise.reject(new Error('fichier absent : ' + nom));
}

test('Import valide : recettes, ingrédient rattaché ou créé, matériel', async () => {
  const etat = etatVide();
  etat.ingredients.push({ id: 'ing-c', nom: 'carotte', dernierProduit: null });
  const r = await lireSaisies({
    Recettes: [['Soupe'], ['Pâtes']],
    Lignes: [['Soupe', 'Carotte', '1,5', 'kg'], ['Soupe', 'Oignon', '2', 'pièce'], ['Pâtes', 'Pâtes', '500', 'g'], ['Pâtes', 'Carotte', '100', 'g']],
    Matériel: [['Soupe', 'Grande casserole']]
  }, etat);
  assert.strictEqual(r.ok, true, JSON.stringify(r.erreurs));
  assert.strictEqual(r.recettes.length, 2);
  assert.deepStrictEqual(r.recettes[0].lignes[0], { ingredient: 'Carotte', quantite: 1.5, unite: 'kg' });
  assert.deepStrictEqual(r.recettes[0].materiel, ['Grande casserole']);

  const bilan = RI.appliquerRecettes(etat, r.recettes);
  assert.deepStrictEqual(bilan, { recettes: 2, lignes: 4 });
  assert.strictEqual(etat.recettes.length, 2);
  // « Carotte » rattachée à l’ingrédient existant (casse ignorée), pas recréée.
  assert.strictEqual(etat.recettes[0].lignes[0].ingredientId, 'ing-c');
  assert.strictEqual(etat.ingredients.length, 3); // carotte, oignon, pâtes
});

test('Refus : quantité nulle, unité inconnue, doublon, recette absente', async () => {
  const r = await lireSaisies({
    Recettes: [['Soupe']],
    Lignes: [
      ['Soupe', 'Carotte', '0', 'g'],
      ['Soupe', 'Oignon', '2', 'tasse'],
      ['Soupe', 'Sel', '1', 'g'],
      ['Soupe', 'sel', '2', 'G'],
      ['Autre', 'Sel', '1', 'g']
    ]
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.erreurs.length, 4);
  assert.match(r.erreurs[0], /ligne 2 : la quantité/);
  assert.match(r.erreurs[1], /ligne 3 : unité « tasse » inconnue/);
  assert.match(r.erreurs[2], /ligne 5 : « sel » figure déjà/);
  assert.match(r.erreurs[3], /ligne 6 : la recette « Autre »/);
});

test('Refus : nom déjà présent dans l’outil, ou en double dans le fichier', async () => {
  const etat = etatVide();
  etat.recettes.push({ id: 'r1', nom: 'Soupe', etiquettes: [], materiel: [], origineId: null, lignes: [] });
  const r = await lireSaisies({ Recettes: [['soupe'], ['Tarte'], ['Tarte']] }, etat);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.erreurs.length, 2);
  assert.match(r.erreurs[0], /existe déjà dans l’outil/);
  assert.match(r.erreurs[1], /en double/);
});

test('Refus : fichier qui n’est pas un modèle, en-têtes modifiés', async () => {
  const bidon = await RI.lireRecettes(enc('pas un zip'), etatVide(), R.UNITES);
  assert.strictEqual(bidon.ok, false);
  assert.match(bidon.erreurs[0], /pas un modèle Excel/);

  const octets = X.ecrireClasseur([{ nom: 'Recettes', lignes: ENTETES.Recettes }]);
  const sansFeuille = await RI.lireRecettes(octets, etatVide(), R.UNITES);
  assert.match(sansFeuille.erreurs[0], /« Lignes » est absente/);

  const modifie = classeurDeTest({});
  modifie[1].lignes = [['Recette', 'Ingredient', 'Quantité', 'Unité']];
  const r2 = await RI.lireRecettes(X.ecrireClasseur(modifie), etatVide(), R.UNITES);
  assert.match(r2.erreurs[0], /En-têtes modifiés dans la feuille « Lignes »/);
});

test('Les lignes entièrement vides sont ignorées', async () => {
  const r = await lireSaisies({ Recettes: [['Soupe'], [''], ['']], Lignes: [['Soupe', 'Carotte', '1', 'g'], ['', '', '', '']] });
  assert.strictEqual(r.ok, true, JSON.stringify(r.erreurs));
  assert.strictEqual(r.recettes.length, 1);
  assert.strictEqual(r.recettes[0].lignes.length, 1);
});
