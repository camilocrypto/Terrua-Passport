/* The published pilot roster is the trust anchor for the demonstration. */
(() => {
  'use strict';
  const hashPattern = /^[a-f0-9]{64}$/;
  const chain = TerruaChain;
  const serial = TerruaSerial;

  async function verify(roster, lot, proof, number = null) {
    if (
      roster.network !== 'Stellar Testnet' ||
      !roster.lots.includes(lot) ||
      proof.metadata.example !== true ||
      proof.receipt.mode !== serial.mode ||
      proof.receipt.issuer !== lot.issuer ||
      proof.receipt.hash !== lot.seal ||
      proof.receipt.fingerprint !== lot.fingerprint ||
      serial.marker(proof.metadata) !== lot.marker ||
      proof.metadata.bottles !== lot.count ||
      proof.metadata.firstSerial !== lot.first ||
      roster.lots.filter((entry) => entry.marker === lot.marker).length !== 1
    ) {
      throw Error('La emisión no coincide con el registro autorizado de la demo.');
    }
    if (number !== null) serial.serialNumber(proof.metadata, number);
    if (!lot.correction) return null;
    const correction = await TerruaReview.verify(
      lot.correction, proof.receipt, 'terrua.correction.v1',
    );
    if (
      correction.signer !== roster.reviewer ||
      correction.data.schema !== 'terrua.correction.v1'
    ) {
      throw Error('La corrección no está firmada por la cuenta revisora de la demo.');
    }
    serial.serialNumber(proof.metadata, correction.data.number);
    return correction;
  }

  let rosterRequest;
  async function roster() {
    rosterRequest ??= fetch('pilot-evidence.json', { cache: 'no-cache' })
      .then(async (response) => {
        if (!response.ok) throw Error('El registro de la demo no está disponible.');
        return response.json();
      })
      .catch((error) => {
        rosterRequest = undefined;
        throw error;
      });
    return rosterRequest;
  }

  function transactionUrl(hash) {
    if (!hashPattern.test(hash)) throw Error('Referencia de transacción inválida.');
    return chain.HORIZON + '/transactions/' + hash;
  }

  globalThis.TerruaPilot = { roster, verify, transactionUrl };
})();
