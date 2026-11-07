import test from 'node:test';
import assert from 'node:assert/strict';
import { browserRequestSignal } from '../src/lib/browser-request';

test('browser request timeout cancels a stalled request',async()=>{
  const parent = new AbortController(), request = browserRequestSignal(parent.signal,10);
  try {
    await new Promise<void>(resolve=>request.signal.addEventListener('abort',()=>resolve(),{once:true}));
    assert.equal(request.signal.aborted,true);assert.equal(parent.signal.aborted,false);
  } finally {request.dispose();}
});
test('navigation cancels the current request, including an already aborted navigation',()=>{
  const parent = new AbortController(), request = browserRequestSignal(parent.signal,1000);
  parent.abort();assert.equal(request.signal.aborted,true);request.dispose();
  const next = browserRequestSignal(parent.signal,1000);
  assert.equal(next.signal.aborted,true);next.dispose();
});
test('completed browser requests release their timeout and navigation listener',async()=>{
  const parent = new AbortController(), request = browserRequestSignal(parent.signal,10);
  request.dispose();parent.abort();
  await new Promise(resolve=>setTimeout(resolve,25));
  assert.equal(request.signal.aborted,false);
});
