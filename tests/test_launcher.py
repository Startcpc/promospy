import importlib.util
import json
from pathlib import Path
import socket
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('promospy_launcher', Path(__file__).resolve().parents[1] / 'start.py')
launcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(launcher)


class LauncherTests(unittest.TestCase):
    def test_corrupt_or_non_object_state_recovers_without_a_traceback(self):
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / 'state.json'
            for raw in ('[]', 'null', '42', 'not json'):
                filename.write_text(raw)
                self.assertEqual(launcher.load_state(filename), {})
            launcher.save_state(filename, {'build': 'done'})
            self.assertEqual(launcher.load_state(filename), {'build': 'done'})
            self.assertEqual(list(Path(directory).glob('*.tmp')), [])

    def test_failed_state_replace_keeps_the_previous_state(self):
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / 'state.json'
            filename.write_text('{"build":"old"}')
            with patch.object(Path, 'replace', side_effect=OSError('disk error')):
                with self.assertRaises(OSError):
                    launcher.save_state(filename, {'build': 'new'})
            self.assertEqual(launcher.load_state(filename), {'build': 'old'})
            self.assertEqual(list(Path(directory).glob('*.tmp')), [])

    def project(self, root):
        for name in ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', 'next.config.ts', 'tsconfig.json', 'postcss.config.mjs'):
            (root / name).write_text(name)
        for directory in ('src', 'public', 'scripts', 'node_modules/next'):
            (root / directory).mkdir(parents=True, exist_ok=True)
        (root / 'src/app.ts').write_text('app source')
        (root / 'node_modules/next/package.json').write_text('{}')

    def test_cached_launch_reuses_build_and_install_config_changes_rebuild(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.project(root)
            calls = []
            def run(command, env):
                calls.append([str(item) for item in command])
                if command[-2:] == ['run', 'build']:
                    server = root / '.next/standalone/server.js'
                    server.parent.mkdir(parents=True, exist_ok=True)
                    server.write_text('server')
            with patch.multiple(launcher, ROOT=root, RUNTIME=root / '.runtime'), patch.object(launcher, 'npm_cli', return_value=root / 'npm-cli.js'), patch.object(launcher.subprocess, 'check_output', return_value='v22.23.4'), patch.object(launcher, 'run', side_effect=run):
                launcher.prepare_runtime(root / 'node', False)
                self.assertEqual(len(calls), 2)
                launcher.prepare_runtime(root / 'node', False)
                self.assertEqual(len(calls), 2)
                (root / '.npmrc').write_text('changed store configuration')
                launcher.prepare_runtime(root / 'node', False)
                self.assertEqual(len(calls), 4)
                (root / '.npmrc').unlink()
                launcher.prepare_runtime(root / 'node', False)
                self.assertEqual(len(calls), 6)

    def test_moving_a_prepared_folder_to_another_platform_reinstalls_native_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.project(root)
            runtime = root / '.runtime'
            runtime.mkdir()
            (runtime / 'state.json').write_text(json.dumps({'platform': 'DifferentOS-x64-v22', 'build': 'old'}))
            with patch.multiple(launcher, ROOT=root, RUNTIME=runtime), patch.object(launcher, 'npm_cli', return_value=root / 'npm-cli.js'), patch.object(launcher.subprocess, 'check_output', return_value='v22.23.4'), patch.object(launcher, 'run') as run:
                launcher.prepare_runtime(root / 'node', True)
                self.assertIn('--force', run.call_args.args[0])
                self.assertNotIn('build', launcher.load_state(runtime / 'state.json'))
                state = launcher.load_state(runtime / 'state.json')
                state['projectRoot'] = '/another folder'
                launcher.save_state(runtime / 'state.json', state)
                run.reset_mock()
                launcher.prepare_runtime(root / 'node', True)
                self.assertIn('--force', run.call_args.args[0])

    def test_busy_port_is_detected_before_modifying_dependencies_or_build(self):
        with socket.socket() as busy:
            busy.bind(('127.0.0.1', 0))
            port = busy.getsockname()[1]
            with patch.object(launcher, 'system_node', return_value=Path('/node')), patch.object(launcher, 'prepare_runtime') as prepare, patch('sys.argv', ['start.py', '--no-browser', '--port', str(port)]):
                with self.assertRaisesRegex(RuntimeError, 'занят'):
                    launcher.main()
                prepare.assert_not_called()

    def test_immediate_restart_can_reuse_a_closed_server_port(self):
        if launcher.platform.system() == 'Windows':
            self.skipTest('POSIX TIME_WAIT regression')
        with socket.socket() as listener:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind(('127.0.0.1', 0))
            listener.listen(1)
            port = listener.getsockname()[1]
            with socket.create_connection(('127.0.0.1', port)) as client:
                connection, _ = listener.accept()
                connection.close()
                self.assertEqual(client.recv(1), b'')
        with patch.object(launcher, 'system_node', return_value=Path('/node')), patch.object(launcher, 'prepare_runtime', side_effect=RuntimeError('setup reached')), patch('sys.argv', ['start.py', '--no-browser', '--port', str(port)]):
            with self.assertRaisesRegex(RuntimeError, 'setup reached'):
                launcher.main()

    def test_unreadable_checksum_response_is_not_extracted(self):
        with tempfile.TemporaryDirectory() as directory:
            def download(url, destination):
                destination.write_text('not-a-checksum\n')
            with patch.object(launcher, 'RUNTIME', Path(directory)), patch.object(launcher.platform, 'system', return_value='Linux'), patch.object(launcher.platform, 'machine', return_value='x86_64'), patch.object(launcher, 'download', side_effect=download) as request:
                with self.assertRaisesRegex(RuntimeError, 'контрольная сумма'):
                    launcher.portable_node()
                self.assertEqual(request.call_count, 1)
                self.assertEqual(list(Path(directory).iterdir()), [])

    def test_system_node_with_a_broken_npm_falls_back_to_portable_runtime(self):
        with patch.object(launcher.shutil, 'which', return_value='/node'), patch.object(launcher, 'npm_cli', return_value=Path('/npm-cli.js')), patch.object(launcher.subprocess, 'check_output', side_effect=['v22.23.4', '/node', subprocess.CalledProcessError(1, 'npm')]):
            self.assertIsNone(launcher.system_node())

    def test_backup_does_not_install_dependencies_or_start_a_server(self):
        with patch.object(launcher, 'system_node', return_value=Path('/node')), patch.object(launcher, 'prepare_runtime') as prepare, patch.object(launcher, 'run') as run, patch('sys.argv', ['start.py', '--backup']):
            launcher.main()
            prepare.assert_not_called()
            self.assertEqual(run.call_args.args[0][-1], 'backup')

    def test_restore_refuses_a_running_server_before_touching_data(self):
        with socket.socket() as busy:
            busy.bind(('127.0.0.1', 0))
            port = busy.getsockname()[1]
            with patch.object(launcher, 'system_node', return_value=Path('/node')), patch.object(launcher, 'run') as run, patch('sys.argv', ['start.py', '--restore', 'copy.json', '--port', str(port)]):
                with self.assertRaisesRegex(RuntimeError, 'занят'):
                    launcher.main()
                run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
