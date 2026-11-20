// These browser scenarios intercept every external document request. Keep DNS
// isolated as well so the result is independent of the machine's resolver.
process.env.PROMO_DNS_MODE = 'google-doh';

export function fixtureDns(url) {
  if (url.origin === 'https://dns.google' && url.pathname === '/resolve') {
    return Response.json({Status: 0, Answer: [{type: 1, data: '93.184.216.34'}]});
  }
}
