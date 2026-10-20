(function () {
  const status = document.querySelector('#status');
  const toggle = document.querySelector('#toggle');
  let enabled = true;
  let language = null;
  let course = null;

  function render(active) {
    status.textContent = active
      ? `${language} mapping is ${enabled ? 'on' : 'off'}.`
      : language
        ? `${language} detected. Open a ${language} challenge to use its keyboard.`
        : course
          ? 'This course has no keyboard mapping. Supported: Esperanto from English.'
          : 'Open Duolingo with an Esperanto course from English.';
    toggle.textContent = enabled ? 'Turn off' : 'Turn on';
    toggle.disabled = !active;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return render(false);
    chrome.tabs.sendMessage(tab.id, { type: 'get-state' }, (response) => {
      if (chrome.runtime.lastError || !response) return render(false);
      enabled = response.enabled;
      language = response.language;
      course = response.course;
      render(response.active);
    });
  });

  toggle.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      enabled = !enabled;
      chrome.tabs.sendMessage(tab.id, { type: 'set-enabled', enabled }, (response) => {
        if (!chrome.runtime.lastError && response) enabled = response.enabled;
        render(true);
      });
    });
  });
})();
