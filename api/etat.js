// =============================================================================
// État partagé (fonction Vercel). Une seule ligne en base : tous les utilisateurs
// connectés voient et modifient les mêmes recettes et séjours.
// GET /api/etat  → { version, donnees }   (crée l'état initial au premier appel)
// PUT /api/etat  { version, donnees }     → { version } ; 409 si la version a changé
// Accès réservé à une session valide (cookie gm_session, voir api/session.js).
// Variables : DATABASE_URL, SESSION_SECRET.
// =============================================================================
'use strict';
const { Pool } = require('pg');
const S = require('./session.js');
const F = require('../src/format.js');
const C = require('../src/csv.js');

let pool = null;
function bd() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  return pool;
}

function envoyer(res, statut, corps) {
  res.statusCode = statut;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(corps));
}

async function lireCorps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

// État de départ : ingrédients et recettes du fichier de référence, catalogue importé.
async function etatInitial() {
  const rs = await bd().query("SELECT nom, contenu FROM ressources WHERE nom IN ('recettes-initiales.json', 'catalogue.csv')");
  const par = Object.fromEntries(rs.rows.map((r) => [r.nom, r.contenu]));
  let etat = F.nouvelEtat();
  const init = JSON.parse(par['recettes-initiales.json'] || '{}');
  etat.ingredients = Array.isArray(init.ingredients) ? init.ingredients : [];
  etat.recettes = Array.isArray(init.recettes) ? init.recettes : [];
  if (par['catalogue.csv']) {
    const r = C.lireCatalogue(par['catalogue.csv']);
    if (r.ok) etat = C.appliquerCatalogue(etat, r.produits, new Date());
  }
  return etat;
}

async function lireEtat() {
  const q = 'SELECT version, donnees FROM etat_partage WHERE id = 1';
  let r = await bd().query(q);
  if (!r.rowCount) {
    await bd().query('INSERT INTO etat_partage (id, version, donnees) VALUES (1, 1, $1) ON CONFLICT (id) DO NOTHING',
      [JSON.stringify(await etatInitial())]);
    r = await bd().query(q);
  }
  return r.rows[0];
}

async function ecrireEtat(req, res) {
  const corps = await lireCorps(req);
  const version = Number.isInteger(corps.version) ? corps.version : null;
  const controle = F.lire(JSON.stringify(corps.donnees), 'Base partagée');
  if (!controle.ok) return envoyer(res, 400, { erreur: controle.erreur });
  const r = await bd().query(
    'UPDATE etat_partage SET donnees = $1, version = version + 1, maj = now() WHERE id = 1 AND version = $2 RETURNING version',
    [JSON.stringify(controle.etat), version]);
  if (!r.rowCount) {
    return envoyer(res, 409, { erreur: 'Les données ont été modifiées par quelqu’un d’autre. Rechargez la page avant de continuer.' });
  }
  return envoyer(res, 200, { version: r.rows[0].version });
}

module.exports = async function handler(req, res) {
  const session = S.verifierJeton(S.lireCookie(req.headers && req.headers.cookie, 'gm_session'), process.env.SESSION_SECRET);
  if (!session) return envoyer(res, 401, { erreur: 'Connexion requise.' });
  try {
    if (req.method === 'GET') {
      const e = await lireEtat();
      return envoyer(res, 200, { version: e.version, donnees: e.donnees });
    }
    if (req.method === 'PUT') return await ecrireEtat(req, res);
    res.statusCode = 405;
    return res.end();
  } catch (e) {
    console.error('etat:', e && e.message);
    return envoyer(res, 500, { erreur: 'Base de données indisponible. Réessayez dans un instant.' });
  }
};
