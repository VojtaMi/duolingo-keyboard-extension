(function () {
  'use strict';

  const HEADER_SELECTOR = 'h1[data-test="challenge-header"]';
  const KEYBOARD_BUTTON_SELECTOR = 'button[data-test="player-toggle-keyboard"]';
  const GENERIC_HEADER = /^(type the missing words?|complete the sentence)$/i;

  // Ubuntu's xkb Esperanto "basic" layout on a US QWERTY keyboard.
  const ESPERANTO_KEY_MAP = new Map([
    ['q', 'ŝ'], ['Q', 'Ŝ'],
    ['w', 'ĝ'], ['W', 'Ĝ'],
    ['y', 'ŭ'], ['Y', 'Ŭ'],
    ['[', 'ĵ'], ['{', 'Ĵ'],
    [']', 'ĥ'], ['}', 'Ĥ'],
    ['x', 'ĉ'], ['X', 'Ĉ']
  ]);

  const LAYOUTS = {
    eo: { name: 'Esperanto', characters: /[ĉĝĥĵŝŭ]/i, keys: ESPERANTO_KEY_MAP }
  };

  let enabled = true;
  let active = false;
  let course = null;
  let layout = null;
  let lastStoredState;
  let courseRead = Promise.resolve();
  const mappedEvents = new WeakSet();

  function refreshCourse() {
    let stored;
    try {
      stored = localStorage.getItem('duo.state');
    } catch {
      stored = null;
    }
    if (stored === lastStoredState) return courseRead;
    lastStoredState = stored;
    course = null;
    layout = null;
    refreshState();
    courseRead = (async () => {
      try {
        if (!stored) return;
        const bytes = Uint8Array.from(atob(JSON.parse(stored)), (c) => c.charCodeAt(0));
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        const user = JSON.parse(await new Response(stream).text()).state.redux.user;
        const match = /^DUOLINGO_(.+)_([^_]+)$/.exec(user.currentCourseId || '');
        const learning = String(user.learningLanguage || match?.[1] || '').toLowerCase();
        const from = String(user.fromLanguage || match?.[2] || '').toLowerCase();
        if (stored !== lastStoredState) return;
        course = { currentCourseId: user.currentCourseId, learningLanguage: learning, fromLanguage: from };
        layout = from === 'en' ? LAYOUTS[learning] || null : null;
      } catch {
        // Missing or changed Duolingo state leaves remapping disabled.
      } finally {
        refreshState();
      }
    })();
    return courseRead;
  }

  function challengeIsActive() {
    if (!layout) return false;
    const header = document.querySelector(HEADER_SELECTOR);
    const heading = header?.textContent.trim() || '';
    // Explicit reverse translations should keep the English keyboard.
    if (/\b(?:in|into) English\b/i.test(heading)) return false;
    const hasCharacterButton = [...document.querySelectorAll('button')]
      .some((button) => layout.characters.test(button.textContent));
    return Boolean(
      heading.toLowerCase().includes(layout.name.toLowerCase()) ||
      GENERIC_HEADER.test(heading) ||
      document.querySelector(KEYBOARD_BUTTON_SELECTOR) ||
      hasCharacterButton
    );
  }

  function refreshState() {
    active = challengeIsActive();
  }

  function isEditable(element) {
    if (!element) return false;
    return element.matches('input, textarea, [contenteditable="true"]') ||
      Boolean(element.closest('[contenteditable="true"]'));
  }

  function editableElement(element) {
    if (!element) return null;
    if (element.matches('input, textarea')) return element;
    return element.closest('[contenteditable="true"]') || null;
  }

  function insertIntoInput(input, character) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const value = input.value;

    // Use the native setter so React-controlled inputs observe the change.
    const prototype = input instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(input, value.slice(0, start) + character + value.slice(end));
    else input.value = value.slice(0, start) + character + value.slice(end);

    const cursor = start + character.length;
    input.setSelectionRange(cursor, cursor);
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: character
    }));
  }

  function insertIntoContentEditable(element, character) {
    element.focus();
    // execCommand preserves the selection and produces an input event in Chromium.
    if (!document.execCommand('insertText', false, character)) {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      selection.deleteFromDocument();
      selection.getRangeAt(0).insertNode(document.createTextNode(character));
      selection.collapseToEnd();
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: character
      }));
    }
  }

  function dispatchMappedKey(event, character) {
    const translated = new KeyboardEvent(event.type, {
      key: character,
      code: event.code,
      location: event.location,
      repeat: event.repeat,
      isComposing: event.isComposing,
      bubbles: true,
      cancelable: true,
      composed: true,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    });
    mappedEvents.add(translated);
    event.target.dispatchEvent(translated);
  }

  document.addEventListener('keydown', (event) => {
    if (mappedEvents.has(event)) return;
    void refreshCourse();
    refreshState();
    if (!enabled || !active || event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const character = layout.keys.get(event.key);
    if (!character) return;

    const target = editableElement(event.target);
    event.preventDefault();
    event.stopImmediatePropagation();

    if (target && target.matches('input, textarea')) {
      insertIntoInput(target, character);
    } else if (target) {
      insertIntoContentEditable(target, character);
    } else {
      // Duolingo's word-tile view has no input. Let its key handlers see the
      // mapped character instead.
      dispatchMappedKey(event, character);
    }
  }, true);

  const observer = new MutationObserver(refreshState);
  function observeDom() {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }
  if (document.documentElement) observeDom();
  else document.addEventListener('DOMContentLoaded', observeDom, { once: true });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'set-enabled') {
      enabled = Boolean(message.enabled);
      sendResponse({ enabled });
    } else if (message?.type === 'get-state') {
      refreshCourse().then(() => {
        refreshState();
        sendResponse({ enabled, active, language: layout?.name || null, course });
      });
    }
    return true;
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'duo.state' || event.key === null) void refreshCourse();
  });
  // Same-tab localStorage writes do not fire storage events.
  setInterval(refreshCourse, 1000);
  void refreshCourse();
})();
