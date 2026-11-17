// =============================================================================
// Connexion côté serveur (fonction Vercel). Un seul compte partagé.
// POST   /api/session  { id, motDePasse } → cookie de session si correct
// GET    /api/session                     → 200 si connecté, 401 sinon
// DELETE /api/session                     → déconnexion
// Variables d'environnement (à définir dans Vercel, jamais dans le dépôt) :
//   SESSION_SECRET  : chaîne aléatoire d'au moins 32 caractères
//   AUTH_MDP_HASH   : hachage du mot de passe, produit par creerHash()
// Le mot de passe n'est jamais stocké en clair ni renvoyé.
// =============================================================================
'use strict';
const crypto = require('crypto');

const ID_ATTENDU = 'User.1050';
const COOKIE = 'gm_session';
const DUREE_SECONDES = 12 * 3600;

function creerHash(motDePasse) {
  const sel = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(motDePasse), sel, 32);
  return ['scrypt', sel.toString('base64url'), hash.toString('base64url')].join('$');
}

function verifierMotDePasse(motDePasse, stocke) {
  const [algo, sel, hash] = String(stocke || '').split('$');
  if (algo !== 'scrypt' || !sel || !hash) return false;
  const attendu = Buffer.from(hash, 'base64url');
  const calcule = crypto.scryptSync(String(motDePasse), Buffer.from(sel, 'base64url'), attendu.length);
  return calcule.length === attendu.length && crypto.timingSafeEqual(calcule, attendu);
}

function signer(charge, secret) {
  const corps = Buffer.from(JSON.stringify(charge)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(corps).digest('base64url');
  return corps + '.' + sig;
}

function verifierJeton(jeton, secret, maintenant) {
  const [corps, sig] = String(jeton || '').split('.');
  if (!corps || !sig || !secret) return null;
  const attendu = crypto.createHmac('sha256', secret).update(corps).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let charge;
  try { charge = JSON.parse(Buffer.from(corps, 'base64url').toString()); } catch (e) { return null; }
  return charge && charge.exp > (maintenant || Date.now()) / 1000 ? charge : null;
}

function lireCookie(entete, nom) {
  const m = String(entete || '').match(new RegExp('(?:^|;\\s*)' + nom + '=([^;]*)'));
  return m ? m[1] : null;
}

async function lireCorps(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

function handler(req, res) {
  const secret = process.env.SESSION_SECRET;
  const hashAttendu = process.env.AUTH_MDP_HASH;
  const jetonActuel = lireCookie(req.headers && req.headers.cookie, COOKIE);

  if (req.method === 'GET') {
    const ok = verifierJeton(jetonActuel, secret);
    res.statusCode = ok ? 200 : 401;
    return res.end(JSON.stringify({ connecte: !!ok }));
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', COOKIE + '=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
    res.statusCode = 200;
    return res.end(JSON.stringify({ connecte: false }));
  }

  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  if (!secret || secret.length < 32 || !hashAttendu) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ erreur: 'Serveur mal configuré : variables SESSION_SECRET ou AUTH_MDP_HASH absentes.' }));
  }

  lireCorps(req).then((corps) => {
    const idOk = typeof corps.id === 'string' && corps.id === ID_ATTENDU;
    const mdpOk = typeof corps.motDePasse === 'string' && verifierMotDePasse(corps.motDePasse, hashAttendu);
    if (!idOk || !mdpOk) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ erreur: 'Identifiant ou mot de passe incorrect.' }));
    }
    const exp = Math.floor(Date.now() / 1000) + DUREE_SECONDES;
    const jeton = signer({ sub: ID_ATTENDU, exp }, secret);
    res.setHeader('Set-Cookie', COOKIE + '=' + jeton + '; Path=/; Max-Age=' + DUREE_SECONDES + '; HttpOnly; Secure; SameSite=Strict');
    res.statusCode = 200;
    return res.end(JSON.stringify({ connecte: true }));
  });
}

module.exports = handler;
module.exports.creerHash = creerHash;
module.exports.verifierMotDePasse = verifierMotDePasse;
module.exports.signer = signer;
module.exports.verifierJeton = verifierJeton;
module.exports.lireCookie = lireCookie;
module.exports.ID_ATTENDU = ID_ATTENDU;
