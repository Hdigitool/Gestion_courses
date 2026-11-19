// Tests des règles et calculs — jeu de tests de référence de la Design Spec (TR-01 à TR-14)
// et table des contenances. Écrits avant les règles (principe « tests d'abord »).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/rules.js');
const H = require('./helpers.js');

const proche = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('TR-01 RM-01 : 1 kg pour 10, effectif 23 → 2,3 kg', () => {
  proche(R.besoinRepas(1, 23), 2.3);
});

test('RM-09 : conversions génériques au sein d’une famille', () => {
  proche(R.convertir(250, 'g', 'kg', []), 0.25);
  proche(R.convertir(1.5, 'l', 'cl', []), 150);
  proche(R.convertir(200, 'cl', 'ml', []), 2000);
  assert.equal(R.convertir(3, 'pièce', 'g', []), null);
});

test('RM-09 : équivalence d’ingrédient, dans les deux sens', () => {
  const eq = [{ qA: 1, uA: 'pièce', qB: 150, uB: 'g' }];
  proche(R.convertir(6, 'pièce', 'kg', eq), 0.9);
  proche(R.convertir(300, 'g', 'pièce', eq), 2);
});

test('TR-05 RM-05 : total 2,05 kg, contenance 1 kg', () => {
  assert.equal(R.arrondirTotal(2.05, 1, 0), 3);
  assert.equal(R.arrondirTotal(2.05, 1, 5), 2);
});

test('TR-06 RM-05 : un multiple exact n’est pas arrondi au-dessus', () => {
  assert.equal(R.arrondirTotal(3, 1, 0), 3);
  assert.equal(R.arrondirTotal(0.3 + 0.6 + 0.1, 0.5, 0), 2); // bruit flottant
  assert.equal(R.arrondirTotal(0, 1, 0), 0);
});

test('TR-07 répartition : 2,3 + 1,4 kg → 4 réparti 2 et 2', () => {
  assert.deepEqual(R.repartir(4, [2.3, 1.4]), [2, 2]);
});
test('TR-08 répartition : 0,8 + 8,7 kg → 10 réparti 1 et 9', () => {
  assert.deepEqual(R.repartir(R.arrondirTotal(9.5, 1, 0), [0.8, 8.7]), [1, 9]);
});
test('TR-09 répartition : lignes à 0 conservées', () => {
  assert.deepEqual(R.repartir(R.arrondirTotal(0.54, 1, 0), [0.02, 0.02, 0.5]), [0, 0, 1]);
});
test('TR-10 répartition : égalité → ordre chronologique', () => {
  assert.deepEqual(R.repartir(1, [0.5, 0.5]), [1, 0]);
});
test('Répartition : la somme vaut toujours le total', () => {
  const b = [0.33, 1.71, 2.9, 0.05, 4.4];
  const t = R.arrondirTotal(b.reduce((a, x) => a + x, 0), 1, 0);
  assert.equal(R.repartir(t, b).reduce((a, x) => a + x, 0), t);
});

test('Contenance proposée depuis la colonne Unité', () => {
  const cas = {
    '500g': [500, 'g'], '1,5L': [1.5, 'l'], '10x20cl': [200, 'cl'], 'caisse 8 kg': [8, 'kg'],
    '±1kg': [1, 'kg'], '10pc': [10, 'pièce'], 'pqt de 100': [100, 'pièce'], '200 g': [200, 'g'],
    '8x23g': [184, 'g'], '10x55ml': [550, 'ml'], '1,5kg': [1.5, 'kg'], 'sac 5 kg': [5, 'kg']
  };
  for (const [txt, [q, u]] of Object.entries(cas)) {
    const c = R.proposerContenance(txt);
    assert.ok(c, 'aucune proposition pour ' + txt);
    proche(c.q, q); assert.equal(c.u, u, txt);
  }
  for (const txt of ['unité', 'rouleau', 'kg', '', '100']) assert.equal(R.proposerContenance(txt), null, txt);
});

test('Contenance saisie : formats acceptés et refusés', () => {
  assert.deepEqual(R.lireContenance('500 g'), { q: 500, u: 'g' });
  assert.deepEqual(R.lireContenance('1,5 l'), { q: 1.5, u: 'l' });
  assert.deepEqual(R.lireContenance('10 pièces'), { q: 10, u: 'pièce' });
  assert.equal(R.lireContenance('beaucoup'), null);
  assert.equal(R.lireContenance('0 g'), null);
});

