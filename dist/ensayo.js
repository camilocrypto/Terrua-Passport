(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const large = location.port === '18768';
  const publicView = location.pathname === '/botella-3d.html';
  const params = new URLSearchParams(location.search);
  const selection = params.get('botella');
  const number = selection === null ? 1 : Number(selection);
  if (large || publicView) {
    $('lot-nav').hidden = false;
    if (publicView) {
      $('nav-catalogue').href = '/galeria.html';
      $('nav-3d').href = '/botella-3d.html?botella=100';
      $('lot-back').querySelector('a').href = '/galeria.html';
      if (params.get('galeria') === '1') document.body.classList.add('ensayo-gallery-frame');
    }
    if (selection === null) $('nav-catalogue').setAttribute('aria-current', 'page');
    if (number === 100) $('nav-3d').setAttribute('aria-current', 'page');
  }
  const api = '/api/botella/' + number;
  const status = $('status');
  const form = $('check-form');
  const input = form.elements.cork;
  const open = $('open-cork');
  const consume = $('consume');
  const stage = $('bottle-stage');
  const replay = $('replay-cork');
  const viewCork = $('view-cork');
  let checked = '';

  function showSide(side) {
    stage.dataset.view = side;
    delete stage.dataset.inspect;
    $('view-front').setAttribute('aria-pressed', String(side === 'front'));
    $('view-back').setAttribute('aria-pressed', String(side === 'back'));
    viewCork.setAttribute('aria-pressed', 'false');
    if (publicView) {
      delete stage.dataset.previewOpen;
      $('visual-note').hidden = true;
    }
  }
  $('view-front').onclick = () => showSide('front');
  $('view-back').onclick = () => showSide('back');
  if (publicView) {
    viewCork.hidden = false;
    viewCork.onclick = () => {
      showSide('front');
      stage.dataset.previewOpen = '';
      stage.dataset.inspect = '';
      $('view-front').setAttribute('aria-pressed', 'false');
      viewCork.setAttribute('aria-pressed', 'true');
      $('visual-note').textContent = 'El grabado DEMO es ilustrativo. El código real permanece oculto.';
      $('visual-note').hidden = false;
    };
  }

  async function renderBottle(serial, qr) {
    const G = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js');
    const renderer = new G.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    const scene = new G.Scene();
    const camera = new G.PerspectiveCamera(31, 1, 0.1, 30);
    camera.position.set(0, 2.05, 7.3);
    camera.lookAt(0, 1.77, 0);
    const bottle = new G.Group();
    scene.add(bottle);
    const profile = [
      [0, 0.08], [.36, .02], [.47, .07], [.5, .14], [.5, 1.76],
      [.49, 1.88], [.44, 2.04], [.35, 2.17], [.23, 2.28],
      [.175, 2.4], [.17, 2.96], [.19, 3], [.19, 3.09], [0, 3.09],
    ].map(([radius, height]) => new G.Vector2(radius, height));
    const mesh = (shape, surface) => new G.Mesh(shape, new G.MeshPhysicalMaterial(surface));
    bottle.add(mesh(new G.LatheGeometry(profile, 80), {
      color: 0x293c21, roughness: 0.24, metalness: 0.12, clearcoat: 1,
    }));
    const cork = mesh(new G.CylinderGeometry(.145, .145, .14, 48), { color: 0xaa7a4f, roughness: .85 });
    cork.position.y = 3.1;
    bottle.add(cork);
    const corkFace = document.createElement('canvas');
    corkFace.width = corkFace.height = 256;
    const corkInk = corkFace.getContext('2d');
    const corkTexture = new G.CanvasTexture(corkFace);
    corkTexture.colorSpace = G.SRGBColorSpace;
    const corkStamp = new G.Mesh(
      new G.CircleGeometry(.144, 48),
      new G.MeshBasicMaterial({ map: corkTexture }),
    );
    corkStamp.rotation.x = -Math.PI / 2;
    corkStamp.position.y = 3.171;
    corkStamp.visible = false;
    bottle.add(corkStamp);
    let stamp = '';
    let focusHeight = 1.77;
    const capsule = mesh(new G.CylinderGeometry(.193, .182, .51, 64), {
      color: 0x742d43, metalness: .45, roughness: .31, clearcoat: .6,
    });
    capsule.position.y = 2.9;
    bottle.add(capsule);
    const rim = mesh(new G.TorusGeometry(.182, .009, 12, 64), { color: 0xb58d57, metalness: .5 });
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -.247;
    capsule.add(rim);

    function label(back) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f4e8cd';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#a98459';
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, 484, 484);
      ctx.fillStyle = '#63263b';
      ctx.textAlign = 'center';
      if (back) {
        const count = qr.getModuleCount();
        const cell = Math.floor(330 / (count + 8));
        const size = (count + 8) * cell;
        const x = Math.floor((512 - size) / 2);
        const y = 70;
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#111';
        for (let row = 0; row < count; row++)
          for (let column = 0; column < count; column++)
            if (qr.isDark(row, column)) ctx.fillRect(x + (column + 4) * cell, y + (row + 4) * cell, cell, cell);
      } else {
        ctx.font = '100px Georgia';
        ctx.fillText('Terruá', 256, 228);
        ctx.font = '28px Georgia';
        ctx.fillText('P A S S P O R T', 256, 282);
      }
      ctx.fillStyle = '#63263b';
      ctx.font = '35px Georgia';
      ctx.fillText('Nº ' + serial, 256, 446);
      const texture = new G.CanvasTexture(canvas);
      texture.colorSpace = G.SRGBColorSpace;
      const paper = new G.Mesh(
        new G.CylinderGeometry(.503, .503, .94, 48, 1, true, -.9, 1.8),
        new G.MeshBasicMaterial({ map: texture }),
      );
      paper.position.y = .96;
      paper.rotation.y = back ? Math.PI : 0;
      bottle.add(paper);
    }
    label(false);
    label(true);
    scene.add(new G.HemisphereLight(0xfff4e4, 0xb5af91, 2.2));
    for (const [x, y, z, strength] of [[-3, 4, 4, 3], [3, 3, -4, 4], [2, 1, 3, 1.5]]) {
      const light = new G.DirectionalLight(0xfff5dd, strength);
      light.position.set(x, y, z);
      scene.add(light);
    }
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    bottle.rotation.y = -.18;
    function resize() {
      renderer.setSize(stage.clientWidth, stage.clientHeight);
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
    }
    stage.append(renderer.domElement);
    resize();
    new ResizeObserver(resize).observe(stage);
    $('bottle-fallback').hidden = true;
    renderer.setAnimationLoop(() => {
      const target = stage.dataset.view === 'back' ? Math.PI : -.18;
      const removed = Object.hasOwn(stage.dataset, 'opened') || Object.hasOwn(stage.dataset, 'previewOpen');
      const inspect = removed && Object.hasOwn(stage.dataset, 'inspect');
      const code = Object.hasOwn(stage.dataset, 'previewOpen')
        ? 'DEMO-' + serial
        : $('code').textContent;
      const ease = reduceMotion.matches ? 1 : .1;
      bottle.rotation.y += (target - bottle.rotation.y) * ease;
      capsule.position.y += ((removed ? 3.49 : 2.9) - capsule.position.y) * ease;
      capsule.position.x += ((removed ? .65 : 0) - capsule.position.x) * ease;
      capsule.rotation.z += ((removed ? -.45 : 0) - capsule.rotation.z) * ease;
      if (code && code !== stamp) {
        corkInk.fillStyle = '#d5a875';
        corkInk.fillRect(0, 0, 256, 256);
        corkInk.fillStyle = '#3e2417';
        corkInk.font = 'bold 49px monospace';
        corkInk.textAlign = 'center';
        const groups = code.split('-');
        groups.forEach((group, i) => corkInk.fillText(group, 128, 144 + (i - (groups.length - 1) / 2) * 43));
        corkTexture.needsUpdate = true;
        stamp = code;
      }
      corkStamp.visible = removed && Boolean(stamp);
      camera.position.y += ((inspect ? 4.35 : 2.05) - camera.position.y) * ease;
      camera.position.z += ((inspect ? 1.92 : 7.3) - camera.position.z) * ease;
      focusHeight += ((inspect ? 3.22 : 1.77) - focusHeight) * ease;
      camera.lookAt(0, focusHeight, 0);
      renderer.render(scene, camera);
    });
  }

  async function request(action, data) {
    if (publicView) {
      if (action || !Number.isInteger(number) || number < 1 || number > 100) {
        throw Error('Elige una botella de la tirada, entre 0001 y 0100.');
      }
      const response = await fetch('/tirada-evidence.json');
      if (!response.ok) throw Error('No se pudo consultar el lote.');
      const config = await response.json();
      const [lot] = config.lots;
      const T = TerruaSoroban;
      const current = await T.read(config.contract, config.reader, 'get_bottle',
        T.bytes(T.fromHex(lot.id)), T.uint(number));
      const history = current.state[0] === 'Consumed'
        ? lot.transactions.find((entry) => entry.number === number && entry.label.startsWith('Consumo'))
        : null;
      const url = new URL('/tirada.html', location.origin);
      url.hash = [config.contract, lot.id, number].join('/');
      return { number, lot: lot.manifest.code, state: current.state[0], hash: history?.hash, interactive: false, url: url.href };
    }
    const response = await fetch(api + (action ? '/' + action : ''), action ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    } : { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'La consulta no está disponible.');
    return result;
  }

  let interactive = true;
  function setState(state, hash) {
    const consumed = state === 'Consumed';
    if (consumed) stage.dataset.opened = '';
    $('state').textContent = (consumed ? 'Consumida' : state === 'Withdrawn' ? 'Retirada' : 'Activa') + ' en Soroban Testnet';
    open.hidden = consumed || !interactive;
    replay.hidden = !consumed || !interactive;
    form.hidden = consumed || $('code-label').hidden;
    if (consumed && hash) {
      const link = $('transaction');
      link.href = 'https://stellar.expert/explorer/testnet/tx/' + encodeURIComponent(hash);
      link.hidden = false;
    }
  }

  replay.onclick = async () => {
    replay.disabled = true;
    try {
      // This control exists only on the consumed fixture. Its code is already public in Testnet.
      const { code } = await request('abrir', {});
      $('code').textContent = code;
      showSide('front');
      delete stage.dataset.opened;
      setTimeout(() => {
        stage.dataset.opened = '';
        stage.dataset.inspect = '';
        replay.disabled = false;
      }, 550);
    } catch (error) {
      status.textContent = error.message;
      replay.disabled = false;
    }
  };

  async function initialize() {
    try {
      const result = await request();
      if (result.preparing) {
        setTimeout(initialize, 2500);
        return;
      }
      const printed = String(result.number).padStart(4, '0');
      interactive = result.interactive !== false;
      $('lot-back').hidden = !(large || publicView);
      $('bottle').textContent = 'Botella ' + printed + ' · ' + result.lot;
      $('front').textContent = 'Frente · Botella ' + printed;
      $('back').textContent = 'Reverso · Botella ' + printed;
      const passportUrl = result.url || location.href;
      $('qr-link').href = passportUrl;
      if (publicView && params.get('galeria') === '1') $('qr-link').target = '_top';
      const qr = qrcode(0, 'M');
      qr.addData(passportUrl);
      qr.make();
      $('qr').innerHTML = qr.createImgTag(3, 12, 'QR de la botella ' + printed);
      $('bottle-qr').innerHTML = $('qr').innerHTML;
      $('bottle-serial').textContent = 'Nº ' + printed;
      $('passport').hidden = false;
      setState(result.state, result.hash);
      renderBottle(printed, qr).catch(() => {
        // Keep the local illustration available when WebGL or the CDN is unavailable.
      });
      status.textContent = '';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function initializeLot() {
    $('ensayo-title').textContent = 'Tirada digital de 100 botellas';
    status.textContent = 'Consultando la tirada en Soroban Testnet…';
    try {
      const response = await fetch('/api/lote', { cache: 'no-store' });
      const lot = await response.json();
      if (!response.ok) throw Error(lot.error);
      if (lot.preparing) {
        status.textContent = 'Registrando y verificando la tirada en Soroban Testnet…';
        setTimeout(initializeLot, 3500);
        return;
      }
      $('lot-heading').textContent = lot.lot;
      $('lot-count').textContent = lot.active + ' activas de ' + lot.registered + ' registradas en Soroban Testnet';
      if (lot.consumption) {
        const link = $('lot-consumption');
        link.href = 'https://stellar.expert/explorer/testnet/tx/' + encodeURIComponent(lot.consumption);
        link.hidden = false;
      }
      const links = $('lot-bottles');
      if (!links.childElementCount) {
        for (let n = 1; n <= lot.count; n++) {
          const link = document.createElement('a');
          link.href = '?botella=' + n;
          link.className = 'btn outline';
          link.textContent = String(n).padStart(4, '0');
          links.append(link);
        }
      }
      $('lot-panel').hidden = false;
      status.textContent = '';
      if (location.hash === '#catalogo-botellas') $('catalogo-botellas').scrollIntoView();
    } catch (error) {
      status.textContent = error.message;
    }
  }

  open.onclick = async () => {
    open.disabled = true;
    try {
      const result = await request('abrir', {});
      $('code').textContent = result.code;
      showSide('front');
      stage.dataset.opened = '';
      stage.dataset.inspect = '';
      $('code-label').hidden = false;
      form.hidden = false;
      input.focus();
      status.textContent = 'Apertura simulada. Ingresa el código que apareció bajo la cápsula.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      open.disabled = false;
    }
  };

  input.oninput = () => {
    checked = '';
    consume.disabled = true;
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const entered = input.value;
    checked = '';
    consume.disabled = true;
    try {
      await request('comprobar', { code: entered });
      if (input.value !== entered) return;
      checked = entered;
      consume.disabled = false;
      status.textContent = 'El código coincide con el registro de esta botella.';
    } catch (error) {
      status.textContent = error.message;
    }
  };
  consume.onclick = async () => {
    if (!checked || input.value !== checked) return;
    consume.disabled = true;
    input.disabled = true;
    status.textContent = 'Firmando con la cuenta de ensayo y esperando confirmación de Testnet…';
    try {
      const result = await request('consumir', { code: checked });
      checked = '';
      input.value = '';
      setState(result.state, result.hash);
      status.textContent = 'Consumo confirmado en Stellar Testnet.';
    } catch (error) {
      status.textContent = error.message;
      input.disabled = false;
      try {
        const current = await request();
        if (current.state === 'Consumed') {
          setState(current.state, current.hash);
          status.textContent = 'Consumo confirmado en Soroban Testnet.';
          return;
        }
      } catch {
        // The original warning stays visible if the ledger cannot be queried.
      }
      consume.disabled = !checked;
    }
  };
  $('refresh-lot').onclick = initializeLot;
  $('lot-search').onsubmit = (event) => {
    event.preventDefault();
    location.search = 'botella=' + encodeURIComponent(event.currentTarget.elements.number.value);
  };
  if (large && selection === null) initializeLot();
  else initialize();
})();
