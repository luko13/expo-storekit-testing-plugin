import fs from 'node:fs';
import path from 'node:path';

import type { StoreKitTestingPluginProps } from './types';

const ERROR_PREFIX = '[expo-storekit-testing-plugin]';

function configurationError(message: string, cause?: unknown): never {
  throw new Error(
    `${ERROR_PREFIX} ${message}`,
    cause === undefined ? undefined : { cause },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function staysInsideProject(relativePath: string): boolean {
  const normalized = path.normalize(relativePath);
  return normalized !== '..' && !normalized.startsWith(`..${path.sep}`);
}

export function validatePluginProps(
  props: unknown,
): StoreKitTestingPluginProps {
  if (!isRecord(props) || typeof props.configurationFile !== 'string') {
    configurationError('configurationFile must be a non-empty string.');
  }

  const configurationFile = props.configurationFile.trim();
  if (!configurationFile) {
    configurationError('configurationFile must be a non-empty string.');
  }
  if (
    path.isAbsolute(configurationFile) ||
    path.posix.isAbsolute(configurationFile) ||
    path.win32.isAbsolute(configurationFile)
  ) {
    configurationError(
      'configurationFile must be relative to the Expo project root.',
    );
  }
  if (!staysInsideProject(configurationFile)) {
    configurationError(
      'configurationFile must stay inside the Expo project root.',
    );
  }
  if (path.extname(configurationFile).toLowerCase() !== '.storekit') {
    configurationError('configurationFile must end in .storekit.');
  }

  if (props.scheme === undefined) {
    return { configurationFile };
  }
  if (typeof props.scheme !== 'string') {
    configurationError('scheme must be a non-empty scheme name.');
  }

  const scheme = props.scheme.trim();
  if (
    !scheme ||
    scheme.toLowerCase().endsWith('.xcscheme') ||
    scheme.includes('/') ||
    scheme.includes('\\') ||
    scheme === '.' ||
    scheme === '..'
  ) {
    configurationError(
      'scheme must be a name without path separators or the .xcscheme extension.',
    );
  }

  return { configurationFile, scheme };
}

export function resolveConfigurationFile(
  projectRoot: string,
  configurationFile: string,
): string {
  const validated = validatePluginProps({ configurationFile });
  const absolutePath = path.resolve(projectRoot, validated.configurationFile);
  const relativePath = path.relative(path.resolve(projectRoot), absolutePath);

  if (!staysInsideProject(relativePath) || path.isAbsolute(relativePath)) {
    configurationError(
      'configurationFile must stay inside the Expo project root.',
    );
  }

  let stats: fs.Stats;
  try {
    stats = fs.statSync(absolutePath);
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      configurationError(
        `StoreKit configuration file not found: ${validated.configurationFile}.`,
      );
    }
    configurationError(
      `Could not inspect StoreKit configuration file: ${validated.configurationFile}.`,
      error,
    );
  }

  if (!stats.isFile()) {
    configurationError('configurationFile must point to a regular file.');
  }

  const realProjectRoot = fs.realpathSync(projectRoot);
  const realConfigurationFile = fs.realpathSync(absolutePath);
  const realRelativePath = path.relative(
    realProjectRoot,
    realConfigurationFile,
  );
  if (
    !staysInsideProject(realRelativePath) ||
    path.isAbsolute(realRelativePath)
  ) {
    configurationError(
      'configurationFile must stay inside the Expo project root.',
    );
  }

  return absolutePath;
}