// --- Export : un séjour fictif complet -----------------------------------------
function etatExport() {
  const e = H.etatDeBase({ nbJours: 3, moments: ['Déjeuner', 'Dîner'] });
  e.produits = [
    H.produit('ALM-160', 'BONI pâtes cavatappi', '1kg', 1.79, 'Féculents (pâtes, riz, farine)', { q: 1, u: 'kg' }),
    H.produit('ALM-O01', 'Oignons (filet)', '1kg', 1.49, 'Fruits & légumes', { q: 1, u: 'kg' }),
    H.produit('ALM-C01', 'Citrons', 'kg', 2.5, 'Fruits & légumes', { q: 1, u: 'kg' }),
    H.produit('ALM-002', 'BONI pâte à tartiner', '750g', 1.99, '', { q: 750, u: 'g' })
  ];
  H.ajouterIngredient(e, 'pates', 'Pâtes');
  H.ajouterIngredient(e, 'oignon', 'Oignon');
  H.ajouterIngredient(e, 'oignonEm', 'Oignon émincé');
  H.ajouterIngredient(e, 'citron', 'Citron');
  e.equivalences.push({ id: 'eq1', ingredientId: 'oignon', qA: 1, uA: 'pièce', qB: 150, uB: 'g' });
  H.ajouterRecette(e, 'r-pates', 'Pâtes bolognaise', [['pates', 1, 'kg']]);
  H.ajouterRecette(e, 'r-oignon', 'Soupe à l’oignon', [['oignon', 3, 'pièce']]);
  H.ajouterRecette(e, 'r-mix', 'Mélange oignons', [['oignon', 200, 'g'], ['oignonEm', 300, 'g']]);
  H.ajouterRecette(e, 'r-citron', 'Citronnade', [['citron', 4, 'pièce']]);
  H.rattacher(e, 'pates', 'ALM-160');
  H.rattacher(e, 'oignon', 'ALM-O01');
  H.rattacher(e, 'oignonEm', 'ALM-O01');
  H.rattacher(e, 'citron', 'ALM-C01');
  return e;
}
const ligne = (res, code, jour, moment) =>
  res.lignes.filter((l) => l.code === code && l.activite === 'J' + jour && l.destination === moment);

test('TR-01/TR-02 : effectif 23 exporté, effectif 0 omis', () => {
  const e = etatExport();
  H.placer(e, 1, 'm1', 'r-pates', 23);
  H.placer(e, 2, 'm1', 'r-pates', 0);
  const res = R.calculerExport(e, 's1');
  assert.equal(ligne(res, 'ALM-160', 1, 'Déjeuner').length, 1);
  assert.equal(ligne(res, 'ALM-160', 2, 'Déjeuner').length, 0);
  assert.equal(ligne(res, 'ALM-160', 1, 'Déjeuner')[0].quantite, 3); // 2,3 kg → 3 paquets
});

test('TR-03 : 250 g pour 10, effectif 10, contenance 1 kg → 1', () => {
  const e = etatExport();
  e.recettes.find((r) => r.id === 'r-pates').lignes[0] = { id: 'x', ingredientId: 'pates', quantite: 250, unite: 'g' };
  H.placer(e, 1, 'm1', 'r-pates', 10);
  assert.equal(R.calculerExport(e, 's1').lignes[0].quantite, 1);
});

test('TR-04 : 3 pièces pour 10, 1 pièce = 150 g, effectif 20 → 0,9 kg → 1', () => {
  const e = etatExport();
  H.placer(e, 1, 'm2', 'r-oignon', 20);
  const res = R.calculerExport(e, 's1');
  assert.equal(res.lignes.length, 1);
  assert.equal(res.lignes[0].quantite, 1);
  proche(res.lignes[0].besoinExact, 0.9);
});

test('TR-07 : deux repas 2,3 et 1,4 kg → 2 et 2', () => {
  const e = etatExport();
  H.placer(e, 1, 'm1', 'r-pates', 23);
  H.placer(e, 2, 'm2', 'r-pates', 14);
  const res = R.calculerExport(e, 's1');
  assert.equal(ligne(res, 'ALM-160', 1, 'Déjeuner')[0].quantite, 2);
  assert.equal(ligne(res, 'ALM-160', 2, 'Dîner')[0].quantite, 2);
});

test('TR-11 : deux ingrédients, même produit, même repas → une seule ligne', () => {
  const e = etatExport();
  H.placer(e, 1, 'm1', 'r-mix', 10);
  const res = R.calculerExport(e, 's1');
  assert.equal(res.lignes.length, 1);
  proche(res.lignes[0].besoinExact, 0.5);
  assert.equal(res.lignes[0].quantite, 1);
});

