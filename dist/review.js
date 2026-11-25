/* A reviewer signs a separate, testnet-only attestation referring to the issuance hash. */
(() => {
  const S = globalThis.StellarSdk,
    chain = TerruaChain,
    network = S.Networks.TESTNET;
  const passKinds = [
    'Identidad y origen',
    'Análisis enológico',
    'Embotellado y cantidad',
    'Revisión documental',
  ];
  const hashHex = (tx) =>
    Array.from(tx.hash(), (b) => b.toString(16).padStart(2, '0')).join('');
  function valid(r) {
    return (
      r &&
      r.schema === 'terrua.review.v1' &&
      typeof r.org === 'string' &&
      r.org.trim() &&
      r.org.length <= 100 &&
      typeof r.folio === 'string' &&
      r.folio.trim() &&
      r.folio.length <= 90 &&
      passKinds.includes(r.scope) &&
      /^[a-f0-9]{64}$/.test(r.batch)
    );
  }
  const key = (batch, i) =>
    'tr.review.' + batch.slice(0, 12) + '.' + String(i).padStart(2, '0');
  function build(account, review) {
    if (!valid(review))
      throw Error('Completa la entidad revisora, el alcance y el folio.');
    const data = new TextEncoder().encode(chain.canonical(review));
    const encoded = btoa(String.fromCharCode(...data));
    const tx = new S.TransactionBuilder(account, {
      fee: '200',
      networkPassphrase: network,
    });
    encoded
      .match(/.{1,64}/g)
      .forEach((value, i) =>
        tx.addOperation(
          S.Operation.manageData({ name: key(review.batch, i), value }),
        ),
      );
    return tx.addMemo(S.Memo.hash(review.batch)).setTimeout(300).build();
  }
  async function verify(hash, receipt) {
    if (!/^[a-f0-9]{64}$/.test(hash))
      throw Error('El hash de la revisión no es válido.');
    const record = await chain.request(chain.HORIZON + '/transactions/' + hash);
    const tx = S.TransactionBuilder.fromXDR(record.envelope_xdr, network);
    const fail = () => {
      throw Error('La revisión firmada no corresponde a este pasaporte.');
    };
    if (
      !record.successful ||
      record.hash !== hash ||
      hashHex(tx) !== hash ||
      tx.memo?.type !== 'hash' ||
      Array.from(tx.memo.value, (b) => b.toString(16).padStart(2, '0')).join(
        '',
      ) !== receipt.hash ||
      [receipt.issuer, receipt.distribution].includes(tx.source) ||
      !tx.operations.length ||
      tx.operations.length > 30
    )
      fail();
    const data = tx.operations
      .map((op, i) => {
        if (
          op.type !== 'manageData' ||
          (op.source && op.source !== tx.source) ||
          op.name !== key(receipt.hash, i) ||
          !op.value
        )
          fail();
        return new TextDecoder().decode(op.value);
      })
      .join('');
    const r = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(
        Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
      ),
    );
    if (!valid(r) || r.batch !== receipt.hash) fail();
    return { data: r, signer: tx.source, hash, at: record.created_at };
  }
  async function sign(review, receipt) {
    const api = globalThis.freighterApi;
    if (!api || !(await api.isConnected()).isConnected)
      throw Error(
        'Para firmar, abre la app en un navegador con la extensión Freighter habilitada y selecciona Testnet.',
      );
    const { address, error } = await api.requestAccess();
    if (error || !address) throw Error('La billetera no autorizó la conexión.');
    const net = await api.getNetworkDetails();
    if (net.networkPassphrase !== network)
      throw Error(
        'Selecciona Stellar Testnet en tu billetera antes de firmar.',
      );
    if ([receipt.issuer, receipt.distribution].includes(address))
      throw Error(
        'Utiliza la cuenta del revisor, independiente de las cuentas de emisión.',
      );
    let account;
    try {
      account = await chain.request(chain.HORIZON + '/accounts/' + address);
    } catch (e) {
      if (e.status === 404)
        throw Error(
          'La cuenta del revisor necesita saldo de prueba en Stellar Testnet.',
        );
      throw e;
    }
    const tx = build(new S.Account(address, account.sequence), review);
    const result = await api.signTransaction(tx.toXDR(), {
      networkPassphrase: network,
      address,
    });
    if (result.error || !result.signedTxXdr)
      throw Error('Se canceló la firma. Puedes retomar la revisión.');
    const signed = S.TransactionBuilder.fromXDR(result.signedTxXdr, network);
    if (hashHex(signed) !== hashHex(tx) || !signed.signatures.length)
      throw Error('La firma no corresponde a la revisión preparada.');
    return {
      hash: hashHex(tx),
      xdr: result.signedTxXdr,
      expires: Number(tx.timeBounds.maxTime) * 1000,
    };
  }
  globalThis.TerruaReview = { passKinds, build, verify, sign, hashHex };
})();
