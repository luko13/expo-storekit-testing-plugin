import { XML } from 'expo/config-plugins';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { configureStoreKitTestingFiles } from '../native';

const baseScheme = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'base.xcscheme'),
  'utf8',
);

describe('native StoreKit file configuration', () => {
  let projectRoot: string;
  let sourcePath: string;

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'storekit-native-'));
    sourcePath = path.join(projectRoot, 'storekit', 'Demo.storekit');
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, '{"version":1}\n');
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  function writeScheme(schemeName = 'Example'): string {
    const schemePath = path.join(
      projectRoot,
      'ios',
      'Example.xcodeproj',
      'xcshareddata',
      'xcschemes',
      `${schemeName}.xcscheme`,
    );
    fs.mkdirSync(path.dirname(schemePath), { recursive: true });
    fs.writeFileSync(schemePath, baseScheme);
    return schemePath;
  }

  it('copies to the fixed native destination and configures the selected scheme', async () => {
    const schemePath = writeScheme('Development');

    const changes = await configureStoreKitTestingFiles({
      projectRoot,
      projectName: 'Example',
      schemeName: 'Development',
      sourcePath,
    });

    const destination = path.join(
      projectRoot,
      'ios',
      'Example',
      'StoreKit',
      'Configuration.storekit',
    );
    const parsedScheme = await XML.parseXMLAsync(
      fs.readFileSync(schemePath, 'utf8'),
    );

    expect(changes).toEqual({ catalogChanged: true, schemeChanged: true });
    expect(fs.readFileSync(destination, 'utf8')).toBe('{"version":1}\n');
    expect(
      parsedScheme.Scheme.LaunchAction[0].StoreKitConfigurationFileReference,
    ).toEqual([
      {
        $: { identifier: '../Example/StoreKit/Configuration.storekit' },
      },
    ]);
  });

  it('does not rewrite unchanged catalog or scheme content', async () => {
    writeScheme();
    const options = {
      projectRoot,
      projectName: 'Example',
      schemeName: 'Example',
      sourcePath,
    };

    await configureStoreKitTestingFiles(options);
    const changes = await configureStoreKitTestingFiles(options);

    expect(changes).toEqual({ catalogChanged: false, schemeChanged: false });
  });

  it('updates the fixed destination after the source content changes', async () => {
    writeScheme();
    const options = {
      projectRoot,
      projectName: 'Example',
      schemeName: 'Example',
      sourcePath,
    };
    await configureStoreKitTestingFiles(options);

    fs.writeFileSync(sourcePath, '{"version":2}\n');
    const changes = await configureStoreKitTestingFiles(options);

    expect(changes.catalogChanged).toBe(true);
    expect(
      fs.readFileSync(
        path.join(
          projectRoot,
          'ios',
          'Example',
          'StoreKit',
          'Configuration.storekit',
        ),
        'utf8',
      ),
    ).toBe('{"version":2}\n');
  });

  it('rejects a missing shared scheme with an actionable path', async () => {
    await expect(
      configureStoreKitTestingFiles({
        projectRoot,
        projectName: 'Example',
        schemeName: 'Missing',
        sourcePath,
      }),
    ).rejects.toThrow(
      '[expo-storekit-testing-plugin] Shared Xcode scheme "Missing" was not found',
    );
  });
});
