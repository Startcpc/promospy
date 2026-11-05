import { getCompanyById } from "../src/lib/promocodes";
import { runFullScan } from "../src/lib/scan-engine";
const company = getCompanyById(Number(process.argv[2]));
if (!company) throw new Error("Укажите ID магазина из src/lib/companies.ts");
const result = await runFullScan(company, (entry) => console.log(entry.text), AbortSignal.timeout(7 * 60000));
console.log(JSON.stringify({ company: company.name, sourcesSucceeded: result.sourcesSucceeded, sourcesTotal: result.sourcesTotal,
  codes: result.codes.map((code) => ({ code: code.code, status: code.status, details: code.verificationDetails })) }, null, 2));
