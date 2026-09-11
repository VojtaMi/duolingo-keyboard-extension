# Duolingo Esperanto Keyboard

This local Chromium extension maps an English US QWERTY keyboard to Ubuntu's
Esperanto `epo(basic)` layout during Duolingo's **Write this in Esperanto**
challenges.

Mappings:

| English key | Esperanto |
| --- | --- |
| q / Q | ŝ / Ŝ |
| w / W | ĝ / Ĝ |
| y / Y | ŭ / Ŭ |
| [ / { | ĵ / Ĵ |
| ] / } | ĥ / Ĥ |
| x / X | ĉ / Ĉ |

## Install in Chromium

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Open or reload Duolingo.

The extension is enabled automatically when the Duolingo challenge header
`h1[data-test="challenge-header"]` contains `Esperanto`, the
`button[data-test="player-toggle-keyboard"]` (“Use keyboard” button) is
present, or an Esperanto special-character button (`ĉ`, `ĝ`, `ĥ`, `ĵ`, `ŝ`,
or `ŭ`) is visible. It also activates for the exact “Type the missing word” or
“Type the missing words” challenge heading.

Use the extension toolbar button to toggle it off temporarily.
