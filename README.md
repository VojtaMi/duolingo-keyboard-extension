# Duolingo Adaptive Keyboard

This local Chromium extension maps a US English QWERTY keyboard to German or
Esperanto during Duolingo challenges. It detects your active course from the
gzip + base64 compressed `duo.state` in localStorage. Both courses must have
English as their base language. Unsupported courses leave your keys unchanged.

Esperanto uses Ubuntu's `epo(basic)` layout:

| English key | Esperanto |
| --- | --- |
| q / Q | ŝ / Ŝ |
| w / W | ĝ / Ĝ |
| y / Y | ŭ / Ŭ |
| [ / { | ĵ / Ĵ |
| ] / } | ĥ / Ĥ |
| x / X | ĉ / Ĉ |

German maps only its special characters:

| English key | German |
| --- | --- |
| [ / { | ü / Ü |
| ; / : | ö / Ö |
| ' / " | ä / Ä |
| - | ß |
| ] / } | ' / " |

Y/Z and all other keys keep their US English behavior. Characters are inserted
directly, without dead-key composition. Ctrl, Alt, and Meta shortcuts keep their
original behavior.

## Install in Chromium

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Open or reload Duolingo.

The extension checks for course changes once per second and before key presses,
and only decompresses state when the stored value changes. No extra extension
permissions are needed.

For a supported course, remapping activates when the Duolingo challenge header
`h1[data-test="challenge-header"]` contains the detected language name, the
`button[data-test="player-toggle-keyboard"]` (“Use keyboard” button) is
present, or a special-character button for that language is visible.
It also activates for the exact “Type the missing word”,
“Type the missing words”, or “Complete the sentence” challenge heading.
Headings explicitly asking for an answer in English disable remapping. Other
exercise detection remains heuristic, so use the toggle if an exercise expects
English without saying so in its heading.

Use the extension toolbar button to see the detected language and toggle
remapping off temporarily. After updating the extension, reload it at
`chrome://extensions` and reload your Duolingo tab.

Run the automated course detection and keyboard checks with
`node --test tests/content.test.cjs`.
