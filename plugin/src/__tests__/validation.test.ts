import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveConfigurationFile, validatePluginProps } from '../validation';

describe('plugin option validation', () => {
  it.each([
    undefined,
    null,
    {},
    { configurationFile: '' },
    { configurationFile: '   ' },
  ])('rejects a missing or empty configurationFile: %p', (props) => {
    expect(() => validatePluginProps(props)).toThrow(
      '[expo-storekit-testing-plugin] configurationFile must be a non-empty string',
    );
  });

  it.each(['/outside/Demo.storekit', 'C:\\outside\\Demo.storekit'])(
    'rejects an absolute configurationFile path on every host: %s',
    (configurationFile) => {
      expect(() => validatePluginProps({ configurationFile })).toThrow(
        '[expo-storekit-testing-plugin] configurationFile must be relative to the Expo project root',
      );
    },
  );

  it('rejects a configurationFile path that leaves the project root', () => {
    expect(() =>
      validatePluginProps({ configurationFile: '../Demo.storekit' }),
    ).toThrow(
      '[expo-storekit-testing-plugin] configurationFile must stay inside the Expo project root',
    );
  });

  it('rejects files without the .storekit extension', () => {
    expect(() =>
      validatePluginProps({ configurationFile: 'storekit.json' }),
    ).toThrow(
      '[expo-storekit-testing-plugin] configurationFile must end in .storekit',
    );
  });

  it.each(['Demo.xcscheme', 'Demo.XCSCHEME', 'ios/Demo', 'ios\\Demo', '   '])(
    'rejects an invalid scheme name: %s',
    (scheme) => {
      expect(() =>
        validatePluginProps({ configurationFile: 'Demo.storekit', scheme }),
      ).toThrow('[expo-storekit-testing-plugin] scheme');
    },
  );

  it('returns trimmed, validated options', () => {
    expect(
      validatePluginProps({
        configurationFile: '  storekit/Demo.storekit  ',
        scheme: '  Example  ',
      }),
    ).toEqual({
      configurationFile: 'storekit/Demo.storekit',
      scheme: 'Example',
    });
  });
});

describe('configuration file resolution', () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'storekit-plugin-'));
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('resolves an existing regular .storekit file', () => {
    const relativePath = path.join('storekit', 'Demo.storekit');
    const absolutePath = path.join(projectRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, '{}');

    expect(resolveConfigurationFile(projectRoot, relativePath)).toBe(
      absolutePath,
    );
  });

  it('rejects a missing file', () => {
    expect(() =>
      resolveConfigurationFile(projectRoot, 'Missing.storekit'),
    ).toThrow(
      '[expo-storekit-testing-plugin] StoreKit configuration file not found',
    );
  });

  it('rejects a directory with a .storekit suffix', () => {
    fs.mkdirSync(path.join(projectRoot, 'Folder.storekit'));

    expect(() =>
      resolveConfigurationFile(projectRoot, 'Folder.storekit'),
    ).toThrow(
      '[expo-storekit-testing-plugin] configurationFile must point to a regular file',
    );
  });

  it('rejects a symlink whose target is outside the project root', () => {
    const outsideRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'storekit-outside-'),
    );
    const outsideFile = path.join(outsideRoot, 'Outside.storekit');
    const linkedFile = path.join(projectRoot, 'Linked.storekit');
    fs.writeFileSync(outsideFile, '{}');

    try {
      fs.symlinkSync(outsideFile, linkedFile, 'file');
    } catch (error) {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'EPERM'
      ) {
        return;
      }
      throw error;
    }

    try {
      expect(() =>
        resolveConfigurationFile(projectRoot, 'Linked.storekit'),
      ).toThrow(
        '[expo-storekit-testing-plugin] configurationFile must stay inside the Expo project root',
      );
    } finally {
      fs.rmSync(outsideRoot, { recursive: true, force: true });
    }
  });
});
