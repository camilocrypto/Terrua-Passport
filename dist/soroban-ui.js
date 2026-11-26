(() => {
  'use strict';
  const T = TerruaSoroban;
  const app = document.querySelector('#soroban-app');
  const explorer = 'https://stellar.expert/explorer/testnet/';
  const labels = { Active: 'Activa', Withdrawn: 'Retirada', Consumed: 'Consumida' };
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const serial = (number) => String(number).padStart(4, '0');
  const route = (contract, lot, number) => '#' + [contract, lot, number].map(encodeURIComponent).join('/');
  const href = (kind, id) => explorer + kind + '/' + encodeURIComponent(id);
  let renderId = 0;

  function qr(url) {
    const image = qrcode(0, 'M');
    image.addData(url);
    image.make();
    return image.createImgTag(3, 12, 'QR del pasaporte');
  }

  function index(config) {
    app.innerHTML = '<h1>Pasaportes Soroban</h1><p>Datos ficticios. Etiquetado y apertura de la cápsula simulados.</p>' +
      '<p><a href="' + href('contract', config.contract) + '">Consultar contrato en Testnet</a></p>' +
      config.lots.map(({ id, manifest }) => {
        const label = escape(manifest.winery + ' · ' + manifest.code);
        const links = Array.from({ length: manifest.count }, (_, i) => {
          const number = manifest.first + i;
          return '<a class="btn outline" href="' + route(config.contract, id, number) +
            '">Botella ' + serial(number) + '</a>';
        });
        return '<section class="panel no-print"><h2>' + label + '</h2><div class="actions">' +
          links.join('') + '</div></section>';
      }).join('') +
      '<section class="panel"><h2>Seis etiquetas simuladas</h2><p>La numeración aparece en el frente y se repite junto al QR de la etiqueta trasera.</p>' +
      '<div class="actions">' + config.lots.flatMap(({ id, manifest }) =>
        [manifest.first, manifest.first + 1].map((number) => {
          const url = new URL(route(config.contract, id, number), location.href);
          return '<div class="qr-box"><strong>Frente · Botella ' + serial(number) + '</strong><p>' +
            escape(manifest.winery + ' · ' + manifest.code) + '</p>' + qr(url.href) +
            '<p>Reverso · Botella ' + serial(number) + '</p></div>';
        })).join('') + '</div><button class="btn outline no-print" id="print-labels">Imprimir etiquetas</button></section>';
    document.querySelector('#print-labels').onclick = () => window.print();
  }

  async function render() {
    const request = ++renderId;
    app.innerHTML = '<p role="status">Consultando el registro de Soroban…</p>';
    try {
      const response = await fetch('soroban-evidence.json', { cache: 'no-cache' });
      if (!response.ok) throw Error('El despliegue de demostración no está disponible.');
      const config = await response.json();
      if (request !== renderId) return;
      if (!location.hash) return index(config);
      const parts = location.hash.slice(1).split('/');
      const [contract, id, rawNumber] = parts;
      const number = Number(rawNumber);
      const lot = config.lots.find((entry) => entry.id === id);
      if (parts.length !== 3 || contract !== config.contract || !lot ||
          !/^\d{1,8}$/.test(rawNumber) || number < lot.manifest.first ||
          number >= lot.manifest.first + lot.manifest.count) {
        throw Error('El QR no identifica una botella del despliegue actual.');
      }
      const [registered, bottle] = await Promise.all([
        T.read(contract, config.reader, 'get_lot', T.bytes(T.fromHex(id))),
        T.read(contract, config.reader, 'get_bottle', T.bytes(T.fromHex(id)), T.uint(number)),
      ]);
      if (request !== renderId) return;
      const hash = T.hex(T.digest(T.encoder.encode(TerruaChain.canonical(lot.manifest))));
      if (hash !== T.hex(registered.manifest) || registered.first !== lot.manifest.first ||
          registered.count !== lot.manifest.count) {
        throw Error('La ficha pública difiere del manifiesto registrado.');
      }
      const state = bottle.state[0];
      if (!Object.hasOwn(labels, state)) throw Error('Estado de botella desconocido.');
      const history = lot.transactions.filter((entry) => !entry.number || entry.number === number);
      app.innerHTML = '<a href="soroban.html">Volver a los lotes</a><article class="cert">' +
        '<h1>Botella ' + serial(number) + '</h1><p>' + escape(lot.manifest.winery + ' · ' + lot.manifest.code) +
        '</p><p>Añada ' + escape(lot.manifest.vintage) + ' · Origen declarado: ' + escape(lot.manifest.origin) +
        '</p><p><strong>' + labels[state] + '</strong> · Estado consultado en Soroban Testnet</p>' +
        '<p>' + registered.active + ' activas de ' + registered.registered + ' registradas en el lote</p>' +
        '<p>Datos ficticios. Comprueba que el número de la ficha coincide con la etiqueta.</p>' +
        '<details><summary>Comparar el número impreso</summary><form id="printed-form">' +
        '<label class="field">Número de la etiqueta<input name="printed" inputmode="numeric" maxlength="8" required></label>' +
        '<button class="btn outline">Comparar</button><p role="status" id="printed-message"></p></form></details>' +
        '<p><a href="' + href('contract', contract) + '">Contrato en Testnet</a></p>' +
        '<h2>Historial de la demo</h2><ul>' + history.map((entry) =>
          '<li><a href="' + href('tx', entry.hash) + '">' + escape(entry.label) + '</a></li>').join('') +
        '</ul><p>Último cambio en ledger ' + bottle.changed_ledger + '.</p>' +
        (bottle.reason ? '<p>Huella del motivo del retiro: <code>' + T.hex(bottle.reason) + '</code></p>' : '') +
        (state === 'Active' ? '<form id="cork-form"><label class="field">Código bajo la cápsula' +
          '<input name="cork" required autocomplete="off" autocapitalize="characters" maxlength="24" spellcheck="false"></label>' +
          '<div class="actions"><button type="button" id="check-cork" class="btn outline">Comprobar código</button>' +
          (bottle.holder ? '<button class="btn primary">Marcar como consumida</button>' : '') +
          '</div>' + (bottle.holder ? '<p>Al iniciar el consumo, el código se envía al RPC para preparar la firma y queda visible en la transacción pública si se confirma. El cambio es definitivo.</p>' :
            '<p>La bodega aún no asignó titular.</p>') +
          '<p id="cork-message" role="status"></p></form>' : '') + '</article>';
      document.querySelector('#printed-form').onsubmit = (event) => {
        event.preventDefault();
        document.querySelector('#printed-message').textContent =
          T.matchPrintedNumber(number, event.currentTarget.elements.printed.value)
            ? 'El número impreso coincide con el pasaporte.'
            : 'El número impreso no coincide con el pasaporte.';
      };
      const form = document.querySelector('#cork-form');
      if (!form) return;
      const message = document.querySelector('#cork-message');
      const input = form.elements.cork;
      document.querySelector('#check-cork').onclick = () => {
        try {
          const matches = T.hex(T.commitment(contract, id, number, input.value)) === T.hex(bottle.commitment);
          message.textContent = matches ? 'El código coincide con el registro de esta botella.' :
            'El código no corresponde a esta botella.';
        } catch (error) {
          message.textContent = error.message;
        }
      };
      form.onsubmit = async (event) => {
        event.preventDefault();
        if (!bottle.holder) return;
        const submit = form.querySelector('button[type="submit"], button.btn.primary');
        if (submit.disabled) return;
        if (!window.confirm('Se enviará el código al RPC para preparar la firma. Si la transacción se confirma, el consumo será definitivo y el código quedará público en Testnet. ¿Continuar?')) return;
        submit.disabled = true;
        try {
          const { hash: consumed } = await T.consume(config, id, number, bottle, input.value);
          if (request !== renderId) return;
          await render();
          app.insertAdjacentHTML('afterbegin', '<p role="status">Consumo confirmado. <a href="' +
            href('tx', consumed) + '">Ver transacción</a></p>');
        } catch (error) {
          message.textContent = error.message;
        } finally {
          input.value = '';
          submit.disabled = false;
        }
      };
    } catch (error) {
      if (request !== renderId) return;
      app.innerHTML = '<h1>Verificación no disponible</h1><p role="status">' + escape(error.message) +
        '</p><a href="soroban.html">Volver a la demo</a>';
    }
  }
  addEventListener('hashchange', render);
  render();
})();
