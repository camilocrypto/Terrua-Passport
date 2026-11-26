'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
global.self = globalThis;
const S = (global.StellarSdk = require('../dist/assets/stellar-sdk.min.js'));
require('../dist/chain.js');
require('../dist/soroban.js');
const T = TerruaSoroban;
const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'dist', 'soroban-evidence.json');
const hashText = (value) => T.digest(T.encoder.encode(value));
const lotHash = (winery, code) => T.hex(T.digest(T.join(
  T.encoder.encode('terrua.lot.v1'), winery, hashText(code),
)));

async function funded() {
  const key = S.Keypair.random();
  await TerruaChain.request('https://friendbot.stellar.org/?addr=' + key.publicKey());
  return key;
}

async function write(signer, operation, label, number) {
  const account = await T.rpc.getAccount(signer.publicKey());
  const unsigned = await T.rpc.prepareTransaction(T.transaction(account, operation));
  unsigned.sign(signer);
  const { hash, result } = await T.submit(unsigned);
  console.log(label, hash);
  return {
    label, hash, ledger: result.ledger,
    feeStroops: S.xdr.TransactionResult.fromXDR(result.resultXdr, 'base64').feeCharged().toString(),
    ...(number ? { number } : {}),
  };
}

async function deploy(admin, reviewer, wasmHash) {
  const account = await T.rpc.getAccount(admin.publicKey());
  const address = new S.Address(admin.publicKey());
  const salt = randomBytes(32);
  const deployment = await T.rpc.prepareTransaction(T.transaction(account, S.Operation.createCustomContract({
    address, salt,
    wasmHash,
    constructorArgs: [T.address(admin.publicKey()), T.address(reviewer.publicKey())],
  })));
  deployment.sign(admin);
  const deployed = await T.submit(deployment);
  const preimage = S.xdr.HashIdPreimage.envelopeTypeContractId(new S.xdr.HashIdPreimageContractId({
    networkId: hashText(T.network),
    contractIdPreimage: S.xdr.ContractIdPreimage.contractIdPreimageFromAddress(
      new S.xdr.ContractIdPreimageFromAddress({ address: address.toScAddress(), salt }),
    ),
  }));
  const contract = S.StrKey.encodeContract(T.digest(preimage.toXDR()));
  return {
    network: 'Stellar Testnet', contract, reader: admin.publicKey(),
    wasmHash: T.hex(wasmHash),
    deployment: {
      hash: deployed.hash, ledger: deployed.result.ledger,
      feeStroops: S.xdr.TransactionResult.fromXDR(deployed.result.resultXdr, 'base64').feeCharged().toString(),
    },
  };
}

