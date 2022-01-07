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
  `${cachePath}/${process.versions.node}/include/node`, // node_api.h
];

const defines = {
  __CLANG_TIDY__: true,
};

const options = {
  std: 'c++17',
};

const includeArgs = includes.map(include => `-I${include}`);

const defineArgs = Object.entries(defines).map(([def, val]) => `-D${def}${val === true ? '' : `=${val}`}`);

const optionsArgs = Object.entries(options).map(([opt, val]) => `-${opt}=${val}`);

const compilerArgs = [...defineArgs, ...includeArgs, ...optionsArgs];

const cliArgs = process.argv.slice(2);

const args = [...compilerArgs.map(arg => `--extra-arg=${arg}`), ...cliArgs];

// console.log('> clang-tidy', args);

const exec = spawn('clang-tidy', args, { stdio: 'inherit' });

exec.on('exit', code => {
  process.exitCode = code;
});

exec.on('error', e => {
  process.exitCode = 1;
  console.error(e.code === 'ENOENT' ? 'Error: clang-tidy not found on PATH. Please install LLVM.' : e);
});
