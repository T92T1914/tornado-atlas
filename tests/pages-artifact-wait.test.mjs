import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEADLINE_MS, backendIds, listArtifactNames, listRequest, main, waitForArtifact,
} from '../tools/pages_artifact_wait.mjs';

const RUN = 'ce7f54c7-61c7-4aae-887f-30da475f5f1a';
const JOB = 'ca395085-040a-526b-2ce8-bdc85f692774';

function jwt(claims) {
  const part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'none' })}.${part(claims)}.signature`;
}

const TOKEN = jwt({ scp: `Actions.ExampleScope Actions.Results:${RUN}:${JOB}` });

// A clock that moves only when the wait sleeps, so every bound is exact.
function clock() {
  let time = 0;
  const slept = [];
  return {
    now: () => time,
    sleep: async ms => { slept.push(ms); time += ms; },
    slept,
  };
}

function answers(...replies) {
  const calls = [];
  return {
    calls,
    list: async () => {
      const reply = replies[Math.min(calls.length, replies.length - 1)];
      calls.push(reply);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
}

test('the backend ids come from the Actions.Results scope of the runtime token', () => {
  assert.deepEqual(backendIds(TOKEN), { workflow_run_backend_id: RUN, workflow_job_run_backend_id: JOB });
  assert.throws(() => backendIds('not a token'), /not a JWT/);
  assert.throws(() => backendIds(jwt({ scp: 'Actions.ExampleScope' })), /no Actions\.Results scope/);
  assert.throws(() => backendIds(jwt({ scp: `Actions.Results:${RUN}` })), /no Actions\.Results scope/);
});

test('the request is the ListArtifacts call deploy-pages makes, on the results origin', () => {
  const { url, init } = listRequest({ resultsUrl: 'https://results.example.test/some/path/', token: TOKEN });
  assert.equal(url, 'https://results.example.test/twirp/github.actions.results.api.v1.ArtifactService/ListArtifacts');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(init.body), { workflow_run_backend_id: RUN, workflow_job_run_backend_id: JOB });
  assert.throws(() => listRequest({ resultsUrl: '', token: TOKEN }), /ACTIONS_RESULTS_URL/);
});

test('the listing reads artifact names and refuses an answer it cannot read', async () => {
  const request = listRequest({ resultsUrl: 'https://results.example.test', token: TOKEN });
  const reply = (status, body) => async () => ({ ok: status === 200, status, json: async () => body });
  assert.deepEqual(await listArtifactNames(request, reply(200, { artifacts: [{ name: 'github-pages-1', size: '1' }, { name: 'github-pages-2' }] })),
    ['github-pages-1', 'github-pages-2']);
  await assert.rejects(listArtifactNames(request, reply(401, {})), /HTTP 401/);
  // Protobuf JSON leaves an empty list out.
  assert.deepEqual(await listArtifactNames(request, reply(200, {})), []);
  await assert.rejects(listArtifactNames(request, reply(200, { artifacts: 'none' })), /not a list/);
  await assert.rejects(listArtifactNames(request, reply(200, null)), /without a JSON object/);
});

test('every request carries its own timeout so a slow answer cannot outlast the wait', async () => {
  const request = listRequest({ resultsUrl: 'https://results.example.test', token: TOKEN });
  const stalled = (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  const started = performance.now();
  await assert.rejects(listArtifactNames(request, stalled, 50), error => error.name === 'TimeoutError');
  assert.ok(performance.now() - started < 2_000);
});

test('the race of 2026-11-25 waits for the new artifact instead of failing', async () => {
  // Attempt 1 listed nothing and attempt 2 listed only the artifact of attempt 1.
  const time = clock();
  const service = answers([], ['github-pages-1'], ['github-pages-1', 'github-pages-2']);
  const result = await waitForArtifact({ name: 'github-pages-2', list: service.list, ...time });
  assert.deepEqual(result, { requests: 3, waitedMs: 1_500 });
  assert.deepEqual(time.slept, [500, 1_000]);
});

test('an artifact listed at once costs no wait', async () => {
  const time = clock();
  const result = await waitForArtifact({ name: 'github-pages-1', list: answers(['github-pages-1']).list, ...time });
  assert.deepEqual(result, { requests: 1, waitedMs: 0 });
  assert.deepEqual(time.slept, []);
});

test('the wait ends at its deadline and names the artifact it never saw', async () => {
  const time = clock();
  const service = answers(['github-pages-1']);
  await assert.rejects(waitForArtifact({ name: 'github-pages-2', list: service.list, ...time }),
    /github-pages-2 was not listed after \d+ request\(s\) in 60000 ms$/);
  assert.equal(time.now(), DEADLINE_MS);
  assert.ok(time.slept.every(ms => ms <= 5_000));
  assert.equal(service.calls.length, time.slept.length + 1);
});

test('a schedule that could never reach its deadline is refused before any request', async () => {
  for (const options of [{ pauses: [] }, { pauses: [0] }, { deadlineMs: 0 }, { deadlineMs: Number.NaN }]) {
    const service = answers(['github-pages-1']);
    await assert.rejects(waitForArtifact({ name: 'github-pages-2', list: service.list, ...clock(), ...options }),
      /positive deadline and positive pauses/);
    assert.equal(service.calls.length, 0);
  }
});

test('failed requests are asked again and the last failure is named at the deadline', async () => {
  const time = clock();
  const recovers = answers(new Error('ListArtifacts answered HTTP 503'), ['github-pages-1']);
  assert.deepEqual(await waitForArtifact({ name: 'github-pages-1', list: recovers.list, ...time }), { requests: 2, waitedMs: 500 });

  const never = answers(new Error('ListArtifacts answered HTTP 503'));
  await assert.rejects(waitForArtifact({ name: 'github-pages-1', list: never.list, ...clock(), deadlineMs: 3_000 }),
    /last request failed: ListArtifacts answered HTTP 503/);
});

test('two artifacts of the same name stop the job, as deploy-pages would', async () => {
  const service = answers(['github-pages-1', 'github-pages-1']);
  await assert.rejects(waitForArtifact({ name: 'github-pages-1', list: service.list, ...clock() }),
    /2 artifacts are named github-pages-1/);
  assert.equal(service.calls.length, 1);
});

function step(env, replies) {
  const lines = [];
  const failures = [];
  const core = { info: line => lines.push(line), setFailed: message => failures.push(message) };
  const sent = [];
  const fetchImpl = async (url, init) => {
    sent.push({ url, init });
    const body = replies[Math.min(sent.length - 1, replies.length - 1)];
    return { ok: true, status: 200, json: async () => ({ artifacts: body.map(name => ({ name })) }) };
  };
  const time = clock();
  return { lines, failures, sent, run: () => main(env, core, { fetchImpl, sleep: time.sleep, now: time.now }) };
}

const ENV = { ATLAS_PAGES_ARTIFACT: 'github-pages-2', ACTIONS_RESULTS_URL: 'https://results.example.test/', ACTIONS_RUNTIME_TOKEN: TOKEN };

test('the step reports a listed artifact on one line and fails nothing', async () => {
  const s = step(ENV, [['github-pages-1'], ['github-pages-1', 'github-pages-2']]);
  assert.deepEqual(await s.run(), { requests: 2, waitedMs: 500 });
  assert.deepEqual(s.failures, []);
  assert.equal(s.lines.at(-1), 'ATLAS_PAGES_ARTIFACT name=github-pages-2 listed=true requests=2 waited_ms=500');
  assert.equal(s.sent.length, 2);
  assert.ok(s.lines.every(line => !line.includes(TOKEN)));
});

test('the step fails the job with a reason when the wait runs out', async () => {
  const s = step(ENV, [['github-pages-1']]);
  assert.equal(await s.run(), null);
  assert.equal(s.failures.length, 1);
  assert.match(s.failures[0], /^The run does not list github-pages-2, so the site was not deployed: github-pages-2 was not listed/);
  assert.match(s.lines.at(-1), /^ATLAS_PAGES_ARTIFACT name=github-pages-2 listed=false error=/);
});

test('a missing name, URL or token fails at once without a request', async () => {
  for (const [key, value, reason] of [
    ['ATLAS_PAGES_ARTIFACT', '', /ATLAS_PAGES_ARTIFACT is not set/],
    ['ACTIONS_RESULTS_URL', undefined, /ACTIONS_RESULTS_URL is not set/],
    ['ACTIONS_RUNTIME_TOKEN', 'broken', /not a JWT/],
  ]) {
    const s = step({ ...ENV, [key]: value }, [['github-pages-2']]);
    assert.equal(await s.run(), null);
    assert.equal(s.sent.length, 0, key);
    assert.match(s.failures[0], reason);
  }
});
