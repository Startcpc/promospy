/** Browser Origin is checked against the request authority or an explicit public URL.
 * Never accept an arbitrary forwarded-host header as an allowlist entry.
 */
export function allowedRequestOrigin(origin: string | null, requestUrl: string, host: string | null, publicOrigin?: string): boolean {
  if (origin === null) return true;
  try {
    const supplied = new URL(origin);
    if (!['http:', 'https:'].includes(supplied.protocol) || supplied.origin !== origin) return false;
    if (supplied.origin === new URL(requestUrl).origin) return true;
    if (host && supplied.host.toLowerCase() === host.toLowerCase() && !/[\s,/@\\]/.test(host)) return true;
    return !!publicOrigin && supplied.origin === new URL(publicOrigin).origin;
  } catch { return false; }
}
export function configuredPublicOrigin(env: Record<string,string | undefined> = process.env): string | undefined {
  if (env.PROMO_PUBLIC_ORIGIN) return env.PROMO_PUBLIC_ORIGIN;
  if (env.CODESPACE_NAME && env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN
    && /^[a-z\d-]+$/i.test(env.CODESPACE_NAME) && /^[a-z\d.-]+$/i.test(env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN)) {
    return `https://${env.CODESPACE_NAME}-3000.${env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`;
  }
}
