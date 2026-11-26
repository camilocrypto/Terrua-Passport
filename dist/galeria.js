(() => {
  'use strict';
  const find = (id) => document.getElementById(id);
  const number = find('gallery-number');
  const iframe = find('gallery-model');
  const previous = find('gallery-prev');
  const next = find('gallery-next');
  const serial = (n) => String(n).padStart(4, '0');
  let config;

  function show(bottle) {
    number.value = bottle;
    const label = serial(bottle);
    const route = '/botella-3d.html?botella=' + bottle;
    if (iframe.getAttribute('src') !== route + '&galeria=1') iframe.src = route + '&galeria=1';
    iframe.title = 'Modelo 3D de la botella ' + label;
    find('gallery-detail').href = route;
    const link = find('gallery-passport');
    link.textContent = 'Abrir pasaporte ' + label;
    if (config) {
      link.href = '/tirada.html#' + [config.contract, config.lots[0].id, bottle].join('/');
      link.removeAttribute('aria-disabled');
    }
    previous.disabled = bottle === 1;
    next.disabled = bottle === 100;
  }

  for (let bottle = 1; bottle <= 100; bottle++) number.add(new Option(serial(bottle), bottle));
  number.onchange = () => show(Number(number.value));
  previous.onclick = () => show(Number(number.value) - 1);
  next.onclick = () => show(Number(number.value) + 1);
  find('gallery-picker').onsubmit = (event) => event.preventDefault();
  show(100);
  fetch('/tirada-evidence.json').then((response) => {
    if (!response.ok) throw Error('Evidencia no disponible');
    return response.json();
  }).then((evidence) => {
    config = evidence;
    show(Number(number.value));
  }).catch(() => {
    find('gallery-status').textContent = 'No se pudo cargar el enlace del pasaporte. Actualiza la página e inténtalo de nuevo.';
  });
})();
