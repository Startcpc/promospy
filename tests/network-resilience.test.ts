import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DomainScheduler, HttpPageError, retryAfterMilliseconds, resilientRequest,
} from '../src/lib/network-resilience';
import { looksLikeClientRenderedShell } from '../src/lib/browser-render';
import { applyGroundedModelAnswer, enrichLiteralTerms } from '../src/lib/promo-nlp';
import type { PromoCode } from '../src/lib/promocodes';

const offer: PromoCode = {
  id: '54:HELLO', companyId: 54, code: 'HELLO',
  description: 'Скидка для первого заказа от 1000 рублей до 30.11.2026',
  discount: 'По условиям акции', status: 'found',
  found: Date.UTC(2026, 9, 1), sources: [
    { url: 'https://vkusvill.ru/promocodes/', name: 'vkusvill.ru', seenAt: Date.UTC(2026, 9, 1) },
  ], conditions: [],
};

test('token bucket serializes same-host work and releases on error', async () => {
  const scheduler = new DomainScheduler({ maxConcurrent: 1, capacity: 10, refillPerSecond: 100 });
  let concurrent = 0, peak = 0;
  const tasks = Array.from({length: 5}, (_, index) => scheduler.run(
    'example.test', new AbortController().signal, async () => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise(resolve => setTimeout(resolve, 5));
      concurrent--;
      if (index === 2) throw Error('expected');
      return index;
    },
  ).catch(error => error instanceof Error ? error.message : 'unknown'));
  assert.deepEqual(await Promise.all(tasks), [0, 1, 'expected', 3, 4]);
  assert.equal(peak, 1);
});

test('queue cancellation rejects without acquiring a slot', async () => {
  const scheduler = new DomainScheduler({ maxConcurrent: 1, capacity: 1, refillPerSecond: 100 });
  let finish!: () => void;
  const first = scheduler.run('example.test', new AbortController().signal,
    () => new Promise<void>(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const waiting = scheduler.run('example.test', controller.signal, async () => 99);
  controller.abort(new Error('cancelled'));
  await assert.rejects(waiting, /cancelled/);
  finish();
  await first;
  assert.equal(await scheduler.run('example.test', new AbortController().signal, async () => 10), 10);
});

test('honors numeric and HTTP date Retry-After with bounded values', () => {
  assert.equal(retryAfterMilliseconds('2'), 2000);
  assert.equal(retryAfterMilliseconds('999999'), 86_400_000);
  assert.equal(retryAfterMilliseconds('Wed, 21 Oct 2026 07:28:00 GMT', Date.UTC(2026, 9, 21, 7, 27, 0)), 60_000);
  assert.equal(retryAfterMilliseconds('no'), undefined);
});

test('429 retries, 403 and 404 fail without retry', async () => {
  const scheduler = new DomainScheduler({ maxConcurrent: 2, capacity: 5, refillPerSecond: 1000 });
  let calls = 0;
  const value = await resilientRequest('example.test', new AbortController().signal,
    async () => { calls++; if (calls < 3) throw new HttpPageError(429); return 'ok'; },
    scheduler, { baseDelayMs: 1 });
  assert.equal(value, 'ok');
  assert.equal(calls, 3);
  for (const status of [401, 403, 404]) {
    calls = 0;
    await assert.rejects(resilientRequest('other.test', new AbortController().signal,
      async () => { calls++; throw new HttpPageError(status); }, scheduler), { status });
    assert.equal(calls, 1);
  }
});

test('successful empty app shells are eligible for opt-in rendering', () => {
  assert.equal(looksLikeClientRenderedShell('<html><div id="__next"></div><script src="/app.js"></script></html>'), true);
  assert.equal(looksLikeClientRenderedShell('<html><article>Купон</article></html>'), false);
});

test('literal extraction never replaces an existing code and uses source dates', () => {
  const result = enrichLiteralTerms(offer, Date.UTC(2026, 9, 1));
  assert.equal(result.code, 'HELLO');
  assert.equal(result.minOrder, 1000);
  assert.equal(new Date(result.expiresAt!).toISOString(), '2026-11-30T20:59:59.999Z');
});

test('model output must contain exact evidence spans, never invents a code', () => {
  const result = applyGroundedModelAnswer(offer, {
    code: 'FAKE999',
    evidencePhrases: ['первого заказа', 'несуществующее условие'],
    expiryLiteral: '30.11.2026',
    minimumLiteral: '1000',
  });
  assert.equal(result.code, offer.code);
  assert.deepEqual(result.conditions, ['первого заказа']);
  assert.equal(result.minOrder, 1000);
  assert.equal(new Date(result.expiresAt!).toISOString(), '2026-11-30T20:59:59.999Z');
});
