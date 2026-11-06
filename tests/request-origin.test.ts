import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedRequestOrigin, configuredPublicOrigin } from '../src/lib/request-origin';

test('accepts the browser authority behind a reverse proxy',()=>{
 assert.equal(allowedRequestOrigin('https://my-space-3000.app.github.dev','http://localhost:3000/api/scan/54','my-space-3000.app.github.dev'),true);
 assert.equal(allowedRequestOrigin('http://localhost:3000','http://localhost:3000/api','localhost:3000'),true);
 assert.equal(allowedRequestOrigin('https://promo.example','http://localhost:3000/api','localhost:3000','https://promo.example'),true);
 assert.equal(allowedRequestOrigin(null,'http://localhost:3000/api','localhost:3000'),true);
});
test('rejects unrelated and malformed origins instead of disabling the guard',()=>{
 for(const origin of ['https://evil.example','null','https://promo.example.evil.test','https://promo.example/path','https://user@promo.example','file:///tmp/a']) {
  assert.equal(allowedRequestOrigin(origin,'http://localhost:3000/api','promo.example','https://promo.example'),false,origin);
 }
 assert.equal(allowedRequestOrigin('https://evil.example','http://localhost:3000','promo.example,evil.example'),false);
});
test('Codespaces public URL is computed from environment, never arbitrary forwarded headers',()=>{
 const env={CODESPACE_NAME:'my-space',GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:'app.github.dev'};
 assert.equal(configuredPublicOrigin(env),'https://my-space-3000.app.github.dev');
 assert.equal(configuredPublicOrigin({...env,PROMO_PUBLIC_ORIGIN:'https://promo.example'}),'https://promo.example');
 assert.equal(configuredPublicOrigin({...env,CODESPACE_NAME:'evil/host'}),undefined);
});
