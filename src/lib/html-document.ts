import { createRequire } from 'node:module';
export const { load } = createRequire(import.meta.url)('cheerio') as typeof import('cheerio');
