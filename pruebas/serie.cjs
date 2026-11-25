// Prueba local, sin conexión, sin secretos persistentes y sin emitir en Stellar.
'use strict';
const assert = require('node:assert/strict');
global.self = globalThis;
const S = (global.StellarSdk = require('../dist/assets/stellar-sdk.min.js'));
require('../dist/model.js');
require('../dist/chain.js');
require('../dist/serial.js');
const serial = TerruaSerial,
  chain = TerruaChain,
  model = TerruaModel;

(async () => {
  const issuer = S.Keypair.random(),
    dest = S.Keypair.random().publicKey();
  const m = {
    ...model.metadata(model.examples[1].data),
    bottleMode: serial.mode,
    firstSerial: 450,
    bottles: 123,
    bottleOwner: dest,
  };
  const plan = serial.build(m, issuer, dest, '4294967296');
  assert.deepEqual(await serial.inspectPlan(plan), m);
  assert.throws(() => serial.serialNumber(m, 449));
  assert.throws(() => serial.serialNumber(m, 573));
  assert.throws(() => serial.serialNumber(m, '450.5'));
  assert.equal(serial.serialNumber(m, '00450'), 450);
  assert.throws(() => serial.check({ ...m, bottles: 4801 }));
  assert.throws(() => serial.check({ ...m, firstSerial: 99999999 }));
  assert.throws(() => serial.check({ ...m, bottleOwner: 'G-malformada' }));
  assert.equal(
    serial.marker({ ...m, winery: m.winery.toUpperCase() }),
    serial.marker(m),
  );
  assert.notEqual(serial.marker({ ...m, lot: 'OTRO' }), serial.marker(m));
  const draft = {
    ...model.examples.find((wine) => wine.id === 'origen').data,
    origin: 'Valle de prueba', withdrawn: '0117', serviceTemp: '16', decant: '0',
  };
  const registered = model.metadata(draft);
  assert.equal(model.validate(registered), '');
  const inventory = model.inventory(registered);
  assert.deepEqual([inventory.available, inventory.samples, inventory.withdrawn, inventory.loss], [1193, 6, 1, 24]);
  assert.equal(inventory.states.get(401), 'Muestra testigo');
  assert.equal(inventory.states.get(117), 'Baja');
  assert.equal(registered.decant, 0);
  const winePlan = serial.build(registered, issuer, dest, '4294967296');
  assert.deepEqual(await serial.inspectPlan(winePlan), registered);
  for (const changed of [
    { withdrawn: '0401' }, { samples: '0' }, { samples: '1201' }, { samples: '8-2' },
    { samples: '3-7, 7' }, { withdrawn: '0117,' }, { theoretical: 1199 },
    { firstSerial: 450 }, { serviceTemp: 'abc' }, { decant: -1 },
  ]) assert.notEqual(model.validate({ ...draft, ...changed }), '');
  const plain = model.metadata({ ...draft, lineCheck: false });
  assert.equal(plain.samples, undefined);
  assert.equal(model.inventory(plain), null);
  for (const file of ['example-serial.json', 'example-proof.json']) {
    const old = require('../dist/' + file).metadata;
    assert.equal(model.validate(old), '');
    assert.deepEqual(model.metadata(old), old);
  }
  const bad = structuredClone(plan);
  [bad.steps[1], bad.steps[2]] = [bad.steps[2], bad.steps[1]];
  await assert.rejects(serial.inspectPlan(bad));
  const confirmed = new Map(),
    submissionCount = new Map();
  let disconnect = true;
  chain.request = async (url) => {
    const rec = confirmed.get(url.split('/').pop());
    if (!rec) {
      const e = Error('Pendiente');
      e.status = 404;
      throw e;
    }
    return rec;
  };
  chain.submit = async (step) => {
    if (step.hash === plan.steps[2].hash && disconnect) {
      disconnect = false;
      throw Error('Interrupción de prueba');
    }
    submissionCount.set(step.hash, (submissionCount.get(step.hash) || 0) + 1);
    confirmed.set(step.hash, {
      hash: step.hash,
      envelope_xdr: step.xdr,
      successful: true,
      ledger: 10,
      created_at: '2026-11-22T12:00:00Z',
    });
  };
  await assert.rejects(
    serial.submitSeries(plan, () => {}),
    /Interrupción/,
  );
  assert.equal(confirmed.size, 2);
  await serial.submitSeries(plan, () => {});
  await serial.submitSeries(plan, () => {});
  assert.equal(confirmed.size, plan.steps.length);
  for (const count of submissionCount.values()) assert.equal(count, 1);
  const proof = await serial.decode(confirmed.get(plan.hash));
  const all = [];
  for (let n = m.firstSerial; n < m.firstSerial + m.bottles; n++)
    all.push(await serial.bottle(proof, n));
  assert.equal(new Set(all.map((b) => b.asset)).size, 123);
  assert.equal(new Set(all.map((b) => b.balanceId)).size, 123);
  assert.equal(all[59].number, 509);
  assert.equal(all[60].number, 510);
  const cap = { ...m, firstSerial: 1, bottles: serial.maxBottles };
  const full = serial.build(cap, issuer, dest, '4294967296');
  assert.deepEqual(await serial.inspectPlan(full), cap);
  console.log(
    'OK: 123 botellas distintas, límites de rango, integridad del respaldo, recuperación tras una interrupción, reintento sin duplicados y estructura del máximo de 4.800.',
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
