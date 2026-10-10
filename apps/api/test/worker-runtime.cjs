const assert = require('node:assert/strict');
const { startWorkerLoop } = require('../dist/portal/worker-runtime');

const settled = () => new Promise(resolve => setImmediate(resolve));
const clock = () => {
  const pending = [];
  return {
    pending,
    schedule(task, delayMs) { const timer = { task, delayMs }; pending.push(timer); return timer; },
    cancel(timer) { const index = pending.indexOf(timer); if (index >= 0) pending.splice(index, 1); }
  };
};

(async () => {
  const scheduler = clock();
  const releases = [];
  let started = 0;
  const stop = startWorkerLoop(async () => {
    started++;
    await new Promise(resolve => releases.push(resolve));
  }, 1000, () => assert.fail('No failure expected'), scheduler);
  assert.equal(started, 1);
  assert.equal(scheduler.pending.length, 0, 'an active sweep cannot schedule an overlapping sweep');
  releases.shift()();
  await settled();
  assert.equal(scheduler.pending.length, 1);
  assert.equal(scheduler.pending[0].delayMs, 1000);
  scheduler.pending.shift().task();
  assert.equal(started, 2);
  assert.equal(scheduler.pending.length, 0);
  let stopped = false;
  const stopping = stop().then(() => { stopped = true; });
  await settled();
  assert.equal(stopped, false, 'shutdown waits for the current sweep');
  releases.shift()();
  await stopping;
  assert.equal(stopped, true);
  assert.equal(scheduler.pending.length, 0, 'shutdown does not schedule more work');

  const failures = [];
  const failureClock = clock();
  const stopFailureLoop = startWorkerLoop(async () => { throw new Error('provider secret in raw exception'); }, 1000, code => failures.push(code), failureClock);
  await settled();
  assert.deepEqual(failures, ['worker_run_failed']);
  assert.equal(JSON.stringify(failures).includes('provider secret'), false);
  assert.equal(failureClock.pending.length, 1, 'a failed sweep can retry after the interval');
  await stopFailureLoop();
  assert.equal(failureClock.pending.length, 0);
  console.log('Worker scheduling, shutdown, and bounded failure checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