async function publish(wasmPath) {
  if (!wasmPath) throw Error('Indica la ruta del archivo Wasm.');
  const interactiveHolder = process.env.TERRUA_TEST_HOLDER;
  const interactiveInput = process.env.TERRUA_TEST_CORK;
  if (Boolean(interactiveHolder) !== Boolean(interactiveInput) ||
      (interactiveHolder && !S.StrKey.isValidEd25519PublicKey(interactiveHolder))) {
    throw Error('Para probar con Freighter, indica una cuenta pública Testnet y su código de muestra.');
  }
  const interactiveCode = interactiveInput ? T.normalizeCode(interactiveInput) : null;
  delete process.env.TERRUA_TEST_CORK;
  const wasm = fs.readFileSync(wasmPath);
  const [admin, winery, reviewer, holder] = await Promise.all(Array.from({ length: 4 }, funded));
  const upload = await write(admin, S.Operation.uploadContractWasm({ wasm }), 'Publicación del Wasm');
  const config = { ...await deploy(admin, reviewer, T.digest(wasm)), upload, lots: [] };
  const { contract } = config;
  console.log('Contrato', contract, config.deployment.hash);
  const wineryId = hashText('terrua.winery.demo.v1');
  const invoke = (key, label, method, args, number) =>
    write(key, T.operation(contract, method, ...args), label, number);
  config.authorization = await invoke(admin, 'Autorización de bodega', 'set_winery',
    [T.bytes(wineryId), T.address(winery.publicKey())]);

  for (const [index, origin] of ['Ladera de muestra', 'Valle de muestra', 'Parcela de muestra'].entries()) {
    const manifest = {
      schema: 'terrua.soroban.v1', winery: 'Bodega de demostración',
      code: 'SOROBAN-00' + (index + 1), origin, vintage: 2024, first: 1, count: 24,
    };
    const manifestHash = hashText(TerruaChain.canonical(manifest));
    const id = lotHash(wineryId, manifest.code);
    const lot = T.bytes(T.fromHex(id));
    const codes = Array.from({ length: manifest.count }, () =>
      Array.from(randomBytes(16), (byte) => T.alphabet[byte & 31]).join(''));
    if (index === 0 && interactiveCode) codes[2] = interactiveCode;
    const transactions = [await invoke(winery, 'Registro de ' + manifest.code, 'register_lot',
      [T.bytes(wineryId), T.bytes(hashText(manifest.code)), T.bytes(manifestHash), T.uint(1), T.uint(24)])];
    for (let offset = 0; offset < codes.length; offset += 8) {
      const commitments = codes.slice(offset, offset + 8).map((code, i) =>
        T.bytes(T.commitment(contract, id, offset + i + 1, code)));
      transactions.push(await invoke(winery, 'Registro de botellas ' + (offset + 1) + '–' + (offset + 8),
        'register_bottles', [lot, T.uint(offset + 1), S.xdr.ScVal.scvVec(commitments)]));
    }
    if (index === 0) {
      transactions.push(await invoke(winery, 'Asignación a la wallet titular', 'assign_bottle',
        [lot, T.uint(1), T.address(holder.publicKey())], 1));
      transactions.push(await invoke(holder, 'Consumo firmado por el titular', 'consume_bottle',
        [lot, T.uint(1), T.bytes(T.encoder.encode(codes[0]))], 1));
      transactions.push(await invoke(reviewer, 'Retiro firmado por revisión', 'withdraw_bottle',
        [lot, T.uint(2), T.bytes(hashText('Etiqueta de muestra retirada.'))], 2));
      if (interactiveHolder) {
        transactions.push(await invoke(winery, 'Asignación para prueba con Freighter', 'assign_bottle',
          [lot, T.uint(3), T.address(interactiveHolder)], 3));
        config.interactiveBottle = 3;
      }
    }
    config.lots.push({ id, manifest, transactions });
  }
  await verify(config);
  fs.writeFileSync(evidence, JSON.stringify(config, null, 2) + '\n');
}

async function verify(config) {
  assert.equal(config.network, 'Stellar Testnet');
  assert.equal(config.lots.length, 3);
  const read = (method, ...args) => T.read(config.contract, config.reader, method, ...args);
  let checked = 0;
  for (const [index, row] of config.lots.entries()) {
    const lot = T.bytes(T.fromHex(row.id));
    const record = await read('get_lot', lot);
    assert.equal(T.hex(record.manifest), T.hex(hashText(TerruaChain.canonical(row.manifest))));
    assert.equal(record.count, 24);
    assert.equal(record.registered, 24);
    let active = 0;
    const seen = new Set();
    for (let first = 1; first <= 24; first += 6) {
      const batch = await Promise.all(Array.from({ length: 6 }, (_, offset) =>
        read('get_bottle', lot, T.uint(first + offset))));
      for (const [offset, bottle] of batch.entries()) {
        const number = first + offset;
        const expected = index === 0 && number === 1 ? 'Consumed' :
          index === 0 && number === 2 ? 'Withdrawn' : 'Active';
        if (index === 0 && number === config.interactiveBottle) {
          assert.ok(['Active', 'Consumed'].includes(bottle.state[0]));
        } else {
          assert.equal(bottle.state[0], expected);
        }
        if (bottle.state[0] === 'Active') active++;
        assert.equal(bottle.commitment.length, 32);
        seen.add(T.hex(bottle.commitment));
        checked++;
      }
    }
    assert.equal(seen.size, 24);
    assert.equal(record.active, active);
  }
  assert.equal(checked, 72);
  console.log('Soroban Testnet: 3 lotes, 72 botellas, 1 consumo y 1 retiro verificados.');
}

async function main() {
  if (process.argv[2] === '--publish') return publish(process.argv[3]);
  await verify(JSON.parse(fs.readFileSync(evidence, 'utf8')));
}

module.exports = { S, T, funded, write, deploy, hashText, lotHash };
if (require.main === module) main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
