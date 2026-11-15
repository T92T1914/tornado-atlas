# GitHub publication

Repository: [T92T1914/tornado-atlas](https://github.com/T92T1914/tornado-atlas).

The public repository was created on September 20, 2026. GitHub Pages uses the repository's Actions workflow. Verification runs before deployment and publishes only `web/`. The workflow has read access to source content. Its deployment job adds the Pages and identity token permissions that GitHub Pages requires.

A deployment publishes only while its revision is still the head of `main`. On November 15, 2026 two merges landed 14 seconds apart, the older run finished its deployment last, and the site served the older `data.json` until the newer deployment ran again. The `pages` concurrency group runs one deployment at a time but takes them in arrival order. So `tools/pages_head.py` now reads the head of `main` inside the deployment job. When the head has moved on, the job logs both revisions, raises a warning on the run and skips publication, and the run for the newer head publishes.

Two limits remain. If the newer run fails its checks, neither run publishes, and the site keeps the revision before both until a later run passes. The group also holds only one waiting deployment, and a new arrival cancels the one already waiting. With three deployments close together, the newest can be cancelled by an older one that then skips, so nothing publishes the head. The warning names the head in that case, and its deployment job has to be run again. A skipped job also still appears as a `github-pages` deployment of its own revision on the Environments page, although Pages keeps serving the newer site.

The local checkout's existing Git credential manager supports Git transport. GitHub CLI authentication is not required for that push path. No new credentials were added to the repository.

Raw research downloads, the local SQLite database and output logs are excluded through `.gitignore`. Public browser bundles contain normalized NOAA records and event narratives, Natural Earth map geometry, the selected NWS geographic source, nine explicitly credited NOAA/NWS survey photographs, original procedural graphics, short original notes and public video references. Attribution and source hashes are included.

The first [verification and deployment run](https://github.com/T92T1914/tornado-atlas/actions/runs/35511588062) passed, and the hosted atlas, source detail, exhibit and wind laboratory were checked in the browser. See the [verification record](verification.md) for the inspection scope and remaining limits.
