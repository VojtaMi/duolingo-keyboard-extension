(function () {
  'use strict';

  const HEADER_SELECTOR = 'h1[data-test="challenge-header"]';
  const KEYBOARD_BUTTON_SELECTOR = 'button[data-test="player-toggle-keyboard"]';
  const ESPERANTO_CHARACTERS = /[ĉĝĥĵŝŭ]/i;
  const ACTIVE_HEADER = /esperanto|^type the missing words?$|^complete the sentence$/i;

  // Ubuntu's xkb Esperanto "basic" layout on a US QWERTY keyboard.
  const KEY_MAP = new Map([
    ['q', 'ŝ'], ['Q', 'Ŝ'],
    ['w', 'ĝ'], ['W', 'Ĝ'],
    ['y', 'ŭ'], ['Y', 'Ŭ'],
    ['[', 'ĵ'], ['{', 'Ĵ'],
    [']', 'ĥ'], ['}', 'Ĥ'],
    ['x', 'ĉ'], ['X', 'Ĉ']
  ]);

  let enabled = true;
  let active = false;

  function challengeIsActive() {
    const header = document.querySelector(HEADER_SELECTOR);
    const hasEsperantoCharacterButton = [...document.querySelectorAll('button')]
      .some((button) => ESPERANTO_CHARACTERS.test(button.textContent));
    return Boolean(
      (header && ACTIVE_HEADER.test(header.textContent.trim())) ||
      document.querySelector(KEYBOARD_BUTTON_SELECTOR) ||
      hasEsperantoCharacterButton
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
    event.target.dispatchEvent(translated);
  }

  document.addEventListener('keydown', (event) => {
    refreshState();
    if (!enabled || !active || event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const character = KEY_MAP.get(event.key);
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
      // Esperanto character instead.
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
      refreshState();
      sendResponse({ enabled, active });
    }
    return true;
  });

  refreshState();
})();
