import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const executable=process.platform==='win32'?'python':'python3';
const result=spawnSync(executable,['-m','unittest','discover','-s','tests','-p','test_launcher.py','-v'],{cwd:fileURLToPath(new URL('../',import.meta.url)),stdio:'inherit'});
if(result.error)console.error(`Не удалось запустить ${executable}: ${result.error.message}`);
process.exitCode=result.status??1;
