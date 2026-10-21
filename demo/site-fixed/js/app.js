// Interacciones de la página: cabecera pegajosa y búsqueda del catálogo.
// Versión corregida: se carga con defer, sin librerías sin usar y sin tareas largas.

var header = document.querySelector('.site-header');

var resizeTimer;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () {
    if (header) header.classList.toggle('compact', window.innerWidth < 480);
  }, 150);
}

window.addEventListener('resize', onResize);
onResize();

// Mismo índice que la versión original, pero construido en trozos que ceden el hilo
// principal entre uno y otro, de modo que ninguna tarea supera los 50 ms.
var TOTAL = 150000;
var CHUNK = 5000;

function buildSearchIndex() {
  var origins = ['Etiopía', 'Brasil', 'Colombia', 'Kenia', 'Guatemala', 'Costa Rica', 'Perú'];
  var entries = [];
  var next = 0;

  function fill() {
    var end = Math.min(next + CHUNK, TOTAL);
    for (; next < end; next++) {
      entries.push({
        id: next,
        name: origins[next % origins.length] + ' lote ' + ((next * 7919) % 10007),
        score: (next * 31) % 100,
      });
    }
    if (next < TOTAL) {
      setTimeout(fill, 0);
    } else {
      sortInChunks();
    }
  }

  // Ordenación por mezcla con trozos: ordena bloques pequeños y los fusiona cediendo el hilo.
  var collator = new Intl.Collator('es');
  function compare(a, b) {
    return collator.compare(a.name, b.name) || b.score - a.score;
  }

  function sortInChunks() {
    var runs = [];
    var position = 0;

    function sortBlock() {
      var end = Math.min(position + CHUNK, entries.length);
      runs.push(entries.slice(position, end).sort(compare));
      position = end;
      if (position < entries.length) {
        setTimeout(sortBlock, 0);
      } else {
        mergeRuns();
      }
    }

    function mergeRuns() {
      if (runs.length === 1) {
        window.searchIndex = runs[0];
        return;
      }
      var a = runs.shift();
      var b = runs.shift();
      var merged = [];
      var i = 0;
      var j = 0;

      function step() {
        var budget = 20000;
        while ((i < a.length || j < b.length) && budget-- > 0) {
          if (j >= b.length || (i < a.length && compare(a[i], b[j]) <= 0)) merged.push(a[i++]);
          else merged.push(b[j++]);
        }
        if (i < a.length || j < b.length) {
          setTimeout(step, 0);
        } else {
          runs.push(merged);
          setTimeout(mergeRuns, 0);
        }
      }
      step();
    }

    sortBlock();
  }

  fill();
}

// Arranca justo después del primer pintado, mientras el usuario ya puede interactuar.
requestAnimationFrame(function () {
  setTimeout(buildSearchIndex, 0);
});
