(function () {
  const status = document.querySelector('#status');
  const toggle = document.querySelector('#toggle');
  let enabled = true;

  function render(active) {
    status.textContent = active
      ? `Esperanto mapping is ${enabled ? 'on' : 'off'}.`
      : 'Open a “Write this in Esperanto” Duolingo challenge.';
    toggle.textContent = enabled ? 'Turn off' : 'Turn on';
    toggle.disabled = !active;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return render(false);
    chrome.tabs.sendMessage(tab.id, { type: 'get-state' }, (response) => {
      if (chrome.runtime.lastError || !response) return render(false);
      enabled = response.enabled;
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
