import chalk from 'chalk';
import ora, { Ora } from 'ora';

let isJsonMode = false;

export function setJsonMode(enabled: boolean) {
  isJsonMode = enabled;
}

export function getJsonMode(): boolean {
  return isJsonMode;
}

export function log(message: string) {
  if (!isJsonMode) {
    process.stderr.write(`${message}\n`);
  }
}

export function info(message: string) {
  if (!isJsonMode) {
    process.stderr.write(`${chalk.blue('ℹ')} ${message}\n`);
  }
}

export function success(message: string) {
  if (!isJsonMode) {
    process.stderr.write(`${chalk.green('✔')} ${message}\n`);
  }
}

export function warn(message: string) {
  if (!isJsonMode) {
    process.stderr.write(`${chalk.yellow('⚠')} ${chalk.yellow(message)}\n`);
  }
}

export function error(message: string) {
  process.stderr.write(`${chalk.red('✖')} ${chalk.red(message)}\n`);
}

export function createSpinner(text: string): Ora | null {
  if (isJsonMode) {
    return null;
  }
  return ora({ text, stream: process.stderr }).start();
}

export function outputJson(data: unknown) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}
