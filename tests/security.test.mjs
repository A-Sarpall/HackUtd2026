import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';

const ORIGIN = 'https://nextmove.test';

async function startServer(port, extraEnv = {}) {
  const env = {...process.env, PORT: String(port), DATABASE_PATH: ':memory:', PUBLIC_ORIGIN: ORIGIN, ...extraEnv};
  delete env.NVIDIA_API_KEY; delete env.NESSIE_API_KEY;
  const child = spawn(process.execPath, ['--experimental-sqlite', 'backend/server.mjs'], {env, stdio: ['ignore', 'pipe', 'pipe']});
  await once(child.stdout, 'data');
  return child;
}

// Raw request so tests control Host/Origin exactly as a browser or attacker would send them.
function request(port, path, {method = 'GET', headers = {}, body} = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port, path, method, headers: Object.fromEntries(Object.entries({host: 'nextmove.test', ...headers}).filter(([, v]) => v !== undefined))}, res => {
      let text = ''; res.on('data', c => { text += c; });
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, json: text && res.headers['content-type']?.includes('json') ? JSON.parse(text) : null}));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}
const post = (port, path, body, headers = {}) => request(port, path, {method: 'POST', body, headers: {'content-type': 'application/json', origin: ORIGIN, ...headers}});

test('public deployment sends security headers and secure session cookies', async () => {
  const port = 3096, child = await startServer(port);
  try {
    const page = await request(port, '/');
    assert.equal(page.status, 200);
    assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
    assert.match(page.headers['content-security-policy'], /object-src 'none'/);
    assert.equal(page.headers['x-frame-options'], 'DENY');
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal(page.headers['referrer-policy'], 'no-referrer');
    assert.match(page.headers['strict-transport-security'], /max-age=\d+/);
    const login = await post(port, '/api/v1/demo-session', {});
    assert.equal(login.status, 201);
    const cookie = login.headers['set-cookie'][0];
    assert.match(cookie, /^__Host-nextmove_session=[a-f0-9]{64};/);
    for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=604800']) assert.ok(cookie.includes(flag), flag);
    // The non-prefixed cookie name must not authenticate when secure cookies are in use.
    const value = cookie.split(';')[0].split('=')[1];
    assert.equal((await request(port, '/api/v1/snapshot', {headers: {cookie: 'nextmove_session=' + value}})).status, 401);
    assert.equal((await request(port, '/api/v1/snapshot', {headers: {cookie: cookie.split(';')[0]}})).status, 200);
  } finally { child.kill(); }
});

test('cross-site, wrong-host and non-JSON writes are rejected', async () => {
  const port = 3095, child = await startServer(port);
  try {
    const cookie = (await post(port, '/api/v1/demo-session', {})).headers['set-cookie'][0].split(';')[0];
    assert.equal((await post(port, '/api/v1/actions', {amountCents: 100}, {cookie, origin: 'https://evil.test'})).status, 403);
    assert.equal((await post(port, '/api/v1/actions', {amountCents: 100}, {cookie, origin: undefined, 'sec-fetch-site': 'cross-site'})).status, 403);
    assert.equal((await post(port, '/api/v1/actions', 'amountCents=100', {cookie, 'content-type': 'application/x-www-form-urlencoded'})).status, 415);
    assert.equal((await request(port, '/api/v1/snapshot', {headers: {cookie, host: 'attacker.test'}})).status, 421);
    assert.equal((await post(port, '/api/v1/actions', {amountCents: 100}, {cookie, 'content-length': '20000'}).catch(() => ({status: 413}))).status, 413);
    // Health stays reachable for platform probes regardless of Host.
    assert.equal((await request(port, '/health', {headers: {host: 'internal'}})).status, 200);
    // Same-origin write still succeeds.
    assert.equal((await post(port, '/api/v1/actions', {amountCents: 100}, {cookie})).status, 201);
  } finally { child.kill(); }
});

test('session creation and Sidekick runs are rate limited', async () => {
  const port = 3094, child = await startServer(port, {SESSION_LIMIT_PER_HOUR: '2', RUN_LIMIT_PER_HOUR: '1'});
  try {
    const first = await post(port, '/api/v1/demo-session', {});
    assert.equal((await post(port, '/api/v1/demo-session', {})).status, 201);
    const blocked = await post(port, '/api/v1/demo-session', {});
    assert.equal(blocked.status, 429);
    assert.equal(blocked.json.error.code, 'RATE_LIMITED');
    assert.ok(Number(blocked.headers['retry-after']) > 0);
    const cookie = first.headers['set-cookie'][0].split(';')[0];
    const snap = (await request(port, '/api/v1/snapshot', {headers: {cookie}})).json;
    const run = {snapshotId: snap.id, snapshotVersion: snap.version, message: 'Can I pay $300 today?'};
    assert.equal((await post(port, '/api/v1/runs', run, {cookie})).status, 200);
    const limitedRun = await post(port, '/api/v1/runs', run, {cookie});
    assert.equal(limitedRun.status, 429);
    assert.equal(limitedRun.json.error.code, 'RATE_LIMITED');
  } finally { child.kill(); }
});

test('expired sessions stop authenticating', async () => {
  const port = 3093, child = await startServer(port, {SESSION_TTL_MS: '800'});
  try {
    const cookie = (await post(port, '/api/v1/demo-session', {})).headers['set-cookie'][0].split(';')[0];
    assert.equal((await request(port, '/api/v1/snapshot', {headers: {cookie}})).status, 200);
    await new Promise(r => setTimeout(r, 1000));
    assert.equal((await request(port, '/api/v1/snapshot', {headers: {cookie}})).status, 401);
  } finally { child.kill(); }
});
