// =============================================================================
// CSV : import du catalogue et export de la liste de courses (contrat d'interface)
// SEC-06 contrôle de l'import, SEC-07 neutralisation des formules.
// =============================================================================
(function (racine) {
  'use strict';
  const R = (typeof module !== 'undefined' && module.exports) ? require('./rules.js') : racine.GM_rules;
  const F = (typeof module !== 'undefined' && module.exports) ? require('./format.js') : racine.GM_format;

  const COLONNES_CATALOGUE = ['Code', 'Nom', 'Marque', 'Sous-catégorie', 'Unité', 'Prix unitaire (EUR)', 'Magasin', 'Fiche produit', 'Statut', 'Actif'];
  const COLONNES_EXPORT = ['Code', 'Article', 'Marque', 'Magasin', 'Quantité', 'Unité', 'Prix unitaire (EUR)', 'Total ligne (EUR)', 'Destination', 'Activité', 'À commander', 'Fiche produit'];
  const TAILLE_MAX = 5 * 1024 * 1024; // un catalogue de 400 produits pèse ~50 Ko

  // Lecteur CSV : séparateur `;`, guillemets doublés, retours à la ligne dans un champ,
  // BOM UTF-8 ignoré, lignes vides ignorées.
  function parser(texte) {
    const s = String(texte).replace(/^﻿/, '');
    const lignes = [];
    let champ = '', ligne = [], guillemets = false;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (guillemets) {
        if (c === '"' && s[i + 1] === '"') { champ += '"'; i++; }
        else if (c === '"') guillemets = false;
        else champ += c;
      } else if (c === '"') guillemets = true;
      else if (c === ';') { ligne.push(champ); champ = ''; }
      else if (c === '\r' || c === '\n') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        ligne.push(champ); champ = '';
        if (ligne.some((x) => x !== '')) lignes.push(ligne);
        ligne = [];
      } else champ += c;
    }
    ligne.push(champ);
    if (ligne.some((x) => x !== '')) lignes.push(ligne);
    return lignes;
  }

  const nombre = (t) => { const n = Number(String(t || '').trim().replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  // SEC-06 : colonnes attendues par leur nom, codes uniques ; sinon refus complet.
  function lireCatalogue(texte) {
    if (String(texte).length > TAILLE_MAX) return { ok: false, erreur: 'Import refusé : le fichier dépasse 5 Mo. Vérifiez qu’il s’agit bien du catalogue de l’outil de courses.' };
    const lignes = parser(texte);
    if (!lignes.length) return { ok: false, erreur: 'Import refusé : le fichier est vide.' };
    const entete = lignes[0].map((x) => x.trim());
    const index = {};
    for (const col of COLONNES_CATALOGUE) {
      const i = entete.indexOf(col);
      if (i < 0) return { ok: false, erreur: 'Import refusé : la colonne « ' + col + ' » est absente. Exportez de nouveau le catalogue depuis l’outil de courses, sans modifier les en-têtes.' };
      index[col] = i;
    }
    const supplementaires = entete.filter((c) => c && !COLONNES_CATALOGUE.includes(c));
    const vus = new Set();
    const produits = [];
    for (let n = 1; n < lignes.length; n++) {
      const l = lignes[n];
      const v = (col) => (l[index[col]] || '').trim();
      const code = v('Code');
      if (!code) continue;
      if (vus.has(code)) return { ok: false, erreur: 'Import refusé : le code ' + code + ' apparaît deux fois. Corrigez le fichier dans l’outil de courses.' };
      vus.add(code);
      produits.push({
        code, nom: v('Nom'), marque: v('Marque'), sousCategorie: v('Sous-catégorie'), unite: v('Unité'),
        prix: nombre(v('Prix unitaire (EUR)')), magasin: v('Magasin'), fiche: v('Fiche produit'),
        statut: v('Statut'), actif: v('Actif')
      });
    }
    return { ok: true, produits, supplementaires };
  }

  const CHAMPS_COMPARES = ['nom', 'marque', 'sousCategorie', 'unite', 'prix', 'magasin', 'fiche', 'statut', 'actif'];

  // Aperçu avant import (US-01) : rien n'est modifié ici.
  function comparerCatalogue(actuels, importes) {
    const avant = new Map(actuels.map((p) => [p.code, p]));
    const apres = new Set(importes.map((p) => p.code));
    const ajoutes = [], modifies = [], uniteChangee = [];
    for (const p of importes) {
      const a = avant.get(p.code);
      if (!a) { ajoutes.push(p); continue; }
      if (CHAMPS_COMPARES.some((c) => a[c] !== p[c]) || a.present === false) modifies.push(p);
      if (a.unite !== p.unite) uniteChangee.push(p);
    }
    const absents = actuels.filter((p) => !apres.has(p.code) && p.present !== false);
    return { ajoutes, modifies, uniteChangee, absents, total: importes.length, alimentaires: importes.filter(R.estRattachable).length };
  }

  // Applique un import confirmé. Une contenance validée est conservée, sauf si
  // l'unité du produit a changé (validation retirée, nouvelle proposition).
  // Un produit absent n'est jamais supprimé : il est marqué et signalé.
  function appliquerCatalogue(etat, importes, date) {
    const avant = new Map(etat.produits.map((p) => [p.code, p]));
    const codes = new Set(importes.map((p) => p.code));
    const produits = importes.map((p) => {
      const a = avant.get(p.code);
      const garde = a && a.unite === p.unite && a.contenance;
      return Object.assign({}, p, {
        contenance: garde ? a.contenance : R.proposerContenance(p.unite),
        contenanceValidee: garde ? !!a.contenanceValidee : false,
        present: true
      });
    });
    for (const a of etat.produits) if (!codes.has(a.code)) produits.push(Object.assign({}, a, { present: false }));
    const sousCategories = etat.sousCategories.slice();
    for (const p of importes) {
      if (p.sousCategorie && !sousCategories.some((s) => s.nom === p.sousCategorie)) {
        sousCategories.push({ nom: p.sousCategorie, frais: F.FRAIS_PAR_DEFAUT.includes(p.sousCategorie) });
      }
    }
    sousCategories.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return Object.assign({}, etat, {
      produits, sousCategories,
      dernierImport: { date: (date || new Date()).toISOString(), total: importes.length, alimentaires: importes.filter(R.estRattachable).length }
    });
  }

  // SEC-07 : un texte commençant par =, +, @ ou une tabulation serait exécuté
  // comme formule par un tableur ; on le préfixe d'une apostrophe.
  const neutraliser = (v) => (/^[=+@\t]/.test(String(v)) ? '\'' + v : String(v));

  function champCSV(v) {
    const s = neutraliser(v === null || v === undefined ? '' : v);
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // Export au format exact de l'outil de courses : UTF-8 sans BOM, `;`, CRLF.
  function exporterCSV(lignes) {
    const rows = [COLONNES_EXPORT];
    for (const l of lignes) {
      rows.push([
        l.code, l.article, l.marque, l.magasin, R.nombreFr(l.quantite), l.unite,
        R.nombreFr(l.prix), l.totalLigne === null ? '' : R.nombreFr(l.totalLigne, 2),
        l.destination, l.activite, l.aCommander, l.fiche
      ]);
    }
    return rows.map((r) => r.map(champCSV).join(';')).join('\r\n') + '\r\n';
  }

  const api = { COLONNES_CATALOGUE, COLONNES_EXPORT, parser, lireCatalogue, comparerCatalogue, appliquerCatalogue, neutraliser, exporterCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.GM_csv = api;
})(this);
