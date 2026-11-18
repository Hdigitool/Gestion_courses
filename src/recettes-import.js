// =============================================================================
// IMPORT DE RECETTES PAR MODÈLE EXCEL — fonctions pures (sans affichage).
// Le modèle reprend les règles de saisie de l'outil : nom obligatoire, quantité
// supérieure à 0, unité dans la liste fixe, pas deux fois le même ingrédient avec
// la même unité dans une recette. Un fichier avec une seule erreur n'importe rien.
// =============================================================================
(function (racine) {
  'use strict';
  const X = (typeof module !== 'undefined' && module.exports) ? require('./xlsx.js') : racine.GM_xlsx;
  const F = (typeof module !== 'undefined' && module.exports) ? require('./format.js') : racine.GM_format;

  const FEUILLE_RECETTES = 'Recettes';
  const FEUILLE_LIGNES = 'Lignes';
  const FEUILLE_MATERIEL = 'Matériel';
  const MAX_LIGNES = 300;          // plages de saisie du modèle : lignes 2 à 300
  const MAX_TEXTE = 120;
  const MAX_ERREURS = 30;

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const estVide = (ligne) => !ligne || ligne.every((c) => String(c || '').trim() === '');

  // --- Modèle à remplir -------------------------------------------------------
  // Les listes (unités, recettes) et les contrôles viennent de la même source que l'outil.
  function modeleRecettes(unites) {
    const plage = (col) => `${col}2:${col}${MAX_LIGNES}`;
    const liste = (col) => [{ sqref: plage(col), type: 'list', formule: `${FEUILLE_RECETTES}!$A$2:$A$${MAX_LIGNES}`, titre: 'Recette inconnue', message: 'Choisissez une recette de la feuille Recettes.' }];
    const texte = (col) => ({ sqref: plage(col), type: 'textLength', operateur: 'between', formule: '1', formule2: String(MAX_TEXTE), titre: 'Texte trop long ou vide', message: `Saisissez un texte de 1 à ${MAX_TEXTE} caractères.` });
    return X.ecrireClasseur([
      { nom: 'Lisez-moi', largeurs: [110], lignes: [
        ['Modèle d’import des recettes — Menus de séjour'],
        [''],
        ['1. Feuille Recettes : un nom par recette. Chaque nom doit être unique et ne pas exister déjà dans l’outil.'],
        ['2. Feuille Lignes : une ligne par ingrédient. Recette : choisissez dans la liste. Ingrédient : texte libre ; s’il porte le même nom qu’un ingrédient existant, il est rattaché à celui-ci, sinon il est créé.'],
        ['    Quantité pour 10 : nombre supérieur à 0 (virgule ou point). Unité : g, kg, ml, cl, l ou pièce (liste).'],
        ['    Un même ingrédient ne peut pas figurer deux fois dans une recette avec la même unité.'],
        ['3. Feuille Matériel (facultatif) : une ligne par matériel nécessaire à une recette.'],
        ['4. Enregistrez le fichier au format .xlsx, puis importez-le dans l’outil : onglet Recettes, « Importer des recettes ».'],
        [''],
        ['Si une seule ligne est en erreur, l’outil n’importe rien et indique les lignes à corriger.'],
        ['Ne renommez pas les feuilles et ne changez pas les en-têtes.']
      ] },
      { nom: FEUILLE_RECETTES, entete: true, largeurs: [44], lignes: [['Nom de la recette']], validations: [
        texte('A'),
        { sqref: plage('A'), type: 'custom', formule: `COUNTIF($A$2:$A$${MAX_LIGNES},A2)=1`, titre: 'Nom en double', message: 'Ce nom de recette est déjà utilisé dans ce modèle.' }
      ] },
      { nom: FEUILLE_LIGNES, entete: true, largeurs: [44, 40, 22, 12], lignes: [['Recette', 'Ingrédient', 'Quantité pour 10', 'Unité']], validations: [
        ...liste('A'),
        texte('B'),
        { sqref: plage('C'), type: 'decimal', operateur: 'greaterThan', formule: '0', titre: 'Quantité invalide', message: 'La quantité pour 10 personnes doit être un nombre supérieur à 0.' },
        { sqref: plage('D'), type: 'list', formule: `"${unites.join(',')}"`, titre: 'Unité inconnue', message: 'Choisissez une unité dans la liste : ' + unites.join(', ') + '.' },
        { sqref: plage('B'), type: 'custom', formule: `COUNTIFS($A$2:$A$${MAX_LIGNES},A2,$B$2:$B$${MAX_LIGNES},B2,$D$2:$D$${MAX_LIGNES},D2)=1`, titre: 'Doublon', message: 'Cet ingrédient figure déjà dans cette recette avec la même unité.' }
      ] },
      { nom: FEUILLE_MATERIEL, entete: true, largeurs: [44, 50], lignes: [['Recette', 'Matériel']], validations: [
        ...liste('A'),
        texte('B')
      ] }
    ]);
  }

  // --- Lecture et contrôle ----------------------------------------------------
  // Retourne { ok:true, recettes:[{nom, lignes:[{ingredient, quantite, unite}], materiel:[]}] }
  // ou { ok:false, erreurs:[...] } : rien n'est importé dans ce cas.
  function controler(feuilles, etat, unites) {
    const erreurs = [];
    const signaler = (feuille, n, message) => erreurs.push(`Feuille ${feuille}, ligne ${n} : ${message}`);
    const enTete = (feuille, attendus) => {
      const l = (feuilles[feuille] || [])[0] || [];
      return attendus.every((c, i) => String(l[i] || '').trim() === c);
    };
    for (const [feuille, attendus] of [[FEUILLE_RECETTES, ['Nom de la recette']], [FEUILLE_LIGNES, ['Recette', 'Ingrédient', 'Quantité pour 10', 'Unité']], [FEUILLE_MATERIEL, ['Recette', 'Matériel']]]) {
      if (!feuilles[feuille]) return { ok: false, erreurs: [`La feuille « ${feuille} » est absente. Utilisez le modèle fourni par l’outil.`] };
      if (!enTete(feuille, attendus)) return { ok: false, erreurs: [`En-têtes modifiés dans la feuille « ${feuille} ». Utilisez le modèle fourni, sans changer les en-têtes.`] };
    }

    // 1. Recettes
    const recettes = new Map(); // norm(nom) -> { nom, lignes, materiel }
    const existantes = new Set((etat.recettes || []).map((r) => norm(r.nom)));
    (feuilles[FEUILLE_RECETTES] || []).forEach((l, i) => {
      if (i === 0 || estVide(l)) return;
      const nom = String(l[0] || '').trim();
      if (!nom) return signaler(FEUILLE_RECETTES, i + 1, 'nom de recette manquant.');
      if (nom.length > MAX_TEXTE) return signaler(FEUILLE_RECETTES, i + 1, `le nom dépasse ${MAX_TEXTE} caractères.`);
      if (existantes.has(norm(nom))) return signaler(FEUILLE_RECETTES, i + 1, `« ${nom} » existe déjà dans l’outil. Renommez la recette du fichier.`);
      if (recettes.has(norm(nom))) return signaler(FEUILLE_RECETTES, i + 1, `« ${nom} » est en double dans le fichier.`);
      recettes.set(norm(nom), { nom, lignes: [], materiel: [] });
    });

    // 2. Ingrédients par recette
    const dejaVus = new Set();
    (feuilles[FEUILLE_LIGNES] || []).forEach((l, i) => {
      if (i === 0 || estVide(l)) return;
      const n = i + 1;
      const recette = recettes.get(norm(l[0]));
      if (!recette) return signaler(FEUILLE_LIGNES, n, `la recette « ${String(l[0] || '').trim()} » n’est pas dans la feuille ${FEUILLE_RECETTES}.`);
      const ingredient = String(l[1] || '').trim();
      if (!ingredient) return signaler(FEUILLE_LIGNES, n, 'ingrédient manquant.');
      if (ingredient.length > MAX_TEXTE) return signaler(FEUILLE_LIGNES, n, `le nom de l’ingrédient dépasse ${MAX_TEXTE} caractères.`);
      const quantite = Number(String(l[2] || '').trim().replace(',', '.'));
      if (String(l[2] || '').trim() === '' || !(quantite > 0)) return signaler(FEUILLE_LIGNES, n, 'la quantité pour 10 doit être un nombre supérieur à 0.');
      const unite = unites.find((u) => u.toLowerCase() === String(l[3] || '').trim().toLowerCase());
      if (!unite) return signaler(FEUILLE_LIGNES, n, `unité « ${String(l[3] || '').trim()} » inconnue. Choisissez : ${unites.join(', ')}.`);
      const cle = norm(recette.nom) + '|' + norm(ingredient) + '|' + unite;
      if (dejaVus.has(cle)) return signaler(FEUILLE_LIGNES, n, `« ${ingredient} » figure déjà dans « ${recette.nom} » avec l’unité ${unite}.`);
      dejaVus.add(cle);
      recette.lignes.push({ ingredient, quantite, unite });
    });

    // 3. Matériel
    (feuilles[FEUILLE_MATERIEL] || []).forEach((l, i) => {
      if (i === 0 || estVide(l)) return;
      const n = i + 1;
      const recette = recettes.get(norm(l[0]));
      if (!recette) return signaler(FEUILLE_MATERIEL, n, `la recette « ${String(l[0] || '').trim()} » n’est pas dans la feuille ${FEUILLE_RECETTES}.`);
      const materiel = String(l[1] || '').trim();
      if (!materiel) return signaler(FEUILLE_MATERIEL, n, 'matériel manquant.');
      if (materiel.length > MAX_TEXTE) return signaler(FEUILLE_MATERIEL, n, `le texte dépasse ${MAX_TEXTE} caractères.`);
      if (!recette.materiel.includes(materiel)) recette.materiel.push(materiel);
    });

    if (erreurs.length) return { ok: false, erreurs: erreurs.slice(0, MAX_ERREURS).concat(erreurs.length > MAX_ERREURS ? [`… et ${erreurs.length - MAX_ERREURS} autre(s) erreur(s).`] : []) };
    return { ok: true, recettes: [...recettes.values()] };
  }

  // Lit un fichier .xlsx (octets) et le contrôle. Ne modifie pas l'état.
  async function lireRecettes(octets, etat, unites) {
    let feuilles;
    try { feuilles = await X.lireClasseur(octets); }
    catch (e) { return { ok: false, erreurs: ['Ce fichier n’est pas un modèle Excel (.xlsx) lisible. Utilisez le modèle fourni par l’outil.'] }; }
    return controler(feuilles, etat, unites);
  }

  // Ajoute les recettes à l'état. Un ingrédient inconnu est créé ; un nom connu est rattaché.
  function appliquerRecettes(etat, recettes) {
    const ingredients = etat.ingredients;
    const trouver = (nom) => ingredients.find((i) => norm(i.nom) === norm(nom));
    let lignes = 0;
    for (const r of recettes) {
      etat.recettes.push({
        id: F.id('rec'), nom: r.nom, etiquettes: [], materiel: r.materiel.slice(), origineId: null,
        lignes: r.lignes.map((l) => {
          let ing = trouver(l.ingredient);
          if (!ing) { ing = { id: F.id('ing'), nom: l.ingredient, dernierProduit: null }; ingredients.push(ing); }
          lignes += 1;
          return { id: F.id('l'), ingredientId: ing.id, quantite: l.quantite, unite: l.unite };
        })
      });
    }
    return { recettes: recettes.length, lignes };
  }

  const api = { modeleRecettes, lireRecettes, controler, appliquerRecettes, FEUILLE_RECETTES, FEUILLE_LIGNES, FEUILLE_MATERIEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.GM_recettes = api;
})(this);
