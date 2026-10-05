# Explorer browser checks

These checks run the checked-in catalogue and map in a separate headless browser.
They cover search, source selection, photographs, history, narrow layouts and
recovery from missing records or failed requests. They do not open a desktop
window or reuse a browser profile. External requests are blocked, so these checks
do not establish USGS availability or validate the historical source material.

The spatial replay checks also exercise recorded observer selection, shared
clock behavior, gaps, layer switching and separation from original footage.
`replay-camera.test.mjs` covers both appearances at desktop and narrow widths.
Set `ATLAS_SCREENSHOT_DIR` to an evidence directory outside the repository to
retain its four rendered-page captures. These captures show only the owned
headless fixture and do not inspect the desktop.

Install the pinned test dependencies and Chromium, then run the suite:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
```

If a compatible Chromium browser is already installed, set
`ATLAS_BROWSER_EXECUTABLE` to its executable path and omit the browser download.
The suite still launches its own headless process and temporary contexts. It
uses one browser at a time, binds its temporary server to loopback and closes
both when finished. No clipboard, microphone, camera or audio access is needed.

CI sets `ATLAS_BROWSER_CHANNEL=chrome` to use the hosted runner's installed
Chrome. Ubuntu's AppArmor profile permits that installation to use its sandbox.
Downloaded developer builds can fail before the tests begin under Ubuntu's
user-namespace restrictions. The suite keeps Chromium sandboxing enabled and
prints the actual browser version. See the
[Chromium sandbox explanation](https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md).

The same suite can run in Firefox and WebKit with `ATLAS_BROWSER_ENGINE=firefox`
or `ATLAS_BROWSER_ENGINE=webkit`, after installing the matching pinned Playwright
test browser. The hosted workflow exercises all three engines sequentially.
Firefox uses a narrow viewport and touch input without Playwright's unsupported
mobile viewport mode. Chromium-only CDP gestures and font-provider checks remain
separate and are skipped on the other engines.

These are isolated webpage checks. They do not establish physical-phone,
spoken-screen-reader, branded Safari or native browser-theme acceptance. The
ordinary Python and Node suites remain separate checks in the workflow. Local
launch failures must remain failures or unavailable results, even if hosted
checks subsequently succeed.

Typography checks retain selected source records and narrow keyboard controls.
Set `ATLAS_REQUIRE_INTER=1` in a controlled Chrome environment with Inter installed
to require positive glyph evidence for all six faces. Controlled specimens and
ordinary interface elements are recorded separately. The fallback check is
independent. This does not establish native client acceptance or font persistence.
