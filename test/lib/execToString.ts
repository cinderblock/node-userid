import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Run a command synchronously and get the output as a string with newlines stripped
 * @param command The command to run
 */
export default async function execToString(command: string): Promise<string> {
  return (await promisify(exec)(command)).toString().replace('\n', '');
}
