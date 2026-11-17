// Tests de la connexion serveur (api/session.js) : mot de passe, jeton signé, identifiant.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const S = require('../api/session.js');

const SECRET = 'x'.repeat(40);
const MDP = 'mot-de-passe-test';

function appeler(metho, corps, cookie) {
  return new Promise((resolve) => {
    process.env.SESSION_SECRET = SECRET;
    process.env.AUTH_MDP_HASH = S.creerHash(MDP);
    const req = { method: metho, headers: cookie ? { cookie } : {}, body: corps };
    const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { resolve({ status: this.statusCode, headers: this.headers, corps: t ? JSON.parse(t) : null }); } };
    S(req, res);
  });
}

test('mot de passe correct accepté, faux refusé', () => {
  const h = S.creerHash(MDP);
  assert.ok(S.verifierMotDePasse(MDP, h));
  assert.ok(!S.verifierMotDePasse('autre', h));
  assert.ok(!S.verifierMotDePasse(MDP, 'n-importe-quoi'));
});

test('le hachage ne contient pas le mot de passe et change à chaque fois (sel)', () => {
  const a = S.creerHash(MDP), b = S.creerHash(MDP);
  assert.ok(!a.includes(MDP));
  assert.notStrictEqual(a, b);
});

test('connexion : bon identifiant et bon mot de passe → cookie HttpOnly signé', async () => {
  const r = await appeler('POST', { id: 'User.1050', motDePasse: MDP });
  assert.strictEqual(r.status, 200);
  const cookie = r.headers['Set-Cookie'];
  assert.match(cookie, /gm_session=.+; Path=\/; .*HttpOnly; Secure; SameSite=Strict/);
});

test('mauvais mot de passe ou mauvais identifiant → 401 sans cookie', async () => {
  const a = await appeler('POST', { id: 'User.1050', motDePasse: 'faux' });
  const b = await appeler('POST', { id: 'User.9999', motDePasse: MDP });
  assert.strictEqual(a.status, 401);
  assert.strictEqual(b.status, 401);
  assert.strictEqual(a.headers['Set-Cookie'], undefined);
});

test('session : jeton valide → 200, falsifié ou expiré → 401', async () => {
  const jeton = S.signer({ sub: 'User.1050', exp: Math.floor(Date.now() / 1000) + 60 }, SECRET);
  assert.strictEqual((await appeler('GET', null, 'gm_session=' + jeton)).status, 200);
  assert.strictEqual((await appeler('GET', null, 'gm_session=' + jeton + 'x')).status, 401);
  const vieux = S.signer({ sub: 'User.1050', exp: 1 }, SECRET);
  assert.strictEqual((await appeler('GET', null, 'gm_session=' + vieux)).status, 401);
  assert.strictEqual((await appeler('GET', null, undefined)).status, 401);
});

test('déconnexion : cookie effacé', async () => {
  const r = await appeler('DELETE', null, undefined);
  assert.match(r.headers['Set-Cookie'], /Max-Age=0/);
});
