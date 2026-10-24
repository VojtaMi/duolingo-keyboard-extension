const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { gzipSync } = require('node:zlib');

function harness() {
  let stored = null;
  let heading = 'Write this in German';
  let onKey;
  let onMessage;
  let poll;
  let decompressions = 0;
  const document = {
    documentElement: {},
    querySelector: (selector) => selector.startsWith('h1') ? { textContent: heading } : null,
    querySelectorAll: () => [],
    addEventListener: (type, callback) => { if (type === 'keydown') onKey = callback; }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../content.js'), 'utf8'), {
    document,
    window: { addEventListener() {} },
    localStorage: { getItem: () => stored },
    chrome: { runtime: { onMessage: { addListener: (callback) => { onMessage = callback; } } } },
    MutationObserver: class { observe() {} },
    KeyboardEvent: class { constructor(type, options) { Object.assign(this, options, { type }); } },
    setInterval: (callback) => { poll = callback; },
    atob, Blob, Response,
    DecompressionStream: class extends DecompressionStream {
      constructor(format) { super(format); decompressions++; }
    }
  });
  return {
    setCourse(user) {
      stored = JSON.stringify(gzipSync(JSON.stringify({ state: { redux: { user } } })).toString('base64'));
    },
    corrupt() { stored = 'invalid'; },
    heading(value) { heading = value; },
    state: () => new Promise((resolve) => onMessage({ type: 'get-state' }, null, resolve)),
    toggle(enabled) { onMessage({ type: 'set-enabled', enabled }, null, () => {}); },
    poll: () => poll(),
    decompressions: () => decompressions,
    key(key, options = {}) {
      const translated = [];
      let prevented = false;
      const target = {
        matches: () => false,
        closest: () => null,
        dispatchEvent(event) {
          event.target = target;
          onKey(event);
          translated.push(event.key);
        }
      };
      onKey({ type: 'keydown', key, target, ...options,
        preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
      return { prevented, translated };
    }
  };
}

test('gzip course detection, German keys, reverse translation, and course switching', async () => {
  const page = harness();
  assert.equal((await page.state()).active, false);
  page.setCourse({ currentCourseId: 'DUOLINGO_DE_EN', learningLanguage: 'de', fromLanguage: 'en' });
  assert.equal((await page.state()).language, 'German');
  for (const [key, expected] of [['[', 'ü'], ['{', 'Ü'], [';', 'ö'], [':', 'Ö'], ["'", 'ä'], ['"', 'Ä'], ['-', 'ß'], [']', "'"], ['}', '"']]) {
    assert.deepEqual(page.key(key), { prevented: true, translated: [expected] });
  }
  for (const key of ['y', 'Y', 'z', 'Z', '_', '@', '#', '/', '?']) {
    assert.deepEqual(page.key(key), { prevented: false, translated: [] });
  }
  assert.equal(page.key('[', { ctrlKey: true }).prevented, false);
  assert.equal(page.key('[', { isComposing: true }).prevented, false);
  page.toggle(false);
  assert.equal(page.key('[').prevented, false);
  page.toggle(true);
  page.heading('Write this in English');
  assert.equal(page.key('[').prevented, false);
  page.heading('Complete the sentence');
  assert.equal((await page.state()).active, true);
  const count = page.decompressions();
  await page.poll();
  await page.state();
  assert.equal(page.decompressions(), count, 'unchanged state is not decompressed again');
  page.setCourse({ currentCourseId: 'DUOLINGO_EO_EN' });
  // A key before the new state finishes decoding must not use the previous map.
  assert.equal(page.key('[').prevented, false);
  assert.equal((await page.state()).language, 'Esperanto');
  assert.deepEqual(page.key('x').translated, ['ĉ']);
  assert.deepEqual(page.key('[').translated, ['ĵ']);
  page.setCourse({ currentCourseId: 'DUOLINGO_NL-NL_EN' });
  const unsupported = await page.state();
  assert.equal(unsupported.course.learningLanguage, 'nl-nl');
  assert.equal(unsupported.active, false);
  page.setCourse({ currentCourseId: 'DUOLINGO_DE_ES' });
  assert.equal((await page.state()).active, false);
  page.corrupt();
  assert.equal((await page.state()).active, false);
  assert.equal(page.key('[').prevented, false);
});
