// =============================================================================
// INTERFACE (blocs B1 à B6 côté écran) — UX/UI Spec, zoning B, direction Brigade.
// L'interface ne calcule rien elle-même : elle appelle GM_rules, GM_csv, GM_format.
// Tout texte venu d'un fichier est inséré comme texte, jamais comme HTML (SEC-04).
// =============================================================================
(function () {
  'use strict';
  const F = window.GM_format, R = window.GM_rules, C = window.GM_csv;
  const CLE_SECOURS = 'gestion-menu:secours';
  const CLE_THEME = 'gestion-menu:theme';
  // Mode en ligne : seulement quand la page est servie par le site (pas en file://).
  const EN_LIGNE = /^https?:$/.test(window.location.protocol);
  let minuterieSauvegarde = null;

  // ---------------------------------------------------------------------------
  // État de l'application
  // ---------------------------------------------------------------------------
  const app = {
    etat: null,            // données (format JSON v1), source de vérité une fois enregistrées
    version: null,         // version de la base partagée (mode en ligne), pour détecter les conflits
    ui: nouvelleUI()
  };
  function nouvelleUI() {
    return {
      enLigne: false, ecranConnexion: false, attente: false, connexion: { id: '', mdp: '', erreur: '' },
      onglet: 'menu', fichier: null, dirty: false, enregistreA: null,
      sejourId: null, sel: [], actif: null, annulations: [], effBrouillon: '', effErreur: false,
      biblioQ: '', ingFiltre: 'tous', ingCur: null, prodQ: '',
      recetteId: null, recetteQ: '', nouvelleLigne: { ing: '', q: '', u: 'g', erreur: '' }, materielBrouillon: '',
      catFiltre: 'a-valider', catQ: '', catSel: {}, apercu: null, catErreur: '', catSucces: '', contSaisie: {},
      eqForm: { ing: '', qA: '1', uA: 'pièce', qB: '', uB: 'g', erreur: '' },
      brouillons: {}, erreurs: {}, alerte: '', alerteRecette: '',
      dialog: null, focusApres: null, erreurDemarrage: '', secoursIgnore: false
    };
  }

  // ---------------------------------------------------------------------------
  // Construction du DOM sans innerHTML (SEC-04)
  // ---------------------------------------------------------------------------
  const BOOLEENS = ['disabled', 'checked', 'selected', 'hidden', 'required', 'multiple'];
  function h(tag, props, ...enfants) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className = v;
      else if (k === 'k') el.dataset.k = v;
      else if (k === 'value') el.value = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (BOOLEENS.includes(k)) el[k] = true;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    ajouter(el, enfants);
    return el;
  }
  function ajouter(el, enfants) {
    for (const c of enfants) {
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) ajouter(el, c);
      else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }
  // Un lien vers une fiche produit n'est actif qu'en http(s) (SEC-04).
  const lienSur = (url, texte) => (/^https?:\/\//i.test(url || '')
    ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, texte) : null);

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const deux = (n) => String(n).padStart(2, '0');
  const heure = (d) => deux(d.getHours()) + ':' + deux(d.getMinutes());
  const dateLongue = (d) => d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + heure(d);
  const pluriel = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sejour';

  // ---------------------------------------------------------------------------
  // Copie de secours (SEC-02) : cache seulement, jamais appliquée sans confirmation
  // ---------------------------------------------------------------------------
  function ecrireSecours() {
    try { localStorage.setItem(CLE_SECOURS, JSON.stringify({ date: new Date().toISOString(), fichier: app.ui.fichier, etat: app.etat })); } catch (e) { /* stockage indisponible : SEC-01 reste actif */ }
  }
  function lireSecours() {
    try {
      const t = localStorage.getItem(CLE_SECOURS);
      if (!t) return null;
      const o = JSON.parse(t);
      const v = F.lire(JSON.stringify(o.etat));
      return v.ok ? { date: new Date(o.date), fichier: o.fichier, etat: v.etat } : null;
    } catch (e) { return null; }
  }
  function effacerSecours() { try { localStorage.removeItem(CLE_SECOURS); } catch (e) { /* rien */ } }

  // ---------------------------------------------------------------------------
  // Modifications
  // ---------------------------------------------------------------------------
  function modifier(fn) {
    fn(app.etat);
    app.ui.dirty = true;
    ecrireSecours();
    if (app.ui.enLigne) { clearTimeout(minuterieSauvegarde); minuterieSauvegarde = setTimeout(sauverPartage, 600); }
    render();
  }

  // ---------------------------------------------------------------------------
  // Mode en ligne : base partagée derrière un compte unique (api/session, api/etat)
  // ---------------------------------------------------------------------------
  async function appelApi(chemin, options) {
    const r = await fetch(chemin, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, options || {}));
    let corps = {};
    try { corps = await r.json(); } catch (e) { /* réponse sans JSON */ }
    return { statut: r.status, corps };
  }

  async function demarrerEnLigne() {
    app.ui.attente = true; render();
    let connecte = false;
    try { connecte = (await appelApi('/api/session')).statut === 200; } catch (e) { connecte = false; }
    if (connecte) return chargerPartage();
    app.ui.attente = false; app.ui.ecranConnexion = true; render();
  }

  async function seConnecter() {
    const c = app.ui.connexion;
    c.erreur = '';
    let r = null;
    try { r = await appelApi('/api/session', { method: 'POST', body: JSON.stringify({ id: c.id, motDePasse: c.mdp }) }); } catch (e) { r = null; }
    c.mdp = '';
    if (!r || r.statut !== 200) {
      c.erreur = r && r.statut === 401 ? 'Identifiant ou mot de passe incorrect.' : 'Connexion impossible pour le moment. Réessayez.';
      render(); return;
    }
    await chargerPartage();
  }

  async function chargerPartage() {
    app.ui.attente = true; render();
    let r = null;
    try { r = await appelApi('/api/etat'); } catch (e) { r = null; }
    app.ui.attente = false;
    if (!r || r.statut !== 200) {
      app.ui.ecranConnexion = true;
      app.ui.connexion.erreur = r && r.statut === 401 ? 'Session expirée : reconnectez-vous.' : ((r && r.corps.erreur) || 'Données indisponibles. Réessayez.');
      render(); return;
    }
    const v = F.lire(JSON.stringify(r.corps.donnees), 'Base partagée');
    if (!v.ok) { app.ui.ecranConnexion = true; app.ui.connexion.erreur = v.erreur; render(); return; }
    app.version = r.corps.version;
    app.ui.ecranConnexion = false;
    demarrerAvec(v.etat, 'Base partagée', false);
    app.ui.enLigne = true;
    render();
  }

  async function sauverPartage() {
    if (!app.ui.enLigne || !app.etat) return;
    clearTimeout(minuterieSauvegarde);
    let r = null;
    try { r = await appelApi('/api/etat', { method: 'PUT', body: JSON.stringify({ version: app.version, donnees: app.etat }) }); } catch (e) { r = null; }
    if (r && r.statut === 200) {
      app.version = r.corps.version;
      app.ui.dirty = false;
      annoncer('Modifications enregistrées dans la base partagée.');
      return;
    }
    app.ui.alerte = r && r.statut === 409
      ? (r.corps.erreur + ' Vos dernières modifications ne sont pas enregistrées.')
      : (r && r.statut === 401 ? 'Connexion perdue : vos dernières modifications ne sont pas enregistrées. Reconnectez-vous.'
        : 'Enregistrement impossible pour le moment : vos modifications sont conservées ici, réessayez.');
    render();
  }

  // ----- Thème clair / sombre (choix mémorisé sur l'appareil) -------------------
  function basculerTheme() {
    const actuel = document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair');
    const suivant = actuel === 'sombre' ? 'clair' : 'sombre';
    document.documentElement.setAttribute('data-theme', suivant);
    try { localStorage.setItem(CLE_THEME, suivant); } catch (e) { /* stockage indisponible */ }
    render();
  }
  function appliquerThemeMemorise() {
    try {
      const t = localStorage.getItem(CLE_THEME);
      if (t === 'clair' || t === 'sombre') document.documentElement.setAttribute('data-theme', t);
    } catch (e) { /* rien */ }
  }

  // ----- Déconnexion (mode en ligne) ---------------------------------------------
  async function seDeconnecter() {
    if (app.ui.dirty) await sauverPartage();
    try { await appelApi('/api/session', { method: 'DELETE' }); } catch (e) { /* le cookie expirera de toute façon */ }
    clearTimeout(minuterieSauvegarde);
    app.etat = null; app.version = null;
    app.ui = nouvelleUI(); app.ui.ecranConnexion = true;
    render();
  }

  // ----- Liste de courses : aperçu exact de ce que l'export contiendra ----------
  function vueCourses() {
    const s = sejour();
    if (!s) return h('div', { class: 'muted', style: 'padding:24px' }, 'Aucun séjour. Créez un séjour pour voir sa liste de courses.');
    const res = R.calculerExport(app.etat, s.id);
    const n = res.manques.length;
    const cellules = (l) => [l.code, l.article, l.marque, l.magasin, R.nombreFr(l.quantite), l.unite, R.nombreFr(l.prix),
      l.totalLigne === null ? '' : R.nombreFr(l.totalLigne, 2), l.destination, l.activite, l.aCommander, l.fiche];
    return h('section', { class: 'pile', style: 'padding:16px 24px', 'aria-labelledby': 'courses-t' },
      h('h2', { id: 'courses-t' }, 'Liste de courses — ' + s.nom),
      h('p', { class: 'muted petit', style: 'margin:0' }, pluriel(res.resume.lignes, 'ligne') + ' · ' + pluriel(res.resume.produits, 'produit') + ' · ' + pluriel(res.resume.magasins, 'magasin') + '. C’est exactement ce que contiendra l’export.'),
      n ? h('div', { class: 'message m-alerte', role: 'status' }, '△ ' + pluriel(n, 'manque') + ' : ingrédients non rattachés ou repas sans effectif. Ils ne seront pas exportés.') : null,
      res.lignes.length
        ? h('div', { class: 'tableau-boite' }, h('table', null,
          h('thead', null, h('tr', null, C.COLONNES_EXPORT.map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', null, res.lignes.map((l) => h('tr', null, cellules(l).map((v) => h('td', null, String(v === null || v === undefined ? '' : v))))))))
        : h('p', null, 'Rien à exporter pour l’instant : rattachez des produits et saisissez des effectifs.'),
      h('div', null, h('button', { class: 'btn-primaire', onClick: () => ouvrirDialog({ type: 'export' }), disabled: !res.lignes.length }, 'Exporter la liste de courses')));
  }

  function vueAttente() {
    return h('main', { class: 'demarrage' }, h('div', { class: 'gauche' }, h('p', { class: 'muted', role: 'status' }, 'Chargement…')));
  }

  function vueConnexion() {
    const c = app.ui.connexion;
    return h('div', null,
      h('header', { class: 'barre' }, h('div', { class: 'titre' }, 'Menus de séjour'), h('div', { class: 'fichier' }, 'Connexion')),
      h('main', { class: 'demarrage' }, h('div', { class: 'gauche' },
        h('h1', null, 'Connexion'),
        h('p', { class: 'muted', style: 'font-size:17px;margin:0' }, 'Les recettes et les séjours sont partagés entre tous les utilisateurs.'),
        h('form', { class: 'pile', onSubmit: (ev) => { ev.preventDefault(); seConnecter(); } },
          h('label', { class: 'champ' }, 'Identifiant', h('input', { k: 'connexion-id', autocomplete: 'username', value: c.id, onInput: (ev) => { c.id = ev.target.value; } })),
          h('label', { class: 'champ' }, 'Mot de passe', h('input', { k: 'connexion-mdp', type: 'password', autocomplete: 'current-password', value: c.mdp, onInput: (ev) => { c.mdp = ev.target.value; } })),
          c.erreur ? h('div', { class: 'message m-erreur', role: 'alert' }, '✕ ' + c.erreur) : null,
          h('button', { class: 'btn-primaire', k: 'connexion-valider', type: 'submit', style: 'min-height:48px' }, 'Se connecter')))));
  }
  // Modifications de la grille : annulables (Ctrl+Z), historique en mémoire seulement.
  function modifierGrille(libelle, fn) {
    const s = sejour();
    app.ui.annulations.push({ sejourId: s.id, repas: JSON.parse(JSON.stringify(s.repas)), libelle });
    if (app.ui.annulations.length > 50) app.ui.annulations.shift();
    modifier(fn);
  }
  function annuler() {
    const s0 = sejour();
    let i = app.ui.annulations.length - 1;
    while (i >= 0 && (!s0 || app.ui.annulations[i].sejourId !== s0.id)) i--;
    if (i < 0) return;
    const a = app.ui.annulations.splice(i, 1)[0];
    const s = app.etat.sejours.find((x) => x.id === a.sejourId);
    if (s) s.repas = a.repas;
    app.ui.dirty = true; ecrireSecours();
    annoncer('Annulé : ' + a.libelle);
    render();
  }

  // ---------------------------------------------------------------------------
  // Accès pratiques
  // ---------------------------------------------------------------------------
  function sejour() {
    const e = app.etat;
    return e.sejours.find((s) => s.id === app.ui.sejourId) || e.sejours[0] || null;
  }
  const recette = (id) => app.etat.recettes.find((r) => r.id === id);
  const ingredient = (id) => app.etat.ingredients.find((i) => i.id === id);
  const produit = (code) => app.etat.produits.find((p) => p.code === code);
  const repasDe = (s, jour, momentId) => s.repas.find((r) => r.jour === jour && r.momentId === momentId);
  const nomMoment = (s, id) => (s.moments.find((m) => m.id === id) || {}).nom || '?';
  const estSel = (j, m) => app.ui.sel.some(([a, b]) => a === j && b === m);

  function ingredientParNom(nom, creer) {
    const n = norm(nom);
    let ing = app.etat.ingredients.find((i) => norm(i.nom) === n);
    if (!ing && creer) { ing = { id: F.id('ing'), nom: nom.trim(), dernierProduit: null }; app.etat.ingredients.push(ing); }
    return ing;
  }

  // ---------------------------------------------------------------------------
  // Messages de statut (annoncés aux lecteurs d'écran)
  // ---------------------------------------------------------------------------
  let minuteurToast = null;
  function annoncer(texte) {
    const zone = document.getElementById('statut');
    zone.replaceChildren(h('div', { class: 'toast' }, '✓ ' + texte));
    clearTimeout(minuteurToast);
    minuteurToast = setTimeout(() => zone.replaceChildren(), 5000);
  }

  // ---------------------------------------------------------------------------
  // Fichiers : ouvrir, enregistrer (SEC-01, SEC-03, SEC-05), télécharger
  // ---------------------------------------------------------------------------
  function telecharger(nom, texte, type) {
    const url = URL.createObjectURL(new Blob([texte], { type }));
    const a = h('a', { href: url, download: nom, style: 'display:none' });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function choisirFichier(accept, surFichier) {
    const input = h('input', { type: 'file', accept, style: 'display:none' });
    input.addEventListener('change', () => { const f = input.files[0]; input.remove(); if (f) surFichier(f); });
    document.body.append(input); input.click();
  }

  function demanderOuverture() {
    if (app.etat && app.ui.dirty) {
      ouvrirDialog({ type: 'confirmer', titre: 'Ouvrir un autre fichier ?',
        texte: 'Les modifications non enregistrées seront perdues. Enregistrez d’abord si vous voulez les garder.',
        bouton: 'Ouvrir quand même', danger: true, action: () => choisirFichier('.json,application/json', chargerFichier) });
      return;
    }
    choisirFichier('.json,application/json', chargerFichier);
  }

  async function chargerFichier(fichier) {
    const texte = await fichier.text();
    const r = F.lire(texte, fichier.name);
    if (!r.ok) {
      if (app.etat) app.ui.alerte = r.erreur; else app.ui.erreurDemarrage = r.erreur;
      render(); return;
    }
    // La copie de secours n'est pas effacée ici : elle reste récupérable jusqu'au prochain enregistrement.
    demarrerAvec(r.etat, fichier.name, false);
    annoncer('Fichier ouvert : ' + fichier.name);
  }

  function demarrerAvec(etat, nomFichier, modifie) {
    const garde = app.ui.secoursIgnore;
    app.etat = etat;
    app.ui = nouvelleUI();
    app.ui.secoursIgnore = garde;
    app.ui.fichier = nomFichier;
    app.ui.dirty = modifie;
    const s = etat.sejours[0];
    if (s) { app.ui.sejourId = s.id; if (s.moments[0]) { app.ui.sel = [[1, s.moments[0].id]]; app.ui.actif = [1, s.moments[0].id]; } }
    render();
  }

  async function enregistrer() {
    if (!app.etat) return;
    if (app.ui.enLigne) sauverPartage(); // la base partagée est enregistrée ; le fichier reste disponible
    const nom = F.nomFichier(new Date());
    const texte = F.serialiser(app.etat);
    if (window.showSaveFilePicker) {
      try {
        const poignee = await window.showSaveFilePicker({ suggestedName: nom, types: [{ description: 'Fichier de menus', accept: { 'application/json': ['.json'] } }] });
        const w = await poignee.createWritable();
        await w.write(texte); await w.close();
        enregistre(poignee.name || nom);
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        app.ui.alerte = '✕ L’enregistrement a échoué (' + (e && e.message ? e.message : 'erreur inconnue') + '). Vos modifications sont toujours là : réessayez.';
        render();
      }
    } else {
      telecharger(nom, texte, 'application/json');
      enregistre(nom);
    }
  }
  function enregistre(nom) {
    app.ui.fichier = nom; app.ui.dirty = false; app.ui.enregistreA = new Date();
    effacerSecours();
    annoncer('Enregistré : ' + nom);
    render();
  }

  // ---------------------------------------------------------------------------
  // Fenêtres (un seul modèle) : focus piégé, Échap ferme, retour du focus
  // ---------------------------------------------------------------------------
  function ouvrirDialog(d) {
    d.retour = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
    app.ui.dialog = d;
    app.ui.focusApres = 'dlg-defaut';
    render();
  }
  function fermerDialog() {
    const d = app.ui.dialog;
    app.ui.dialog = null;
    if (d && d.retour) app.ui.focusApres = d.retour;
    render();
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  function render() {
    const actif = document.activeElement;
    const k = actif && actif.dataset ? actif.dataset.k : null;
    const selection = actif && 'selectionStart' in actif ? [actif.selectionStart, actif.selectionEnd] : null;
    const vue = app.ui.attente ? vueAttente() : app.ui.ecranConnexion ? vueConnexion() : app.etat ? vueApp() : vueDemarrage();
    document.getElementById('app').replaceChildren(vue);
    const cible = app.ui.focusApres || k;
    app.ui.focusApres = null;
    if (cible) {
      const el = document.querySelector('[data-k="' + cible.replace(/"/g, '') + '"]');
      if (el) {
        el.focus({ preventScroll: cible === k });
        if (cible === k && selection && 'setSelectionRange' in el) { try { el.setSelectionRange(selection[0], selection[1]); } catch (e) { /* type sans sélection */ } }
      }
    }
  }

  // ----- Démarrage (F-13, US-08) ---------------------------------------------
  function vueDemarrage() {
    const secours = app.ui.secoursIgnore ? null : lireSecours();
    return h('div', null,
      h('header', { class: 'barre' }, h('div', { class: 'titre' }, 'Menus de séjour'), h('div', { class: 'fichier' }, 'Aucun fichier ouvert')),
      h('main', { class: 'demarrage' },
        h('div', { class: 'gauche' },
          h('h1', null, 'Ouvrez votre fichier de menus pour continuer'),
          h('p', { class: 'muted', style: 'font-size:17px;margin:0' }, 'Vos recettes, séjours et rattachements sont dans un fichier .json sur votre ordinateur. L’outil ne garde rien en ligne.'),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn-primaire', k: 'ouvrir', style: 'min-height:48px', onClick: demanderOuverture }, 'Ouvrir un fichier'),
            h('button', { k: 'nouveau', style: 'min-height:48px', onClick: () => demarrerAvec(F.nouvelEtat(), null, false) }, 'Nouveau fichier')),
          app.ui.erreurDemarrage ? h('div', { class: 'message m-erreur', role: 'alert' }, '✕ ' + app.ui.erreurDemarrage) : null),
        secours ? h('section', { class: 'carte reprise pile', 'aria-labelledby': 'reprise-t' },
          h('h2', { id: 'reprise-t' }, '△ Travail non enregistré retrouvé'),
          h('p', { style: 'margin:0' }, 'Une copie de secours du ', h('strong', null, dateLongue(secours.date)), ' existe dans ce navigateur. Elle contient des modifications faites après le dernier enregistrement' + (secours.fichier ? ' de ' + secours.fichier : '') + '.'),
          h('div', { class: 'muted petit' }, secours.etat.sejours.length + ' séjour(s) · ' + secours.etat.recettes.length + ' recette(s) · ' + secours.etat.produits.length + ' produit(s)'),
          h('div', { class: 'ligne' },
            h('button', { class: 'btn-primaire', k: 'reprendre', onClick: () => { demarrerAvec(secours.etat, secours.fichier, true); annoncer('Copie de secours reprise. Pensez à enregistrer.'); } }, 'Reprendre la copie'),
            h('button', { k: 'ignorer', onClick: () => { app.ui.secoursIgnore = true; render(); demanderOuverture(); } }, 'Ignorer et ouvrir un fichier')),
          h('div', { class: 'muted petit' }, 'Après reprise, pensez à enregistrer : la copie de secours peut être effacée par le navigateur.')) : null));
  }

  // ----- Application ------------------------------------------------------------
  const ONGLETS = [['menu', 'Menu'], ['courses', 'Liste de courses'], ['ingredients', 'Ingrédients du séjour'], ['recettes', 'Recettes'], ['catalogue', 'Catalogue'], ['referentiels', 'Référentiels']];

  function manquesSejour(s) {
    let total = 0, repas = 0;
    if (!s) return { total, repas };
    for (const r of s.repas) { const n = R.manquesRepas(app.etat, s, r).length; if (n) { total += n; repas += 1; } }
    return { total, repas };
  }

  function vueApp() {
    const s = sejour();
    const aFaireIng = s ? R.ingredientsDuSejour(app.etat, s).filter((i) => i.statut !== 'pret').length : 0;
    const etatFichier = app.ui.dirty
      ? h('span', { class: 'etat etat-modifie' }, '● Non enregistré')
      : (app.ui.enregistreA ? h('span', { class: 'etat etat-ok' }, '✓ Enregistré à ' + heure(app.ui.enregistreA)) : (app.ui.fichier ? h('span', { class: 'etat etat-ok' }, '✓ Ouvert') : null));
    const contenu = { menu: vueMenu, courses: vueCourses, ingredients: vueIngredients, recettes: vueRecettes, catalogue: vueCatalogue, referentiels: vueReferentiels }[app.ui.onglet]();
    const sombre = (document.documentElement.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair')) === 'sombre';
    return h('div', null,
      h('header', { class: 'barre' },
        h('div', { class: 'titre' }, 'Menus de séjour'),
        h('div', { class: 'fichier' }, app.ui.fichier || 'Nouveau fichier'),
        etatFichier,
        h('div', { class: 'espace' }),
        h('button', { k: 'b-theme', onClick: basculerTheme, 'aria-pressed': String(sombre) }, sombre ? 'Mode clair' : 'Mode sombre'),
        app.ui.enLigne ? h('button', { k: 'b-deconnexion', onClick: seDeconnecter }, 'Se déconnecter') : null,
        h('button', { k: 'b-ouvrir', onClick: demanderOuverture }, 'Ouvrir'),
        h('button', { k: 'b-enregistrer', title: 'Ctrl+S', onClick: enregistrer }, 'Enregistrer'),
        h('button', { k: 'b-exporter', class: 'btn-primaire', disabled: !s, onClick: () => ouvrirDialog({ type: 'export' }) }, 'Exporter la liste de courses')),
      h('nav', { class: 'onglets', role: 'tablist', 'aria-label': 'Sections' },
        ONGLETS.map(([id, nom]) => h('button', { role: 'tab', k: 'onglet-' + id, 'aria-selected': String(app.ui.onglet === id),
          onClick: () => { app.ui.onglet = id; app.ui.alerte = ''; render(); } },
        nom, id === 'ingredients' && aFaireIng ? h('span', { class: 'pastille p-alerte' }, '△ ' + aFaireIng) : null))),
      app.ui.alerte ? h('div', { class: 'message m-erreur', role: 'alert', style: 'margin:12px 24px 0' }, app.ui.alerte, ' ',
        h('button', { class: 'btn-petit', onClick: () => { app.ui.alerte = ''; render(); } }, 'Fermer')) : null,
      h('main', null, contenu),
      vueDialog());
  }

  // ----- Menu du séjour (F-07, F-08, F-10, US-04, US-06) ----------------------
  function vueMenu() {
    const e = app.etat, s = sejour();
    if (!s) {
      return h('div', { class: 'page' }, h('div', { class: 'carte pile', style: 'max-width:560px' },
        h('h1', null, 'Aucun séjour'),
        h('p', { style: 'margin:0' }, 'Aucun séjour dans ce fichier. Créez-en un pour composer le menu.'),
        h('div', null, h('button', { class: 'btn-primaire', k: 'creer-sejour', onClick: () => ouvrirDialog({ type: 'sejour' }) }, 'Créer un séjour'))));
    }
    const q = norm(app.ui.biblioQ);
    const recettes = e.recettes.filter((r) => !q || norm(r.nom).includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const single = app.ui.sel.length <= 1;
    const [sj, sm] = app.ui.sel[0] || [];
    const m = manquesSejour(s);
    const derniere = app.ui.annulations.filter((a) => a.sejourId === s.id).slice(-1)[0];

    const gauche = h('aside', { class: 'col-g', 'aria-label': 'Bibliothèque de recettes' },
      h('h2', null, 'Recettes'),
      h('label', { class: 'champ' }, h('span', { class: 'muted', style: 'font-weight:400' }, 'Rechercher'),
        h('input', { k: 'biblio-q', value: app.ui.biblioQ, placeholder: 'Nom de la recette', onInput: (ev) => { app.ui.biblioQ = ev.target.value; render(); } })),
      h('div', { class: 'muted petit' }, app.ui.sel.length === 0 ? 'Sélectionnez une case dans la grille.'
        : single ? 'Clic : place la recette en J' + sj + ' ' + nomMoment(s, sm) + ', puis passe au jour suivant.'
          : 'Clic : place la recette dans les ' + app.ui.sel.length + ' cases sélectionnées.'),
      e.recettes.length === 0 ? h('div', { class: 'pile' }, h('p', { style: 'margin:0' }, 'Aucune recette. Créez votre première recette pour 10 personnes.'),
        h('div', null, h('button', { onClick: () => { app.ui.onglet = 'recettes'; render(); } }, 'Nouvelle recette'))) : null,
      e.recettes.length && !recettes.length ? h('div', { class: 'muted' }, 'Aucune recette ne correspond à « ' + app.ui.biblioQ + ' ».') : null,
      recettes.map((r) => h('button', { class: 'biblio-item', k: 'biblio-' + r.id, disabled: app.ui.sel.length === 0, onClick: () => placer(r) },
        h('span', null, r.nom), h('span', { class: 'muted petit' }, r.lignes.length + ' ingr.'))));

    const cols = s.moments.length;
    const grille = h('div', { class: 'grille', role: 'grid', 'aria-label': 'Menu du séjour ' + s.nom + ', jours en lignes, moments en colonnes',
      style: 'grid-template-columns: 64px repeat(' + cols + ', minmax(0, 1fr))' },
    h('div', { role: 'row', style: 'display:contents' }, h('div', { role: 'columnheader' }, h('span', { class: 'sr' }, 'Jour')),
      s.moments.map((mo) => h('div', { role: 'columnheader', class: 'entete-moment' }, mo.nom))),
    Array.from({ length: s.nbJours }, (_, i) => i + 1).map((j) => h('div', { role: 'row', style: 'display:contents' },
      h('div', { role: 'rowheader', class: 'entete-jour' }, 'J' + j),
      s.moments.map((mo) => caseMenu(s, j, mo)))));

    const centre = h('section', { class: 'col-c', 'aria-label': 'Grille du menu' },
      h('div', { class: 'ligne' },
        h('h1', null, s.nom),
        e.sejours.length > 1 ? h('label', null, h('span', { class: 'sr' }, 'Séjour'),
          h('select', { k: 'choix-sejour', onChange: (ev) => { app.ui.sejourId = ev.target.value; app.ui.sel = []; app.ui.actif = null; render(); } },
            e.sejours.map((x) => h('option', { value: x.id, selected: x.id === s.id }, x.nom)))) : null,
        h('span', { class: 'muted' }, s.nbJours + ' jours, ' + s.moments.length + ' moments'),
        m.total ? h('span', { class: 'pastille p-alerte' }, '△ ' + m.total + ' à compléter dans ' + m.repas + ' repas')
          : (s.repas.length ? h('span', { class: 'pastille p-ok' }, '✓ Menu complet, prêt à exporter') : null),
        h('div', { class: 'espace' }),
        h('button', { class: 'btn-petit', k: 'annuler', disabled: !derniere, title: 'Ctrl+Z', onClick: annuler }, '↶ Annuler' + (derniere ? ' (' + derniere.libelle + ')' : '')),
        h('button', { class: 'btn-petit', k: 'modifier-sejour', onClick: () => ouvrirDialog({ type: 'sejour', sejourId: s.id }) }, 'Modifier le séjour'),
        h('button', { class: 'btn-petit', k: 'nouveau-sejour', onClick: () => ouvrirDialog({ type: 'sejour' }) }, 'Nouveau séjour')),
      grille,
      h('div', { class: 'muted petit' }, 'Flèches : changer de case. Entrée : chercher une recette. Maj + clic ou Maj + flèches : sélectionner plusieurs cases. Suppr : vider. Ctrl+Z : annuler dans la grille.'));

    return h('div', { class: 'trois' }, gauche, centre, h('aside', { class: 'col-d', 'aria-label': 'Repas sélectionné' }, panneauRepas(s)));
  }

  function caseMenu(s, j, mo) {
    const r = repasDe(s, j, mo.id);
    const rec = r && recette(r.recetteId);
    const manques = rec ? R.manquesRepas(app.etat, s, r) : [];
    const sel = estSel(j, mo.id);
    const actif = app.ui.actif && app.ui.actif[0] === j && app.ui.actif[1] === mo.id;
    const eff = rec ? (r.effectif === null || r.effectif === undefined ? 'Effectif ?' : r.effectif + ' pers.') : '';
    return h('button', {
      role: 'gridcell', class: 'case' + (rec ? '' : ' vide'), k: 'case-' + j + '-' + mo.id,
      tabindex: actif || (!app.ui.actif && j === 1 && mo.id === s.moments[0].id) ? '0' : '-1',
      'aria-selected': String(sel),
      'aria-label': 'J' + j + ' ' + mo.nom + ', ' + (rec ? rec.nom + ', ' + eff : 'vide') + (manques.length ? ', ' + manques.length + ' élément(s) à compléter' : ''),
      onClick: (ev) => choisirCase(j, mo.id, ev.shiftKey),
      onKeydown: (ev) => toucheCase(ev, s, j, mo.id)
    },
    h('span', { class: 'nom-recette' }, rec ? rec.nom : '+ Placer une recette'),
    h('span', { class: 'bas' }, h('span', { class: 'effectif' }, eff),
      manques.length ? h('span', { class: 'pastille p-alerte', 'aria-hidden': 'true' }, '△ ' + manques.length) : null));
  }

  function choisirCase(j, m, ajout) {
    if (ajout) {
      app.ui.sel = estSel(j, m) ? app.ui.sel.filter(([a, b]) => !(a === j && b === m)) : app.ui.sel.concat([[j, m]]);
      if (!app.ui.sel.length) app.ui.sel = [[j, m]];
    } else app.ui.sel = [[j, m]];
    app.ui.actif = [j, m];
    const r = repasDe(sejour(), j, m);
    app.ui.effBrouillon = r && r.effectif !== null && r.effectif !== undefined ? String(r.effectif) : '';
    app.ui.effErreur = false;
    app.ui.focusApres = 'case-' + j + '-' + m;
    render();
  }

  function toucheCase(ev, s, j, m) {
    const idx = s.moments.findIndex((x) => x.id === m);
    let nj = j, ni = idx;
    if (ev.key === 'ArrowDown') nj = Math.min(s.nbJours, j + 1);
    else if (ev.key === 'ArrowUp') nj = Math.max(1, j - 1);
    else if (ev.key === 'ArrowRight') ni = Math.min(s.moments.length - 1, idx + 1);
    else if (ev.key === 'ArrowLeft') ni = Math.max(0, idx - 1);
    else if (ev.key === 'Enter') { ev.preventDefault(); const q = document.querySelector('[data-k="biblio-q"]'); if (q) q.focus(); return; }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); viderSelection(); return; }
    else return;
    ev.preventDefault();
    choisirCase(nj, s.moments[ni].id, ev.shiftKey);
  }

  function placer(rec) {
    const s = sejour();
    const cibles = app.ui.sel.slice();
    if (!cibles.length) return;
    const remplaces = [];
    modifierGrille('placer « ' + rec.nom + ' »', () => {
      for (const [j, m] of cibles) {
        const r = repasDe(s, j, m);
        if (r) { if (r.recetteId !== rec.id) { const ancien = recette(r.recetteId); if (ancien) remplaces.push(ancien.nom); } r.recetteId = rec.id; }
        else s.repas.push({ jour: j, momentId: m, recetteId: rec.id, effectif: null });
      }
      // Placement en chaîne : une seule case → on passe au jour suivant, même moment.
      if (cibles.length === 1 && cibles[0][0] < s.nbJours) {
        const [j, m] = cibles[0];
        app.ui.sel = [[j + 1, m]]; app.ui.actif = [j + 1, m];
        const suiv = repasDe(s, j + 1, m);
        app.ui.effBrouillon = suiv && suiv.effectif !== null ? String(suiv.effectif) : '';
      }
    });
    if (remplaces.length) annoncer('Remplacé : ' + remplaces.join(', ') + ' → ' + rec.nom + ' (Ctrl+Z pour annuler)');
  }

  function viderSelection() {
    const s = sejour();
    const cibles = app.ui.sel.filter(([j, m]) => repasDe(s, j, m));
    if (!cibles.length) return;
    modifierGrille(cibles.length === 1 ? 'vider J' + cibles[0][0] + ' ' + nomMoment(s, cibles[0][1]) : 'vider ' + cibles.length + ' cases', () => {
      s.repas = s.repas.filter((r) => !cibles.some(([j, m]) => r.jour === j && r.momentId === m));
    });
  }

  function appliquerEffectif() {
    const t = app.ui.effBrouillon.trim();
    if (!/^\d+$/.test(t)) { app.ui.effErreur = true; render(); return; }
    const s = sejour(), n = Number(t);
    const cibles = app.ui.sel.filter(([j, m]) => repasDe(s, j, m));
    if (!cibles.length) return;
    app.ui.effErreur = false;
    modifierGrille('effectif ' + n, () => { for (const [j, m] of cibles) repasDe(s, j, m).effectif = n; });
  }

  function champEffectif(libelle) {
    return h('div', { class: 'pile' },
      h('div', { class: 'ligne', style: 'align-items:flex-end' },
        h('label', { class: 'champ' }, libelle,
          h('input', { k: 'eff', inputmode: 'numeric', style: 'width:100px', class: app.ui.effErreur ? 'invalide' : null,
            'aria-invalid': app.ui.effErreur ? 'true' : null, 'aria-describedby': 'eff-aide', value: app.ui.effBrouillon,
            onInput: (ev) => { app.ui.effBrouillon = ev.target.value; app.ui.effErreur = false; },
            onKeydown: (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); appliquerEffectif(); } } })),
        h('button', { class: app.ui.sel.length > 1 ? 'btn-primaire' : 'btn-contour', k: 'eff-appliquer', onClick: appliquerEffectif },
          app.ui.sel.length > 1 ? 'Appliquer l’effectif' : 'Appliquer')),
      h('div', { id: 'eff-aide', class: app.ui.effErreur ? 'erreur-champ' : 'muted petit' },
        app.ui.effErreur ? '✕ Saisissez un nombre entier, par exemple 42.' : 'Nombre de personnes à nourrir pour ce repas.'));
  }

  function panneauRepas(s) {
    if (!app.ui.sel.length) return h('p', { class: 'muted' }, 'Sélectionnez une case de la grille.');
    if (app.ui.sel.length > 1) {
      return h('div', { class: 'pile' },
        h('h2', null, app.ui.sel.length + ' cases sélectionnées'),
        champEffectif('Effectif à appliquer'),
        h('div', { class: 'muted petit' }, 'Clic sur une recette à gauche : la place dans toutes les cases sélectionnées.'),
        h('div', null, h('button', { class: 'btn-petit', onClick: viderSelection }, 'Vider les cases')));
    }
    const [j, m] = app.ui.sel[0];
    const r = repasDe(s, j, m);
    const rec = r && recette(r.recetteId);
    const titre = h('div', { class: 'muted' }, 'J' + j + ' · ' + nomMoment(s, m));
    if (!rec) return h('div', { class: 'pile' }, titre, h('h2', { style: 'font-size:26px' }, 'Case vide'),
      h('p', { class: 'muted', style: 'margin:0' }, 'Case vide. Cliquez sur une recette à gauche pour la placer ici.'));
    const manques = R.manquesRepas(app.etat, s, r);
    const eff = r.effectif;
    return h('div', { class: 'pile', style: 'gap:14px' },
      titre, h('h2', { style: 'font-size:26px;font-weight:700' }, rec.nom),
      champEffectif('Effectif'),
      manques.length ? h('section', { class: 'message m-alerte pile', 'aria-label': 'Éléments à compléter' },
        h('h3', { style: 'font-size:19px;color:var(--warning-text)' }, '△ ' + manques.length + ' à compléter'),
        manques.map((mq) => h('div', { class: 'pile', style: 'gap:6px' },
          h('div', null, h('strong', null, mq.nom), ' : ' + mq.texte),
          h('div', null, boutonCorrection(mq, s))))) : h('div', { class: 'message m-ok' }, '✓ Repas complet'),
      h('div', { class: 'pile', style: 'gap:2px' },
        h('div', { style: 'font-weight:600' }, 'Ingrédients pour ' + (eff === null || eff === undefined ? '— (effectif à saisir)' : eff)),
        rec.lignes.map((l) => {
          const ing = ingredient(l.ingredientId);
          return h('div', { class: 'ligne', style: 'justify-content:space-between;border-bottom:1px solid var(--surface-muted);padding:3px 0' },
            h('span', null, ing ? ing.nom : '?'),
            h('span', null, eff === null || eff === undefined ? '—' : R.formatQuantite(R.besoinRepas(l.quantite, eff), l.unite)));
        })),
      h('div', null, h('strong', null, 'Matériel'), ' : ' + (rec.materiel.length ? rec.materiel.join(', ') : '—')),
      h('div', { class: 'ligne' },
        h('button', { class: 'btn-petit', onClick: () => { app.ui.onglet = 'recettes'; app.ui.recetteId = rec.id; render(); } }, 'Modifier la recette'),
        h('button', { class: 'btn-petit', onClick: viderSelection }, 'Vider la case')));
  }

  function boutonCorrection(mq, s) {
    const aller = (onglet, maj) => () => { Object.assign(app.ui, maj); app.ui.onglet = onglet; render(); };
    const ing = mq.ingredientId && ingredient(mq.ingredientId);
    switch (mq.type) {
      case 'effectif': return h('button', { class: 'btn-contour btn-petit', onClick: () => { const el = document.querySelector('[data-k="eff"]'); if (el) el.focus(); } }, 'Saisir l’effectif');
      case 'non-rattache':
      case 'introuvable': return h('button', { class: 'btn-contour btn-petit', onClick: aller('ingredients', { ingCur: mq.ingredientId, prodQ: ing ? premierMot(ing.nom) : '', focusApres: 'prod-q' }) }, mq.type === 'introuvable' ? 'Changer de produit' : 'Rattacher');
      case 'contenance': return h('button', { class: 'btn-contour btn-petit', onClick: aller('catalogue', { catQ: s.rattachements[mq.ingredientId] || '', catFiltre: 'tous', focusApres: 'cat-q' }) }, 'Valider la contenance');
      case 'sans-conversion': return h('button', { class: 'btn-contour btn-petit', onClick: aller('referentiels', { eqForm: Object.assign({}, app.ui.eqForm, { ing: mq.ingredientId, erreur: '' }), focusApres: 'eq-qb' }) }, 'Ajouter une équivalence');
      default: return null;
    }
  }
  const premierMot = (nom) => norm(nom).split(/\s+/)[0].replace(/s$/, '');

  // ----- Ingrédients du séjour (F-09, US-05) ----------------------------------
  const STATUTS = {
    'pret': ['✓ Prêt', 'p-ok'], 'non-rattache': ['△ Non rattaché', 'p-alerte'], 'introuvable': ['△ Produit introuvable', 'p-alerte'],
    'contenance': ['△ Contenance à valider', 'p-alerte'], 'sans-conversion': ['△ Sans conversion', 'p-alerte']
  };
  function vueIngredients() {
    const s = sejour();
    if (!s) return h('div', { class: 'page' }, h('p', null, 'Créez d’abord un séjour dans l’onglet Menu.'));
    const tous = R.ingredientsDuSejour(app.etat, s);
    const aFaire = tous.filter((i) => i.statut !== 'pret');
    const liste = app.ui.ingFiltre === 'a-faire' ? aFaire : tous;
    const centre = h('section', { class: 'col-c' },
      h('div', { class: 'ligne', style: 'align-items:baseline' }, h('h1', null, 'Ingrédients du séjour ' + s.nom),
        h('span', { class: 'muted' }, tous.length + ' ingrédients, ' + aFaire.length + ' à compléter')),
      tous.length === 0 ? h('div', { class: 'carte pile' }, h('p', { style: 'margin:0' }, 'Les ingrédients apparaîtront ici dès qu’une recette sera placée dans le menu.'),
        h('div', null, h('button', { onClick: () => { app.ui.onglet = 'menu'; render(); } }, 'Aller au menu'))) : [
        h('div', { class: 'ligne', role: 'group', 'aria-label': 'Filtre' },
          h('button', { class: 'btn-petit', 'aria-pressed': String(app.ui.ingFiltre === 'tous'), style: app.ui.ingFiltre === 'tous' ? 'border:2px solid var(--primary)' : null, onClick: () => { app.ui.ingFiltre = 'tous'; render(); } }, 'Tous'),
          h('button', { class: 'btn-petit', 'aria-pressed': String(app.ui.ingFiltre === 'a-faire'), style: app.ui.ingFiltre === 'a-faire' ? 'border:2px solid var(--primary)' : null, onClick: () => { app.ui.ingFiltre = 'a-faire'; render(); } }, '△ À compléter (' + aFaire.length + ')')),
        h('div', { class: 'tableau-boite' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Ingrédient'), h('th', null, 'Utilisé dans'), h('th', null, 'Produit rattaché'), h('th', null, 'Statut'), h('th', null, h('span', { class: 'sr' }, 'Action')))),
          h('tbody', null, liste.map((i) => {
            const code = s.rattachements[i.ingredientId];
            const p = code && produit(code);
            const [txt, cls] = STATUTS[i.statut];
            return h('tr', { class: app.ui.ingCur === i.ingredientId ? 'courant' : null },
              h('td', { style: 'font-weight:600' }, i.nom),
              h('td', { class: 'muted' }, i.recettes.join(', ')),
              h('td', null, p ? code + ' · ' + p.nom : (code || '—')),
              h('td', null, h('span', { class: 'pastille ' + cls }, txt)),
              h('td', { style: 'text-align:right' }, h('button', { class: code ? 'btn-contour btn-petit' : 'btn-primaire btn-petit', k: 'ing-' + i.ingredientId,
                onClick: () => { app.ui.ingCur = i.ingredientId; app.ui.prodQ = premierMot(i.nom); app.ui.focusApres = 'prod-q'; render(); } }, code ? 'Changer' : 'Rattacher')));
          }))))]);
    return h('div', { class: 'trois' }, centre, h('aside', { class: 'col-d', 'aria-label': 'Rattacher un produit' }, panneauRattachement(s)));
  }

  function panneauRattachement(s) {
    const ing = app.ui.ingCur && ingredient(app.ui.ingCur);
    if (!ing) return h('p', { class: 'muted' }, 'Choisissez un ingrédient dans la liste pour le rattacher à un produit.');
    const code = s.rattachements[ing.id];
    const actuel = code && produit(code);
    const rattachables = app.etat.produits.filter((p) => R.estRattachable(p) && p.present !== false);
    const q = norm(app.ui.prodQ);
    const resultats = q.length >= 2 ? rattachables.filter((p) => norm(p.nom + ' ' + p.code + ' ' + p.marque).includes(q)).slice(0, 30) : [];
    const choisir = (p) => modifier(() => { s.rattachements[ing.id] = p.code; ing.dernierProduit = p.code; app.ui.focusApres = 'ing-' + ing.id; annoncerApres('Rattaché : ' + ing.nom + ' → ' + p.nom); });
    return h('div', { class: 'pile', style: 'gap:12px' },
      h('div', { class: 'muted' }, 'Rattacher un produit à'),
      h('h2', { style: 'font-size:26px;font-weight:700' }, ing.nom),
      h('div', { class: 'muted petit' }, 'Un seul produit par ingrédient pour ce séjour. Seuls les produits alimentaires actifs sont proposés.'),
      actuel ? h('div', { class: 'carte pile', style: 'gap:6px' }, h('div', null, h('strong', null, 'Produit actuel : '), actuel.code + ' · ' + actuel.nom),
        actuel.present === false ? h('div', { class: 'pastille p-alerte' }, '△ Absent du dernier catalogue') : null,
        h('div', null, h('button', { class: 'btn-petit btn-danger', onClick: () => modifier(() => { delete s.rattachements[ing.id]; }) }, 'Retirer le rattachement'))) : null,
      rattachables.length === 0 ? h('div', { class: 'message m-alerte' }, 'Aucun produit dans le catalogue. Importez le catalogue de votre outil de courses dans l’onglet Catalogue.') : [
        h('label', { class: 'champ' }, 'Rechercher dans le catalogue',
          h('input', { k: 'prod-q', value: app.ui.prodQ, onInput: (ev) => { app.ui.prodQ = ev.target.value; render(); } })),
        h('div', { class: 'muted petit', 'aria-live': 'polite' }, q.length < 2 ? 'Tapez au moins 2 lettres.' : resultats.length + ' produit(s) alimentaire(s)'),
        resultats.map((p) => h('button', { class: 'biblio-item', style: 'flex-direction:column;align-items:flex-start;min-height:48px;padding:8px 10px', onClick: () => choisir(p) },
          h('span', { style: 'font-weight:600' }, p.nom),
          h('span', { class: 'muted petit' }, [p.code, p.marque, p.unite, R.nombreFr(p.prix) + ' €', p.magasin].filter(Boolean).join(' · ')),
          p.statut && p.statut !== 'Validé' ? h('span', { class: 'pastille p-info' }, p.statut) : null)),
        q.length >= 2 && !resultats.length ? h('div', null, 'Aucun produit ne correspond à « ' + app.ui.prodQ + ' ». Vérifiez l’orthographe ou importez un catalogue à jour dans l’onglet Catalogue.') : null]);
  }
  // Annonce après le rendu (le rendu remplace le contenu de la page).
  const annoncerApres = (t) => setTimeout(() => annoncer(t), 0);

  // ----- Recettes (F-01, F-04, US-03) ----------------------------------------
  function utilisations(recetteId) {
    const res = [];
    for (const s of app.etat.sejours) for (const r of s.repas) if (r.recetteId === recetteId) res.push(s.nom + ' (J' + r.jour + ' ' + nomMoment(s, r.momentId) + ')');
    return res;
  }

  function vueRecettes() {
    const e = app.etat;
    const q = norm(app.ui.recetteQ);
    const liste = e.recettes.filter((r) => !q || norm(r.nom).includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const cur = recette(app.ui.recetteId);
    const gauche = h('aside', { class: 'col-g', 'aria-label': 'Liste des recettes' },
      h('button', { class: 'btn-primaire', k: 'nouvelle-recette', style: 'min-height:44px', onClick: nouvelleRecette }, 'Nouvelle recette'),
      h('label', { class: 'champ' }, h('span', { class: 'muted', style: 'font-weight:400' }, 'Rechercher'),
        h('input', { k: 'recette-q', value: app.ui.recetteQ, placeholder: 'Nom de la recette', onInput: (ev) => { app.ui.recetteQ = ev.target.value; render(); } })),
      q ? h('div', { class: 'muted petit' }, liste.length + ' recette(s)') : null,
      liste.map((r) => h('button', { class: 'biblio-item', k: 'rec-' + r.id, 'aria-current': r.id === app.ui.recetteId ? 'true' : null,
        style: 'flex-direction:column;align-items:flex-start;min-height:48px;padding:6px 10px;' + (r.id === app.ui.recetteId ? 'border:2px solid var(--primary);background:var(--primary-subtle)' : ''),
        onClick: () => { app.ui.recetteId = r.id; app.ui.alerteRecette = ''; render(); } },
      h('span', { style: 'font-weight:600' }, r.nom),
      h('span', { class: 'muted petit' }, r.lignes.length + ' ingrédient(s) · utilisée dans ' + utilisations(r.id).length + ' repas'))));
    const centre = h('section', { class: 'col-c', style: 'max-width:1040px' }, cur ? editeurRecette(cur)
      : h('div', { class: 'carte pile' }, h('p', { style: 'margin:0' }, e.recettes.length ? 'Choisissez une recette à gauche, ou créez-en une.' : 'Aucune recette. Créez votre première recette pour 10 personnes.')));
    return h('div', { class: 'trois' }, gauche, centre);
  }

  function nouvelleRecette() {
    const r = { id: F.id('rec'), nom: 'Nouvelle recette', etiquettes: [], materiel: [], origineId: null, lignes: [] };
    modifier((e) => { e.recettes.push(r); app.ui.recetteId = r.id; app.ui.recetteQ = ''; app.ui.focusApres = 'rec-nom'; });
  }

  function editeurRecette(r) {
    const err = app.ui.erreurs, br = app.ui.brouillons;
    const ingsDatalist = h('datalist', { id: 'liste-ingredients' }, app.etat.ingredients.slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((i) => h('option', { value: i.nom })));
    const nl = app.ui.nouvelleLigne;
    return h('div', { class: 'pile', style: 'gap:16px' },
      h('div', { class: 'ligne' }, h('h1', { style: 'font-size:30px' }, r.nom), h('div', { class: 'espace' }),
        h('button', { onClick: () => dupliquerRecette(r) }, 'Dupliquer'),
        h('button', { class: 'btn-danger', k: 'rec-supprimer', onClick: () => supprimerRecette(r) }, 'Supprimer')),
      app.ui.alerteRecette ? h('div', { class: 'message m-erreur', role: 'alert' }, app.ui.alerteRecette) : null,
      h('div', { class: 'muted petit' }, 'Modifier cette recette modifie aussi les repas qui l’utilisent.'),
      h('label', { class: 'champ', style: 'max-width:480px' }, 'Nom',
        h('input', { k: 'rec-nom', value: br['nom-' + r.id] !== undefined ? br['nom-' + r.id] : r.nom, class: err['nom-' + r.id] ? 'invalide' : null,
          'aria-invalid': err['nom-' + r.id] ? 'true' : null,
          onChange: (ev) => {
            const v = ev.target.value.trim();
            if (!v) { br['nom-' + r.id] = ''; err['nom-' + r.id] = '✕ Le nom de la recette est obligatoire.'; render(); return; }
            delete br['nom-' + r.id]; delete err['nom-' + r.id];
            modifier(() => { r.nom = v; });
          } })),
      err['nom-' + r.id] ? h('div', { class: 'erreur-champ' }, err['nom-' + r.id]) : null,
      h('section', { class: 'tableau-boite', 'aria-labelledby': 'rec-ings' },
        h('div', { style: 'padding:12px 16px' }, h('h2', { id: 'rec-ings' }, 'Ingrédients pour 10 personnes')),
        ingsDatalist,
        h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Ingrédient'), h('th', { style: 'width:140px' }, 'Quantité pour 10'), h('th', { style: 'width:120px' }, 'Unité'), h('th', null, 'Conversion'), h('th', null, h('span', { class: 'sr' }, 'Supprimer')))),
          h('tbody', null,
            r.lignes.length === 0 ? h('tr', null, h('td', { colspan: '5', class: 'muted' }, 'Aucun ingrédient. Ajoutez le premier ci-dessous.')) : null,
            r.lignes.map((l) => ligneRecette(r, l)),
            h('tr', null,
              h('td', null, h('input', { k: 'nl-ing', list: 'liste-ingredients', 'aria-label': 'Nouvel ingrédient', placeholder: 'Ingrédient', value: nl.ing, onInput: (ev) => { nl.ing = ev.target.value; majApercu(); } })),
              h('td', null, h('input', { k: 'nl-q', 'aria-label': 'Quantité pour 10 du nouvel ingrédient', inputmode: 'decimal', style: 'width:110px', value: nl.q, onInput: (ev) => { nl.q = ev.target.value; majApercu(); },
                onKeydown: (ev) => { if (ev.key === 'Enter') ajouterLigne(r); } })),
              h('td', null, selectUnite('nl-u', nl.u, 'Unité du nouvel ingrédient', (u) => { nl.u = u; majApercu(); })),
              h('td', { class: 'muted', id: 'apercu-nl', 'aria-live': 'polite' }, apercuNouvelleLigne(nl)),
              h('td', null, h('button', { class: 'btn-petit', k: 'nl-ajouter', style: 'border-style:dashed', onClick: () => ajouterLigne(r) }, '+ Ajouter l’ingrédient'))),
            nl.erreur ? h('tr', null, h('td', { colspan: '5', class: 'erreur-champ', role: 'alert' }, nl.erreur)) : null))),
      h('div', { class: 'pile' },
        h('span', { style: 'font-weight:600;font-size:14px' }, 'Matériel'),
        h('div', { class: 'ligne', style: 'gap:6px' },
          r.materiel.map((m, i) => h('span', { class: 'pastille', style: 'background:var(--surface-muted);border-color:var(--border);font-weight:400;font-size:14px' }, m,
            h('button', { class: 'btn-petit', style: 'min-height:24px;padding:0 6px;border:0;background:transparent', 'aria-label': 'Retirer ' + m, onClick: () => modifier(() => { r.materiel.splice(i, 1); }) }, '×'))),
          h('input', { k: 'mat', 'aria-label': 'Ajouter du matériel', placeholder: 'ex. 2 cocottes 20 L', value: app.ui.materielBrouillon,
            onInput: (ev) => { app.ui.materielBrouillon = ev.target.value; },
            onKeydown: (ev) => { if (ev.key === 'Enter') ajouterMateriel(r); } }),
          h('button', { class: 'btn-petit', onClick: () => ajouterMateriel(r) }, 'Ajouter'))));
  }

  function selectUnite(k, valeur, libelle, surChoix) {
    return h('select', { k, 'aria-label': libelle, onChange: (ev) => surChoix(ev.target.value) },
      R.UNITES.map((u) => h('option', { value: u, selected: u === valeur }, u)));
  }

  function ligneRecette(r, l) {
    const ing = ingredient(l.ingredientId);
    const kq = 'q-' + l.id, ki = 'i-' + l.id;
    const err = app.ui.erreurs, br = app.ui.brouillons;
    return [h('tr', null,
      h('td', null, h('input', { k: ki, list: 'liste-ingredients', 'aria-label': 'Ingrédient', value: br[ki] !== undefined ? br[ki] : (ing ? ing.nom : ''), class: err[ki] ? 'invalide' : null,
        onChange: (ev) => {
          const v = ev.target.value.trim();
          if (!v) { br[ki] = ''; err[ki] = '✕ Le nom de l’ingrédient est obligatoire. Saisissez-le, ou supprimez la ligne.'; render(); return; }
          delete br[ki]; delete err[ki];
          modifier(() => { l.ingredientId = ingredientParNom(v, true).id; });
        } })),
      h('td', null, h('input', { k: kq, inputmode: 'decimal', style: 'width:110px', 'aria-label': 'Quantité pour 10 de ' + (ing ? ing.nom : 'l’ingrédient'),
        value: br[kq] !== undefined ? br[kq] : R.nombreFr(l.quantite), class: err[kq] ? 'invalide' : null, 'aria-invalid': err[kq] ? 'true' : null,
        onChange: (ev) => {
          const n = Number(ev.target.value.trim().replace(',', '.'));
          if (!(n > 0)) { br[kq] = ev.target.value; err[kq] = '✕ La quantité doit être supérieure à 0. Saisissez la quantité pour 10 personnes, ou supprimez la ligne.'; render(); return; }
          delete br[kq]; delete err[kq];
          modifier(() => { l.quantite = n; });
        } })),
      h('td', null, selectUnite('u-' + l.id, l.unite, 'Unité de ' + (ing ? ing.nom : 'l’ingrédient'), (u) => modifier(() => { l.unite = u; }))),
      h('td', null, conversionAffichee(l)),
      h('td', { style: 'text-align:right' }, h('button', { class: 'btn-petit', 'aria-label': 'Supprimer la ligne ' + (ing ? ing.nom : ''), onClick: () => modifier(() => { r.lignes = r.lignes.filter((x) => x !== l); }) }, 'Supprimer'))),
    err[kq] || err[ki] ? h('tr', null, h('td', { colspan: '5', class: 'erreur-champ' }, err[ki] || err[kq])) : null];
  }

  function conversionAffichee(l) {
    const eqs = app.etat.equivalences.filter((e) => e.ingredientId === l.ingredientId);
    const eq = R.equivalenceAffichee(l.quantite, l.unite, eqs);
    if (l.unite === 'pièce' && eq) return h('span', { class: 'muted' }, eq);
    if (eq && (l.unite === 'g' || l.unite === 'ml')) return h('span', { class: 'muted' }, eq);
    if (l.unite === 'g' && l.quantite >= 1000) return h('span', { class: 'muted' }, '= ' + R.formatQuantite(l.quantite, 'g'));
    if ((l.unite === 'ml' || l.unite === 'cl') && R.convertirGenerique(l.quantite, l.unite, 'l') >= 1) return h('span', { class: 'muted' }, '= ' + R.nombreFr(R.convertirGenerique(l.quantite, l.unite, 'l')) + ' l');
    if (l.unite === 'pièce') {
      const eqs = app.etat.equivalences.filter((e) => e.ingredientId === l.ingredientId);
      for (const u of ['g', 'ml']) {
        const un = R.convertir(1, 'pièce', u, eqs);
        if (un !== null) return h('span', { class: 'muted' }, '1 pièce ≈ ' + R.nombreFr(un) + ' ' + u);
      }
      return h('span', null, h('span', { style: 'color:var(--warning-text);font-weight:600' }, '△ Aucune équivalence pièce → g '),
        h('button', { class: 'btn-petit', onClick: () => { app.ui.eqForm = Object.assign({}, app.ui.eqForm, { ing: l.ingredientId, uA: 'pièce', erreur: '' }); app.ui.onglet = 'referentiels'; app.ui.focusApres = 'eq-qb'; render(); } }, 'Ajouter une équivalence'));
    }
    return h('span', { class: 'muted' }, '—');
  }

  // Aperçu de conversion pendant la saisie d'une nouvelle ligne (US-03 : « 12 pièces » → « ≈ 720 g »).
  function apercuNouvelleLigne(nl) {
    const ing = nl.ing.trim() && ingredientParNom(nl.ing, false);
    const q = Number(String(nl.q).trim().replace(',', '.'));
    if (!ing || !(q > 0)) return '';
    return R.equivalenceAffichee(q, nl.u, app.etat.equivalences.filter((e) => e.ingredientId === ing.id)) || '';
  }

  // Mise à jour ciblée (sans tout redessiner, pour ne pas perdre le clic en cours).
  function majApercu() { const el = document.getElementById('apercu-nl'); if (el) el.textContent = apercuNouvelleLigne(app.ui.nouvelleLigne); }

  function ajouterLigne(r) {
    const nl = app.ui.nouvelleLigne;
    const nom = nl.ing.trim(), n = Number(String(nl.q).trim().replace(',', '.'));
    if (!nom) { nl.erreur = '✕ Saisissez le nom de l’ingrédient.'; app.ui.focusApres = 'nl-ing'; render(); return; }
    if (!(n > 0)) { nl.erreur = '✕ La quantité doit être supérieure à 0. Saisissez la quantité pour 10 personnes.'; app.ui.focusApres = 'nl-q'; render(); return; }
    const ingId = ingredientParNom(nom, false) ? ingredientParNom(nom, false).id : null;
    if (ingId && r.lignes.some((l) => l.ingredientId === ingId && l.unite === nl.u)) {
      nl.erreur = '✕ « ' + nom + ' » est déjà dans la recette avec cette unité. Modifiez la ligne existante.'; render(); return;
    }
    modifier(() => {
      const ing = ingredientParNom(nom, true);
      r.lignes.push({ id: F.id('l'), ingredientId: ing.id, quantite: n, unite: nl.u });
      app.ui.nouvelleLigne = { ing: '', q: '', u: nl.u, erreur: '' };
      app.ui.focusApres = 'nl-ing';
    });
  }

  function ajouterMateriel(r) {
    const v = app.ui.materielBrouillon.trim();
    if (!v) return;
    modifier(() => { if (!r.materiel.includes(v)) r.materiel.push(v); app.ui.materielBrouillon = ''; app.ui.focusApres = 'mat'; });
  }

  function dupliquerRecette(r) {
    const copie = JSON.parse(JSON.stringify(r));
    copie.id = F.id('rec'); copie.nom = r.nom + ' (copie)';
    copie.lignes.forEach((l) => { l.id = F.id('l'); });
    modifier((e) => { e.recettes.push(copie); app.ui.recetteId = copie.id; });
    annoncerApres('Recette dupliquée : ' + copie.nom);
  }

  function supprimerRecette(r) {
    const u = utilisations(r.id);
    if (u.length) {
      app.ui.alerteRecette = '✕ Impossible de supprimer « ' + r.nom + ' » : elle est utilisée dans ' + u.join(', ') + '. Retirez-la de ces menus d’abord.';
      render(); return;
    }
    ouvrirDialog({ type: 'confirmer', titre: 'Supprimer la recette « ' + r.nom + ' » ?', texte: 'Elle sera retirée de la bibliothèque. Les ingrédients restent dans les référentiels.',
      bouton: 'Supprimer la recette', danger: true,
      action: () => modifier((e) => { e.recettes = e.recettes.filter((x) => x.id !== r.id); app.ui.recetteId = null; }) });
  }

  // ----- Catalogue (F-05, F-06, US-01, US-02) ---------------------------------
  function importerCatalogue() {
    choisirFichier('.csv,text/csv', async (f) => {
      const r = C.lireCatalogue(await f.text());
      app.ui.catSucces = '';
      if (!r.ok) { app.ui.catErreur = '✕ ' + r.erreur; app.ui.apercu = null; render(); return; }
      app.ui.catErreur = '';
      app.ui.apercu = { nom: f.name, produits: r.produits, diff: C.comparerCatalogue(app.etat.produits, r.produits), supplementaires: r.supplementaires };
      app.ui.focusApres = 'cat-confirmer';
      render();
    });
  }

  function statutContenance(p) {
    const br = app.ui.brouillons['c-' + p.code];
    if (br !== undefined && br !== '') return ['✕ Format non reconnu', 'p-erreur', 1];
    if (p.contenanceValidee && p.contenance) return ['✓ Validée', 'p-ok', 3];
    if (!p.contenance) return ['△ À saisir', 'p-alerte', 0];
    return [app.ui.contSaisie[p.code] ? 'Saisie, à valider' : 'Proposée, à valider', 'p-info', 2];
  }
  const texteContenance = (c) => (c ? R.nombreFr(c.q) + ' ' + (c.u === 'pièce' ? (c.q > 1 ? 'pièces' : 'pièce') : c.u) : '');

  function vueCatalogue() {
    const e = app.etat, ui = app.ui;
    const rattachables = e.produits.filter((p) => R.estRattachable(p));
    const q = norm(ui.catQ);
    const aValider = rattachables.filter((p) => !(p.contenanceValidee && p.contenance));
    const base = ui.catFiltre === 'a-valider' ? aValider : rattachables;
    const lignes = base.filter((p) => !q || norm(p.nom + ' ' + p.code + ' ' + p.magasin).includes(q))
      .map((p) => ({ p, st: statutContenance(p) }))
      .sort((a, b) => a.st[2] - b.st[2] || a.p.nom.localeCompare(b.p.nom, 'fr'));
    const cochables = lignes.filter(({ p, st }) => st[2] === 2 && p.contenance);
    const nSel = cochables.filter(({ p }) => ui.catSel[p.code]).length;
    const di = e.dernierImport;
    const ap = ui.apercu;

    return h('div', { class: 'page' },
      h('div', { class: 'ligne' }, h('h1', null, 'Catalogue'),
        h('span', { class: 'muted' }, di ? 'Dernier import le ' + dateLongue(new Date(di.date)) + ' : ' + di.total + ' produits, dont ' + di.alimentaires + ' alimentaires.' : 'Aucun catalogue importé.'),
        h('div', { class: 'espace' }),
        h('button', { class: 'btn-primaire', k: 'cat-importer', style: 'min-height:44px', onClick: importerCatalogue }, 'Importer le catalogue')),
      ui.catErreur ? h('div', { class: 'message m-erreur', role: 'alert' }, ui.catErreur) : null,
      ui.catSucces ? h('div', { class: 'message m-ok', role: 'status' }, ui.catSucces) : null,
      ap ? h('section', { class: 'carte pile', style: 'border:2px solid var(--primary)', 'aria-labelledby': 'apercu-t' },
        h('h2', { id: 'apercu-t' }, 'Aperçu de l’import : ' + ap.nom),
        h('div', { class: 'ligne', style: 'gap:24px' },
          h('div', null, h('strong', null, String(ap.diff.total)), ' produits lus, dont ' + ap.diff.alimentaires + ' alimentaires'),
          h('div', null, h('strong', null, String(ap.diff.ajoutes.length)), ' ajoutés'),
          h('div', null, h('strong', null, String(ap.diff.modifies.length)), ' modifiés' + (ap.diff.uniteChangee.length ? ', dont ' + ap.diff.uniteChangee.length + ' dont l’unité a changé (contenance à revalider)' : '')),
          h('div', null, h('strong', null, String(ap.diff.absents.length)), ' absent(s)' + (ap.diff.absents.length ? ' : ' + ap.diff.absents.slice(0, 5).map((p) => p.code + ' ' + p.nom).join(', ') + (ap.diff.absents.length > 5 ? '…' : '') + ' (gardés, signalés)' : ''))),
        ap.supplementaires && ap.supplementaires.length ? h('div', { class: 'muted petit' }, 'Colonnes ignorées : ' + ap.supplementaires.join(', ')) : null,
        h('div', { class: 'muted petit' }, 'Rien n’est modifié tant que vous ne confirmez pas.'),
        h('div', { class: 'ligne' },
          h('button', { class: 'btn-primaire', k: 'cat-confirmer', style: 'min-height:44px', onClick: () => {
            const d = ap.diff;
            modifier((et) => { Object.assign(et, C.appliquerCatalogue(et, ap.produits, new Date())); });
            app.ui.apercu = null;
            app.ui.catSucces = '✓ Catalogue importé : ' + d.ajoutes.length + ' produit(s) ajouté(s), ' + d.modifies.length + ' modifié(s), ' + d.absents.length + ' absent(s) signalé(s).';
            render();
          } }, 'Confirmer l’import'),
          h('button', { style: 'min-height:44px', onClick: () => { app.ui.apercu = null; render(); } }, 'Annuler'))) : null,
      !di && !e.produits.length ? h('div', { class: 'carte' }, 'Importez le catalogue de votre outil de courses pour rattacher des produits.') : null,
      rattachables.length ? h('div', { class: 'ligne', style: 'align-items:flex-start;gap:20px' },
        h('section', { class: 'tableau-boite', style: 'flex:999 1 720px;min-width:0', 'aria-labelledby': 'cont-t' },
          h('div', { class: 'ligne', style: 'padding:14px 16px' },
            h('h2', { id: 'cont-t' }, 'Contenances'),
            h('span', { class: 'muted petit' }, aValider.length ? aValider.length + ' sur ' + rattachables.length + ' à valider' : 'Toutes les contenances sont validées.'),
            h('div', { class: 'espace' }),
            h('button', { class: nSel ? 'btn-primaire' : null, k: 'cat-valider', disabled: !nSel, onClick: () => {
              const codes = cochables.filter(({ p }) => ui.catSel[p.code]).map(({ p }) => p.code);
              modifier((et) => { for (const p of et.produits) if (codes.includes(p.code)) { p.contenanceValidee = true; p.ancienneUnite = null; } app.ui.catSel = {}; });
              annoncerApres(codes.length + ' contenance(s) validée(s)');
            } }, 'Valider la sélection (' + nSel + ')')),
          h('div', { class: 'muted petit', style: 'padding:0 16px 8px' }, 'Une contenance n’est utilisée pour l’arrondi qu’après validation. Les unités illisibles sont en tête : saisissez la contenance (ex. 500 g, 1,5 l, 10 pièces) avant de valider.'),
          h('div', { class: 'ligne', style: 'padding:0 16px 10px' },
            h('button', { class: 'btn-petit', 'aria-pressed': String(ui.catFiltre === 'a-valider'), style: ui.catFiltre === 'a-valider' ? 'border:2px solid var(--primary)' : null, onClick: () => { ui.catFiltre = 'a-valider'; render(); } }, 'À valider (' + aValider.length + ')'),
            h('button', { class: 'btn-petit', 'aria-pressed': String(ui.catFiltre === 'tous'), style: ui.catFiltre === 'tous' ? 'border:2px solid var(--primary)' : null, onClick: () => { ui.catFiltre = 'tous'; render(); } }, 'Toutes (' + rattachables.length + ')'),
            h('label', null, h('span', { class: 'sr' }, 'Rechercher un produit'), h('input', { k: 'cat-q', placeholder: 'Rechercher un produit ou un code', value: ui.catQ, onInput: (ev) => { ui.catQ = ev.target.value; render(); } }))),
          h('table', null,
            h('thead', null, h('tr', null,
              h('th', { style: 'width:44px' }, cochables.length ? h('input', { type: 'checkbox', 'aria-label': 'Sélectionner toutes les contenances proposées visibles', checked: nSel > 0 && nSel === cochables.length,
                onChange: (ev) => { for (const { p } of cochables) ui.catSel[p.code] = ev.target.checked; render(); } }) : null),
              h('th', null, 'Produit'), h('th', null, 'Unité (catalogue)'), h('th', null, 'Contenance'), h('th', null, 'Statut'))),
            h('tbody', null, lignes.length ? lignes.map(({ p, st }) => ligneContenance(p, st)) : h('tr', null, h('td', { colspan: '5', class: 'muted' }, q ? 'Aucun produit ne correspond.' : 'Rien à valider.'))))),
        vueSousCategories()) : null);
  }

  function ligneContenance(p, st) {
    const ui = app.ui, kc = 'c-' + p.code;
    const cochable = st[2] === 2 && p.contenance;
    return h('tr', null,
      h('td', null, h('input', { type: 'checkbox', k: 'sel-' + p.code, 'aria-label': 'Sélectionner ' + p.nom, disabled: !cochable, checked: !!(cochable && ui.catSel[p.code]),
        onChange: (ev) => { ui.catSel[p.code] = ev.target.checked; render(); } })),
      h('td', null, h('div', { style: 'font-weight:600' }, p.nom, ' ', lienSur(p.fiche, 'fiche')),
        h('div', { class: 'muted petit' }, [p.code, p.magasin].filter(Boolean).join(' · '), p.present === false ? ' · absent du dernier catalogue' : '', p.statut && p.statut !== 'Validé' ? ' · ' + p.statut : '')),
      h('td', null, p.unite || '—', p.ancienneUnite ? h('div', null, h('span', { class: 'pastille p-alerte' }, '△ Unité changée : ' + p.ancienneUnite + ' → ' + (p.unite || '—'))) : null),
      h('td', null, h('input', { k: kc, style: 'width:120px', 'aria-label': 'Contenance de ' + p.nom, placeholder: 'ex. 1 kg', class: st[2] === 1 ? 'invalide' : null,
        value: ui.brouillons[kc] !== undefined ? ui.brouillons[kc] : texteContenance(p.contenance),
        onChange: (ev) => {
          const t = ev.target.value.trim();
          if (!t) { delete ui.brouillons[kc]; modifier(() => { p.contenance = null; p.contenanceValidee = false; }); return; }
          const c = R.lireContenance(t);
          if (!c) { ui.brouillons[kc] = t; render(); return; }
          delete ui.brouillons[kc]; ui.contSaisie[p.code] = true;
          modifier(() => { p.contenance = c; p.contenanceValidee = false; });
        } }),
      st[2] === 1 ? h('div', { class: 'erreur-champ petit' }, 'Écrivez un nombre et une unité : 500 g, 1,5 l, 10 pièces.') : null),
      h('td', null, h('span', { class: 'pastille ' + st[1] }, st[0])));
  }

  function vueSousCategories() {
    const e = app.etat;
    const n = (nom) => e.produits.filter((p) => p.sousCategorie === nom && R.estRattachable(p)).length;
    const sans = e.produits.filter((p) => !p.sousCategorie && R.estRattachable(p)).length;
    return h('section', { class: 'carte pile', style: 'flex:1 1 300px;max-width:360px', 'aria-labelledby': 'sc-t' },
      h('h2', { id: 'sc-t' }, 'Sous-catégories frais'),
      h('div', { class: 'muted petit' }, 'Les produits de ces sous-catégories partent en « Frais » dans la colonne À commander ; les autres en « Gros achat ».'),
      e.sousCategories.map((sc) => h('label', { style: 'display:flex;align-items:center;gap:10px;min-height:36px' },
        h('input', { type: 'checkbox', checked: sc.frais, onChange: (ev) => modifier(() => { sc.frais = ev.target.checked; }) }),
        h('span', null, sc.nom, ' ', h('span', { class: 'muted petit', style: 'white-space:nowrap' }, pluriel(n(sc.nom), 'produit'))))),
      sans ? h('div', { class: 'muted petit' }, 'Sans sous-catégorie : ' + pluriel(sans, 'produit') + ', toujours en « Gros achat ».') : null);
  }

  // ----- Référentiels : équivalences (F-04) -----------------------------------
  function vueReferentiels() {
    const e = app.etat, f = app.ui.eqForm;
    const ings = e.ingredients.slice().sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const ajouterEq = () => {
      const qA = Number(String(f.qA).replace(',', '.')), qB = Number(String(f.qB).replace(',', '.'));
      const ing = ingredient(f.ing);
      if (!ing) { f.erreur = '✕ Choisissez un ingrédient.'; render(); return; }
      if (!(qA > 0) || !(qB > 0)) { f.erreur = '✕ Les deux quantités doivent être supérieures à 0, par exemple 1 pièce = 60 g.'; app.ui.focusApres = 'eq-qb'; render(); return; }
      if (R.famille(f.uA) === R.famille(f.uB)) { f.erreur = '✕ Une équivalence relie deux familles d’unités différentes, par exemple pièce et g. Entre ' + f.uA + ' et ' + f.uB + ', la conversion est automatique.'; render(); return; }
      const fam = [R.famille(f.uA), R.famille(f.uB)].sort().join('|');
      if (e.equivalences.some((x) => x.ingredientId === ing.id && [R.famille(x.uA), R.famille(x.uB)].sort().join('|') === fam)) {
        f.erreur = '✕ Une équivalence ' + f.uA + ' → ' + f.uB + ' existe déjà pour « ' + ing.nom + ' ». Supprimez-la avant d’en ajouter une autre.'; render(); return;
      }
      modifier((et) => { et.equivalences.push({ id: F.id('eq'), ingredientId: ing.id, qA, uA: f.uA, qB, uB: f.uB }); app.ui.eqForm = Object.assign({}, f, { qB: '', erreur: '' }); });
      annoncerApres('Équivalence ajoutée : ' + ing.nom + ', ' + R.nombreFr(qA) + ' ' + f.uA + ' = ' + R.nombreFr(qB) + ' ' + f.uB);
    };
    return h('div', { class: 'page', style: 'max-width:960px' },
      h('h1', null, 'Référentiels'),
      h('section', { class: 'carte pile', 'aria-labelledby': 'eq-t' },
        h('h2', { id: 'eq-t' }, 'Équivalences'),
        h('div', { class: 'muted petit' }, 'Une équivalence convertit un ingrédient d’une famille d’unités à une autre (pièce ↔ g ou ml). Les conversions g ↔ kg et ml ↔ cl ↔ l sont automatiques.'),
        ings.length === 0 ? h('div', null, 'Aucun ingrédient. Ajoutez des ingrédients dans vos recettes d’abord.') : h('div', { class: 'ligne', style: 'align-items:flex-end' },
          h('label', { class: 'champ' }, 'Ingrédient', h('select', { k: 'eq-ing', onChange: (ev) => { f.ing = ev.target.value; f.erreur = ''; } },
            h('option', { value: '' }, 'Choisir…'), ings.map((i) => h('option', { value: i.id, selected: i.id === f.ing }, i.nom)))),
          h('label', { class: 'champ' }, 'Quantité', h('input', { k: 'eq-qa', style: 'width:80px', inputmode: 'decimal', value: f.qA, onInput: (ev) => { f.qA = ev.target.value; } })),
          h('label', { class: 'champ' }, 'Unité', selectUnite('eq-ua', f.uA, 'Unité de départ', (u) => { f.uA = u; })),
          h('span', { style: 'padding-bottom:10px;font-weight:600' }, '='),
          h('label', { class: 'champ' }, 'Quantité', h('input', { k: 'eq-qb', style: 'width:80px', inputmode: 'decimal', value: f.qB, onInput: (ev) => { f.qB = ev.target.value; },
            onKeydown: (ev) => { if (ev.key === 'Enter') ajouterEq(); } })),
          h('label', { class: 'champ' }, 'Unité', selectUnite('eq-ub', f.uB, 'Unité d’arrivée', (u) => { f.uB = u; })),
          h('button', { class: 'btn-primaire', k: 'eq-ajouter', onClick: ajouterEq }, 'Ajouter une équivalence')),
        f.erreur ? h('div', { class: 'erreur-champ', role: 'alert' }, f.erreur) : null,
        e.equivalences.length === 0 ? h('div', { class: 'muted' }, 'Aucune équivalence. Ajoutez-en une pour convertir des pièces en grammes, par exemple 1 œuf = 60 g.')
          : h('table', null, h('thead', null, h('tr', null, h('th', null, 'Ingrédient'), h('th', null, 'Équivalence'), h('th', null, h('span', { class: 'sr' }, 'Supprimer')))),
            h('tbody', null, e.equivalences.slice().sort((a, b) => ((ingredient(a.ingredientId) || {}).nom || '').localeCompare((ingredient(b.ingredientId) || {}).nom || '', 'fr')).map((x) => {
              const ing = ingredient(x.ingredientId);
              return h('tr', null, h('td', null, ing ? ing.nom : '?'), h('td', null, R.nombreFr(x.qA) + ' ' + x.uA + ' = ' + R.nombreFr(x.qB) + ' ' + x.uB),
                h('td', { style: 'text-align:right' }, h('button', { class: 'btn-petit btn-danger', onClick: () => ouvrirDialog({ type: 'confirmer', titre: 'Supprimer cette équivalence ?',
                  texte: (ing ? ing.nom : '?') + ' : ' + R.nombreFr(x.qA) + ' ' + x.uA + ' = ' + R.nombreFr(x.qB) + ' ' + x.uB + '. Les recettes qui en dépendent afficheront « sans conversion ».',
                  bouton: 'Supprimer l’équivalence', danger: true, action: () => modifier((et) => { et.equivalences = et.equivalences.filter((y) => y.id !== x.id); }) }) }, 'Supprimer')));
            })))));
  }

  // ----- Fenêtres : export, séjour, confirmation -------------------------------
  function vueDialog() {
    const d = app.ui.dialog;
    if (!d) return null;
    let corps;
    if (d.type === 'export') corps = dialogExport();
    else if (d.type === 'sejour') corps = dialogSejour(d);
    else corps = [h('h2', { id: 'dlg-t' }, d.titre), h('p', { style: 'margin:0' }, d.texte),
      h('div', { class: 'actions' },
        h('button', { k: 'dlg-defaut', style: 'min-height:44px', onClick: fermerDialog }, 'Annuler'),
        h('button', { class: d.danger ? 'btn-danger' : 'btn-primaire', style: 'min-height:44px', onClick: () => { app.ui.dialog = null; d.action(); render(); } }, d.bouton))];
    return h('div', { class: 'voile', onMousedown: (ev) => { if (ev.target.classList.contains('voile')) fermerDialog(); } },
      h('div', { class: 'fenetre', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dlg-t' }, corps));
  }

  function dialogExport() {
    const s = sejour();
    const res = R.calculerExport(app.etat, s.id);
    const parRepas = new Map();
    for (const m of res.manques) {
      const cle = 'J' + m.jour + ' ' + m.moment + ' — ' + m.recette;
      if (!parRepas.has(cle)) parRepas.set(cle, []);
      parRepas.get(cle).push(m.nom + ' (' + m.texte + ')');
    }
    const n = res.manques.length;
    const exporter = () => {
      const csv = C.exporterCSV(res.lignes);
      const d = new Date();
      const nom = 'liste-courses_' + slug(s.nom) + '_' + d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate()) + '.csv';
      telecharger(nom, csv, 'text/csv;charset=utf-8');
      app.ui.dialog = null; render();
      annoncer('Liste de courses exportée : ' + nom);
    };
    const revenir = () => {
      app.ui.dialog = null; app.ui.onglet = 'menu';
      const ordre = new Map(s.moments.map((m, i) => [m.id, i]));
      const premier = s.repas.slice().sort((a, b) => a.jour - b.jour || ordre.get(a.momentId) - ordre.get(b.momentId))
        .find((r) => R.manquesRepas(app.etat, s, r).length);
      if (premier) { app.ui.sel = [[premier.jour, premier.momentId]]; app.ui.actif = [premier.jour, premier.momentId]; app.ui.focusApres = 'case-' + premier.jour + '-' + premier.momentId;
        app.ui.effBrouillon = premier.effectif === null || premier.effectif === undefined ? '' : String(premier.effectif); }
      render();
    };
    return [
      h('h2', { id: 'dlg-t' }, 'Exporter la liste de courses'),
      h('p', { style: 'margin:0' }, 'Un fichier CSV au format de l’outil de courses : une ligne par produit et par repas, quantités arrondies sur le total. ' +
        res.resume.lignes + ' ligne(s), ' + res.resume.produits + ' produit(s), ' + res.resume.magasins + ' magasin(s).'),
      n ? h('div', { class: 'message m-alerte pile', style: 'gap:6px' },
        h('div', { style: 'font-weight:600;color:var(--warning-text)' }, '△ ' + n + ' élément(s) incomplet(s)'),
        [...parRepas.entries()].map(([k, v]) => h('div', null, k + ' : ' + v.join(', '))),
        h('div', { class: 'muted petit' }, 'Si vous continuez : les ingrédients non rattachés et les repas sans effectif ne sont pas exportés ; les lignes sans conversion ou sans contenance validée sont marquées « À vérifier ».')) : null,
      h('div', { class: 'actions' },
        n ? h('button', { class: 'btn-primaire', k: 'dlg-defaut', style: 'min-height:44px', onClick: revenir }, 'Revenir et compléter')
          : h('button', { k: 'dlg-fermer', style: 'min-height:44px', onClick: fermerDialog }, 'Fermer'),
        n ? h('button', { style: 'min-height:44px', onClick: exporter }, 'Exporter quand même')
          : h('button', { class: 'btn-primaire', k: 'dlg-defaut', style: 'min-height:44px', onClick: exporter }, 'Exporter'))];
  }

  function dialogSejour(d) {
    const existant = d.sejourId ? app.etat.sejours.find((x) => x.id === d.sejourId) : null;
    if (!d.form) d.form = existant
      ? { nom: existant.nom, nbJours: String(existant.nbJours), moments: existant.moments.map((m) => m.nom).join('\n'), erreur: '', perdus: null }
      : { nom: '', nbJours: '7', moments: 'Petit-déjeuner\nDéjeuner\nGoûter\nDîner', erreur: '', perdus: null };
    const f = d.form;
    const valider = () => {
      const nom = f.nom.trim(), nb = Number(f.nbJours);
      const moments = f.moments.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!nom) { f.erreur = '✕ Donnez un nom au séjour, par exemple « Jupiter été ».'; render(); return; }
      if (!Number.isInteger(nb) || nb < 1 || nb > 60) { f.erreur = '✕ Le nombre de jours doit être un entier entre 1 et 60.'; render(); return; }
      if (!moments.length) { f.erreur = '✕ Indiquez au moins un moment de repas, un par ligne.'; render(); return; }
      if (new Set(moments.map(norm)).size !== moments.length) { f.erreur = '✕ Deux moments portent le même nom. Chaque moment doit être unique.'; render(); return; }
      if (existant) {
        const nouveaux = moments.map((nomM) => existant.moments.find((m) => norm(m.nom) === norm(nomM)) || { id: F.id('m'), nom: nomM });
        const garde = new Set(nouveaux.map((m) => m.id));
        const perdus = existant.repas.filter((r) => r.jour > nb || !garde.has(r.momentId));
        if (perdus.length && !f.perdus) {
          f.perdus = perdus.map((r) => 'J' + r.jour + ' ' + nomMoment(existant, r.momentId) + ' — ' + ((recette(r.recetteId) || {}).nom || '?'));
          render(); return;
        }
        app.ui.dialog = null;
        app.ui.annulations = app.ui.annulations.filter((a) => a.sejourId !== existant.id);
        modifier(() => {
          existant.nom = nom; existant.nbJours = nb;
          existant.moments = nouveaux.map((m) => ({ id: m.id, nom: moments[nouveaux.indexOf(m)] }));
          existant.repas = existant.repas.filter((r) => !(r.jour > nb || !garde.has(r.momentId)));
          app.ui.sel = []; app.ui.actif = null;
        });
        annoncerApres('Séjour modifié : ' + nom);
      } else {
        // Le dernier produit choisi (RM-07) est mémorisé dès I1 ; sa proposition arrive en I2 (US-12).
        const s = { id: F.id('sej'), nom, nbJours: nb, moments: moments.map((m) => ({ id: F.id('m'), nom: m })), repas: [], rattachements: {} };
        app.ui.dialog = null;
        modifier((e) => { e.sejours.push(s); app.ui.sejourId = s.id; app.ui.sel = [[1, s.moments[0].id]]; app.ui.actif = [1, s.moments[0].id]; app.ui.effBrouillon = ''; app.ui.focusApres = 'case-1-' + s.moments[0].id; });
        annoncerApres('Séjour créé : ' + nom);
      }
    };
    return [
      h('h2', { id: 'dlg-t' }, existant ? 'Modifier le séjour' : 'Nouveau séjour'),
      h('label', { class: 'champ' }, 'Nom du séjour', h('input', { k: 'dlg-defaut', value: f.nom, onInput: (ev) => { f.nom = ev.target.value; f.perdus = null; } })),
      h('label', { class: 'champ' }, 'Nombre de jours', h('input', { k: 'sej-jours', inputmode: 'numeric', style: 'width:100px', value: f.nbJours, onInput: (ev) => { f.nbJours = ev.target.value; f.perdus = null; } })),
      h('label', { class: 'champ' }, 'Moments de repas (un par ligne, dans l’ordre de la journée)',
        h('textarea', { k: 'sej-moments', rows: '5', value: f.moments, onInput: (ev) => { f.moments = ev.target.value; f.perdus = null; } })),
      f.erreur ? h('div', { class: 'erreur-champ', role: 'alert' }, f.erreur) : null,
      f.perdus ? h('div', { class: 'message m-alerte pile', role: 'alert', style: 'gap:4px' },
        h('strong', null, '△ ' + f.perdus.length + ' repas seront supprimés :'), f.perdus.map((p) => h('div', null, p)),
        h('div', { class: 'petit' }, 'Les recettes restent dans la bibliothèque. Cliquez de nouveau pour confirmer.')) : null,
      h('div', { class: 'actions' },
        h('button', { style: 'min-height:44px', onClick: fermerDialog }, 'Annuler'),
        h('button', { class: f.perdus ? 'btn-danger' : 'btn-primaire', k: 'sej-valider', style: 'min-height:44px', onClick: () => { f.erreur = ''; valider(); } },
          f.perdus ? 'Supprimer ces repas et modifier' : (existant ? 'Enregistrer le séjour' : 'Créer le séjour')))];
  }

  // ---------------------------------------------------------------------------
  // Clavier global : Ctrl+S, Ctrl+Z (grille), Échap et focus piégé dans les fenêtres
  // ---------------------------------------------------------------------------
  document.addEventListener('keydown', (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.key.toLowerCase() === 's') { ev.preventDefault(); enregistrer(); return; }
    if (app.ui.dialog) {
      if (ev.key === 'Escape') { ev.preventDefault(); fermerDialog(); return; }
      if (ev.key === 'Tab') {
        const els = [...document.querySelectorAll('.fenetre button, .fenetre input, .fenetre select, .fenetre textarea')].filter((x) => !x.disabled);
        if (!els.length) return;
        const i = els.indexOf(document.activeElement);
        if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); els[els.length - 1].focus(); }
        else if (!ev.shiftKey && (i === els.length - 1 || i < 0)) { ev.preventDefault(); els[0].focus(); }
      }
      return;
    }
    const dansChamp = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    if (mod && ev.key.toLowerCase() === 'z' && !ev.shiftKey && app.etat && app.ui.onglet === 'menu' && !dansChamp) { ev.preventDefault(); annuler(); }
  });

  // SEC-01 : avertissement du navigateur si l'on ferme avec des modifications non enregistrées.
  window.addEventListener('beforeunload', (ev) => { if (app.etat && app.ui.dirty) { ev.preventDefault(); ev.returnValue = ''; } });

  // Point d'entrée pour les tests de bout en bout (lecture seule de l'état).
  window.GM_app = { app, render };
  appliquerThemeMemorise();
  if (EN_LIGNE) demarrerEnLigne(); else render();
})();
