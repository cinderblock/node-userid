import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { includes } from './includes.mjs';

if (require.main !== module) {
  throw new Error('Cannot be used as a module');
}

// writeFile('tidy.log', 'Hello World!\n', { flag: 'a' }).catch(console.error);

const args = [...includes.values().map(i => `--extra-arg=-I${i}`), ...process.argv.slice(2)];

// console.log('> clang-tidy', args);

// append args to log file tidy.log
writeFile('tidy.log', args.join('\n') + '\n', { flag: 'a' }).catch(console.error);

const exec = spawn('clang-tidy', args, { stdio: 'inherit' });

exec.on('exit', code => {
  process.exitCode = code;
});

exec.on('error', e => {
  process.exitCode = 1;

  if (e.code === 'ENOENT') {
    console.error('Error: clang-tidy not found on PATH. Please install LLVM.');
    return;
  }

  console.error(e);
});
