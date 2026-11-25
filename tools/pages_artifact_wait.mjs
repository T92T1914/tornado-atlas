// Hold the Pages deployment until this run lists the artifact it just uploaded.
//
// `actions/deploy-pages` asks the artifact service for the run's artifacts once
// and stops when the name it was given is missing. On 2026-11-25 run 45517063042
// finalized `github-pages-1` 0.44 s before that request and `github-pages-2`
// 0.69 s before it, and both requests came back without the new artifact, so
// `main` verified and never deployed. This module asks the same service the
// same question until the name is listed, within a bounded wait, and fails the
// job when it never is. It does not deploy and it does not retry a deployment.
//
// It runs inside `actions/github-script`, a JavaScript action, because only
// actions receive `ACTIONS_RUNTIME_TOKEN` and `ACTIONS_RESULTS_URL`. The request
// mirrors `listArtifacts` in `@actions/artifact`, which `deploy-pages` calls.

const SERVICE = 'github.actions.results.api.v1.ArtifactService';
export const DEADLINE_MS = 60_000;
export const PAUSES_MS = [500, 1_000, 2_000, 4_000, 5_000];
export const REQUEST_TIMEOUT_MS = 10_000;

/** The run and job ids the artifact service expects, read from the runtime token's scope claim. */
export function backendIds(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('ACTIONS_RUNTIME_TOKEN is not a JWT');
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('ACTIONS_RUNTIME_TOKEN has an unreadable payload');
  }
  for (const scope of String(claims.scp || '').split(' ')) {
    const fields = scope.split(':');
    if (fields[0] !== 'Actions.Results') continue;
    if (fields.length !== 3 || !fields[1] || !fields[2]) break;
    return { workflow_run_backend_id: fields[1], workflow_job_run_backend_id: fields[2] };
  }
  throw new Error('ACTIONS_RUNTIME_TOKEN carries no Actions.Results scope');
}

/** The request `listArtifacts` sends: URL, headers and JSON body. */
export function listRequest({ resultsUrl, token }) {
  if (!resultsUrl) throw new Error('ACTIONS_RESULTS_URL is not set');
  return {
    url: new URL(`/twirp/${SERVICE}/ListArtifacts`, new URL(resultsUrl).origin).href,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(backendIds(token)),
    },
  };
}

/**
 * Names of the artifacts the service lists for this run, for a request built by `listRequest`.
 * Each request gives up after `timeoutMs`, so one slow answer cannot outlast the wait.
 */
export async function listArtifactNames({ url, init }, fetchImpl = fetch, timeoutMs = REQUEST_TIMEOUT_MS) {
  const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`ListArtifacts answered HTTP ${response.status}`);
  const body = await response.json();
  if (body === null || typeof body !== 'object') throw new Error('ListArtifacts answered without a JSON object');
  // Protobuf JSON leaves an empty list out, so a run with no artifacts may answer {}.
  const artifacts = body.artifacts ?? [];
  if (!Array.isArray(artifacts)) throw new Error('ListArtifacts answered an artifacts field that is not a list');
  return artifacts.map(artifact => artifact?.name);
}

/**
 * Ask `list` until it names `name` exactly once.
 *
 * Resolves with the number of requests and the time spent. Rejects when the
 * name is listed more than once, which `deploy-pages` also refuses, or when
 * `deadlineMs` passes. A failed request counts as not listed yet and is asked
 * again, and its error is named if the wait runs out.
 */
export async function waitForArtifact({ name, list, sleep, now, deadlineMs = DEADLINE_MS, pauses = PAUSES_MS, log = () => {} }) {
  if (!name) throw new Error('no artifact name to wait for');
  if (!(deadlineMs > 0) || !pauses.length || !pauses.every(ms => ms > 0)) {
    throw new Error('the wait needs a positive deadline and positive pauses');
  }
  const start = now();
  let requests = 0;
  let lastError = null;
  for (;;) {
    requests += 1;
    let count = 0;
    try {
      const names = await list();
      count = names.filter(listed => listed === name).length;
      lastError = null;
      log(`request ${requests}: ${names.length} artifact(s), ${count} named ${name}`);
    } catch (error) {
      lastError = error;
      log(`request ${requests}: ${error.message}`);
    }
    if (count === 1) return { requests, waitedMs: Math.round(now() - start) };
    if (count > 1) throw new Error(`${count} artifacts are named ${name}, and deploy-pages accepts exactly one`);
    const pause = pauses[Math.min(requests - 1, pauses.length - 1)];
    const left = deadlineMs - (now() - start);
    if (left <= 0) {
      const reason = lastError ? `, last request failed: ${lastError.message}` : '';
      throw new Error(`${name} was not listed after ${requests} request(s) in ${Math.round(now() - start)} ms${reason}`);
    }
    await sleep(Math.min(pause, left));
  }
}

/**
 * Entry point for the workflow step. A missing name, URL or token fails at once,
 * since waiting cannot repair it. Only the service's answers are waited on.
 */
export async function main(env, core, { fetchImpl = fetch, sleep, now = () => performance.now() } = {}) {
  const name = env.ATLAS_PAGES_ARTIFACT || '(unset)';
  try {
    if (!env.ATLAS_PAGES_ARTIFACT) throw new Error('ATLAS_PAGES_ARTIFACT is not set');
    const request = listRequest({ resultsUrl: env.ACTIONS_RESULTS_URL, token: env.ACTIONS_RUNTIME_TOKEN });
    const result = await waitForArtifact({
      name,
      list: () => listArtifactNames(request, fetchImpl),
      sleep: sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))),
      now,
      log: line => core.info(line),
    });
    core.info(`ATLAS_PAGES_ARTIFACT name=${name} listed=true requests=${result.requests} waited_ms=${result.waitedMs}`);
    return result;
  } catch (error) {
    core.info(`ATLAS_PAGES_ARTIFACT name=${name} listed=false error=${error.message}`);
    core.setFailed(`The run does not list ${name}, so the site was not deployed: ${error.message}`);
    return null;
  }
}
