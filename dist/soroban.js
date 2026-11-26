/* Public Testnet reads and wallet-authorized consumption. */
(() => {
  'use strict';
  const S = globalThis.StellarSdk;
  const network = S.Networks.TESTNET;
  const rpcUrl = 'https://soroban-testnet.stellar.org';
  const rpc = new S.rpc.Server(rpcUrl, { timeout: 12000 });
  const encoder = new TextEncoder();
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const hex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  const digest = (bytes) => S.hash(bytes);
  const hashPattern = /^[a-f0-9]{64}$/;
  function fromHex(value) {
    if (!hashPattern.test(value)) throw Error('Identificador inválido.');
    return Uint8Array.from(value.match(/../g), (pair) => parseInt(pair, 16));
  }
  const bytes = (value) => S.nativeToScVal(value, { type: 'bytes' });
  const uint = (value) => S.nativeToScVal(value, { type: 'u32' });
  const address = (value) => new S.Address(value).toScVal();
  function join(...parts) {
    const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }
    return result;
  }
  function normalizeCode(raw) {
    const code = raw.replace(/[\s-]/g, '').toUpperCase();
    if (code.length !== 16 || !Array.from(code).every((letter) => alphabet.includes(letter))) {
      throw Error('Ingresa los 16 caracteres del código debajo de la cápsula.');
    }
    return code;
  }
  function matchPrintedNumber(number, printed) {
    return /^\d{1,8}$/.test(printed.trim()) && Number(printed) === number;
  }
  function commitment(contract, lot, number, raw) {
    const serial = new Uint8Array(4);
    new DataView(serial.buffer).setUint32(0, number);
    return digest(join(
      encoder.encode('terrua.cork.v1'),
      digest(encoder.encode(network)),
      address(contract).toXDR(),
      fromHex(lot),
      serial,
      encoder.encode(normalizeCode(raw)),
    ));
  }
  function transaction(source, operation) {
    return new S.TransactionBuilder(source, { fee: '1000', networkPassphrase: network })
      .addOperation(operation).setTimeout(120).build();
  }
  function operation(contract, method, ...args) {
    return new S.Contract(contract).call(method, ...args);
  }
  async function read(contract, reader, method, ...args) {
    const tx = transaction(new S.Account(reader, '0'), operation(contract, method, ...args));
    const result = await rpc.simulateTransaction(tx);
    if (!S.rpc.Api.isSimulationSuccess(result) || !result.result?.retval) {
      throw Error('Soroban no pudo verificar el registro. Comprueba la red y vuelve a intentar.');
    }
    return S.scValToNative(result.result.retval);
  }
  async function submit(signed) {
    const hash = hex(signed.hash());
    const sent = await rpc.sendTransaction(signed);
    if (sent.hash !== hash || !['PENDING', 'DUPLICATE'].includes(sent.status)) {
      throw Error('Testnet no aceptó la transacción.');
    }
    // Read confirmation without deserializing transaction metadata. Classic's
    // vendored SDK predates the metadata version currently returned by RPC.
    for (let attempt = 0; attempt < 16; attempt++) {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash } }),
        signal: AbortSignal.timeout(12000),
      });
      const { result } = await response.json();
      if (result?.status === 'SUCCESS' && result.txHash === hash) return { hash, result };
      if (result?.status === 'FAILED') throw Error('Soroban rechazó la ejecución de la transacción.');
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw Error('La transacción no está confirmada. Vuelve a consultar el pasaporte antes de reintentar.');
  }
  async function consume(config, lot, number, bottle, raw) {
    const code = normalizeCode(raw);
    if (hex(commitment(config.contract, lot, number, code)) !== hex(bottle.commitment)) {
      throw Error('El código del corcho no corresponde a esta botella.');
    }
    const wallet = globalThis.freighterApi;
    if (!wallet || !(await wallet.isConnected()).isConnected) {
      throw Error('Abre esta página en un navegador con Freighter configurado para Testnet.');
    }
    const details = await wallet.getNetworkDetails();
    if (details.networkPassphrase !== network) throw Error('Selecciona Testnet en Freighter.');
    const access = await wallet.requestAccess();
    if (access.error || access.address !== bottle.holder) {
      throw Error('La wallet conectada no es la titular asignada.');
    }
    const source = await rpc.getAccount(access.address);
    const tx = await rpc.prepareTransaction(transaction(source, operation(
      config.contract, 'consume_bottle', bytes(fromHex(lot)), uint(number), bytes(encoder.encode(code)),
    )));
    const signed = await wallet.signTransaction(tx.toXDR(), { networkPassphrase: network, address: access.address });
    if (signed.error || !signed.signedTxXdr) throw Error('La firma no se completó.');
    const envelope = S.TransactionBuilder.fromXDR(signed.signedTxXdr, network);
    if (hex(envelope.hash()) !== hex(tx.hash())) throw Error('La firma corresponde a otra transacción.');
    return submit(envelope);
  }
  globalThis.TerruaSoroban = {
    network, rpc, alphabet, encoder, hex, digest, fromHex, join, bytes, uint, address,
    commitment, normalizeCode, matchPrintedNumber, operation, transaction, read, submit, consume,
  };
})();
