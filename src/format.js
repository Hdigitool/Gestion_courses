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
    for (const s of obj.sejours) {
      if (!s || typeof s.nom !== 'string' || !Number.isInteger(s.nbJours) || !Array.isArray(s.moments) || !Array.isArray(s.repas) || typeof s.rattachements !== 'object') {
        return erreurFormat(nomFichier, 'un séjour est incomplet.');
      }
    }
    for (const r of obj.recettes) {
      if (!r || typeof r.nom !== 'string' || !Array.isArray(r.lignes)) return erreurFormat(nomFichier, 'une recette est incomplète.');
    }
    for (const p of obj.produits) {
      if (!p || typeof p.code !== 'string') return erreurFormat(nomFichier, 'un produit n’a pas de code.');
    }
    return { ok: true, etat: obj };
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
