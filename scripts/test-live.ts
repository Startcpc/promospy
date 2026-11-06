// Actual HTTP search. No fixtures, seeded codes or test network adapters.
import { searchMerchant } from '../src/lib/web-search';
import { getCompanyById } from '../src/lib/promocodes';
const ids = process.argv.slice(2).map(Number);
let failed = false;
for (const id of ids.length ? ids : [54,201]) {
  const company = getCompanyById(id);
  if (!company) throw new Error(`Неизвестный магазин: ${id}`);
  try {
    const report = await searchMerchant(company,AbortSignal.timeout(90000));
    console.log(JSON.stringify({company:company.name,read:report.pagesRead,codes:report.codes.map(code=>({code:code.code,status:code.status,sources:code.sources.map(source=>source.url)})),sources:report.sourceResults},null,2));
    if (!report.codes.length) failed = true;
  } catch (error) { console.error(company.name,error instanceof Error ? error.message : error); failed = true; }
}
if (failed) process.exitCode = 1;
