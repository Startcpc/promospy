// Actual HTTP search. No fixtures, seeded codes or test network adapters.
import { searchMerchant } from '../src/lib/web-search';
import { effectiveStatus, getCompanyById } from '../src/lib/promocodes';
import { closeSourceDispatchers } from '../src/lib/fetch-policy';
const ids = process.argv.slice(2).map(Number);
let failed = false;
try { for (const id of ids.length ? ids : [54]) {
  const company = getCompanyById(id);
  if (!company) throw new Error(`Неизвестный магазин: ${id}`);
  try {
    const report = await searchMerchant(company,AbortSignal.timeout(90000));
    const now=Date.now();
    const active=report.codes.filter(code=>!['expired','rejected'].includes(effectiveStatus(code,now))&&(code.startsAt===undefined||code.startsAt<=now));
    console.log(JSON.stringify({company:company.name,read:report.pagesRead,active:active.length,archived:report.codes.length-active.length,codes:report.codes.map(code=>({code:code.code,status:code.status,description:code.description,conditions:code.conditions,minOrder:code.minOrder,expiresAt:code.expiresAt,sources:code.sources.map(source=>source.url)})),sources:report.sourceResults,discovery:report.discovery},null,2));
    if (!active.length) failed = true;
  } catch (error) { console.error(company.name,error instanceof Error ? error.message : error); failed = true; }
} } finally { await closeSourceDispatchers(); }
if (failed) process.exitCode = 1;
