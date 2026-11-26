'use strict';
const assert = require('node:assert/strict');
global.self = globalThis;
const S = (global.StellarSdk = require('../dist/assets/stellar-sdk.min.js'));
require('../dist/soroban.js');
const T = TerruaSoroban;
const contract = S.StrKey.encodeContract(Buffer.alloc(32, 1));
const lot = 'ab'.repeat(32);
const code = '0123456789ABCDEF'; // Fixed test vector, unrelated to the deployed pilot.
assert.equal(T.normalizeCode('0123-4567-89ab-cdef'), code);
assert.throws(() => T.normalizeCode('C3B5'));
assert.throws(() => T.normalizeCode('0123456789IOULZZ'));
assert.equal(T.matchPrintedNumber(1, '0001'), true);
assert.equal(T.matchPrintedNumber(1, '0002'), false);
assert.equal(T.matchPrintedNumber(1, '1e0'), false);
assert.notDeepEqual(T.commitment(contract, lot, 1, code), T.commitment(contract, lot, 2, code));
assert.notDeepEqual(T.commitment(contract, lot, 1, code), T.commitment(contract, 'cd'.repeat(32), 1, code));
assert.notDeepEqual(T.commitment(contract, lot, 1, code),
  T.commitment(S.StrKey.encodeContract(Buffer.alloc(32, 2)), lot, 1, code));
console.log('OK: números de etiqueta y códigos ligados a contrato, lote y botella.');
