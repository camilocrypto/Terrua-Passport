'use strict';
const assert = require('node:assert/strict');
global.self = globalThis;
const S = (global.StellarSdk = require('../dist/assets/stellar-sdk.min.js'));
require('../dist/model.js');
require('../dist/chain.js');
require('../dist/serial.js');
require('../dist/review.js');
require('../dist/pilot.js');

async function test() {
  const issuer = S.Keypair.random();
  const owner = S.Keypair.random().publicKey();
  const reviewer = S.Keypair.random();
  const outsider = S.Keypair.random();
  const metadata = TerruaModel.metadata({
    ...TerruaModel.examples[1].data,
    example: true,
    bottleMode: TerruaSerial.mode,
    bottleOwner: owner,
    firstSerial: 1,
    bottles: 24,
  });
  const plan = TerruaSerial.build(metadata, issuer, owner, '4294967296');
  const records = new Map(plan.steps.map(({ hash, xdr }) => [
    hash, { hash, successful: true, envelope_xdr: xdr },
  ]));
  TerruaChain.request = async (url) => {
    const record = records.get(url.split('/').at(-1));
    assert.ok(record);
    return record;
  };
  const proof = await TerruaSerial.decode(records.get(plan.hash));
  const lot = {
    issuer: issuer.publicKey(),
    seal: plan.hash,
    fingerprint: proof.receipt.fingerprint,
    marker: TerruaSerial.marker(metadata),
    first: 1,
    count: 24,
  };
  const roster = { network: 'Stellar Testnet', reviewer: reviewer.publicKey(), lots: [lot] };
  const check = (number) => TerruaPilot.verify(roster, lot, proof, number);
  assert.equal(await check(24), null);
  await assert.rejects(check(25), /fuera de la tirada/);
  await assert.rejects(
    TerruaPilot.verify(roster, lot, { ...proof, receipt: { ...proof.receipt, issuer: outsider.publicKey() } }),
    /registro autorizado/,
  );
  await assert.rejects(
    TerruaPilot.verify({ ...roster, lots: [lot, { ...lot }] }, lot, proof),
    /registro autorizado/,
  );
  await assert.rejects(
    TerruaPilot.verify({ ...roster, network: 'Mainnet' }, lot, proof),
    /registro autorizado/,
  );
  const setup = records.get(proof.receipt.setup);
  records.set(proof.receipt.setup, { ...setup, envelope_xdr: records.get(plan.hash).envelope_xdr });
  await assert.rejects(TerruaSerial.decode(records.get(plan.hash)), /no coincide con su hash/);
  records.set(proof.receipt.setup, setup);

  function correction(signer) {
    const tx = TerruaReview.build(new S.Account(signer.publicKey(), '0'), {
      schema: 'terrua.correction.v1',
      batch: lot.seal,
      org: 'Revisión de muestra',
      scope: 'Embotellado y cantidad',
      folio: 'DEMO-001',
      number: 2,
      status: 'retirada',
      reason: 'Etiqueta retirada.',
    });
    tx.sign(signer);
    const hash = TerruaReview.hashHex(tx);
    records.set(hash, { hash, successful: true, envelope_xdr: tx.toXDR() });
    return hash;
  }
  lot.correction = correction(outsider);
  await assert.rejects(check(2), /cuenta revisora/);
  lot.correction = correction(reviewer);
  assert.equal((await check(2)).data.status, 'retirada');
  await assert.rejects(TerruaReview.verify(lot.correction, proof.receipt), /no corresponde/);
  console.log('OK: autorización, duplicados, red, integridad, numeración y correcciones del piloto.');
}
test().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
