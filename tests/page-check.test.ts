import { describe, expect, it } from 'vitest';
import { pageRegressions, type PageSnapshot } from '../src/experiments/page-check.js';

const healthy: PageSnapshot = {
  url: 'http://127.0.0.1:4173/',
  title: 'Tostadero Atlas',
  text: 'Café de especialidad',
  images: [
    { src: 'http://127.0.0.1:4173/img/hero.jpg', loaded: true },
    { src: 'http://127.0.0.1:4173/img/cafe-1.jpg', loaded: true },
  ],
  consoleErrors: [],
  failedRequests: [],
  searchIndexLength: 150000,
};

describe('pageRegressions', () => {
  it('no marca nada si la página es idéntica', () => {
    expect(pageRegressions(healthy, structuredClone(healthy))).toEqual([]);
  });

  it('marca texto, imágenes rotas, errores nuevos y un índice distinto', () => {
    const broken: PageSnapshot = {
      ...healthy,
      text: 'Café',
      images: [{ src: 'http://127.0.0.1:4173/img/hero-480.jpg', loaded: false }],
      consoleErrors: ['Uncaught ReferenceError: THREE is not defined'],
      failedRequests: ['404 http://127.0.0.1:4173/img/hero-480.jpg'],
      searchIndexLength: null,
    };
    const problems = pageRegressions(healthy, broken).join('\n');
    expect(problems).toContain('texto visible');
    expect(problems).toContain('no cargan');
    expect(problems).toContain('menos imágenes');
    expect(problems).toContain('THREE is not defined');
    expect(problems).toContain('404');
    expect(problems).toContain('150000 → ausente');
  });

  it('no culpa al arreglo de errores que ya existían antes', () => {
    const before = { ...healthy, consoleErrors: ['favicon'] };
    expect(pageRegressions(before, structuredClone(before))).toEqual([]);
  });
});

describe('pageRegressions con puertos distintos', () => {
  it('ignora el origen al comparar peticiones fallidas', () => {
    const before = { ...healthy, failedRequests: ['404 http://127.0.0.1:4173/favicon.ico'] };
    const after = { ...healthy, failedRequests: ['404 http://127.0.0.1:4174/favicon.ico'] };
    expect(pageRegressions(before, after)).toEqual([]);
  });
});