test('TR-12 : sans conversion → quantité exacte, « À vérifier », hors arrondi', () => {
  const e = etatExport();
  H.placer(e, 1, 'm1', 'r-citron', 10);
  const res = R.calculerExport(e, 's1');
  assert.equal(res.lignes.length, 1);
  assert.equal(res.lignes[0].quantite, 4);
  assert.equal(res.lignes[0].aCommander, 'À vérifier');
  assert.equal(res.lignes[0].totalLigne, null);
});

test('TR-13 : total ligne = quantité × prix (8 × 1,99 = 15,92)', () => {
  assert.equal(R.nombreFr(R.totalLigne(8, 1.99), 2), '15,92');
});

test('TR-14 RM-08 : frais selon la sous-catégorie', () => {
  const sc = [{ nom: 'Fruits & légumes', frais: true }, { nom: 'Féculents (pâtes, riz, farine)', frais: false }];
  assert.equal(R.aCommander({ sousCategorie: 'Fruits & légumes' }, sc), 'Frais');
  assert.equal(R.aCommander({ sousCategorie: 'Féculents (pâtes, riz, farine)' }, sc), 'Gros achat');
  assert.equal(R.aCommander({ sousCategorie: '' }, sc), 'Gros achat');
});

test('Export : tri par jour, ordre des moments, magasin, article', () => {
  const e = etatExport();
  H.placer(e, 2, 'm1', 'r-pates', 10);
  H.placer(e, 1, 'm2', 'r-oignon', 20);
  H.placer(e, 1, 'm1', 'r-pates', 10);
  const res = R.calculerExport(e, 's1');
  assert.deepEqual(res.lignes.map((l) => l.activite + ' ' + l.destination), ['J1 Déjeuner', 'J1 Dîner', 'J2 Déjeuner']);
});

test('F-10 : manques d’un repas (non rattaché, sans conversion, contenance, effectif, introuvable)', () => {
  const e = etatExport();
  H.ajouterIngredient(e, 'olive', 'Olives vertes');
  H.ajouterRecette(e, 'r-tajine', 'Tajine', [['olive', 200, 'g'], ['citron', 2, 'pièce'], ['pates', 1, 'kg']]);
  H.placer(e, 1, 'm2', 'r-tajine', null);
  const m = R.manquesRepas(e, e.sejours[0], e.sejours[0].repas[0]);
  assert.deepEqual(m.map((x) => x.type).sort(), ['effectif', 'non-rattache', 'sans-conversion']);
  e.produits[0].contenanceValidee = false;
  e.produits[0].present = false;
  const m2 = R.manquesRepas(e, e.sejours[0], e.sejours[0].repas[0]);
  assert.ok(m2.some((x) => x.type === 'introuvable' && x.ingredientId === 'pates'));
});

test('Export : repas sans effectif et ingrédient non rattaché non exportés, mais listés', () => {
  const e = etatExport();
  H.ajouterIngredient(e, 'olive', 'Olives vertes');
  H.ajouterRecette(e, 'r-olive', 'Olives', [['olive', 200, 'g']]);
  H.placer(e, 1, 'm1', 'r-olive', 10);
  H.placer(e, 2, 'm1', 'r-pates', null);
  const res = R.calculerExport(e, 's1');
  assert.equal(res.lignes.length, 0);
  assert.equal(res.manques.length, 2);
});

test('Contenance non validée → traitée comme « À vérifier » (écart journalisé)', () => {
  const e = etatExport();
  e.produits[0].contenanceValidee = false;
  H.placer(e, 1, 'm1', 'r-pates', 23);
  const res = R.calculerExport(e, 's1');
  assert.equal(res.lignes[0].aCommander, 'À vérifier');
  proche(res.lignes[0].quantite, 2.3);
});

test('Rattachables : ALM actifs seulement', () => {
  assert.equal(R.estRattachable({ code: 'ALM-1', actif: 'Oui' }), true);
  assert.equal(R.estRattachable({ code: 'CMB-1', actif: 'Oui' }), false);
  assert.equal(R.estRattachable({ code: 'ALM-1', actif: 'Non' }), false);
});

