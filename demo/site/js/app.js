// Interacciones de la página: cabecera pegajosa y búsqueda del catálogo.

var header;

var resizeTimer;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
    if (header) header.classList.toggle('compact', window.innerWidth < 480);
  }, 150);
}

window.addEventListener('resize', onResize);

document.addEventListener('DOMContentLoaded', function () {
  header = document.querySelector('.site-header');
  onResize();
});

// Índice de búsqueda del catálogo: se construye de una sola vez en el hilo principal
// justo después del primer pintado.
function buildSearchIndex() {
  var origins = ['Etiopía', 'Brasil', 'Colombia', 'Kenia', 'Guatemala', 'Costa Rica', 'Perú'];
  var entries = [];
  for (var i = 0; i < 150000; i++) {
    var origin = origins[i % origins.length];
    entries.push({
      id: i,
      name: origin + ' lote ' + ((i * 7919) % 10007),
      score: (i * 31) % 100,
    });
  }
  entries.sort(function (a, b) {
    return a.name.localeCompare(b.name, 'es') || b.score - a.score;
  });
  window.searchIndex = entries;
}

// Arranca justo después del primer pintado, mientras el usuario ya puede interactuar.
document.addEventListener('DOMContentLoaded', function () {
  requestAnimationFrame(function () {
    setTimeout(buildSearchIndex, 0);
  });
});
