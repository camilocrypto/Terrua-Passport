'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { T, hashText } = require('./soroban.cjs');
const origin = 'http://127.0.0.1:18768';

async function evidence() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await fetch(origin + '/evidencia.json');
    if (response.status === 200) return response.json();
    if (response.status !== 202) throw Error('El servidor no pudo preparar la tirada.');
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw Error('La tirada todavía no está lista.');
}

async function main() {
  const receipt = await evidence();
  const lot = T.bytes(T.fromHex(receipt.id));
  const read = (method, ...args) => T.read(receipt.contract, receipt.reader, method, lot, ...args);
  const state = await read('get_lot');
  assert.equal(T.hex(state.manifest), T.hex(hashText(TerruaChain.canonical(receipt.manifest))));
  assert.equal(state.registered, 100);
  assert.equal(state.active, 100);
  assert.deepEqual(receipt.batches.map(({ first, last }) => [first, last]),
    Array.from({ length: 13 }, (_, i) => [i * 8 + 1, Math.min(i * 8 + 8, 100)]));
  assert.deepEqual(receipt.assignments.map(({ number }) => number), [100]);
  const commitments = new Set();
  for (let first = 1; first <= 100; first += 5) {
    const bottles = await Promise.all(Array.from({ length: 5 }, (_, offset) =>
      read('get_bottle', T.uint(first + offset))));
    for (const [index, bottle] of bottles.entries()) {
      assert.equal(bottle.state[0], 'Active');
      assert.equal(Boolean(bottle.holder), first + index === 100);
      assert.equal(bottle.commitment.length, 32);
      commitments.add(T.hex(bottle.commitment));
    }
  }
  assert.equal(commitments.size, 100);
  const fixture = await (await fetch(origin + '/api/botella/100')).json();
  assert.deepEqual([fixture.number, fixture.state, fixture.opened, fixture.hash],
    [100, 'Active', false, null]);
  if (process.argv[2]) {
    fs.writeFileSync(process.argv[2], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  }
  console.log('100 botellas activas verificadas en Soroban. La 0100 está asignada y cerrada.');
  console.log(receipt.contract);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
