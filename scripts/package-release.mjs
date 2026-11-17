import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--untracked-files=normal')) {
  throw new Error('Сначала сохраните изменения коммитом. ZIP должен соответствовать одному коммиту.');
}
const metadata = JSON.parse(git('show', 'HEAD:package.json'));
const destination = path.resolve(root, process.argv[2] ?? `work/promospy-${metadata.version}.zip`);
if (path.extname(destination).toLowerCase() !== '.zip') throw new Error('Укажите путь с расширением .zip');
mkdirSync(path.dirname(destination), { recursive: true });
const commit = git('rev-parse', 'HEAD');
execFileSync('git', ['archive', '--format=zip', '--prefix=promospy/', `--output=${destination}`, commit], { cwd: root });
const checksum = createHash('sha256').update(readFileSync(destination)).digest('hex');
writeFileSync(`${destination}.sha256`, `${checksum}  ${path.basename(destination)}\n`);
console.log(JSON.stringify({ archive: destination, commit, sha256: checksum }, null, 2));
