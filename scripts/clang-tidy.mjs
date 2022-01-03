import { spawn } from 'child_process';
import { platform } from 'os';

const gyp = 'node-gyp';

// TODO: Find a better way to find <node_api.h>
const cachePath =
  platform() === 'win32'
    ? `${process.env['LocalAppData'.toUpperCase()]}/${gyp}/Cache`
    : `${process.env.HOME}/.cache/${gyp}`;

const includes = [
  'node_modules/node-addon-api', // napi.h
  `${cachePath}/${process.version.slice(1)}/include/node`, // node_api.h
];

const compilerArgs = ['-D__CLANG_TIDY__', ...includes.map(i => `-I${i}`)];

const args = [...compilerArgs.map(i => `--extra-arg=${i}`), ...process.argv.slice(2)];

// console.log('> clang-tidy', args);

const exec = spawn('clang-tidy', args, { stdio: 'inherit' });

exec.on('exit', code => {
  process.exitCode = code;
});

exec.on('error', e => {
  process.exitCode = 1;
  console.error(e.code === 'ENOENT' ? 'Error: clang-tidy not found on PATH. Please install LLVM.' : e);
});
