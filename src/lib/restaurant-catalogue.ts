import type { CheerioAPI } from 'cheerio';
import { getCompanyById } from './promocodes';
import { catalogueUrls } from './source-catalog';
import { matchesMerchant } from './source-extraction';
import { validCouponToken } from './promo-quality';

/** Promokod.com's current template identifies the shop at page level. Only direct
 * rows in the named shop's primary list carry that ownership. */
export function normalizePromokodList($: CheerioAPI, url: string, companyId: number) {
  const rows = $('.coupon-wrap[data-code]:not([data-store-name])');
  if (!rows.length) return;
  const company = getCompanyById(companyId);
  const canonical = $('link[rel="canonical"]');
  const eligiblePage = company && catalogueUrls(companyId).includes(url)
    && canonical.length === 1 && canonical.attr('href') === url
    && $('main #couponList').length === 1 && matchesMerchant($('h1').first().text(), company);
  rows.each((index, element) => {
    const row = $(element);
    const title = row.find('> .coupon > .coupon-main > .coupon-title');
    const terms = row.find('> .coupon-detail > .detail-desc');
    const expiry = row.find('> .coupon .valid .v-full');
    if (!eligiblePage || index >= 200 || !row.is('#couponList > [data-cross-promo="0"][data-ctype="1"][data-action="0"]')
      || !validCouponToken(row.attr('data-code') ?? '') || title.length !== 1 || !title.text().trim()
      || terms.length !== 1 || !terms.text().trim() || expiry.length !== 1 || !expiry.text().trim()) {
      row.remove();
      return;
    }
    row.attr('data-store-name', company.name);
    row.attr('data-title', title.text().trim());
    // The shared parser validates this date and preserves both title and full conditions.
    row.attr('data-expires-at', expiry.text().trim().replace(/^Действует до\s+/i, ''));
  });
}
