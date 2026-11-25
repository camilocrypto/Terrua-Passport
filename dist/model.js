(() => {
  const fields = [
    {
      title: 'Identidad y origen',
      short: 'Origen',
      fields: [
        ['name', 'Nombre del vino', 'text', true, 'Ej. Reserva Los Boldos', 80],
        ['winery', 'Bodega productora', 'text', true, 'Ej. Viña Umbral', 80],
        [
          'type',
          'Tipo de vino',
          'select',
          true,
          [
            'Tinto',
            'Blanco',
            'Rosado',
            'Espumante',
            'Naranjo',
            'Dulce',
            'Otro',
          ],
        ],
        [
          'variety',
          'Cepa o ensamblaje',
          'list',
          true,
          [
            'Carménère',
            'Cabernet Sauvignon',
            'País',
            'Pinot Noir',
            'Merlot',
            'Syrah',
            'Sauvignon Blanc',
            'Chardonnay',
            'Moscatel',
            'Ensamblaje',
          ],
        ],
        ['vintage', 'Añada', 'number', true, 'Ej. 2024', 1900, 2100, 1],
        [
          'origin',
          'Origen de la uva (valle o región)',
          'list',
          true,
          [
            'Valle de Colchagua',
            'Valle del Itata',
            'Valle de Casablanca',
            'Valle del Maule',
            'Valle del Maipo',
            'Valle de Cachapoal',
            'Valle de Aconcagua',
            'Valle del Limarí',
            'Valle de Leyda',
          ],
        ],
        ['vinificationPlace', 'Lugar de vinificación', 'text', false, 'Bodega o localidad', 90],
        ['bottlingPlace', 'Lugar de embotellado', 'text', false, 'Bodega o localidad', 90],
        ['country', 'País', 'text', false, 'Ej. Chile', 55],
        [
          'parcel',
          'Viñedo o cuartel',
          'text',
          false,
          'Ej. Los Boldos · Cuartel 4',
          80,
        ],
      ],
    },
    {
      title: 'Lote y elaboración',
      short: 'Lote',
      fields: [
        ['lot', 'Código del lote', 'text', true, 'Ej. COL-024', 36],
        [
          'bottles',
          'Botellas del lote',
          'number',
          true,
          'Ej. 1200',
          1,
          10000000,
          1,
        ],
        [
          'volume',
          'Volumen por botella (ml)',
          'number',
          true,
          '750',
          50,
          30000,
          1,
        ],
        [
          'alcohol',
          'Alcohol (% vol.)',
          'number',
          false,
          'Ej. 14,2',
          0,
          25,
          0.1,
        ],
        ['serviceTemp', 'Temperatura de servicio (°C)', 'number', false, 'Ej. 16', 0, 40, 0.5],
        ['decant', 'Decantación (minutos)', 'number', false, 'Ej. 30', 0, 1440, 1],
        ['pairing', 'Maridaje sugerido', 'text', false, 'Ej. Pastel de choclo', 140],
        ['harvest', 'Fecha de vendimia', 'date', false],
        ['bottled', 'Fecha de embotellado', 'date', false],
        [
          'fermentation',
          'Fermentación',
          'text',
          false,
          'Ej. Acero inoxidable',
          120,
        ],
        [
          'aging',
          'Crianza',
          'text',
          false,
          'Ej. 12 meses en roble francés',
          120,
        ],
        [
          'notes',
          'Notas de cata',
          'textarea',
          false,
          'Aromas, color y expresión del vino',
          350,
        ],
      ],
    },
    {
      title: 'Respaldo y análisis',
      short: 'Respaldo',
      fields: [
        [
          'author',
          'Responsable de la declaración',
          'text',
          true,
          'Nombre o equipo de la bodega',
          90,
        ],
        [
          'designation',
          'Denominación declarada',
          'text',
          false,
          'Ej. D.O. Valle de Colchagua',
          100,
        ],
        ['ph', 'pH', 'number', false, 'Ej. 3,5', 0, 14, 0.01],
        [
          'sugar',
          'Azúcar residual (g/L)',
          'number',
          false,
          'Ej. 2,4',
          0,
          600,
          0.1,
        ],
        [
          'certifier',
          'Entidad certificadora declarada',
          'text',
          false,
          'Nombre de la entidad externa',
          100,
        ],
        [
          'reference',
          'Folio del certificado',
          'text',
          false,
          'Referencia del documento',
          90,
        ],
        ['evidenceUrl', 'Enlace al respaldo', 'url', false, 'https://…', 250],
      ],
    },
  ];
  const examples = [
    {
      id: 'boldos',
      art: 'boldos',
      name: 'Reserva Los Boldos',
      winery: 'Viña Umbral',
      type: 'Tinto',
      variety: 'Carménère',
      vintage: 2024,
      origin: 'Valle de Colchagua',
      lot: 'COL-024',
      bottles: 1200,
      volume: 750,
      alcohol: 14.2,
      parcel: 'Los Boldos · Cuartel 4',
      harvest: '2024-04-12',
      bottled: '2025-02-14',
      fermentation: 'Acero inoxidable',
      aging: '9 meses en roble francés',
      notes: 'Ciruela negra, cacao y un final especiado.',
      author: 'Equipo enológico de Viña Umbral',
    },
    {
      id: 'piedra',
      art: 'piedra',
      name: 'Piedra del Sur',
      winery: 'Viña Quebrada Clara',
      type: 'Tinto',
      variety: 'País',
      vintage: 2025,
      origin: 'Valle del Itata',
      lot: 'ITA-011',
      bottles: 620,
      volume: 750,
      alcohol: 12.8,
      harvest: '2025-03-21',
      fermentation: 'Fermentación en tinaja',
      author: 'Equipo de Viña Quebrada Clara',
    },
    {
      id: 'bruma',
      art: 'bruma',
      name: 'Bruma Costera',
      winery: 'Viña Litoral',
      type: 'Blanco',
      variety: 'Sauvignon Blanc',
      vintage: 2025,
      origin: 'Valle de Casablanca',
      lot: 'CAS-018',
      bottles: 850,
      volume: 750,
      alcohol: 12.5,
      harvest: '2025-03-10',
      aging: 'Sobre lías finas',
      notes: 'Cítricos y hierbas frescas.',
      author: 'Equipo de Viña Litoral',
    },
    {
      id: 'origen', name: 'Origen 1.200', winery: 'Bodega de demostración',
      type: 'Tinto', variety: '75% Cabernet Sauvignon / 25% Cabernet Franc',
      vintage: 2025, lot: 'ORIGEN-2025-CL-001', bottles: 1200, volume: 750,
      bottleMode: 'bottles-v1', firstSerial: 1, lineCheck: true,
      theoretical: 1224, samples: '0001–0002, 0401–0402, 0801–0802',
      notes: 'Fruta negra y violeta en nariz. En boca aparecen cacao y un final largo.',
      serviceTemp: 16, decant: 30, pairing: 'Pastel de choclo con champiñones.',
      author: 'Equipo enológico de demostración',
    },
  ].map(({ id, art, ...data }) => ({
    id,
    art,
    example: true,
    data: { country: 'Chile', ...data },
  }));
  const tastingKeys = new Set(['notes', 'serviceTemp', 'decant', 'pairing']);
  // Each serial can occupy only one physical inventory state at bottling.
  function inventory(d) {
    if (d.bottleMode !== 'bottles-v1' || d.lineCheck !== true) return null;
    const first = Number(d.firstSerial), count = Number(d.bottles);
    if (!Number.isSafeInteger(first) || first < 1 || !Number.isSafeInteger(count) ||
        count < 1 || count > 4800 || first + count - 1 > 99999999)
      throw Error('Completa la cantidad y el primer número de la serie.');
    const last = first + count - 1;
    const states = new Map();
    function readRanges(value, status) {
      if (value == null || value === '') return 0;
      if (typeof value !== 'string' || value.length > 300)
        throw Error('Usa hasta 300 caracteres por lista de números.');
      if (!value.trim()) return 0;
      let size = 0;
      for (const part of value.split(',')) {
        const range = /^(\d{1,8})(?:\s*[-–]\s*(\d{1,8}))?$/.exec(part.trim());
        if (!range) throw Error('Separa los números con comas o escribe un rango como 0001–0006.');
        const lo = Number(range[1]), hi = Number(range[2] || range[1]);
        if (lo < first || hi > last || hi < lo)
          throw Error('Hay un rango invertido o fuera de la numeración del lote.');
        for (let serial = lo; serial <= hi; serial++) {
          if (states.has(serial))
            throw Error('El número ' + String(serial).padStart(4, '0') + ' aparece más de una vez en la conciliación.');
          states.set(serial, status);
          size++;
        }
      }
      return size;
    }
    const samples = readRanges(d.samples, 'Muestra testigo');
    const withdrawn = readRanges(d.withdrawn, 'Baja');
    let loss = null;
    if (d.theoretical != null && String(d.theoretical).trim() !== '') {
      const total = Number(d.theoretical);
      if (!Number.isSafeInteger(total) || total < count)
        throw Error('La producción teórica debe ser un entero igual o superior a las botellas obtenidas.');
      loss = total - count;
    }
    return { first, last, count, states, samples, withdrawn, available: count - states.size, loss };
  }
  function metadata(d) {
    const out = { schema: 'terrua.passport.v1' };
    for (const f of fields.flatMap((g) => g.fields)) {
      const [key, , type] = f,
        v = d[key];
      if (v !== undefined && String(v).trim() !== '')
        out[key] =
          type === 'number' ? Number(v) : String(v).trim().normalize('NFC');
    }
    if (d.extras?.length)
      out.extras = d.extras
        .filter((e) => e.key?.trim() && e.value?.trim())
        .map((e) => ({ key: e.key.trim(), value: e.value.trim() }));
    if (d.evidence?.hash)
      out.evidence = { name: d.evidence.name, hash: d.evidence.hash };
    if (d.bottleMode === 'bottles-v1') {
      out.bottleMode = d.bottleMode;
      out.firstSerial = Number(d.firstSerial);
      if (d.lineCheck === true) {
        out.lineCheck = true;
        if (d.theoretical != null && String(d.theoretical).trim() !== '') out.theoretical = Number(d.theoretical);
        for (const key of ['samples', 'withdrawn'])
          if (typeof d[key] === 'string' && d[key].trim()) out[key] = d[key].trim();
      }
      if (d.bottleOwner?.trim()) out.bottleOwner = d.bottleOwner.trim();
    }
    if (d.example === true) out.example = true;
    return out;
  }
  function validate(d, group = null) {
    if ((group === 1 || group === null) && d.bottleMode === 'bottles-v1') {
      try {
        TerruaSerial.check(metadata(d));
        inventory(d);
      } catch (e) {
        return e.message;
      }
    }
    const list =
      group === null ? fields.flatMap((g) => g.fields) : fields[group].fields;
    for (const [key, label, type, required, opts, min, max, step] of list) {
      const v = d[key],
        filled = v !== undefined && String(v).trim() !== '';
      if (required && !filled) return 'Completa el campo «' + label + '».';
      if (!filled) continue;
      if (
        type === 'number' &&
        (!Number.isFinite(Number(v)) ||
          Number(v) < min ||
          Number(v) > max ||
          Math.abs(Number(v) / step - Math.round(Number(v) / step)) > 1e-5)
      )
        return 'Revisa el valor de «' + label + '».';
      if (type === 'select' && !opts.includes(v))
        return 'Selecciona un tipo de vino válido.';
      if (type === 'url' && !/^https?:\/\//i.test(v))
        return 'El enlace debe comenzar con https:// o http://.';
      if (
        type === 'date' &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)))
      )
        return 'Revisa la fecha de «' + label + '».';
      if (
        ['text', 'textarea', 'url', 'list'].includes(type) &&
        String(v).length > (typeof min === 'number' ? min : 100)
      )
        return 'Acorta el campo «' + label + '».';
    }
    if (
      (group === 1 || group === null) &&
      d.harvest &&
      d.bottled &&
      d.bottled < d.harvest
    )
      return 'El embotellado debe ser posterior o igual a la vendimia.';
    if (group === 2 || group === null) {
      if (Boolean(d.certifier?.trim()) !== Boolean(d.reference?.trim()))
        return 'Si declaras una certificación externa, completa la entidad y el folio.';
      if (
        d.extras &&
        (!Array.isArray(d.extras) ||
          d.extras.length > 6 ||
          d.extras.some(
            (e) =>
              Boolean(e.key?.trim()) !== Boolean(e.value?.trim()) ||
              (e.key || '').length > 40 ||
              (e.value || '').length > 120,
          ))
      )
        return 'Completa el nombre y el valor de cada campo adicional.';
      if (
        d.evidence &&
        (!/^[a-f0-9]{64}$/.test(d.evidence.hash) ||
          !d.evidence.name ||
          d.evidence.name.length > 100)
      )
        return 'La referencia al archivo no es válida.';
    }
    return '';
  }
  globalThis.TerruaModel = { fields, examples, metadata, validate, inventory, tastingKeys };
})();
