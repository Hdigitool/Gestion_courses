// =============================================================================
// RÈGLES ET CALCULS (bloc B5) — fonctions pures, sans lien avec l'affichage.
// RM-01 besoin, RM-03 agrégation, RM-05 arrondi + répartition, RM-06/07 rattachement,
// RM-08 frais, RM-09 conversion, F-10 manques. Testées par tests/rules.test.js.
// =============================================================================
(function (racine) {
  'use strict';

  // --- Unités (liste fixe, ADR-02) ------------------------------------------
  const UNITES = ['g', 'kg', 'ml', 'cl', 'l', 'pièce'];
  const FAMILLES = {
    g: ['masse', 1], kg: ['masse', 1000],
    ml: ['volume', 1], cl: ['volume', 10], l: ['volume', 1000],
    'pièce': ['piece', 1]
  };
  const famille = (u) => (FAMILLES[u] ? FAMILLES[u][0] : null);

  // Évite les faux restes dus aux nombres à virgule (0,1 + 0,2 ≠ 0,3).
  const net = (x) => Math.round(x * 1e9) / 1e9;

  // Conversion générique au sein d'une même famille (g↔kg, ml↔cl↔l).
  function convertirGenerique(q, de, vers) {
    if (!FAMILLES[de] || !FAMILLES[vers] || famille(de) !== famille(vers)) return null;
    return net(q * FAMILLES[de][1] / FAMILLES[vers][1]);
  }

  // RM-09 : d'abord la conversion générique, sinon une équivalence de l'ingrédient
  // (ex. 1 pièce = 150 g), dans un sens ou dans l'autre. null = « sans conversion ».
  function convertir(q, de, vers, equivalences) {
    const g = convertirGenerique(q, de, vers);
    if (g !== null) return g;
    for (const eq of equivalences || []) {
      const sens = [[eq.qA, eq.uA, eq.qB, eq.uB], [eq.qB, eq.uB, eq.qA, eq.uA]];
      for (const [qx, ux, qy, uy] of sens) {
        const dansX = convertirGenerique(q, de, ux);
        if (dansX === null || famille(uy) !== famille(vers)) continue;
        return convertirGenerique(dansX * qy / qx, uy, vers);
      }
    }
    return null;
  }

  // --- Contenance (ADR-04) ----------------------------------------------------
  const normUnite = (u) => {
    u = u.toLowerCase();
    if (u === 'pc' || u === 'pcs' || u === 'pièce' || u === 'pièces' || u === 'piece' || u === 'pieces') return 'pièce';
    return u;
  };

  // Propose une contenance à partir du texte libre de la colonne `Unité`.
  // Exemples : « 500g » → 500 g ; « 10x20cl » → 200 cl ; « caisse 8 kg » → 8 kg ;
  // « 10pc » → 10 pièces ; « pqt de 100 » → 100 pièces. Illisible → null.
  function proposerContenance(texte) {
    const s = String(texte || '').trim().toLowerCase().replace(/±/g, '').replace(/,/g, '.').trim();
    if (!s) return null;
    let m = s.match(/^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)$/);
    if (m) return { q: net(Number(m[1]) * Number(m[2])), u: m[3] };
    m = s.match(/^(\d+)\s*(pc|pcs|pièces?|pieces?)$/);
    if (m) return { q: Number(m[1]), u: 'pièce' };
    m = s.match(/^(?:pqt|paquet|boîte|boite|lot)\s+de\s+(\d+)$/);
    if (m) return { q: Number(m[1]), u: 'pièce' };
    m = s.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l)$/);
    if (m && Number(m[1]) > 0) return { q: Number(m[1]), u: m[2] };
    return null;
  }

  // Lit une contenance saisie par l'utilisateur : « 500 g », « 1,5 l », « 10 pièces ».
  function lireContenance(texte) {
    const m = String(texte || '').trim().match(/^(\d+(?:[.,]\d+)?)\s*(g|kg|ml|cl|l|L|pièces?|pieces?|pc|pcs)$/i);
    if (!m) return null;
    const q = Number(m[1].replace(',', '.'));
    if (!(q > 0)) return null;
    return { q, u: normUnite(m[2]) };
  }

  // --- RM-01 : besoin d'un ingrédient pour un repas ---------------------------
  const besoinRepas = (quantitePour10, effectif) => net(quantitePour10 * effectif / 10);

  // --- RM-05 : arrondi du total au conditionnement ----------------------------
  // N = Q / C. On garde ⌊N⌋ si le manque qui en résulte reste sous la tolérance
  // (en % du total), sinon ⌈N⌉. Un multiple exact n'est jamais arrondi au-dessus.
  function arrondirTotal(Q, C, tolerancePct) {
    if (!(Q > 0) || !(C > 0)) return 0;
    const N = net(Q / C);
    const bas = Math.floor(N);
    if (N === bas) return bas;
    const manque = (N - bas) * C;
    return manque <= (tolerancePct || 0) / 100 * Q + 1e-12 ? bas : bas + 1;
  }

  // Répartition du total arrondi sur les lignes, au plus fort reste.
  // `besoins` est dans l'ordre chronologique ; à égalité, la ligne la plus tôt l'emporte.
  function repartir(total, besoins) {
    const Q = besoins.reduce((a, b) => a + b, 0);
    if (!(Q > 0)) return besoins.map(() => 0);
    const parts = besoins.map((b) => net(total * b / Q));
    const base = parts.map(Math.floor);
    let reste = total - base.reduce((a, b) => a + b, 0);
    const ordre = parts.map((p, i) => [net(p - base[i]), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    for (let k = 0; reste > 0 && k < ordre.length; k++, reste--) base[ordre[k][1]] += 1;
    return base;
  }

  // --- Produits ---------------------------------------------------------------
  const estRattachable = (p) => typeof p.code === 'string' && p.code.startsWith('ALM-') && p.actif === 'Oui';

  // RM-08 : « Frais » si la sous-catégorie du produit est marquée frais (ADR-08).
  function aCommander(produit, sousCategories) {
    const sc = (sousCategories || []).find((s) => s.nom === produit.sousCategorie);
    return sc && sc.frais ? 'Frais' : 'Gros achat';
  }

  const totalLigne = (q, prix) => Math.round(q * prix * 100) / 100;

  // Nombre au format belge : virgule décimale. Sans `decimales`, la forme la plus courte.
  function nombreFr(n, decimales) {
    if (n === null || n === undefined || Number.isNaN(n)) return '';
    const t = decimales === undefined ? String(net(n)) : Number(n).toFixed(decimales);
    return t.replace('.', ',');
  }

  // Affichage lisible d'une quantité (panneau du repas, fiche) : 2300 g → 2,3 kg.
  function formatQuantite(q, u) {
    if (u === 'g' && q >= 1000) return nombreFr(net(q / 1000)) + ' kg';
    if (u === 'ml' && q >= 1000) return nombreFr(net(q / 1000)) + ' l';
    if (u === 'pièce') return nombreFr(Math.round(q * 10) / 10) + (q > 1 ? ' pièces' : ' pièce');
    return nombreFr(Math.round(q * 1000) / 1000) + ' ' + u;
  }

  // --- Accès aux données ------------------------------------------------------
  const trouver = (liste, id) => liste.find((x) => x.id === id);
  const produitParCode = (etat, code) => etat.produits.find((p) => p.code === code);
  const equivalencesDe = (etat, ingredientId) => etat.equivalences.filter((e) => e.ingredientId === ingredientId);

  // Statut d'un ingrédient dans un séjour (F-10). Un seul manque par ingrédient, par priorité.
  // 'pret' | 'non-rattache' | 'introuvable' | 'contenance' | 'sans-conversion'
  function statutIngredient(etat, sejour, ingredientId, uniteRecette) {
    const code = sejour.rattachements[ingredientId];
    if (!code) return 'non-rattache';
    const p = produitParCode(etat, code);
    if (!p || p.present === false || !estRattachable(p)) return 'introuvable';
    if (!p.contenance || !p.contenanceValidee) return 'contenance';
    if (uniteRecette && convertir(1, uniteRecette, p.contenance.u, equivalencesDe(etat, ingredientId)) === null) return 'sans-conversion';
    return 'pret';
  }

  const LIBELLES_MANQUE = {
    'effectif': 'effectif non renseigné',
    'non-rattache': 'aucun produit rattaché',
    'introuvable': 'produit absent du dernier catalogue ou inactif',
    'contenance': 'contenance du produit non validée',
    'sans-conversion': 'pas de conversion vers l’unité du produit'
  };

  // F-10 : liste des éléments à compléter pour un repas.
  // Un repas à effectif 0 n'est pas exporté : il ne génère aucun manque.
  // Chaque ingrédient est contrôlé pour chacune des unités où il apparaît ; un seul manque par ingrédient.
  function manquesRepas(etat, sejour, repas) {
    const recette = trouver(etat.recettes, repas.recetteId);
    if (!recette || repas.effectif === 0) return [];
    const manques = [];
    if (repas.effectif === null || repas.effectif === undefined || repas.effectif === '') {
      manques.push({ type: 'effectif', ingredientId: null, nom: 'Effectif', texte: LIBELLES_MANQUE.effectif });
    }
    const unites = new Map();
    for (const l of recette.lignes) {
      if (!unites.has(l.ingredientId)) unites.set(l.ingredientId, new Set());
      unites.get(l.ingredientId).add(l.unite);
    }
    for (const [ingredientId, us] of unites) {
      let st = 'pret';
      for (const u of us) { st = statutIngredient(etat, sejour, ingredientId, u); if (st !== 'pret') break; }
      if (st !== 'pret') {
        const ing = trouver(etat.ingredients, ingredientId);
        manques.push({ type: st, ingredientId, nom: ing ? ing.nom : '?', texte: LIBELLES_MANQUE[st] });
      }
    }
    return manques;
  }

  // Aide à la saisie (US-03) : « 12 pièces » → « ≈ 720 g » ; « 300 g » → « ≈ 5 pièces ».
  function equivalenceAffichee(q, u, equivalences) {
    if (!(q > 0) || !(equivalences || []).length) return null;
    const cibles = u === 'pièce' ? ['g', 'ml'] : ['pièce'];
    for (const c of cibles) {
      const v = convertir(q, u, c, equivalences);
      if (v !== null) return '≈ ' + formatQuantite(v, c);
    }
    return null;
  }

  // Ingrédients utilisés dans un séjour, avec les repas qui les utilisent.
  function ingredientsDuSejour(etat, sejour) {
    const map = new Map();
    for (const r of sejour.repas) {
      const rec = trouver(etat.recettes, r.recetteId);
      if (!rec) continue;
      for (const l of rec.lignes) {
        if (!map.has(l.ingredientId)) map.set(l.ingredientId, { ingredientId: l.ingredientId, recettes: new Set(), unites: new Set() });
        map.get(l.ingredientId).recettes.add(rec.nom);
        map.get(l.ingredientId).unites.add(l.unite);
      }
    }
    return [...map.values()].map((x) => {
      const ing = trouver(etat.ingredients, x.ingredientId);
      let statut = 'pret';
      for (const u of x.unites) { const s = statutIngredient(etat, sejour, x.ingredientId, u); if (s !== 'pret') { statut = s; break; } }
      return { ingredientId: x.ingredientId, nom: ing ? ing.nom : '?', recettes: [...x.recettes].sort(), statut };
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }

  // --- Calcul de l'export (F-12) ---------------------------------------------
  // Retourne les lignes au format du contrat d'interface et la liste des manques.
  function calculerExport(etat, sejourId) {
    const sejour = trouver(etat.sejours, sejourId);
    const ordreMoment = new Map(sejour.moments.map((m, i) => [m.id, i]));
    const nomMoment = new Map(sejour.moments.map((m) => [m.id, m.nom]));
    const repasTries = sejour.repas.slice().sort((a, b) => a.jour - b.jour || ordreMoment.get(a.momentId) - ordreMoment.get(b.momentId));
    const tolerance = etat.parametres.tolerance || 0;

    const groupes = new Map();   // clé code|jour|moment → ligne normale (unité de contenance)
    const aVerifier = new Map(); // clé code|jour|moment|unité → ligne « À vérifier » (unité de recette)
    const manques = [];

    for (const r of repasTries) {
      const recette = trouver(etat.recettes, r.recetteId);
      if (!recette) continue;
      const ctx = { jour: r.jour, moment: nomMoment.get(r.momentId), ordre: ordreMoment.get(r.momentId), recette: recette.nom };
      for (const m of manquesRepas(etat, sejour, r)) manques.push(Object.assign({}, ctx, m));
      if (r.effectif === null || r.effectif === undefined || r.effectif === '' || r.effectif === 0) continue;

      for (const l of recette.lignes) {
        const code = sejour.rattachements[l.ingredientId];
        const p = code && produitParCode(etat, code);
        if (!p) continue; // non rattaché : pas de code à exporter
        const besoin = besoinRepas(l.quantite, r.effectif);
        const conv = p.contenance && p.contenanceValidee
          ? convertir(besoin, l.unite, p.contenance.u, equivalencesDe(etat, l.ingredientId)) : null;
        if (conv === null) {
          const cle = [code, r.jour, r.momentId, l.unite].join('|');
          const g = aVerifier.get(cle) || { produit: p, ctx, besoin: 0, unite: l.unite };
          g.besoin = net(g.besoin + besoin);
          aVerifier.set(cle, g);
        } else {
          const cle = [code, r.jour, r.momentId].join('|');
          const g = groupes.get(cle) || { produit: p, ctx, besoin: 0 };
          g.besoin = net(g.besoin + conv);
          groupes.set(cle, g);
        }
      }
    }

    // Arrondi sur le total par produit (RM-05), puis répartition par repas.
    const parCode = new Map();
    for (const g of groupes.values()) {
      if (!parCode.has(g.produit.code)) parCode.set(g.produit.code, []);
      parCode.get(g.produit.code).push(g);
    }
    const lignes = [];
    for (const liste of parCode.values()) {
      const p = liste[0].produit;
      const Q = liste.reduce((a, g) => a + g.besoin, 0);
      const T = arrondirTotal(Q, p.contenance.q, tolerance);
      const parts = repartir(T, liste.map((g) => net(g.besoin / p.contenance.q)));
      liste.forEach((g, i) => lignes.push(ligneExport(p, g.ctx, parts[i], aCommander(p, etat.sousCategories), g.besoin)));
    }
    for (const g of aVerifier.values()) {
      lignes.push(ligneExport(g.produit, g.ctx, g.besoin, 'À vérifier', g.besoin, g.unite));
    }
    lignes.sort((a, b) => a.jour - b.jour || a.ordre - b.ordre ||
      a.magasin.localeCompare(b.magasin, 'fr') || a.article.localeCompare(b.article, 'fr'));

    const produitsDistincts = new Set(lignes.map((l) => l.code));
    const magasins = new Set(lignes.map((l) => l.magasin).filter(Boolean));
    return { lignes, manques, resume: { lignes: lignes.length, produits: produitsDistincts.size, magasins: magasins.size } };
  }

  function ligneExport(p, ctx, quantite, aCmd, besoinExact, uniteRecette) {
    const verif = aCmd === 'À vérifier';
    return {
      code: p.code, article: p.nom, marque: p.marque || '', magasin: p.magasin || '',
      // Ligne « À vérifier » : la quantité est dans l'unité de la recette, on l'indique (écart journalisé).
      quantite, unite: verif ? uniteRecette : (p.unite || ''), prix: p.prix,
      totalLigne: verif ? null : totalLigne(quantite, p.prix || 0),
      destination: ctx.moment, activite: 'J' + ctx.jour, aCommander: aCmd, fiche: p.fiche || '',
      jour: ctx.jour, ordre: ctx.ordre, besoinExact, uniteRecette: uniteRecette || null
    };
  }

  const api = {
    UNITES, famille, convertirGenerique, convertir, proposerContenance, lireContenance,
    besoinRepas, arrondirTotal, repartir, estRattachable, aCommander, totalLigne, nombreFr, formatQuantite,
    statutIngredient, manquesRepas, equivalenceAffichee, ingredientsDuSejour, calculerExport, LIBELLES_MANQUE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else racine.GM_rules = api;
})(this);
