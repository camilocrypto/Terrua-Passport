/* Stellar Classic serial issuance. Each individual asset has exactly one stroop.
   Every envelope is signed and journaled before the first transaction is sent. */
(() => {
  'use strict';
  const S = globalThis.StellarSdk,
    C = globalThis.TerruaChain;
  const mode = 'bottles-v1',
    batchSize = 60,
    maxBottles = 4800;
  const sealMemo = 'Terrua bottles v1',
    unit = '0.0000001';
  const HASH = /^[a-f0-9]{64}$/;
  const bytes = new TextEncoder(),
    utf8 = new TextDecoder('utf-8', { fatal: true });
  const hex = (data) =>
    Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');
  const code = (n) => 'B' + String(n).padStart(8, '0');
  const label = (n) => String(n).padStart(4, '0');
  const blocks = (n) => Math.ceil(n / batchSize);
  const clean = (s) =>
    s
      .normalize('NFKC')
      .trim()
      .toLocaleLowerCase('es')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  const marker = (m) =>
    S.StrKey.encodeEd25519PublicKey(
      S.hash(
        bytes.encode(
          JSON.stringify(['terrua.bottles.v1', clean(m.winery), clean(m.lot)]),
        ),
      ),
    );
  const blockName = (i) => 'tr.block.' + String(i).padStart(2, '0');
  function check(m) {
    if (
      m.bottleMode !== mode ||
      !Number.isSafeInteger(m.bottles) ||
      m.bottles < 1 ||
      m.bottles > maxBottles
    )
      throw Error(
        'La emisión individual admite entre 1 y 4.800 botellas por lote.',
      );
    if (
      !Number.isSafeInteger(m.firstSerial) ||
      m.firstSerial < 1 ||
      m.firstSerial + m.bottles - 1 > 99999999
    )
      throw Error(
        'Usa números de botella entre 1 y 99.999.999, sin decimales.',
      );
    if (m.bottleOwner && !S.StrKey.isValidEd25519PublicKey(m.bottleOwner))
      throw Error(
        'La cuenta receptora debe ser una dirección pública Stellar válida que empiece con G.',
      );
  }
  function serialNumber(m, value) {
    const n = Number(value);
    if (
      !/^\d{1,8}$/.test(String(value)) ||
      !Number.isSafeInteger(n) ||
      n < m.firstSerial ||
      n >= m.firstSerial + m.bottles
    )
      throw Error('Ese número está fuera de la tirada de este lote.');
    return n;
  }
  const opData = (name, value) => S.Operation.manageData({ name, value });
  function setupOps(m, owner) {
    const raw = bytes.encode(C.canonical(m));
    if (raw.length > 4000)
      throw Error('La ficha supera el máximo de 4.000 bytes.');
    const encoded = btoa(String.fromCharCode(...raw));
    return [
      S.Operation.createAccount({
        destination: marker(m),
        startingBalance: '1',
      }),
      opData('tr.receiver', owner),
      ...encoded
        .match(/.{1,64}/g)
        .map((p, i) => opData('terrua.' + String(i).padStart(2, '0'), p)),
    ];
  }
  function mintOps(m, issuer, owner, idx) {
    const claimant = new S.Claimant(owner, S.Claimant.predicateUnconditional());
    const length = Math.min(batchSize, m.bottles - idx * batchSize);
    return Array.from({ length }, (_, offset) =>
      S.Operation.createClaimableBalance({
        asset: new S.Asset(
          code(m.firstSerial + idx * batchSize + offset),
          issuer,
        ),
        amount: unit,
        claimants: [claimant],
      }),
    );
  }
  function sealOps(m, setup, hashes) {
    return [
      opData('tr.setup', setup),
      ...hashes.map((h, i) => opData(blockName(i), h)),
      S.Operation.payment({
        destination: marker(m),
        asset: S.Asset.native(),
        amount: unit,
      }),
      S.Operation.setOptions({ masterWeight: 0 }),
    ];
  }
  function build(m, issuer, owner, sequence) {
    check(m);
    const a = new S.Account(issuer.publicKey(), sequence);
    if (BigInt(sequence) % 4294967296n !== 0n)
      throw Error('La serie requiere una cuenta emisora nueva.');
    function sign(ops, memo) {
      const builder = new S.TransactionBuilder(a, {
        networkPassphrase: S.Networks.TESTNET,
        fee: '5000',
      });
      ops.forEach((op) => builder.addOperation(op));
      const tx = builder.addMemo(memo).setTimeout(0).build();
      tx.sign(issuer);
      return { hash: hex(tx.hash()), xdr: tx.toXDR() };
    }
    const fingerprint = hex(S.hash(bytes.encode(C.canonical(m))));
    const setup = sign(setupOps(m, owner), S.Memo.hash(fingerprint));
    const mints = Array.from({ length: blocks(m.bottles) }, (_, i) =>
      sign(mintOps(m, issuer.publicKey(), owner, i), S.Memo.hash(setup.hash)),
    );
    const seal = sign(
      sealOps(
        m,
        setup.hash,
        mints.map((b) => b.hash),
      ),
      S.Memo.text(sealMemo),
    );
    return { mode, hash: seal.hash, steps: [setup, ...mints, seal] };
  }
  async function prepare(m, progress) {
    check(m);
    const issuer = S.Keypair.random(),
      owner = m.bottleOwner || S.Keypair.random().publicKey();
    progress('Preparando la cuenta emisora en Testnet…');
    await C.request(
      'https://friendbot.stellar.org/?addr=' + issuer.publicKey(),
    );
    const a = await C.request(C.HORIZON + '/accounts/' + issuer.publicKey());
    return build(m, issuer, owner, a.sequence);
  }
  async function load(hash) {
    if (!HASH.test(hash)) throw Error('Referencia de emisión inválida.');
    const record = await C.request(C.HORIZON + '/transactions/' + hash);
    if (record.hash !== hash || record.successful !== true)
      throw Error('Stellar no confirmó la transacción esperada.');
    const tx = S.TransactionBuilder.fromXDR(
      record.envelope_xdr,
      S.Networks.TESTNET,
    );
    if (hex(tx.hash()) !== hash)
      throw Error('El contenido de la transacción no coincide con su hash.');
    return { record, tx };
  }
  function matchOps(tx, expected) {
    const ops = tx.tx.operations();
    if (
      ops.length !== expected.length ||
      expected.some((op, i) => op.toXDR('base64') !== ops[i].toXDR('base64'))
    )
      throw Error(
        'Las operaciones de la serie difieren de las registradas por Terruá.',
      );
  }
  function value(op, name) {
    if (op?.type !== 'manageData' || op.name !== name || !op.value)
      throw Error('Estructura de la serie inválida.');
    return utf8.decode(op.value);
  }
  async function decode(record, lookup = load) {
    const seal = S.TransactionBuilder.fromXDR(
      record.envelope_xdr,
      S.Networks.TESTNET,
    );
    if (
      !record.successful ||
      hex(seal.hash()) !== record.hash ||
      seal.memo?.type !== 'text' ||
      utf8.decode(seal.memo.value) !== sealMemo
    )
      throw Error('Sello de serie inválido.');
    const ops = seal.operations,
      setupHash = value(ops[0], 'tr.setup');
    const hashes = ops.slice(1, -2).map((op, i) => value(op, blockName(i)));
    if (
      !hashes.length ||
      hashes.length > blocks(maxBottles) ||
      hashes.some((h) => !HASH.test(h)) ||
      new Set(hashes).size !== hashes.length
    )
      throw Error('El manifiesto de la serie no es válido.');
    const { tx: setup } = await lookup(setupHash);
    const entries = setup.operations,
      owner = value(entries[1], 'tr.receiver');
    const raw = Uint8Array.from(
      atob(
        entries
          .slice(2)
          .map((op, i) => value(op, 'terrua.' + String(i).padStart(2, '0')))
          .join(''),
      ),
      (c) => c.charCodeAt(0),
    );
    const m = JSON.parse(utf8.decode(raw));
    check(m);
    const fp = await C.digest(raw);
    if (
      m.schema !== 'terrua.passport.v1' ||
      TerruaModel.validate(m) ||
      C.canonical(m) !== utf8.decode(raw) ||
      !S.StrKey.isValidEd25519PublicKey(owner) ||
      (m.bottleOwner && m.bottleOwner !== owner) ||
      setup.source !== seal.source ||
      BigInt(setup.sequence) % 4294967296n !== 1n ||
      setup.memo.type !== 'hash' ||
      hex(setup.memo.value) !== fp ||
      hashes.length !== blocks(m.bottles) ||
      BigInt(seal.sequence) !==
        BigInt(setup.sequence) + BigInt(hashes.length + 1)
    )
      throw Error(
        'El rango, el destinatario o los metadatos no coinciden con la emisión.',
      );
    matchOps(setup, setupOps(m, owner));
    matchOps(seal, sealOps(m, setupHash, hashes));
    // Verify all mint transactions with bounded concurrency before displaying an issued status.
    for (let start = 0; start < hashes.length; start += 4) {
      await Promise.all(
        hashes.slice(start, start + 4).map(async (hash, j) => {
          const i = start + j,
            { tx } = await lookup(hash);
          if (
            tx.source !== seal.source ||
            BigInt(tx.sequence) !== BigInt(setup.sequence) + BigInt(i + 1) ||
            tx.memo.type !== 'hash' ||
            hex(tx.memo.value) !== setupHash
          )
            throw Error('Falta un tramo válido de la emisión.');
          matchOps(tx, mintOps(m, seal.source, owner, i));
        }),
      );
    }
    return {
      metadata: m,
      receipt: {
        mode,
        hash: record.hash,
        ledger: record.ledger,
        at: record.created_at,
        issuer: seal.source,
        distribution: owner,
        code: 'SER' + fp.slice(0, 9).toUpperCase(),
        fingerprint: fp,
        setup: setupHash,
        blocks: hashes,
      },
    };
  }
  async function inspectPlan(plan) {
    if (
      plan?.mode !== mode ||
      !Array.isArray(plan.steps) ||
      plan.steps.length < 3 ||
      plan.steps.length > blocks(maxBottles) + 2 ||
      plan.steps.at(-1)?.hash !== plan.hash
    )
      throw Error('El archivo de recuperación no contiene una serie válida.');
    const byHash = new Map();
    for (const step of plan.steps) {
      const tx = S.TransactionBuilder.fromXDR(step.xdr, S.Networks.TESTNET);
      if (
        hex(tx.hash()) !== step.hash ||
        tx.signatures.length !== 1 ||
        !S.Keypair.fromPublicKey(tx.source).verify(
          tx.hash(),
          tx.signatures[0].signature(),
        )
      )
        throw Error('La firma del archivo de recuperación no es válida.');
      byHash.set(step.hash, {
        tx,
        record: { hash: step.hash, envelope_xdr: step.xdr, successful: true },
      });
    }
    const proof = await decode(byHash.get(plan.hash).record, async (h) => {
      if (!byHash.has(h)) throw Error('El respaldo está incompleto.');
      return byHash.get(h);
    });
    const expected = [proof.receipt.setup, ...proof.receipt.blocks, plan.hash];
    if (
      expected.length !== plan.steps.length ||
      expected.some((h, i) => h !== plan.steps[i].hash)
    )
      throw Error('El orden de envío del archivo no coincide con el sello.');
    return proof.metadata;
  }
  async function existing(m) {
    let page;
    try {
      await C.request(C.HORIZON + '/accounts/' + marker(m));
      page = await C.request(
        C.HORIZON +
          '/accounts/' +
          marker(m) +
          '/transactions?order=desc&limit=100',
      );
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
    for (const rec of page._embedded.records) {
      if (rec.memo !== sealMemo || !rec.successful) continue;
      let proof;
      try {
        proof = await decode(rec);
      } catch (e) {
        if (e.status) throw e;
        continue;
      }
      if (marker(proof.metadata) !== marker(m)) continue;
      if (C.canonical(proof.metadata) !== C.canonical(m))
        throw Error(
          'Esta bodega y este código de lote ya tienen otra ficha numerada. Revisa el lote antes de continuar.',
        );
      return proof;
    }
    throw Error(
      'Este lote tiene una reserva de numeración en Stellar. Retoma el borrador que inició la emisión.',
    );
  }
  async function submitSeries(plan, progress) {
    for (const [i, step] of plan.steps.entries()) {
      progress(
        i === 0
          ? 'Reservando la numeración del lote…'
          : i === plan.steps.length - 1
            ? 'Sellando la serie completa…'
            : 'Emitiendo tramo ' + i + ' de ' + (plan.steps.length - 2) + '…',
      );
      try {
        await load(step.hash);
        continue;
      } catch (e) {
        if (e.status !== 404) throw e;
      }
      try {
        await C.submit(step);
      } catch (submitError) {
        try {
          await load(step.hash);
        } catch {
          throw submitError;
        }
      }
    }
  }
  async function bottle(proof, number) {
    const { metadata: m, receipt: r } = proof;
    if (r.mode !== mode)
      throw Error('Este pasaporte corresponde a un activo por lote.');
    const n = serialNumber(m, number),
      offset = n - m.firstSerial,
      hash = r.blocks[Math.floor(offset / batchSize)];
    const { tx } = await load(hash);
    return {
      number: n,
      asset: code(n),
      issuer: r.issuer,
      hash,
      balanceId: tx.getClaimableBalanceId(offset % batchSize),
    };
  }
  globalThis.TerruaSerial = {
    mode,
    maxBottles,
    sealMemo,
    check,
    serialNumber,
    code,
    label,
    marker,
    build,
    prepare,
    inspectPlan,
    existing,
    submitSeries,
    decode,
    bottle,
  };
})();
