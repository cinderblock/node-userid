import { platform } from 'os';
import { basename } from 'path';
import esMain from 'es-main';

const gyp = 'node-gyp';

// TODO: Find a better way to find <node_api.h>
const cachePath =
  platform() === 'win32'
    ? `${process.env['LocalAppData'.toUpperCase()]}/${gyp}/Cache`
    : `${process.env.HOME}/.cache/${gyp}`;

export const includes = {
  'napi.h': 'node_modules/node-addon-api',
  'node_api.h': `${cachePath}/${process.version.slice(1)}/include/node`,
};

if (esMain(import.meta)) {
  if (process.argv.length < 3 || process.argv.includes('--help') || process.argv.includes('-h')) {
    if (process.argv.length < 3) process.exitCode = 1;
    console.log(`Usage: node ${basename(import.meta.url)} --help|${Object.keys(includes).join('|')}`);
  } else {
    const selected = includes[process.argv[2]];

    if (!selected) {
      throw new Error(`Invalid include: ${process.argv[2]}. Expected one of: [${includes.keys().join(', ')}]`);
    }

    console.log(selected);
  }
}
