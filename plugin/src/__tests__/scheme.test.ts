import { XML } from 'expo/config-plugins';
import fs from 'node:fs';
import path from 'node:path';

import { transformSchemeXml } from '../scheme';

const readFixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('scheme XML transformation', () => {
  it('adds the StoreKit reference while preserving unrelated configuration', async () => {
    const transformed = await transformSchemeXml(
      readFixture('base.xcscheme'),
      '../Example/StoreKit/Configuration.storekit',
    );
    const parsed = await XML.parseXMLAsync(transformed);
    const launchAction = parsed.Scheme.LaunchAction[0];

    expect(launchAction.$.buildConfiguration).toBe('Debug');
    expect(
      launchAction.CommandLineArguments[0].CommandLineArgument[0].$.argument,
    ).toBe('--demo & test');
    expect(
      launchAction.EnvironmentVariables[0].EnvironmentVariable[0].$.value,
    ).toBe('unchanged');
    expect(launchAction.StoreKitConfigurationFileReference).toEqual([
      {
        $: { identifier: '../Example/StoreKit/Configuration.storekit' },
      },
    ]);
    expect(parsed.Scheme.ProfileAction[0].$.buildConfiguration).toBe('Release');
  });

  it('replaces every previous StoreKit reference with exactly one reference', async () => {
    const transformed = await transformSchemeXml(
      readFixture('existing.xcscheme'),
      '../Example/StoreKit/Configuration.storekit',
    );
    const parsed = await XML.parseXMLAsync(transformed);

    expect(
      parsed.Scheme.LaunchAction[0].StoreKitConfigurationFileReference,
    ).toEqual([
      {
        $: { identifier: '../Example/StoreKit/Configuration.storekit' },
      },
    ]);
    expect(
      parsed.Scheme.LaunchAction[0].CommandLineArguments[0]
        .CommandLineArgument[0].$.argument,
    ).toBe('--keep');
  });

  it('escapes project names that contain XML-sensitive characters', async () => {
    const transformed = await transformSchemeXml(
      readFixture('base.xcscheme'),
      '../Example & Co/StoreKit/Configuration.storekit',
    );

    expect(transformed).toContain(
      '../Example &amp; Co/StoreKit/Configuration.storekit',
    );
    expect(
      (await XML.parseXMLAsync(transformed)).Scheme.LaunchAction[0]
        .StoreKitConfigurationFileReference[0].$.identifier,
    ).toBe('../Example & Co/StoreKit/Configuration.storekit');
  });

  it('is byte-for-byte idempotent after the first normalization', async () => {
    const once = await transformSchemeXml(
      readFixture('base.xcscheme'),
      '../Example/StoreKit/Configuration.storekit',
    );
    const twice = await transformSchemeXml(
      once,
      '../Example/StoreKit/Configuration.storekit',
    );

    expect(twice).toBe(once);
  });

  it('rejects malformed XML with an actionable error', async () => {
    await expect(
      transformSchemeXml(
        '<Scheme><LaunchAction></Scheme>',
        '../Example/Demo.storekit',
      ),
    ).rejects.toThrow(
      '[expo-storekit-testing-plugin] Could not parse the Xcode scheme XML',
    );
  });

  it('rejects schemes without a LaunchAction', async () => {
    await expect(
      transformSchemeXml(
        readFixture('missing-launch.xcscheme'),
        '../Example/Demo.storekit',
      ),
    ).rejects.toThrow(
      '[expo-storekit-testing-plugin] Xcode scheme has no LaunchAction',
    );
  });
});
