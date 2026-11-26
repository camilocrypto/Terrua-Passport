'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { S, T, funded, write, deploy, hashText, lotHash } = require('./soroban.cjs');
const dist = path.join(__dirname, '../dist');
const large = process.argv.includes('--tirada');
const count = large ? 100 : 2;
const lotCode = large ? 'TIRADA-100' : 'ENSAYO-001';
const port = large ? 18768 : 18767;
const origin = 'http://127.0.0.1:' + port;
const existing = require('../dist/soroban-evidence.json');
const routes = new Map([
  ['/', ['ensayo.html', 'text/html']],
  ['/ensayo.html', ['ensayo.html', 'text/html']],
  ['/ensayo.js', ['ensayo.js', 'text/javascript']],
  ['/styles.css', ['styles.css', 'text/css']],
  ['/assets/mark.svg', ['assets/mark.svg', 'image/svg+xml']],
  ['/assets/qr.min.js', ['assets/qr.min.js', 'text/javascript']],
]);

async function prepare() {
  const [operator, holder] = await Promise.all([funded(), funded()]);
  const deployment = await deploy(operator, holder, T.fromHex(existing.wasmHash));
  const { contract, reader } = deployment;
  const winery = hashText('terrua.ensayo.bodega.v1');
  const manifest = { winery: 'Bodega de ensayo', code: lotCode, first: 1, count };
  const id = lotHash(winery, manifest.code);
  const lot = T.bytes(T.fromHex(id));
  const invoke = (method, ...args) => T.operation(contract, method, ...args);
  await write(operator, invoke('set_winery', T.bytes(winery), T.address(operator.publicKey())), 'Autorizar emisor de ensayo');
  const registration = await write(operator, invoke('register_lot', T.bytes(winery), T.bytes(hashText(manifest.code)),
    T.bytes(hashText(TerruaChain.canonical(manifest))), T.uint(1), T.uint(count)), 'Registrar lote de ensayo');
  const bottles = Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    code: Array.from(randomBytes(16), byte => T.alphabet[byte & 31]).join(''),
    opened: false,
    hash: null,
  }));
  const commitments = bottles.map(({ number, code }) => T.bytes(T.commitment(contract, id, number, code)));
  const batches = [];
  for (let offset = 0; offset < count; offset += 8) {
    const chunk = commitments.slice(offset, offset + 8);
    const first = offset + 1;
    const last = offset + chunk.length;
    const receipt = await write(operator, invoke('register_bottles', lot, T.uint(first),
      S.xdr.ScVal.scvVec(chunk)), 'Registrar botellas ' + first + '–' + last);
    batches.push({ first, last, ...receipt });
  }
  const assignments = [];
  for (const number of large ? [100] : [1, 2]) {
    assignments.push(await write(operator, invoke('assign_bottle', lot, T.uint(number),
      T.address(holder.publicKey())), 'Asignar botella ' + number, number));
  }
  return {
    bottles, contract, reader, id, lot, holder, manifest, invoke, busy: false,
    evidence: { ...deployment, id, manifest, registration, batches, assignments },
  };
}

let rehearsal;
let failure = false;
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function read(demo, bottle) {
  return T.read(demo.contract, demo.reader, 'get_bottle', demo.lot, T.uint(bottle.number));
}

async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 256) throw Error('Solicitud demasiado grande.');
  }
  return JSON.parse(raw);
}

async function serve(request, response) {
  if (request.headers.host !== '127.0.0.1:' + port) return json(response, 403, { error: 'Usa la dirección local de ensayo.' });
  const pathname = new URL(request.url, origin).pathname;
  if (request.method === 'GET' && routes.has(pathname)) {
    const [file, type] = routes.get(pathname);
    response.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(fs.readFileSync(path.join(dist, file)));
    return;
  }
  const match = /^\/api\/botella\/(\d{1,3})(?:\/(abrir|comprobar|consumir))?$/.exec(pathname);
  const number = Number(match?.[1]);
  const lotRead = large && request.method === 'GET' && pathname === '/api/lote';
  const evidenceRead = large && request.method === 'GET' && pathname === '/evidencia.json';
  if (!lotRead && !evidenceRead && !(number >= 1 && number <= count)) {
    return json(response, 404, { error: 'Ruta no disponible.' });
  }
  if (!rehearsal) return json(response, failure ? 503 : 202, failure
    ? { error: 'Falló la preparación en Testnet. Revisa el servidor local.' }
    : { preparing: true });
  if (evidenceRead) return json(response, 200, rehearsal.evidence);
  if (lotRead) {
    const current = await T.read(rehearsal.contract, rehearsal.reader, 'get_lot', rehearsal.lot);
    return json(response, 200, {
      lot: rehearsal.manifest.code, contract: rehearsal.contract, count, active: current.active,
      registered: current.registered, consumption: rehearsal.bottles[99].hash,
    });
  }
  const bottle = rehearsal.bottles[number - 1];
  const action = match[2];
  if (!action && request.method === 'GET') {
    const current = await read(rehearsal, bottle);
    return json(response, 200, {
      number: bottle.number, lot: rehearsal.manifest.code, contract: rehearsal.contract,
      state: current.state[0], hash: bottle.hash, opened: bottle.opened,
      interactive: !large || number === 100,
    });
  }
  if (!action || request.method !== 'POST' || request.headers.origin !== origin ||
      request.headers['content-type'] !== 'application/json') {
    return json(response, 403, { error: 'Solicitud local inválida.' });
  }
  if (large && number !== 100) {
    return json(response, 403, { error: 'Esta botella está disponible para consulta.' });
  }
  if (action === 'abrir') {
    bottle.opened = true;
    return json(response, 200, { code: bottle.code.match(/.{4}/g).join('-') });
  }
  const data = await body(request);
  let code;
  try {
    code = T.normalizeCode(String(data?.code ?? ''));
  } catch (error) {
    return json(response, 400, { error: error.message });
  }
  const current = await read(rehearsal, bottle);
  if (!bottle.opened ||
      T.hex(T.commitment(rehearsal.contract, rehearsal.id, bottle.number, code)) !==
      T.hex(current.commitment)) {
    return json(response, 400, { error: 'El código no corresponde a esta botella.' });
  }
  if (action === 'comprobar') return json(response, 200, { matched: true });
  if (rehearsal.busy || current.state[0] !== 'Active') {
    return json(response, 409, { error: 'La botella ya fue consumida o hay una firma en curso.' });
  }
  rehearsal.busy = true;
  try {
    const { hash } = await write(rehearsal.holder,
      rehearsal.invoke('consume_bottle', rehearsal.lot, T.uint(bottle.number), T.bytes(T.encoder.encode(code))),
      'Consumo de ensayo ' + bottle.number);
    bottle.hash = hash;
    const confirmed = await read(rehearsal, bottle);
    if (confirmed.state[0] !== 'Consumed') throw Error('Estado pendiente.');
    return json(response, 200, { hash, state: 'Consumed' });
  } finally {
    rehearsal.busy = false;
  }
}

const server = http.createServer((request, response) => serve(request, response).catch(() => {
  json(response, 503, { error: 'No se pudo confirmar la consulta. Actualiza la ficha antes de reintentar.' });
}));
server.listen(port, '127.0.0.1', () => {
  console.log('Ensayo Soroban: ' + origin);
  prepare().then((demo) => {
    rehearsal = demo;
    console.log('Botellas listas en el contrato ' + demo.contract);
  }).catch((error) => {
    failure = true;
    console.error('No se pudo preparar la demo:', error.message);
  });
});
