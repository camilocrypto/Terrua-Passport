'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.self = globalThis;
const S = (global.StellarSdk = require('../dist/assets/stellar-sdk.min.js'));
require('../dist/model.js');
require('../dist/chain.js');
require('../dist/serial.js');
require('../dist/review.js');
require('../dist/pilot.js');
const chain = TerruaChain;
const serial = TerruaSerial;
const pilot = TerruaPilot;
const evidencePath = path.resolve(__dirname, '../dist/pilot-evidence.json');

async function fundedKey() {
  const key = S.Keypair.random();
  await chain.request('https://friendbot.stellar.org/?addr=' + key.publicKey());
  return key;
}

async function claim(owner, token) {
  const address = owner.publicKey();
  const account = await chain.request(chain.HORIZON + '/accounts/' + address);
  const tx = new S.TransactionBuilder(new S.Account(address, account.sequence), {
    fee: '1000',
    networkPassphrase: S.Networks.TESTNET,
  })
    .addOperation(S.Operation.changeTrust({ asset: new S.Asset(token.asset, token.issuer) }))
    .addOperation(S.Operation.claimClaimableBalance({ balanceId: token.balanceId }))
    .setTimeout(300)
    .build();
  tx.sign(owner);
  return chain.submit({ hash: TerruaReview.hashHex(tx), xdr: tx.toXDR() });
}

async function publish() {
  const reviewer = await fundedKey();
  const owner = await fundedKey();
  const roster = { network: 'Stellar Testnet', reviewer: reviewer.publicKey(), lots: [] };
  const run = Date.now().toString(36);
  for (const [index, winery] of ['Ladera de muestra', 'Valle de muestra', 'Parcela de muestra'].entries()) {
    const metadata = TerruaModel.metadata({
      ...TerruaModel.examples[1].data,
      winery,
      lot: 'DEMO-' + run + '-' + (index + 1),
      evidence: undefined,
      certifier: '',
      reference: '',
      example: true,
      bottleMode: serial.mode,
      firstSerial: 1,
      bottles: 24,
      bottleOwner: owner.publicKey(),
      lineCheck: false,
    });
    assert.equal(TerruaModel.validate(metadata), '');
    const plan = await serial.prepare(metadata, console.log);
    await serial.submitSeries(plan, console.log);
    const { receipt } = await chain.verify(plan.hash);
    const lot = {
      label: winery + ' · ' + metadata.lot,
      marker: serial.marker(metadata),
      issuer: receipt.issuer,
      fingerprint: receipt.fingerprint,
      setup: receipt.setup,
      blocks: receipt.blocks,
      seal: receipt.hash,
      first: metadata.firstSerial,
      count: metadata.bottles,
    };
    roster.lots.push(lot);
    console.log(lot.label, lot.seal);
  }
  const [lot] = roster.lots;
  const account = await chain.request(chain.HORIZON + '/accounts/' + roster.reviewer);
  const correction = TerruaReview.build(new S.Account(roster.reviewer, account.sequence), {
    schema: 'terrua.correction.v1',
    batch: lot.seal,
    org: 'Revisión de muestra',
    scope: 'Embotellado y cantidad',
    folio: 'DEMO-001',
    number: 2,
    status: 'retirada',
    reason: 'Etiqueta de muestra retirada durante el control de numeración.',
  });
  correction.sign(reviewer);
  lot.correction = await chain.submit({
    hash: TerruaReview.hashHex(correction),
    xdr: correction.toXDR(),
  });
  const proof = await chain.verify(lot.seal);
  const token = await serial.bottle(proof, 1);
  lot.claim = await claim(owner, token);
  await verify(roster);
  fs.writeFileSync(evidencePath, JSON.stringify(roster, null, 2) + '\n');
}

async function verify(roster) {
  assert.equal(roster.lots.length, 3);
  let checked = 0;
  let corrections = 0;
  let claims = 0;
  for (const lot of roster.lots) {
    const proof = await chain.verify(lot.seal);
    assert.equal(lot.count, 24);
    assert.equal(lot.setup, proof.receipt.setup);
    assert.deepEqual(lot.blocks, proof.receipt.blocks);
    if (await pilot.verify(roster, lot, proof)) corrections++;
    const ids = new Set();
    for (let number = lot.first; number < lot.first + lot.count; number++) {
      const token = await serial.bottle(proof, number);
      assert.equal(token.asset, serial.code(number));
      assert.equal(token.issuer, lot.issuer);
      ids.add(token.balanceId);
      checked++;
    }
    assert.equal(ids.size, lot.count);
    if (lot.claim) {
      const claimRecord = await chain.request(pilot.transactionUrl(lot.claim));
      const original = await serial.bottle(proof, lot.first);
      const tx = S.TransactionBuilder.fromXDR(claimRecord.envelope_xdr, S.Networks.TESTNET);
      assert.equal(claimRecord.successful, true);
      assert.equal(TerruaReview.hashHex(tx), lot.claim);
      assert.equal(tx.source, proof.receipt.distribution);
      assert.equal(tx.operations[1].type, 'claimClaimableBalance');
      assert.equal(tx.operations[1].balanceId, original.balanceId);
      claims++;
    }
  }
  assert.equal(checked, 72);
  assert.equal(corrections, 1);
  assert.equal(claims, 1);
  console.log('Testnet: 3 lotes, 72 botellas, 1 corrección y 1 reclamo verificados.');
}

const task = process.argv[2] === '--publish'
  ? publish()
  : Promise.resolve().then(() => verify(JSON.parse(fs.readFileSync(evidencePath, 'utf8'))));
task.catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