// --- Corrections après revue indépendante (25 oct. 2026) ---------------------
test('Revue #2 : un même ingrédient en deux unités est contrôlé pour chaque unité', () => {
  const e = etatExport();
  H.ajouterRecette(e, 'r-2u', 'Oignons mixtes', [['oignonEm', 100, 'g'], ['oignonEm', 2, 'pièce']]);
  H.placer(e, 1, 'm1', 'r-2u', 10);
  const m = R.manquesRepas(e, e.sejours[0], e.sejours[0].repas[0]);
  assert.deepEqual(m.map((x) => x.type), ['sans-conversion']);
});

test('Revue #6 : un produit devenu inactif est signalé', () => {
  const e = etatExport();
  e.produits[0].actif = 'Non';
  H.placer(e, 1, 'm1', 'r-pates', 10);
  assert.deepEqual(R.manquesRepas(e, e.sejours[0], e.sejours[0].repas[0]).map((x) => x.type), ['introuvable']);
});

test('Revue #9 : un repas à effectif 0 ne génère aucun manque', () => {
  const e = etatExport();
  H.ajouterIngredient(e, 'olive', 'Olives');
  H.ajouterRecette(e, 'r-olive', 'Olives', [['olive', 200, 'g']]);
  H.placer(e, 1, 'm1', 'r-olive', 0);
  assert.deepEqual(R.manquesRepas(e, e.sejours[0], e.sejours[0].repas[0]), []);
  assert.equal(R.calculerExport(e, 's1').manques.length, 0);
});

test('Revue #7 : une ligne « À vérifier » porte l’unité de la recette', () => {
  const e = etatExport();
  H.placer(e, 1, 'm1', 'r-citron', 10);
  assert.equal(R.calculerExport(e, 's1').lignes[0].unite, 'pièce');
});

test('Revue #3 : équivalence affichée pour une quantité (12 pièces ≈ 720 g)', () => {
  const eq = [{ qA: 1, uA: 'pièce', qB: 60, uB: 'g' }];
  assert.equal(R.equivalenceAffichee(12, 'pièce', eq), '≈ 720 g');
  assert.equal(R.equivalenceAffichee(300, 'g', eq), '≈ 5 pièces');
  assert.equal(R.equivalenceAffichee(2, 'pièce', []), null);
});

test('AD-005 : produit propre à un repas, sinon produit par défaut du séjour', () => {
  const e = H.etatDeBase({ nbJours: 2 });
  e.produits.push(H.produit('ALM-1', 'Oignons jaunes', '1kg', 2, 'Fruits & légumes', { q: 1, u: 'kg' }));
  e.produits.push(H.produit('ALM-2', 'Oignons rouges', '500g', 2, 'Fruits & légumes', { q: 500, u: 'g' }));
  H.ajouterIngredient(e, 'oi', 'Oignon');
  H.ajouterRecette(e, 'r', 'Soupe', [['oi', 500, 'g']]);
  H.placer(e, 1, 'm1', 'r', 10); H.placer(e, 2, 'm1', 'r', 10);
  H.rattacher(e, 'oi', 'ALM-1');
  e.sejours[0].repas[1].produits = { oi: 'ALM-2' };
  const res = R.calculerExport(e, 's1');
  assert.deepEqual(res.lignes.map((l) => l.code + ':' + l.activite + ':' + l.quantite), ['ALM-1:J1:1', 'ALM-2:J2:1']);
  assert.equal(res.manques.length, 0);
  // Justification : contributions et arrondi exposés
  const d = res.details.get('ALM-1');
  assert.equal(d.contributions.length, 1); assert.equal(d.total, 0.5); assert.equal(d.paquets, 1);
  assert.equal(res.details.get('ALM-2').contributions[0].specifique, true);
});

test('AD-005 : un remplacement par repas complète un ingrédient sans produit par défaut', () => {
  const e = H.etatDeBase({ nbJours: 1 });
  e.produits.push(H.produit('ALM-2', 'Oignons rouges', '500g', 2, 'Fruits & légumes', { q: 500, u: 'g' }));
  H.ajouterIngredient(e, 'oi', 'Oignon');
  H.ajouterRecette(e, 'r', 'Soupe', [['oi', 500, 'g']]);
  H.placer(e, 1, 'm1', 'r', 10);
  assert.equal(R.manquesRepas(e, e.sejours[0], e.sejours[0].repas[0]).length, 1);
  e.sejours[0].repas[0].produits = { oi: 'ALM-2' };
  assert.equal(R.manquesRepas(e, e.sejours[0], e.sejours[0].repas[0]).length, 0);
  assert.equal(R.ingredientsDuSejour(e, e.sejours[0])[0].statut, 'pret');
});
