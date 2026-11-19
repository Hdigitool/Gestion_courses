// =============================================================================
// FORMAT DES DONNÉES (bloc B6 Persistance) — ADR-01, SEC-05, ENF-05
// Le fichier JSON est la seule source de vérité. Ce module crée, valide,
// migre et sérialise l'état. Aucune dépendance à l'affichage.
// =============================================================================
(function (racine) {
  'use strict';

  const NOM_FORMAT = 'gestion-menu';
  const VERSION = 1; // À incrémenter à chaque changement de structure, avec une migration ci-dessous.

  // Sous-catégories « frais » par défaut (ADR-08), modifiables dans l'onglet Catalogue.
  const FRAIS_PAR_DEFAUT = ['Fruits & légumes', 'Frais (crèmerie, fromages)', 'Boulangerie', 'Boucherie'];

  function nouvelEtat() {
    return {
      format: NOM_FORMAT,
      version: VERSION,
      enregistreLe: null,
      parametres: { tolerance: 0 },   // tolérance d'arrondi en % (RM-05), 0 par défaut
      sejours: [],                    // { id, nom, nbJours, moments[{id,nom}], repas[{jour,momentId,recetteId,effectif}], rattachements{ingredientId: code} }
      recettes: [],                   // { id, nom, etiquettes[], materiel[], origineId, lignes[{id,ingredientId,quantite,unite}] }
      ingredients: [],                // { id, nom, dernierProduit }
      equivalences: [],               // { id, ingredientId, qA, uA, qB, uB }  ex. 1 pièce = 150 g
      produits: [],                   // colonnes du catalogue + contenance {q,u}, contenanceValidee, present
      sousCategories: [],             // { nom, frais }
      dernierImport: null             // { date, total, alimentaires }
    };
  }

  // Identifiant court et unique, suffisant pour un usage local.
  let compteur = 0;
  function id(prefixe) {
    compteur += 1;
    return (prefixe || 'x') + '-' + Date.now().toString(36) + '-' + compteur.toString(36);
  }

  // --- Validation ------------------------------------------------------------
  // On vérifie la structure avant de charger quoi que ce soit (SEC-05) :
  // en cas d'échec, rien n'est remplacé et le message dit quoi faire.
  const LISTES = ['sejours', 'recettes', 'ingredients', 'equivalences', 'produits', 'sousCategories'];

  function erreurFormat(nomFichier, detail) {
    return { ok: false, erreur: 'Le fichier' + (nomFichier ? ' « ' + nomFichier + ' »' : '') +
      ' n’a pas été ouvert : ' + detail + ' Vos données actuelles n’ont pas été modifiées. Ouvrez un fichier enregistré par cet outil.' };
  }

  function lire(texte, nomFichier) {
    let obj;
    try { obj = JSON.parse(texte); } catch (e) { return erreurFormat(nomFichier, 'son contenu n’est pas un JSON lisible.'); }
    if (!obj || typeof obj !== 'object' || obj.format !== NOM_FORMAT) return erreurFormat(nomFichier, 'ce n’est pas un fichier de menus de séjour.');
    if (!Number.isInteger(obj.version) || obj.version < 1 || obj.version > VERSION) {
      return erreurFormat(nomFichier, 'son format (version ' + obj.version + ') n’est pas reconnu.');
    }
    obj = migrer(obj);
    for (const cle of LISTES) {
      if (!Array.isArray(obj[cle])) return erreurFormat(nomFichier, 'la liste « ' + cle + ' » est absente ou abîmée.');
    }
    if (!obj.parametres || typeof obj.parametres.tolerance !== 'number') return erreurFormat(nomFichier, 'les paramètres sont absents ou abîmés.');
    const probleme = verifierContenu(obj);
    if (probleme) return erreurFormat(nomFichier, probleme);
    return { ok: true, etat: obj };
  }

  // Contrôle en profondeur (SEC-05) : chaque objet a la forme attendue, sinon on refuse tout.
  // Retourne une phrase décrivant le premier problème trouvé, ou null.
  const UNITES = ['g', 'kg', 'ml', 'cl', 'l', 'pièce'];
  const estTexte = (v) => typeof v === 'string';
  const estPositif = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const estListeDeTextes = (v) => Array.isArray(v) && v.every(estTexte);
  const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  function verifierContenu(o) {
    if (typeof o.parametres.tolerance !== 'number' || o.parametres.tolerance < 0 || o.parametres.tolerance > 100) return 'la tolérance d’arrondi est invalide.';
    for (const s of o.sejours) {
      if (!estObjet(s) || !estTexte(s.id) || !estTexte(s.nom) || !Number.isInteger(s.nbJours) || s.nbJours < 1 || s.nbJours > 60) return 'un séjour est incomplet ou a un nombre de jours invalide.';
      if (!Array.isArray(s.moments) || !s.moments.length || !s.moments.every((m) => estObjet(m) && estTexte(m.id) && estTexte(m.nom))) return 'les moments d’un séjour sont abîmés.';
      if (!estObjet(s.rattachements) || !Object.values(s.rattachements).every(estTexte)) return 'les rattachements d’un séjour sont abîmés.';
      const ids = new Set(s.moments.map((m) => m.id));
      if (!Array.isArray(s.repas) || !s.repas.every((r) => estObjet(r) && Number.isInteger(r.jour) && r.jour >= 1 && r.jour <= s.nbJours &&
        ids.has(r.momentId) && (estTexte(r.recetteId) || (r.recetteId === null && Array.isArray(r.extras) && r.extras.length > 0)) &&
        (r.extras === undefined || (Array.isArray(r.extras) && r.extras.every((x) => estObjet(x) && ((x.type === 'recette' && estTexte(x.recetteId)) ||
          (x.type === 'produit' && estTexte(x.code) && typeof x.quantite === 'number' && x.quantite > 0 && estTexte(x.unite)))))) && (r.effectif === null || (Number.isInteger(r.effectif) && r.effectif >= 0)) &&
        (r.produits === undefined || (estObjet(r.produits) && Object.values(r.produits).every(estTexte))))) return 'un repas du séjour « ' + s.nom + ' » est abîmé.';
    }
    for (const r of o.recettes) {
      if (!estObjet(r) || !estTexte(r.id) || !estTexte(r.nom) || !Array.isArray(r.lignes) || !estListeDeTextes(r.materiel) || !estListeDeTextes(r.etiquettes)) return 'une recette est incomplète.';
      if (!r.lignes.every((l) => estObjet(l) && estTexte(l.id) && estTexte(l.ingredientId) && estPositif(l.quantite) && UNITES.includes(l.unite))) return 'une ligne de la recette « ' + r.nom + ' » est abîmée.';
    }
    if (!o.ingredients.every((i) => estObjet(i) && estTexte(i.id) && estTexte(i.nom))) return 'un ingrédient est abîmé.';
    if (!o.equivalences.every((e) => estObjet(e) && estTexte(e.ingredientId) && estPositif(e.qA) && estPositif(e.qB) && UNITES.includes(e.uA) && UNITES.includes(e.uB))) return 'une équivalence est abîmée.';
    for (const p of o.produits) {
      if (!estObjet(p) || !estTexte(p.code)) return 'un produit n’a pas de code.';
      if (p.contenance !== null && p.contenance !== undefined && !(estObjet(p.contenance) && estPositif(p.contenance.q) && UNITES.includes(p.contenance.u))) return 'la contenance du produit ' + p.code + ' est abîmée.';
    }
    if (!o.sousCategories.every((s) => estObjet(s) && estTexte(s.nom) && typeof s.frais === 'boolean')) return 'une sous-catégorie est abîmée.';
    return null;
  }

  // Migrations d'une version du format à la suivante. Chaque étape est testée.
  // Exemple futur : if (obj.version === 1) { ...; obj.version = 2; }
  function migrer(obj) {
    return obj;
  }

  function serialiser(etat) {
    return JSON.stringify(Object.assign({}, etat, { enregistreLe: new Date().toISOString() }), null, 2);
  }

  const deux = (n) => String(n).padStart(2, '0');
  // SEC-03 : un nom daté à chaque enregistrement, pour garder des versions successives.
  function nomFichier(date) {
    const d = date || new Date();
    return 'menus_' + d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate()) + '_' + deux(d.getHours()) + deux(d.getMinutes()) + '.json';
  }

  const api = { NOM_FORMAT, VERSION, FRAIS_PAR_DEFAUT, nouvelEtat, id, lire, migrer, serialiser, nomFichier };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.GM_format = api;
})(this);
