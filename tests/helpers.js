// Fabrique d'états fictifs pour les tests (aucune donnée personnelle).
'use strict';
const format = require('../src/format.js');

function produit(code, nom, unite, prix, sousCategorie, contenance, extra) {
  return Object.assign({
    code, nom, marque: '', sousCategorie: sousCategorie || '', unite, prix: prix || 0,
    magasin: 'Colruyt', fiche: '', statut: 'Validé', actif: 'Oui',
    contenance: contenance || null, contenanceValidee: !!contenance, present: true
  }, extra || {});
}

// Un état minimal : un séjour de `nbJours` jours avec les moments donnés.
function etatDeBase(opts) {
  const o = opts || {};
  const e = format.nouvelEtat();
  e.sousCategories = [
    { nom: 'Fruits & légumes', frais: true },
    { nom: 'Féculents (pâtes, riz, farine)', frais: false }
  ];
  e.sejours.push({
    id: 's1', nom: 'Jupiter été', nbJours: o.nbJours || 3,
    moments: (o.moments || ['Déjeuner', 'Dîner']).map((nom, i) => ({ id: 'm' + (i + 1), nom })),
    repas: [], rattachements: {}
  });
  return e;
}

function ajouterIngredient(e, id, nom) { e.ingredients.push({ id, nom, dernierProduit: null }); return id; }
function ajouterRecette(e, id, nom, lignes) {
  e.recettes.push({ id, nom, etiquettes: [], materiel: [], origineId: null,
    lignes: lignes.map((l, i) => ({ id: id + '-l' + i, ingredientId: l[0], quantite: l[1], unite: l[2] })) });
  return id;
}
function placer(e, jour, momentId, recetteId, effectif) {
  e.sejours[0].repas.push({ jour, momentId, recetteId, effectif: effectif === undefined ? null : effectif });
}
function rattacher(e, ingredientId, code) { e.sejours[0].rattachements[ingredientId] = code; }

module.exports = { produit, etatDeBase, ajouterIngredient, ajouterRecette, placer, rattacher };
