'use strict';
(() => {
  const app = document.querySelector('#app'),
    { fields, examples, metadata, validate } = TerruaModel,
    chain = TerruaChain;
  const storeKey = 'terrua.passport.cellar.v1',
    nf = new Intl.NumberFormat('es-CL');
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  const svg = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    stamp:
      '<path d="M8 14h8l-1-3c-.4-1.2 1.2-2.4 1.2-4a4.2 4.2 0 0 0-8.4 0c0 1.6 1.6 2.8 1.2 4l-1 3ZM5 15h14l1 5H4l1-5Z"/>',
    book: '<path d="M4 5a3 3 0 0 1 3-2h12v17H7a3 3 0 0 1-3-3V5Zm0 12a3 3 0 0 1 3-3h12M8 6h7"/>',
    bottle:
      '<path d="M10 2h4m-3 0v6c0 2-3 3.4-3 6v6c0 1 1 2 2 2h4c1 0 2-1 2-2v-6c0-2.6-3-4-3-6V2M8 14h8M8 18h8"/>',
    seal: '<path d="m12 2 2.6 2 3.3.4 1.1 3.2 2 2.5-1.4 3 .1 3.2-3 1.7-1.8 2.7-3-1.1-3 1.1L7 18l-3-1.7.1-3.2-1.4-3 2-2.5 1.1-3.2L9.4 4 12 2Z"/><path d="m8.4 11.6 2.3 2.3 4.8-5"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.3"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    sliders:
      '<path d="M4 7h5m4 0h7M4 17h9m4 0h3"/><circle cx="11" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    wine: '<path d="M8 3h8l1 6a5 5 0 0 1-10 0l1-6ZM7.5 8h9M12 14v6m-4 1h8"/>',
    back: '<path d="m14.5 5-7 7 7 7"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    file: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>',
    print: '<path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/>',
    link: '<path d="m10 14 4-4m-5 2-2 2a3.5 3.5 0 0 0 5 5l3-3m0-4 2-2a3.5 3.5 0 0 0-5-5L9 8"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
    trash: '<path d="M4 6h16M8 6V3h8v3M6 6l1 15h10l1-15M10 10v6m4-6v6"/>',
    leaf: '<path d="M5 18C0 8 12 3 21 3c0 10-6 19-16 15Zm0 0L16 8"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',
    folder: '<path d="M3 6h7l2 2h9v12H3z"/>',
  };
  const icon = (k) =>
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    (svg[k] || '') +
    '</svg>';
  const action = (label, cmd, klass = 'btn outline', sym = '') =>
    '<button type="button" class="' +
    klass +
    '" data-act="' +
    cmd +
    '">' +
    (sym ? icon(sym) : '') +
    label +
    '</button>';
  const link = (label, href, klass, sym = '') =>
    '<a href="' +
    esc(href) +
    '" class="' +
    klass +
    '">' +
    (sym ? icon(sym) : '') +
    label +
    '</a>';
  function readRows() {
    try {
      return JSON.parse(localStorage.getItem(storeKey) || '[]').filter(
        (r) => r && typeof r.id === 'string' && r.data,
      );
    } catch {
      return [];
    }
  }
  let rows = readRows(),
    base = structuredClone(examples),
    current = null,
    stage = 0,
    query = '',
    filter = 'all',
    pendingFile = false,
    busy = false,
    nonce = 0;
  const refresh = () => {
    rows = readRows();
  };
  const all = () => [...rows, ...base];
  const find = (id) => all().find((r) => r.id === id);
  function save(r, completing = false) {
    refresh();
    const old = rows.findIndex((x) => x.id === r.id);
    if (
      old >= 0 &&
      !completing &&
      ((rows[old].receipt && !r.receipt) ||
        (rows[old].pending?.mode === TerruaSerial.mode &&
          rows[old].pending.hash !== r.pending?.hash))
    )
      throw Error(
        'Hay una emisión registrada en otra pestaña. Vuelve a abrir el lote.',
      );
    if (old < 0) rows.unshift(r);
    else rows[old] = r;
    try {
      localStorage.setItem(storeKey, JSON.stringify(rows));
    } catch {
      throw Error(
        'El navegador no pudo guardar el borrador. Libera espacio o habilita el almacenamiento local.',
      );
    }
  }
  function toast(msg) {
    const t = document.querySelector('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.hidden = true), 4500);
  }
  function alertAt(msg, kind = 'error') {
    const n = document.querySelector('#feedback');
    if (n) {
      n.className = 'notice ' + kind;
      n.textContent = msg;
      n.hidden = false;
      n.scrollIntoView({ block: 'nearest' });
    } else toast(msg);
  }
  const strip = (v) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const date = (v) =>
    v
      ? new Intl.DateTimeFormat('es-CL', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: v.length === 10 ? 'UTC' : 'America/Santiago',
        }).format(new Date(v.length === 10 ? v + 'T12:00:00Z' : v))
      : '';
  const badge = (r) =>
    r.receipt
      ? '<span class="status ok">' +
        (r.receipt.mode === TerruaSerial.mode
          ? 'Serie numerada'
          : 'Emitido en Testnet') +
        '</span>'
      : r.example
        ? '<span class="status">Ficha de ejemplo</span>'
        : '<span class="status draft">' +
          (r.pending ? 'Emisión pendiente' : 'Borrador') +
          '</span>';
  const art = (r) =>
    ['boldos', 'piedra', 'bruma'].includes(r.art)
      ? r.art
      : { Tinto: 'cellar', Blanco: 'harvest', Rosado: 'valley' }[r.data.type] ||
        'valley';
  const newData = () => ({ country: 'Chile', volume: 750, extras: [], bottleMode: TerruaSerial.mode, firstSerial: 1 });
  const draftTitle = (r) => r.data.name || 'Vino sin nombre';
  function cards() {
    const root = document.querySelector('#cards');
    if (!root) return;
    const list = all().filter(
      (r) =>
        (filter === 'all' ||
          (filter === 'issued' && r.receipt) ||
          (filter === 'draft' && !r.receipt && !r.example) ||
          (filter === 'sample' && r.example)) &&
        strip(
          [
            r.data.name,
            r.data.winery,
            r.data.origin,
            r.data.variety,
            r.data.lot,
          ].join(' '),
        ).includes(strip(query)),
    );
    root.innerHTML = list.length
      ? list
          .map((r) => {
            const d = r.data;
            return (
              '<a class="card" href="#pasaporte/' +
              encodeURIComponent(r.id) +
              '"><div class="card-art"><img src="assets/' +
              art(r) +
              '.webp" alt=""><span class="tag">' +
              icon('wine') +
              esc(d.type || 'Vino') +
              '</span></div><div class="card-body"><div class="kicker">' +
              esc(d.variety || 'Cepa pendiente') +
              ' · ' +
              esc(d.vintage || 'Sin añada') +
              '</div><h3>' +
              esc(draftTitle(r)) +
              '</h3><p>' +
              icon('pin') +
              esc(d.origin || 'Origen pendiente') +
              '</p></div><div class="card-foot">' +
              badge(r) +
              '<span class="card-link">' +
              icon('book') +
              'Ver ficha</span></div></a>'
            );
          })
          .join('')
      : '<div class="empty"><p>No se encontraron vinos con estos filtros.</p>' +
        action('Limpiar filtros', 'reset') +
        '</div>';
  }
  function catalogue(isHome) {
    const data = all();
    const stats = [
      ['book', '', data.length, 'Lotes en el registro'],
      [
        'bottle',
        'gold',
        data.reduce((n, r) => n + (Number(r.data.bottles) || 0), 0),
        'Botellas declaradas',
      ],
      [
        'seal',
        'olive',
        data.filter((r) => r.receipt).length,
        'Emisiones en Testnet',
      ],
    ];
    const hero =
      '<section class="hero"><div><div class="eyebrow">Panel del productor</div><h1>Cuaderno <em>de bodega</em></h1><p>Registra tus vinos y convierte cada lote en un pasaporte digital verificable en Stellar.</p><div class="actions">' +
      action('Registrar vino', 'new', 'btn light', 'plus') +
      link('Verificar pasaporte', '#verificar', 'btn ghost-light', 'stamp') +
      '</div></div></section>';
    const header =
      '<div class="page-head"><div class="eyebrow">Catálogo de lotes</div><div class="passport-heading"><h1>Mis pasaportes</h1>' +
      action('Registrar vino', 'new', 'btn primary', 'plus') +
      '</div></div>';
    app.innerHTML =
      (isHome
        ? hero +
          '<section class="stats" aria-label="Resumen del registro">' +
          stats
            .map(
              ([ic, co, n, l]) =>
                '<div class="stat"><div class="icon-box ' +
                co +
                '">' +
                icon(ic) +
                '</div><div><strong>' +
                nf.format(n) +
                '</strong><small>' +
                l +
                '</small></div></div>',
            )
            .join('') +
          '</section>'
        : header) +
      '<section class="section"><div class="section-head"><div>' +
      (isHome
        ? '<h2>Pasaportes de vino</h2><p>Consulta los lotes y sus fichas de trazabilidad.</p>'
        : '<p>' + nf.format(data.length) + ' lotes en el registro</p>') +
      '</div><div class="tools"><label class="search">' +
      icon('search') +
      '<input aria-label="Buscar vino, cepa, valle o lote" id="search" type="search" placeholder="Buscar un vino…" value="' +
      esc(query) +
      '"></label><label class="selectwrap">' +
      icon('sliders') +
      '<select id="filter" aria-label="Filtrar por estado">' +
      [
        ['all', 'Todos los estados'],
        ['issued', 'Emitidos'],
        ['draft', 'Borradores'],
        ['sample', 'Ejemplos'],
      ]
        .map(
          ([v, t]) =>
            '<option ' +
            (v === filter ? 'selected' : '') +
            ' value="' +
            v +
            '">' +
            t +
            '</option>',
        )
        .join('') +
      '</select></label></div></div><div id="cards" class="grid"></div></section>';
    cards();
  }
  const back = () => link('Cuaderno de bodega', '#inicio', 'back', 'back');
  const feedback =
    '<div id="feedback" hidden role="status" aria-live="polite"></div>';
  function field(f) {
    const [k, label, type, req, op, min, max, step] = f,
      v = current.data[k] ?? '';
    const common =
      ' name="' + k + '" id="fld-' + k + '" ' + (req ? 'required ' : '') + ' ';
    const spec =
      '<span>' +
      esc(label) +
      (req ? ' <small aria-label="obligatorio">*</small>' : '') +
      '</span>';
    if (type === 'select')
      return (
        '<label class="field select">' +
        spec +
        '<select ' +
        common +
        '><option value="">Selecciona…</option>' +
        op
          .map(
            (o) =>
              '<option ' +
              (o === v ? 'selected' : '') +
              '>' +
              esc(o) +
              '</option>',
          )
          .join('') +
        '</select></label>'
      );
    if (type === 'textarea')
      return (
        '<label class="field wide">' +
        spec +
        '<textarea ' +
        common +
        ' maxlength="' +
        min +
        '" placeholder="' +
        esc(op) +
        '">' +
        esc(v) +
        '</textarea></label>'
      );
    const inputType = type === 'list' ? 'text' : type;
    return (
      '<label class="field">' +
      spec +
      '<input ' +
      common +
      'type="' +
      inputType +
      '" value="' +
      esc(v) +
      '" ' +
      (typeof op === 'string' ? 'placeholder="' + esc(op) + '" ' : '') +
      (type === 'number'
        ? 'min="' + min + '" max="' + max + '" step="' + step + '" '
        : type === 'list'
          ? 'list="list-' + k + '" maxlength="100" '
          : typeof min === 'number'
            ? 'maxlength="' + min + '" '
            : '') +
      '>' +
      (type === 'list'
        ? '<datalist id="list-' +
          k +
          '">' +
          op.map((o) => '<option value="' + esc(o) + '">').join('') +
          '</datalist>'
        : '') +
      '</label>'
    );
  }
  function extras() {
    return (
      '<details class="subgroup" ' +
      (current.data.extras?.length ? 'open' : '') +
      '><summary>Campos personalizados</summary><div id="extras">' +
      (current.data.extras || [])
        .map(
          (e, i) =>
            '<div class="extra-row"><label class="field">Nombre<input data-extra="' +
            i +
            '" data-side="key" maxlength="40" value="' +
            esc(e.key) +
            '" placeholder="Ej. Altitud"></label><label class="field">Valor<input data-extra="' +
            i +
            '" data-side="value" maxlength="120" value="' +
            esc(e.value) +
            '" placeholder="Ej. 380 m s. n. m."></label>' +
            action('Quitar', 'del-extra-' + i, 'textbtn') +
            '</div>',
        )
        .join('') +
      '</div>' +
      ((current.data.extras || []).length < 6
        ? action('Agregar campo', 'add-extra', 'textbtn', 'plus')
        : '') +
      '</details>'
    );
  }
  function evidence() {
    const e = current.data.evidence;
    return (
      '<details class="subgroup" ' +
      (e ? 'open' : '') +
      '><summary>Huella de un documento de respaldo</summary><p class="helptext">Selecciona un archivo de hasta 10 MB. Se registran su nombre y huella SHA-256. El archivo permanece en tu dispositivo.</p>' +
      (e
        ? '<p class="file-detail">' +
          esc(e.name) +
          ' · ' +
          esc(e.hash) +
          '</p>' +
          action('Quitar documento', 'del-file', 'textbtn')
        : '<label class="field">Documento de respaldo<input type="file" id="evidence-file"></label>') +
      '</details>'
    );
  }
  function inventorySummary(d) {
    let balance;
    try {
      balance = TerruaModel.inventory(d);
    } catch (error) {
      return '<p class="line-error">' + esc(error.message) + '</p>';
    }
    if (!balance) return '';
    const figures = [
      ['Embotelladas', balance.count],
      ['Disponibles', balance.available],
      ['Muestras', balance.samples],
      ['Bajas', balance.withdrawn],
    ];
    const loss = balance.loss === null ? '' : '<p class="helptext">Diferencia entre producción teórica y real: ' +
      nf.format(balance.loss) + ' botellas equivalentes.</p>';
    return '<dl class="line-figures">' + figures.map(([label, value]) =>
      '<div><dt>' + label + '</dt><dd>' + nf.format(value) + '</dd></div>').join('') + '</dl>' + loss;
  }
  function inventoryFields(d) {
    return '<label class="ack"><input id="line-check" type="checkbox" ' +
      (d.lineCheck === true ? 'checked' : '') + '><span>Registrar el control de embotellado</span></label>' +
      (d.lineCheck === true
        ? '<p class="helptext">Indica las muestras y bajas al embotellar. Todas las botellas numeradas reciben pasaporte. Deja las listas vacías si toda la tirada está disponible.</p><div class="fields">' +
          field(['samples', 'Números de muestras testigo', 'text', false, 'Ej. 0001–0002, 0401', 300]) +
          field(['withdrawn', 'Números dados de baja', 'text', false, 'Ej. 0117, 0230–0232', 300]) +
          field(['theoretical', 'Producción teórica (botellas)', 'number', false, 'Opcional', 1, 9007199254740991, 1]) +
          '</div><div id="line-summary" aria-live="polite">' + inventorySummary(d) + '</div>'
        : '');
  }
  function atTable(d) {
    const entries = [];
    if (d.serviceTemp != null && d.serviceTemp !== '')
      entries.push(['Servicio', nf.format(d.serviceTemp) + ' °C']);
    if (d.decant != null && d.decant !== '')
      entries.push(['Decantación', Number(d.decant) === 0 ? 'Servir al abrir' : nf.format(d.decant) + ' min']);
    if (d.pairing) entries.push(['Maridaje', d.pairing]);
    if (!entries.length && !d.notes) return '';
    return '<section class="tasting-panel"><div class="tasting-title">' + icon('wine') +
      '<h3>Cómo disfrutar este vino</h3></div>' +
      (d.notes ? '<p>' + esc(d.notes) + '</p>' : '') +
      (entries.length ? '<dl>' + entries.map(([label, value]) =>
        '<div><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>').join('') + '</dl>' : '') +
      '<small>Ficha sensorial de ' + esc(d.winery || 'la bodega') + '</small></section>';
  }
  function inventoryPanel(d, number) {
    let balance;
    try { balance = TerruaModel.inventory(d); }
    catch (error) {
      return '<section class="cert-section"><h3>Control de embotellado pendiente</h3><p>' + esc(error.message) + '</p></section>';
    }
    if (!balance) return '';
    const status = number == null ? '' : '<p class="bottle-state">Botella ' +
      TerruaSerial.label(number) + ' · <strong>' +
      (balance.states.get(number) || 'Disponible') + '</strong></p>';
    return '<section class="cert-section"><h3>Control al embotellar</h3>' +
      status + inventorySummary(d) +
      '<p class="helptext">Cantidades y estado físico declarados por la bodega al cerrar la tirada.</p></section>';
  }
  function numbering(d) {
    const selected = d.bottleMode === TerruaSerial.mode;
    return (
      '<section class="subgroup"><label class="field select">Forma de emisión<select id="bottle-mode"><option value="lot">Un activo por lote</option><option value="bottles-v1" ' +
      (selected ? 'selected' : '') +
      '>Un token único por botella numerada</option></select></label>' +
      (selected
        ? '<div class="fields"><label class="field">Número de la primera botella<input name="firstSerial" type="number" required step="1" min="1" max="99999999" value="' +
          esc(d.firstSerial ?? 1) +
          '"></label><label class="field">Cuenta Stellar receptora (opcional)<input name="bottleOwner" maxlength="56" placeholder="G…" value="' +
          esc(d.bottleOwner || '') +
          '"></label></div><p class="helptext">Hasta 4.800 botellas consecutivas por serie. Cada botella recibe su propio activo y enlace QR. Usa tu cuenta pública para poder reclamar los tokens. Sin dirección, se asignan a una cuenta de demostración sin acceso a las claves.</p>' + inventoryFields(d)
        : '') +
      '</section>'
    );
  }
  function bottlePanel(r, t) {
    const m = r.data,
      p = r.receipt;
    if (!p || p.mode !== TerruaSerial.mode) return '';
    const start = m.firstSerial,
      end = start + m.bottles - 1;
    const selected = t
      ? '<div class="issue-info"><strong>Botella Nº ' +
        TerruaSerial.label(t.number) +
        ' · ' +
        esc(m.lot) +
        '</strong><p>Emisión individual verificada en Stellar Testnet.</p></div>' +
        proofLine('Activo individual', t.asset) +
        proofLine('Emisor', p.issuer) +
        proofLine('ID de saldo reclamable al emitir', t.balanceId) +
        '<a class="proof-link" target="_blank" rel="noopener" href="' +
        chain.HORIZON +
        '/transactions/' +
        t.hash +
        '">Ver emisión de esta botella</a><div class="qr-box">' +
        qr(bottleUrl(r, t.number)) +
        '<p>QR individual · Nº ' +
        TerruaSerial.label(t.number) +
        '</p></div>'
      : '';
    return (
      '<section class="cert-section"><h3>Botellas numeradas</h3><p>Tirada del ' +
      TerruaSerial.label(start) +
      ' al ' +
      TerruaSerial.label(end) +
      '. Cada número corresponde a un activo distinto.</p>' +
      selected +
      '<form id="bottle-find" class="subgroup no-print"><label class="field">Número de botella<input id="bottle-number" type="number" step="1" min="' +
      start +
      '" max="' +
      end +
      '" value="' +
      (t?.number ?? start) +
      '" required></label><div class="actions"><button type="submit" class="btn primary">Verificar botella</button>' +
      action(
        'Descargar numeración CSV',
        'serial-csv',
        'btn outline',
        'download',
      ) +
      '</div></form></section>'
    );
  }
  function bottleUrl(r, n) {
    return (
      location.origin +
      location.pathname +
      '#botella/' +
      r.receipt.hash +
      '/' +
      n +
      (r.review?.hash ? '/' + r.review.hash : '')
    );
  }
  function downloadFile(name, data, type) {
    const url = URL.createObjectURL(new Blob([data], { type })),
      a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  function wizard() {
    const d = current.data;
    const steps = [...fields.map((g) => g.short), 'Emisión'];
    const tracker =
      '<div class="steps" aria-label="Pasos del registro">' +
      steps
        .map(
          (x, i) =>
            '<button type="button" data-act="step-' +
            i +
            '" class="step ' +
            (stage === i ? 'active' : stage > i ? 'done' : '') +
            '" ' +
            (i > stage ? 'disabled' : '') +
            ' ' +
            (i === stage ? 'aria-current="step"' : '') +
            '><span>' +
            (i < stage ? '✓' : i + 1) +
            '</span>' +
            x +
            '</button>',
        )
        .join('') +
      '</div>';
    let inner;
    if (stage < 3) {
      const g = fields[stage];
      const primary = g.fields.filter((f) => f[3]),
        optional = g.fields.filter((f) => !f[3] && !TerruaModel.tastingKeys.has(f[0]));
      inner =
        '<h2>' +
        g.title +
        '</h2><p class="intro">Los campos con * son obligatorios. El borrador se guarda en este navegador.</p><div class="fields">' +
        primary.map(field).join('') +
        '</div><details class="subgroup" ' +
        (optional.some(
          (f) => d[f[0]] !== undefined && d[f[0]] !== '' && f[0] !== 'country',
        )
          ? 'open'
          : '') +
        '><summary>' +
        [
          'Más datos de origen',
          'Añadir detalles de elaboración',
          'Añadir análisis y certificación externa',
        ][stage] +
        '</summary><div class="fields">' +
        optional.map(field).join('') +
        '</div></details>' +
        (stage === 1
          ? '<details class="subgroup" ' +
            ([...TerruaModel.tastingKeys].some((key) => d[key] != null && d[key] !== '') ? 'open' : '') +
            '><summary>Cata y servicio en mesa</summary><div class="fields">' +
            g.fields.filter((f) => TerruaModel.tastingKeys.has(f[0])).map(field).join('') +
            '</div></details>' + numbering(d)
          : '') +
        (stage === 2 ? evidence() + extras() : '');
    } else {
      inner =
        '<h2>Revisar y emitir</h2><p class="intro">Comprueba la ficha antes de firmar el registro de prueba.</p>' +
        sections(d) + inventoryPanel(d) +
        '<div class="issue-info"><b>' +
        nf.format(d.bottles) +
        (d.bottleMode === TerruaSerial.mode
          ? ' activos únicos · botellas ' +
            TerruaSerial.label(Number(d.firstSerial)) +
            ' a ' +
            TerruaSerial.label(Number(d.firstSerial) + Number(d.bottles) - 1) +
            '</b><br>Se reserva la numeración y se comprueba cada emisión antes de sellar la serie. ' +
            (d.bottleOwner
              ? 'Cuenta receptora: ' + esc(d.bottleOwner)
              : 'Receptor de demostración sin custodia disponible.')
          : ' tokens · 1 unidad por botella declarada.</b><br>Se crearán cuentas de demostración para este lote. La emisión fija la cantidad y publica los metadatos en Stellar Testnet. Los tokens de la demo quedan en una cuenta de distribución de prueba.') +
        '</div>' +
        (current.pending?.mode === TerruaSerial.mode
          ? action(
              'Descargar respaldo de emisión',
              'serial-backup',
              'btn outline',
              'download',
            )
          : '') +
        '<label class="ack"><input id="approve" type="checkbox" ' +
        (current.pending ? 'checked disabled' : '') +
        '><span>Revisé la ficha y autorizo publicar estos datos en la red de pruebas.</span></label>';
    }
    app.innerHTML =
      '<div class="page-head">' +
      back() +
      '<h1>Registrar vino</h1></div><div class="form-layout"><form class="form-shell" id="wine-form" novalidate>' +
      tracker +
      inner +
      feedback +
      '<div class="form-foot">' +
      (stage > 0 && !current.pending
        ? action('Anterior', 'prev', 'btn outline', 'back')
        : link('Volver al panel', '#inicio', 'textbtn')) +
      '<div class="actions">' +
      action('Guardar y salir', 'save-exit', 'textbtn') +
      (stage < 3
        ? '<button class="btn primary" type="submit">Continuar</button>'
        : '<button class="btn primary" type="submit">' +
          icon('seal') +
          (current.pending ? 'Comprobar emisión' : 'Emitir en Testnet') +
          '</button>') +
      '</div></div></form><aside class="side"><div class="eyebrow">Vista del lote</div><h3>' +
      esc(d.name || 'Nuevo pasaporte') +
      '</h3><p>' +
      esc(d.winery || 'Bodega por definir') +
      '</p><ul class="side-list"><li>' +
      icon('pin') +
      esc(d.origin || 'Origen por completar') +
      '</li><li>' +
      icon('wine') +
      esc(
        [d.variety, d.vintage].filter(Boolean).join(' · ') ||
          'Cepa y añada por completar',
      ) +
      '</li><li>' +
      icon('bottle') +
      (d.bottles
        ? nf.format(d.bottles) + ' botellas'
        : 'Cantidad por completar') +
      '</li></ul></aside></div>';
  }
  function sections(d, omitTasting = false) {
    const values = (f) => {
      const [k, , type] = f,
        v = d[k];
      return type === 'date'
        ? date(v)
        : type === 'number' && v !== ''
          ? ['vintage', 'volume'].includes(k)
            ? String(v)
            : nf.format(v)
          : v;
    };
    return (
      fields
        .map((g) => {
          const list = g.fields.filter(
            (f) => !(omitTasting && TerruaModel.tastingKeys.has(f[0])) &&
              d[f[0]] !== undefined && String(d[f[0]]).trim() !== '',
          );
          if (!list.length) return '';
          return (
            '<section class="cert-section"><h3>' +
            g.title +
            '</h3><dl class="kv">' +
            list
              .map(
                (f) =>
                  '<div class="' +
                  (f[2] === 'textarea' ? 'wide' : '') +
                  '"><dt>' +
                  esc(f[1]) +
                  '</dt><dd>' +
                  esc(values(f)) +
                  '</dd></div>',
              )
              .join('') +
            '</dl></section>'
          );
        })
        .join('') +
      (d.extras?.length || d.evidence
        ? '<section class="cert-section"><h3>Datos adicionales y respaldo</h3><dl class="kv">' +
          (d.extras || [])
            .map(
              (e) =>
                '<div><dt>' +
                esc(e.key) +
                '</dt><dd>' +
                esc(e.value) +
                '</dd></div>',
            )
            .join('') +
          (d.evidence
            ? '<div class="wide"><dt>Documento · SHA-256</dt><dd>' +
              esc(d.evidence.name) +
              '</dd><dd class="proof-code">' +
              esc(d.evidence.hash) +
              '</dd></div>'
            : '') +
          '</dl></section>'
        : '')
    );
  }
  function newDraft(data) {
    const r = { id: crypto.randomUUID(), data: data || newData(), step: 0 };
    save(r);
    location.hash = 'editar/' + r.id;
  }
  function setStep(n) {
    if (busy || current.pending) return;
    stage = n;
    current.step = n;
    save(current);
    wizard();
    window.scrollTo(0, 0);
  }
  function checkForm(n) {
    const form = document.querySelector('#wine-form');
    const error = validate(current.data, n);
    const bad = form?.querySelector(
      'input:invalid, select:invalid, textarea:invalid',
    );
    if (bad) {
      const details = bad.closest('details');
      if (details) details.open = true;
      bad.focus();
      bad.reportValidity();
      return false;
    }
    if (error) {
      alertAt(error);
      return false;
    }
    return true;
  }
  function pickHash(value) {
    const t = String(value || '').trim();
    if (/^[a-f\d]{64}$/i.test(t)) return t.toLowerCase();
    try {
      const u = new URL(t);
      const tail =
        u.hash.match(/^#verificar\/([a-f\d]{64})$/i) ||
        u.pathname.match(/\/(?:transactions?|tx)\/([a-f\d]{64})\/?$/i);
      return tail ? tail[1].toLowerCase() : '';
    } catch {
      return '';
    }
  }
  function ref(value) {
    try {
      const u = new URL(String(value).trim());
      const m = u.hash.match(
        /^#verificar\/([a-f0-9]{64})(?:\/([a-f0-9]{64}))?$/i,
      );
      if (m) return [m[1].toLowerCase(), m[2]?.toLowerCase() || ''];
    } catch {}
    return [pickHash(value), ''];
  }
  const shareUrl = (hash, review) =>
    location.origin +
    location.pathname +
    '#verificar/' +
    hash +
    (review ? '/' + review : '');
  const localReviewKey = (hash) => 'terrua.review.' + hash;
  function storedReview(hash) {
    try {
      return JSON.parse(localStorage.getItem(localReviewKey(hash)) || 'null');
    } catch {
      return null;
    }
  }
  function reviewPanel(r) {
    const rev = r.review,
      p = r.receipt;
    if (!p) return '';
    const content = rev
      ? '<h3>Revisión firmada</h3><dl class="kv"><div><dt>Entidad declarada</dt><dd>' +
        esc(rev.data.org) +
        '</dd></div><div><dt>Alcance revisado</dt><dd>' +
        esc(rev.data.scope) +
        '</dd></div><div><dt>Folio</dt><dd>' +
        esc(rev.data.folio) +
        '</dd></div><div><dt>Fecha</dt><dd>' +
        date(rev.at) +
        '</dd></div></dl>' +
        proofLine('Cuenta firmante', rev.signer) +
        '<a class="proof-link" rel="noopener" target="_blank" href="' +
        chain.HORIZON +
        '/transactions/' +
        rev.hash +
        '">Ver transacción de revisión</a>'
      : '<h3>Revisión independiente</h3><p class="helptext">Puedes añadir una declaración firmada por la cuenta Stellar de un revisor.</p>';
    return (
      '<section class="cert-section">' +
      content +
      '<p class="helptext">La firma identifica la cuenta que suscribe la revisión. La entidad y su acreditación se comprueban por separado.</p><details class="subgroup no-print"><summary>' +
      (rev ? 'Añadir otra revisión' : 'Firmar una revisión') +
      '</summary><form id="review-form"><div class="fields"><label class="field">Entidad revisora<input name="org" required maxlength="100" placeholder="Laboratorio o certificadora"></label><label class="field">Folio de revisión<input name="folio" required maxlength="90" placeholder="Ej. LAB-001"></label><label class="field select wide">Alcance<select name="scope">' +
      TerruaReview.passKinds
        .map((k) => '<option>' + esc(k) + '</option>')
        .join('') +
      '</select></label></div><p class="issue-info">La cuenta del revisor firma y publica esta declaración en Stellar Testnet. El enlace del pasaporte incluirá esta revisión.</p><button class="btn primary" type="submit">' +
      icon('seal') +
      'Firmar con Freighter</button><div id="review-feedback" role="status" aria-live="polite"></div></form></details></section>'
    );
  }
  async function signReview(form) {
    const r = current,
      box = document.querySelector('#review-feedback'),
      btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const f = new FormData(form);
      const data = {
        schema: 'terrua.review.v1',
        batch: r.receipt.hash,
        org: String(f.get('org')).trim(),
        folio: String(f.get('folio')).trim(),
        scope: String(f.get('scope')),
      };
      const pendingKey = localReviewKey(r.receipt.hash) + '.pending';
      let p = JSON.parse(localStorage.getItem(pendingKey) || 'null'),
        v;
      if (p) {
        try {
          v = await TerruaReview.verify(p.hash, r.receipt);
        } catch (e) {
          if (e.status !== 404) throw e;
          if (Date.now() >= p.expires) {
            localStorage.removeItem(pendingKey);
            p = null;
          }
        }
      }
      if (!v && !p) {
        box.textContent = 'Esperando la firma en la billetera…';
        p = await TerruaReview.sign(data, r.receipt);
        localStorage.setItem(pendingKey, JSON.stringify(p));
      }
      if (!v) {
        box.textContent = 'Publicando la revisión en Testnet…';
        await chain.submit(p);
        v = await TerruaReview.verify(p.hash, r.receipt);
      }
      localStorage.setItem(localReviewKey(r.receipt.hash), JSON.stringify(v));
      localStorage.removeItem(pendingKey);
      toast('Revisión firmada y confirmada en Stellar Testnet.');
      location.hash = 'verificar/' + r.receipt.hash + '/' + v.hash;
    } catch (e) {
      box.className = 'notice error';
      box.textContent = e.message;
    } finally {
      btn.disabled = false;
    }
  }
  function qr(url) {
    try {
      const q = qrcode(0, 'M');
      q.addData(url);
      q.make();
      return q.createImgTag(3, 8, 'QR para verificar el pasaporte en Stellar');
    } catch {
      return '';
    }
  }
  const proofLine = (label, v) =>
    '<div class="proof-line"><b>' +
    label +
    '</b><div class="proof-code">' +
    esc(v) +
    '</div></div>';
  function passport(r, live = false, token = null, sampleNumber = null) {
    if (r.receipt && !live)
      r = { ...r, review: storedReview(r.receipt.hash) || r.review };
    current = { ...r, token };
    const d = r.data,
      p = r.receipt;
    const number = token?.number ?? sampleNumber;
    const proof = p
      ? '<h3>Prueba de emisión</h3><p>' +
        (live
          ? 'Transacción verificada ahora en Stellar Testnet.'
          : 'Emisión registrada en Stellar Testnet.') +
        '</p>' +
        proofLine(
          p.mode === TerruaSerial.mode
            ? 'Referencia de la serie'
            : 'Token del lote',
          p.code,
        ) +
        proofLine('Cantidad emitida', nf.format(d.bottles)) +
        proofLine('Emisor', p.issuer) +
        (p.mode === TerruaSerial.mode
          ? proofLine('Cuenta receptora de las botellas', p.distribution)
          : '') +
        proofLine('Hash de transacción', p.hash) +
        proofLine('Huella de la ficha · SHA-256', p.fingerprint) +
        proofLine('Bloque y fecha', nf.format(p.ledger) + ' · ' + date(p.at)) +
        '<a class="proof-link" href="' +
        chain.HORIZON +
        '/transactions/' +
        p.hash +
        '" target="_blank" rel="noopener">Ver transacción en Horizon</a><div class="qr-box">' +
        qr(
          token ? bottleUrl(r, token.number) : shareUrl(p.hash, r.review?.hash),
        ) +
        '<p>Escanea para verificar esta ficha.</p></div><div class="actions no-print">' +
        action('Copiar enlace', 'copy', 'btn outline', 'link') +
        action('Descargar JSON', 'export', 'btn outline', 'download') +
        '</div>'
      : '<div class="icon-box">' +
        icon('file') +
        '</div><h3>' +
        (r.example ? 'Ficha ilustrativa' : 'Borrador local') +
        '</h3><p>' +
        (r.example
          ? 'Este ejemplo permite explorar los datos que puede declarar una bodega.'
          : 'Puedes completar y revisar la ficha antes de emitir sus tokens.') +
        '</p>';
    app.innerHTML =
      '<div class="page-head">' +
      back() +
      '<div class="passport-heading"><h1>' +
      (number != null
        ? 'Botella Nº ' + TerruaSerial.label(number)
        : 'Pasaporte del lote') +
      '</h1><div class="actions">' +
      (p
        ? (live
            ? action('Volver a verificar', 'recheck', 'btn primary', 'seal')
            : link(
                'Verificar en Stellar',
                '#verificar/' + p.hash + (r.review ? '/' + r.review.hash : ''),
                'btn primary',
                'seal',
              )) + action('Imprimir / PDF', 'print', 'btn outline', 'print')
        : r.example
          ? action('Usar como plantilla', 'clone', 'btn primary', 'plus')
          : link(
              'Continuar registro',
              '#editar/' + r.id,
              'btn primary',
              'file',
            )) +
      '</div></div></div><div class="passport-layout"><article class="cert"><div class="cert-top"><div class="eyebrow">' +
      icon('book') +
      'Terruá Passport</div><h2>' +
      esc(draftTitle(r)) +
      '</h2><p>' +
      esc([d.winery, d.origin || 'Origen de la uva por confirmar'].filter(Boolean).join(' · ')) +
      '</p><div class="tool-line" style="margin-top:12px">' +
      badge(r) +
      (d.lot ? '<span class="status">Lote ' + esc(d.lot) + '</span>' : '') +
      (r.example || d.example
        ? '<span class="status">Datos ficticios</span>'
        : '') +
      '</div></div>' +
      atTable(d) +
      (r.id === 'origen' && r.example && !p
        ? '<div class="sample-nav no-print"><span>Explorar una botella de ejemplo</span><div class="actions">' +
          link('0372 · disponible', '#muestra/origen/0372', 'btn outline') +
          link('0401 · muestra', '#muestra/origen/0401', 'btn outline') + '</div></div>'
        : '') +
      inventoryPanel(d, number) +
      '<details class="subgroup dossier" ' + (number == null ? 'open' : '') +
        '><summary>Origen y expediente del vino</summary>' + sections(d, true) + '</details>' +
      bottlePanel(r, token) +
      reviewPanel(r) +
      '<p class="helptext">El origen, el contenido y los respaldos corresponden a la declaración del productor. La verificación de Stellar comprueba la integridad de la ficha y su emisión.</p>' +
      (d.evidence
        ? '<div class="subgroup no-print"><label class="field">Comparar documento con la huella registrada<input id="check-file" type="file"></label><p class="helptext" id="file-result" role="status"></p></div>'
        : '') +
      '</article><aside class="side">' +
      proof +
      (p && r.example
        ? '<div class="subgroup no-print">' +
          action('Usar como plantilla', 'clone', 'textbtn', 'plus') +
          '</div>'
        : '') +
      '</aside></div>';
    document.title = (number != null ? 'Botella ' + TerruaSerial.label(number) + ' · ' : '') +
      draftTitle(r) + ' · Terruá Passport';
  }
  function verifier() {
    current = null;
    app.innerHTML =
      '<div class="page-head">' +
      back() +
      '<h1>Verificar pasaporte</h1><p>Consulta la emisión y recupera la ficha original directamente desde Stellar Testnet.</p></div><div class="panel verify-panel"><div class="icon-box olive">' +
      icon('seal') +
      '</div><h3>Buscar una emisión</h3><form id="verify-form"><label class="field">Hash o enlace del pasaporte<input id="hash" class="verify-in" required placeholder="Pega el hash de 64 caracteres o un enlace" autocomplete="off" spellcheck="false"></label><button class="btn primary" type="submit">' +
      icon('search') +
      'Verificar en Stellar</button></form><details class="subgroup"><summary>Verificar un archivo de pasaporte</summary><label class="field">Archivo JSON exportado por Terruá<input id="import-json" type="file" accept=".json,application/json"></label></details>' +
      '<details class="subgroup"><summary>Recuperar una emisión numerada pendiente</summary><label class="field">Respaldo firmado de emisión<input id="restore-series" type="file" accept=".json,application/json"></label></details>' +
      feedback +
      (base[0].receipt
        ? '<div class="subgroup">' +
          link(
            'Probar con Reserva Los Boldos',
            '#verificar/' +
              base[0].receipt.hash +
              (base[0].review ? '/' + base[0].review.hash : ''),
            'textbtn',
            'book',
          ) +
          '</div>'
        : '') +
      (base.find((x) => x.id === 'piedra')?.receipt?.mode === TerruaSerial.mode
        ? '<div class="subgroup">' +
          link(
            'Probar con la botella 0001 de Piedra del Sur',
            bottleUrl(
              base.find((x) => x.id === 'piedra'),
              1,
            ),
            'textbtn',
            'bottle',
          ) +
          '</div>'
        : '') +
      '</div>';
  }
  async function verifyHash(
    hash,
    reviewHash = '',
    imported = null,
    number = null,
  ) {
    const id = ++nonce;
    if (number === null) {
      verifier();
      document.querySelector('#hash').value = hash;
    } else {
      current = null;
      app.innerHTML = '<section class="panel verify-panel"><h1>Botella Nº ' +
        esc(TerruaSerial.label(Number(number))) + '</h1>' + feedback +
        '<div class="actions" id="scan-actions"></div></section>';
    }
    alertAt(
      'Consultando la transacción y comparando la huella de la ficha…',
      '',
    );
    try {
      const result = await chain.verify(hash);
      if (id !== nonce) return;
      const error = validate(result.metadata);
      if (error) throw Error('La ficha registrada contiene campos no válidos.');
      if (
        imported &&
        (chain.canonical(result.metadata) !==
          chain.canonical(imported.metadata) ||
          chain.canonical(result.receipt) !==
            chain.canonical(imported.receipt) ||
          imported.network !== 'Stellar Testnet')
      )
        throw Error(
          'El archivo fue modificado. Sus datos difieren del registro en Stellar.',
        );
      const known = all().find((r) => r.receipt?.hash === hash);
      const r = {
        ...known,
        id: known?.id || hash,
        data: result.metadata,
        receipt: result.receipt,
        example: result.metadata.example === true,
      };
      const reviewToCheck =
        reviewHash ||
        (!imported && (storedReview(hash)?.hash || known?.review?.hash));
      r.review = reviewToCheck
        ? await TerruaReview.verify(reviewToCheck, result.receipt)
        : null;
      if (id !== nonce) return;
      if (
        imported?.review &&
        chain.canonical(imported.review) !== chain.canonical(r.review)
      )
        throw Error(
          'Los datos de la revisión difieren de la firma registrada.',
        );
      const token =
        number === null ? null : await TerruaSerial.bottle(result, number);
      if (id !== nonce) return;
      if (
        imported &&
        Object.hasOwn(imported, 'bottle') &&
        chain.canonical(imported.bottle) !== chain.canonical(token)
      )
        throw Error(
          'El número o el activo de la botella no coincide con la emisión.',
        );
      passport(r, true, token);
      window.scrollTo(0, 0);
    } catch (e) {
      if (id === nonce) {
        alertAt(e.message);
        const actions = document.querySelector('#scan-actions');
        if (actions) {
          const retry = document.createElement('button');
          retry.className = 'btn primary';
          retry.textContent = 'Volver a intentar';
          retry.addEventListener('click', () => verifyHash(hash, reviewHash, imported, number), { once: true });
          actions.append(retry);
        }
      }
    }
  }
  function persistInput(el) {
    if (
      !current ||
      busy ||
      current.pending ||
      !document.querySelector('#wine-form')
    )
      return;
    if (el.dataset.extra !== undefined) {
      current.data.extras[Number(el.dataset.extra)][el.dataset.side] = el.value;
    } else if (
      el.name &&
      (['firstSerial', 'bottleOwner', 'samples', 'withdrawn', 'theoretical'].includes(el.name) ||
        fields.some((g) => g.fields.some((f) => f[0] === el.name)))
    ) {
      current.data[el.name] = el.value;
    } else return;
    save(current);
    const summary = document.querySelector('#line-summary');
    if (summary) summary.innerHTML = inventorySummary(current.data);
    const side = document.querySelector('.form-layout .side');
    if (side) {
      const d = current.data;
      side.querySelector('h3').textContent = d.name || 'Nuevo pasaporte';
      side.querySelector('p').textContent = d.winery || 'Bodega por definir';
      const items = side.querySelectorAll('li');
      [
        d.origin || 'Origen por completar',
        [d.variety, d.vintage].filter(Boolean).join(' · ') ||
          'Cepa y añada por completar',
        d.bottles
          ? nf.format(d.bottles) + ' botellas'
          : 'Cantidad por completar',
      ].forEach((v, i) => {
        items[i].lastChild.textContent = v;
      });
    }
  }
  async function issue(r) {
    if (busy) return;
    if (!r.pending && !document.querySelector('#approve')?.checked) {
      alertAt('Confirma la autorización para publicar los datos del lote.');
      return;
    }
    const error = validate(r.data);
    if (error) {
      alertAt(error);
      return;
    }
    const m = metadata(r.data);
    if (new TextEncoder().encode(chain.canonical(m)).length > 4000) {
      alertAt(
        'La ficha supera 4.000 bytes. Acorta las notas o los campos personalizados.',
      );
      return;
    }
    busy = true;
    const onProgress = (s) => {
      if (location.hash === '#editar/' + r.id) alertAt(s, '');
    };
    document
      .querySelectorAll('#wine-form button,#wine-form input')
      .forEach((b) => (b.disabled = true));
    async function send() {
      refresh();
      const fresh = find(r.id);
      if (fresh?.receipt) {
        location.hash = 'pasaporte/' + r.id;
        return;
      }
      if (
        !fresh?.pending &&
        all().some(
          (x) =>
            x.id !== r.id &&
            x.receipt &&
            strip(x.data.winery?.trim()) === strip(m.winery) &&
            strip(x.data.lot?.trim()) === strip(m.lot),
        )
      )
        throw Error(
          'Esta bodega ya tiene una emisión con el mismo código de lote en el registro.',
        );
      let p = fresh?.pending,
        proof;
      if (m.bottleMode === TerruaSerial.mode) {
        if (!p) {
          proof = await TerruaSerial.existing(m);
          if (!proof) {
            p = await TerruaSerial.prepare(m, onProgress);
            r.pending = p;
            save(r);
            if (current?.id === r.id) {
              const bar = document.querySelector('#feedback');
              if (bar)
                bar.insertAdjacentHTML(
                  'afterend',
                  action(
                    'Descargar respaldo de emisión',
                    'serial-backup',
                    'btn outline',
                    'download',
                  ),
                );
            }
          }
        }
        if (!proof) {
          try {
            await TerruaSerial.submitSeries(p, onProgress);
          } catch (e) {
            try {
              proof = await TerruaSerial.existing(m);
            } catch {}
            if (!proof) throw e;
          }
          if (!proof) {
            onProgress('Verificando cada activo de la serie…');
            proof = await chain.verify(p.hash);
          }
        }
      } else if (p) {
        onProgress('Comprobando la emisión anterior…');
        try {
          proof = await chain.verify(p.hash);
        } catch (e) {
          if (e.status !== 404) throw e;
          if (p.expires <= Date.now()) {
            delete r.pending;
            save(r);
            throw Error(
              'La firma anterior expiró sin confirmación. Puedes iniciar una nueva emisión.',
            );
          }
        }
      } else {
        p = await chain.prepare(m, onProgress);
        r.pending = p;
        save(r);
      }
      if (!proof) {
        onProgress('Enviando la transacción firmada a Stellar Testnet…');
        await chain.submit(p);
        onProgress('Verificando la emisión y los metadatos…');
        proof = await chain.verify(p.hash);
      }
      r.data = proof.metadata;
      r.receipt = proof.receipt;
      delete r.pending;
      save(r, true);
      toast('Lote emitido y verificado en Stellar Testnet.');
      location.hash = 'pasaporte/' + r.id;
    }
    try {
      if (navigator.locks)
        await navigator.locks.request(
          'terrua-emision-' + strip(m.winery) + '-' + strip(m.lot),
          send,
        );
      else await send();
    } catch (e) {
      if (location.hash === '#editar/' + r.id) {
        current = r;
        wizard();
        alertAt(
          e.message +
            (r.pending ? ' El comprobante pendiente quedó guardado.' : ''),
        );
      } else toast(e.message);
    } finally {
      busy = false;
    }
  }
  function route() {
    nonce++;
    refresh();
    const [page = 'inicio', param = '', reviewHash = ''] = location.hash
      .slice(1)
      .split('/');
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const active =
        page === 'pasaporte' || page === 'editar'
          ? 'catalogo'
          : page || 'inicio';
      if (a.dataset.nav === active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    current = null;
    if (page === 'editar') {
      const r = find(param);
      if (!r || r.example || r.receipt) {
        location.hash = r ? 'pasaporte/' + r.id : 'catalogo';
        return;
      }
      current = r;
      stage = r.pending ? 3 : Math.max(0, Math.min(3, r.step || 0));
      wizard();
    } else if (page === 'pasaporte') {
      const r = find(param);
      if (r) passport(r);
      else {
        location.hash = 'catalogo';
        return;
      }
    } else if (page === 'muestra' && param === 'origen') {
      const sample = base.find((r) => r.id === 'origen');
      try {
        const number = TerruaSerial.serialNumber(sample.data, reviewHash);
        passport(sample, false, null, number);
      } catch { location.hash = 'pasaporte/origen'; }
    } else if (page === 'botella') {
      const parts = location.hash.slice(1).split('/');
      if (
        parts.length >= 3 &&
        parts.length <= 4 &&
        /^[a-f0-9]{64}$/.test(param) &&
        /^\d{1,8}$/.test(reviewHash) &&
        (!parts[3] || /^[a-f0-9]{64}$/.test(parts[3]))
      )
        verifyHash(param, parts[3] || '', null, reviewHash);
      else {
        verifier();
        alertAt('El enlace de la botella no es válido.');
      }
    } else if (page === 'verificar') {
      if (param) {
        const h = pickHash(param);
        if (h) verifyHash(h, reviewHash);
        else {
          verifier();
          alertAt('El enlace de verificación no es válido.');
        }
      } else verifier();
    } else catalogue(page !== 'catalogo');
    if (!app.querySelector('.passport-layout'))
      document.title = (document.querySelector('h1')?.textContent || 'Cuaderno de bodega') + ' · Terruá Passport';
  }
  app.addEventListener('input', (e) => {
    try {
      if (e.target.id === 'search') {
        query = e.target.value;
        cards();
      } else persistInput(e.target);
    } catch (err) {
      alertAt(err.message);
    }
  });
  app.addEventListener('change', async (e) => {
    const el = e.target;
    try {
      if (el.id === 'bottle-mode' && current && !current.pending && !busy) {
        current.data.bottleMode = el.value;
        if (el.value === TerruaSerial.mode && !current.data.firstSerial)
          current.data.firstSerial = 1;
        save(current);
        wizard();
      }
      if (el.id === 'line-check' && current && !current.pending && !busy) {
        current.data.lineCheck = el.checked;
        save(current);
        wizard();
        document.querySelector('#line-check')?.focus();
      }
      if (el.id === 'filter') {
        filter = el.value;
        cards();
      }
      if (el.id === 'restore-series') {
        const file = el.files[0];
        if (!file) return;
        if (file.size > 3500000)
          throw Error('Archivo de recuperación demasiado grande.');
        const pack = JSON.parse(await file.text());
        if (pack.format !== 'terrua.serial.recovery.v1')
          throw Error('Selecciona un respaldo de emisión de Terruá.');
        const data = await TerruaSerial.inspectPlan(pack.plan);
        const verified = await chain.verify(pack.plan.hash).catch((e) => {
          if (e.status === 404) return null;
          throw e;
        });
        const prior = all().find(
          (r) =>
            r.pending?.hash === pack.plan.hash ||
            r.receipt?.hash === pack.plan.hash,
        );
        if (prior?.receipt) {
          location.hash = 'pasaporte/' + prior.id;
          return;
        }
        const r = { id: prior?.id || crypto.randomUUID(), data, step: 3 };
        if (verified) {
          r.receipt = verified.receipt;
          save(r, true);
          location.hash = 'pasaporte/' + r.id;
        } else {
          r.pending = pack.plan;
          save(r);
          location.hash = 'editar/' + r.id;
        }
      }
      if (el.id === 'import-json') {
        const f = el.files[0];
        if (!f) return;
        if (f.size > 20000)
          throw Error('El archivo de pasaporte debe pesar menos de 20 KB.');
        const item = JSON.parse(await f.text());
        const h = pickHash(item.receipt?.hash);
        if (!h || !item.metadata || item.format !== 'terrua.passport.export.v1')
          throw Error(
            'Selecciona un archivo JSON exportado por Terruá Passport.',
          );
        if (
          Object.hasOwn(item, 'bottle') &&
          (!item.bottle || !Number.isSafeInteger(item.bottle.number))
        )
          throw Error('El número del archivo es inválido.');
        await verifyHash(
          h,
          item.review?.hash || '',
          item,
          item.bottle?.number ?? null,
        );
      }
      if (el.id === 'evidence-file' || el.id === 'check-file') {
        const f = el.files[0];
        if (!f) return;
        if (f.size > 10 * 1024 * 1024)
          throw Error('Selecciona un documento de hasta 10 MB.');
        const target = current;
        pendingFile = true;
        const hash = await chain.digest(new Uint8Array(await f.arrayBuffer()));
        if (target !== current) return;
        if (el.id === 'check-file')
          document.querySelector('#file-result').textContent =
            hash === target.data.evidence.hash
              ? 'Coincide con la huella registrada.'
              : 'El archivo difiere del respaldo registrado.';
        else {
          current.data.evidence = { name: f.name.slice(0, 100), hash };
          save(current);
          wizard();
          toast('Huella del documento guardada.');
        }
      }
    } catch (err) {
      alertAt(
        err instanceof SyntaxError
          ? 'El archivo no contiene JSON válido.'
          : err.message,
      );
    } finally {
      pendingFile = false;
    }
  });
  app.addEventListener('submit', (e) => {
    e.preventDefault();
    if (e.target.id === 'wine-form') {
      if (busy || pendingFile) return;
      if (stage < 3) {
        if (checkForm(stage)) setStep(stage + 1);
      } else issue(current);
    }
    if (e.target.id === 'bottle-find') {
      const n = TerruaSerial.serialNumber(
        current.data,
        document.querySelector('#bottle-number').value,
      );
      const dest = bottleUrl(current, n);
      if (location.href === dest)
        verifyHash(current.receipt.hash, current.review?.hash || '', null, n);
      else location.href = dest;
      return;
    }
    if (e.target.id === 'review-form') {
      signReview(e.target);
      return;
    }
    if (e.target.id === 'verify-form') {
      const input = document.querySelector('#hash').value;
      try {
        const h = new URL(input.trim()).hash;
        if (/^#botella\/[a-f0-9]{64}\/\d{1,8}(?:\/[a-f0-9]{64})?$/i.test(h)) {
          location.hash = h;
          return;
        }
      } catch {}
      const [h, rev] = ref(input);
      if (!h) {
        alertAt(
          'Ingresa un hash de 64 caracteres o un enlace de Terruá o Stellar.',
        );
        return;
      }
      const dest = 'verificar/' + h + (rev ? '/' + rev : '');
      if (location.hash === '#' + dest) verifyHash(h, rev);
      else location.hash = dest;
    }
  });
  app.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const a = el.dataset.act;
    try {
      if (a === 'new') newDraft();
      if (a === 'reset') {
        query = '';
        filter = 'all';
        route();
      }
      if (a === 'prev') setStep(stage - 1);
      if (a.startsWith('step-') && !current.pending)
        setStep(Number(a.slice(5)));
      if (a === 'save-exit') {
        save(current);
        toast('Borrador guardado en este navegador.');
        location.hash = 'catalogo';
      }
      if (a === 'clone') {
        const d = structuredClone(current.data);
        delete d.example;
        delete d.schema;
        delete d.bottleOwner;
        d.lot = '';
        newDraft(d);
      }
      if (a === 'add-extra') {
        (current.data.extras ??= []).push({ key: '', value: '' });
        save(current);
        wizard();
        document.querySelector('#extras .extra-row:last-child input')?.focus();
      }
      if (a.startsWith('del-extra-')) {
        current.data.extras.splice(Number(a.slice(10)), 1);
        save(current);
        wizard();
      }
      if (a === 'del-file') {
        delete current.data.evidence;
        save(current);
        wizard();
      }
      if (a === 'serial-backup' && current?.pending)
        downloadFile(
          'Terrua-respaldo-' + current.pending.hash.slice(0, 12) + '.json',
          JSON.stringify({
            format: 'terrua.serial.recovery.v1',
            plan: current.pending,
          }),
          'application/json',
        );
      if (a === 'serial-csv') {
        const m = current.data,
          balance = TerruaModel.inventory(m),
          rows = ['numero,activo,emisor,enlace,estado_al_embotellar'];
        for (let n = m.firstSerial; n < m.firstSerial + m.bottles; n++)
          rows.push(
            [
              TerruaSerial.label(n),
              TerruaSerial.code(n),
              current.receipt.issuer,
              bottleUrl(current, n),
              balance ? (balance.states.get(n) || 'Disponible') : 'Sin declarar',
            ].join(','),
          );
        downloadFile(
          'Terrua-serie-' + current.receipt.code + '.csv',
          rows.join('\r\n'),
          'text/csv;charset=utf-8',
        );
      }
      if (a === 'recheck')
        verifyHash(
          current.receipt.hash,
          current.review?.hash || '',
          null,
          current.token?.number ?? null,
        );
      if (a === 'print') window.print();
      if (a === 'copy') {
        try {
          await navigator.clipboard.writeText(
            current.token
              ? bottleUrl(current, current.token.number)
              : shareUrl(current.receipt.hash, current.review?.hash),
          );
          toast('Enlace de verificación copiado.');
        } catch {
          const box = document.createElement('input');
          box.value = current.token
            ? bottleUrl(current, current.token.number)
            : shareUrl(current.receipt.hash, current.review?.hash);
          box.readOnly = true;
          box.setAttribute('aria-label', 'Enlace de verificación');
          el.after(box);
          box.select();
        }
      }
      if (a === 'export') {
        const blob = new Blob(
          [
            JSON.stringify(
              {
                format: 'terrua.passport.export.v1',
                network: 'Stellar Testnet',
                metadata: metadata(current.data),
                receipt: current.receipt,
                review: current.review || undefined,
                bottle: current.token || undefined,
              },
              null,
              2,
            ),
          ],
          { type: 'application/json' },
        );
        const u = URL.createObjectURL(blob),
          d = document.createElement('a');
        d.href = u;
        d.download =
          'Terrua-' +
          current.receipt.code +
          (current.token
            ? '-' + TerruaSerial.label(current.token.number)
            : '') +
          '.json';
        d.click();
        setTimeout(() => URL.revokeObjectURL(u), 5000);
      }
    } catch (err) {
      alertAt(err.message);
    }
  });
  let printDossier = null;
  window.addEventListener('beforeprint', () => {
    printDossier = app.querySelector('details.dossier:not([open])');
    if (printDossier) printDossier.open = true;
  });
  window.addEventListener('afterprint', () => {
    if (printDossier) printDossier.open = false;
    printDossier = null;
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', (e) => {
    if (
      e.key === storeKey &&
      (!location.hash || ['#inicio', '#catalogo'].includes(location.hash))
    )
      route();
  });
  async function init() {
    try {
      const response = await fetch('example-proof.json');
      if (response.ok) {
        const sample = await response.json();
        base[0].data = sample.metadata;
        base[0].receipt = sample.receipt;
        base[0].review = sample.review;
      }
    } catch {}
    try {
      const res = await fetch('example-serial.json');
      if (res.ok) {
        const numbered = await res.json();
        const r = base.find((x) => x.id === 'piedra');
        r.data = numbered.metadata;
        r.receipt = numbered.receipt;
      }
    } catch {}
    route();
  }
  init();
})();
