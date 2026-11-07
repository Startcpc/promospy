#!/usr/bin/env python3
"""Local PromoSpy launcher: Python stdlib only, no GitHub/Git requirement."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import platform
import shutil
import socket
import ssl
import subprocess
import sys
import tarfile
import threading
import time
import urllib.request
import webbrowser
import zipfile
import uuid

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / '.runtime'
NODE_VERSION = '22.23.4'
PNPM_VERSION = '11.25.0'


def run(command, env):
    subprocess.run([str(part) for part in command], cwd=ROOT, env=env, check=True)


def npm_cli(node):
    candidates = [node.parent / 'node_modules/npm/bin/npm-cli.js',
                  node.parent.parent / 'lib/node_modules/npm/bin/npm-cli.js',
                  Path('/usr/share/nodejs/npm/bin/npm-cli.js')]
    found = shutil.which('npm')
    if found and Path(found).resolve().suffix == '.js':
        candidates.append(Path(found).resolve())
    return next((item for item in candidates if item.is_file()), None)


def system_node():
    candidate = shutil.which('node')
    if not candidate:
        return None
    try:
        version = subprocess.check_output([candidate, '--version'], text=True, stderr=subprocess.DEVNULL, timeout=10).strip()
        if tuple(map(int, version.lstrip('v').split('.')[:2])) < (22, 18):
            return None
        node = Path(subprocess.check_output([candidate, '-p', 'process.execPath'], text=True, stderr=subprocess.DEVNULL, timeout=10).strip()).resolve()
        cli = npm_cli(node)
        if not cli:
            return None
        subprocess.check_output([str(node), str(cli), '--version'], stderr=subprocess.DEVNULL, timeout=10)
        return node
    except (OSError, ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None


def download(url, destination):
    context = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE'))
    if platform.system() == 'Darwin' and not context.get_ca_certs():
        # Some python.org Mac installs omit a CA bundle. Use macOS public roots
        # rather than asking the user to install packages or disabling TLS.
        roots = subprocess.check_output(['/usr/bin/security', 'find-certificate', '-a', '-p',
                                         '/System/Library/Keychains/SystemRootCertificates.keychain'], text=True)
        context.load_verify_locations(cadata=roots)
    with urllib.request.urlopen(url, timeout=60, context=context) as response, destination.open('wb') as output:
        shutil.copyfileobj(response, output)


def portable_node():
    systems = {'Windows': 'win', 'Linux': 'linux', 'Darwin': 'darwin'}
    architectures = {'amd64': 'x64', 'x86_64': 'x64', 'arm64': 'arm64', 'aarch64': 'arm64'}
    system, arch = systems.get(platform.system()), architectures.get(platform.machine().lower())
    if not system or not arch:
        raise RuntimeError('Для этой системы установите Node.js 22.18+ с nodejs.org и запустите снова.')
    name = f'node-v{NODE_VERSION}-{system}-{arch}'
    suffix = '.zip' if system == 'win' else '.tar.xz'
    node = RUNTIME / name / ('node.exe' if system == 'win' else 'bin/node')
    if node.is_file() and npm_cli(node) and (RUNTIME / name / '.complete').is_file():
        return node
    RUNTIME.mkdir(exist_ok=True)
    archive, checksums = RUNTIME / (name + suffix), RUNTIME / 'SHASUMS256.txt'
    base = f'https://nodejs.org/dist/v{NODE_VERSION}/'
    print('Загружаем переносимый Node.js с nodejs.org. Установка в систему не нужна.', flush=True)
    try:
        download(base + 'SHASUMS256.txt', checksums)
        expected = {}
        for line in checksums.read_text(encoding='utf-8').splitlines():
            parts = line.split()
            if len(parts) == 2 and len(parts[0]) == 64 and all(c in '0123456789abcdefABCDEF' for c in parts[0]):
                expected[parts[1].lstrip('*')] = parts[0].lower()
        checksum = expected.get(archive.name)
        if not checksum:
            raise RuntimeError('Официальная контрольная сумма архива не найдена.')
        download(base + archive.name, archive)
        digest = hashlib.sha256()
        with archive.open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
        if digest.hexdigest() != checksum:
            raise RuntimeError('Не совпала контрольная сумма Node.js. Повторите запуск.')
        def target(member_name):
            parts = PurePosixPath(member_name).parts
            if not parts or parts[0] != name or '..' in parts or '\\' in member_name or ':' in member_name:
                raise RuntimeError('Некорректный путь внутри архива Node.js.')
            return RUNTIME.joinpath(*parts)
        if suffix == '.zip':
            with zipfile.ZipFile(archive) as source:
                for member in source.infolist():
                    output = target(member.filename)
                    if member.is_dir():
                        output.mkdir(parents=True, exist_ok=True)
                    else:
                        output.parent.mkdir(parents=True, exist_ok=True)
                        with source.open(member) as data, output.open('wb') as dest:
                            shutil.copyfileobj(data, dest)
        else:
            with tarfile.open(archive) as source:
                for member in source:
                    output = target(member.name)
                    if member.isdir():
                        output.mkdir(parents=True, exist_ok=True)
                    elif member.isfile():
                        output.parent.mkdir(parents=True, exist_ok=True)
                        with source.extractfile(member) as data, output.open('wb') as dest:
                            shutil.copyfileobj(data, dest)
                        output.chmod(member.mode & 0o755)
                    # No archive symlinks: npm is invoked through its actual JS file.
        if not node.is_file() or not npm_cli(node):
            raise RuntimeError('Не удалось распаковать Node.js и npm.')
        (RUNTIME / name / '.complete').touch()
        return node
    finally:
        archive.unlink(missing_ok=True)
        checksums.unlink(missing_ok=True)


def fingerprint(files):
    digest = hashlib.sha256()
    for file in sorted(files):
        digest.update(str(file.relative_to(ROOT)).encode())
        digest.update(file.read_bytes())
    return digest.hexdigest()


def load_state(filename):
    try:
        value = json.loads(filename.read_text(encoding='utf-8'))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def save_state(filename, state):
    temporary = filename.with_name(filename.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        temporary.write_text(json.dumps(state), encoding='utf-8')
        temporary.replace(filename)
    finally:
        temporary.unlink(missing_ok=True)


def prepare_runtime(node, dev):
    node = node or portable_node()
    env = os.environ.copy()
    env['PATH'] = str(node.parent) + os.pathsep + env.get('PATH', '')
    env['npm_config_cache'] = str(RUNTIME / 'npm-cache')
    env['PNPM_HOME'] = str(RUNTIME / 'pnpm')
    env['XDG_CACHE_HOME'] = str(RUNTIME / 'cache')
    env['XDG_STATE_HOME'] = str(RUNTIME / 'state')
    pm = [node, npm_cli(node), 'exec', '--yes', f'--package=pnpm@{PNPM_VERSION}', '--', 'pnpm']
    RUNTIME.mkdir(exist_ok=True)
    state_path = RUNTIME / 'state.json'
    state = load_state(state_path)
    node_version = subprocess.check_output([str(node), '--version'], text=True).strip().split('.')[0]
    target_platform = f'{platform.system()}-{platform.machine().lower()}-{node_version}'
    project_path = str(ROOT.resolve())
    platform_changed = bool(state) and (state.get('platform') != target_platform or state.get('projectRoot') != project_path)
    if state.get('platform') != target_platform or state.get('projectRoot') != project_path:
        state = {'platform': target_platform, 'projectRoot': project_path}
    dependencies = fingerprint([ROOT / name for name in ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc')])
    if state.get('dependencies') != dependencies or not (ROOT / 'node_modules/next/package.json').exists():
        print('Подготавливаем зависимости. При повторном запуске этот шаг пропускается.', flush=True)
        run(pm + ['install', '--frozen-lockfile', '--store-dir', str(ROOT / '.pnpm-store')] + (['--force'] if platform_changed else []), env)
        state['dependencies'] = dependencies
        state.pop('build', None)
        save_state(state_path,state)
    sources = [file for folder in ('src', 'public', 'scripts') for file in (ROOT / folder).rglob('*') if file.is_file()]
    sources += [ROOT / name for name in ('package.json', 'pnpm-lock.yaml', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs')]
    build = fingerprint(sources)
    if not dev and (state.get('build') != build or not (ROOT / '.next/standalone/server.js').exists()):
        print('Собираем сайт. Следующий запуск будет быстрее.', flush=True)
        run(pm + ['run', 'build'], env)
        state['build'] = build
        save_state(state_path,state)
    return node, env


def main():
    parser = argparse.ArgumentParser(description='Локальный запуск PromoSpy без GitHub.')
    parser.add_argument('--check', action='store_true', help='проверить окружение без установки')
    parser.add_argument('--no-browser', action='store_true')
    parser.add_argument('--dev', action='store_true', help='режим редактирования с обновлением страницы')
    parser.add_argument('--port', type=int, default=3000)
    args = parser.parse_args()
    node = system_node()
    if args.check:
        print(f'Node.js: {node or "будет загружен в .runtime при первом запуске"}')
        print('Git и GitHub для работы приложения не нужны. Первый запуск требует интернет.')
        return
    if not 1 <= args.port <= 65535:
        parser.error('Порт должен быть от 1 до 65535.')
    port = args.port
    # Reserve the port before installing/building: a second launch must not
    # overwrite the files used by an already running server.
    with socket.socket() as reservation:
        try:
            if hasattr(socket, 'SO_EXCLUSIVEADDRUSE'):
                reservation.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            else:
                reservation.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            reservation.bind(('127.0.0.1', port))
            reservation.listen(1)
        except OSError:
            raise RuntimeError(f'Порт {port} занят. Остановите другой сервер или запустите: python3 start.py --port 3001')
        node, env = prepare_runtime(node,args.dev)
    env.update(PORT=str(port), HOSTNAME='127.0.0.1')
    url = f'http://localhost:{port}'
    command = [node, ROOT / 'node_modules/next/dist/bin/next', 'dev', '--webpack', '-p', str(port)] if args.dev else [node, ROOT / 'scripts/start.mjs']
    print(f'PromoSpy: {url}\nОстановить: Ctrl+C', flush=True)
    server = subprocess.Popen([str(part) for part in command], cwd=ROOT, env=env)
    def open_when_ready():
        for _ in range(120):
            if server.poll() is not None:
                return
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=0.5):
                    webbrowser.open(url)
                    return
            except OSError:
                time.sleep(0.5)
    if not args.no_browser:
        threading.Thread(target=open_when_ready, daemon=True).start()
    try:
        code = server.wait()
        if code:
            raise RuntimeError(f'Сервер завершился с кодом {code}. Смотрите сообщение выше.')
    finally:
        if server.poll() is None:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nPromoSpy остановлен.')
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Не удалось запустить PromoSpy: {error}', file=sys.stderr)
        sys.exit(1)
