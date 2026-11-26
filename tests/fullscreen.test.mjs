import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fullscreenDocument } from '../shared/fullscreen.mjs';
import { resolveView } from '../shared/site-route.mjs';

test('game pages fullscreen the persistent shell; standalone pages use their own document', () => {
  const shell = { documentElement: { dataset: { blueyShell: 'true' } } };
  const child = { document: {}, parent: { document: shell } };
  assert.equal(fullscreenDocument(child), shell);
  const standalone = { document: {} }; standalone.parent = standalone;
  assert.equal(fullscreenDocument(standalone), standalone.document);
  child.parent.document.documentElement.dataset.blueyShell = 'false';
  assert.equal(fullscreenDocument(child), child.document);
});

test('cross-origin embedding falls back safely to the local document', () => {
  const child = { document: {}, parent: { get document() { throw new Error('Cross origin'); } } };
  assert.equal(fullscreenDocument(child), child.document);
});

test('shared screen links retain song parameters and the repository base path', () => {
  const base = new URL('https://example.com/wackadoo-rhythm/');
  for (const route of ['home/', 'spinny-roundy/', 'spinny-roundy/music-circle/index.html?song=dance-mode', 'vest-connect/', 'keepy-uppy/']) {
    assert.equal(resolveView(route, base).href, new URL(route, base).href);
  }
  for (const route of ['', 'index.html', '../other/', '//other.example/', 'https://evil.example/', 'shared/site-shell.mjs', 'phone/']) {
    assert.equal(resolveView(route, base).href, new URL('home/', base).href);
  }
});
