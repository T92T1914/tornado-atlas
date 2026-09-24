# Explorer browser checks

These checks run the checked-in catalogue and map in a separate headless browser.
They cover search, source selection, photographs, history, narrow layouts and
recovery from missing records or failed requests. They do not open a desktop
window or reuse a browser profile. External requests are blocked, so these checks
do not establish USGS availability or validate the historical source material.

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

Viewport emulation checks layout and interaction. It does not establish behavior
on physical phones, screen readers, Firefox or Safari. The ordinary Python and
Node suites remain separate checks in the publication workflow.
