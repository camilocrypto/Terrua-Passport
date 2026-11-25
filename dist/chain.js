/* Stellar Testnet only. Each batch has its own issuer, locked in the issuance transaction. */
(() => {
  'use strict';
  const S = globalThis.StellarSdk;
  const HORIZON = 'https://horizon-testnet.stellar.org';
  const PASS = S.Networks.TESTNET;
  const text = new TextEncoder();
  const hex = (bytes) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
  const from64 = (value) =>
    Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const digest = async (bytes) =>
    hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  const canonical = (data) => {
    if (Array.isArray(data)) return '[' + data.map(canonical).join(',') + ']';
    if (data && typeof data === 'object')
      return (
        '{' +
        Object.keys(data)
          .sort()
          .map((key) => JSON.stringify(key) + ':' + canonical(data[key]))
          .join(',') +
        '}'
      );
    return JSON.stringify(data);
  };
  async function request(url, options = {}) {
    // Retry read-only ledger queries. Transaction submissions have their own hash-based recovery.
    const retryable = !options.method && url.startsWith(HORIZON + '/');
    for (let attempt = 0; ; attempt++) {
      try {
        return await requestOnce(url, options);
      } catch (error) {
        if (
          !retryable ||
          attempt >= 2 ||
          (error.status &&
            ![408, 429, 500, 502, 503, 504].includes(error.status))
        )
          throw error;
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(error.retryAfter || 0, 650 * 2 ** attempt),
          ),
        );
      }
    }
  }
  async function requestOnce(url, options = {}) {
    let response;
    try {
      response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(35000),
        ...options,
      });
    } catch {
      const error = new Error(
        'No se pudo contactar Stellar Testnet. Comprueba tu conexión y vuelve a intentar.',
      );
      error.code = 'network';
      throw error;
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        response.status === 404
          ? 'La transacción o cuenta no figura en Stellar Testnet.'
          : body.extras?.result_codes?.transaction ||
            body.detail ||
            'Stellar no respondió. Inténtalo nuevamente.',
      );
      error.status = response.status;
      const seconds = Number(response.headers.get('Retry-After'));
      if (Number.isFinite(seconds) && seconds > 0 && seconds <= 10)
        error.retryAfter = seconds * 1000;
      throw error;
    }
    return body;
  }
  async function build(metadata, issuer, receiver, account) {
    const raw = text.encode(canonical(metadata));
    if (raw.length > 4000)
      throw new Error(
        'La ficha supera los 4.000 bytes disponibles. Acorta las notas o los campos adicionales.',
      );
    const fingerprint = await digest(raw);
    const code = 'VIN' + fingerprint.slice(0, 9).toUpperCase();
    const asset = new S.Asset(code, issuer.publicKey());
    const pub = receiver.publicKey();
    const tx = new S.TransactionBuilder(account, {
      fee: '200',
      networkPassphrase: PASS,
    });
    tx.addOperation(
      S.Operation.createAccount({ destination: pub, startingBalance: '5' }),
    );
    tx.addOperation(
      S.Operation.changeTrust({
        asset,
        limit: String(metadata.bottles),
        source: pub,
      }),
    );
    tx.addOperation(
      S.Operation.payment({
        destination: pub,
        asset,
        amount: String(metadata.bottles),
      }),
    );
    const chunks = b64(raw).match(/.{1,64}/g);
    chunks.forEach((v, i) =>
      tx.addOperation(
        S.Operation.manageData({
          name: 'terrua.' + String(i).padStart(2, '0'),
          value: v,
        }),
      ),
    );
    tx.addOperation(S.Operation.setOptions({ masterWeight: 0 }));
    const signed = tx.addMemo(S.Memo.hash(fingerprint)).setTimeout(300).build();
    signed.sign(issuer, receiver);
    return {
      hash: hex(signed.hash()),
      xdr: signed.toXDR(),
      expires: Number(signed.timeBounds.maxTime) * 1000,
    };
  }
  async function prepare(metadata, onProgress) {
    const issuer = S.Keypair.random(),
      receiver = S.Keypair.random();
    onProgress('Preparando las cuentas de prueba con Friendbot…');
    await request('https://friendbot.stellar.org/?addr=' + issuer.publicKey());
    const a = await request(HORIZON + '/accounts/' + issuer.publicKey());
    onProgress('Firmando la emisión y la huella de la ficha…');
    return build(
      metadata,
      issuer,
      receiver,
      new S.Account(a.account_id, a.sequence),
    );
  }
  async function submit(pending) {
    const res = await request(HORIZON + '/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ tx: pending.xdr }).toString(),
      signal: AbortSignal.timeout(70000),
    });
    if (res.hash !== pending.hash || !res.successful)
      throw new Error('Stellar todavía no confirmó esta emisión.');
    return res.hash;
  }
  async function verify(hash) {
    if (!/^[a-fA-F0-9]{64}$/.test(hash))
      throw new Error('Ingresa un hash de transacción de 64 caracteres.');
    const record = await request(
      HORIZON + '/transactions/' + hash.toLowerCase(),
    );
    if (record.hash !== hash.toLowerCase() || !record.successful)
      throw new Error(
        'La transacción no corresponde a una emisión confirmada.',
      );
    if (record.memo_type === 'text' && record.memo === TerruaSerial.sealMemo)
      return TerruaSerial.decode(record);
    return decode(record);
  }
  async function decode(record) {
    const tx = S.TransactionBuilder.fromXDR(record.envelope_xdr, PASS);
    const ops = tx.operations;
    const fail = () => {
      throw new Error('La transacción no contiene un pasaporte Terruá válido.');
    };
    if (
      !Array.isArray(ops) ||
      ops.length < 5 ||
      ops.length > 100 ||
      hex(tx.hash()) !== record.hash ||
      tx.memo?.type !== 'hash'
    )
      fail();
    const [create, trust, payment] = ops;
    const lock = ops.at(-1),
      parts = ops.slice(3, -1);
    if (
      create.type !== 'createAccount' ||
      trust.type !== 'changeTrust' ||
      payment.type !== 'payment' ||
      lock.type !== 'setOptions' ||
      lock.masterWeight !== 0 ||
      [create, payment, lock].some((o) => o.source && o.source !== tx.source) ||
      create.destination !== trust.source ||
      trust.source !== payment.destination ||
      payment.asset?.issuer !== tx.source ||
      !payment.asset.equals(trust.line)
    )
      fail();
    const encoded = parts
      .map((op, i) => {
        if (
          op.type !== 'manageData' ||
          (op.source && op.source !== tx.source) ||
          op.name !== 'terrua.' + String(i).padStart(2, '0') ||
          !op.value
        )
          fail();
        return new TextDecoder().decode(op.value);
      })
      .join('');
    const raw = from64(encoded);
    const fingerprint = await digest(raw);
    if (
      hex(tx.memo.value) !== fingerprint ||
      payment.asset.code !== 'VIN' + fingerprint.slice(0, 9).toUpperCase()
    )
      fail();
    const metadata = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(raw),
    );
    if (
      metadata.schema !== 'terrua.passport.v1' ||
      !Number.isSafeInteger(metadata.bottles) ||
      metadata.bottles < 1 ||
      Number(payment.amount) !== metadata.bottles ||
      Number(trust.limit) !== metadata.bottles ||
      text.encode(canonical(metadata)).length > 4000
    )
      fail();
    return {
      metadata,
      receipt: {
        hash: record.hash,
        ledger: record.ledger,
        at: record.created_at,
        issuer: tx.source,
        distribution: payment.destination,
        code: payment.asset.code,
        fingerprint,
      },
    };
  }
  globalThis.TerruaChain = {
    build,
    prepare,
    submit,
    verify,
    decode,
    digest,
    canonical,
    request,
    HORIZON,
  };
})();
