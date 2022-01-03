import { exec } from 'child_process';

/**
 * Run a command synchronously and get the output as a string with newlines stripped
 * @param command The command to run
 */
export default function execToString(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) return reject(stderr);
      resolve(stdout.replace('\n', ''));
    });
  });
}
