import packageMetadata from '../../../package.json';
import plugin from '../index';

describe('plugin entry point', () => {
  it('exports an Expo config plugin function from source', () => {
    expect(typeof plugin).toBe('function');
  });

  it('registers the package version in Expo plugin history', () => {
    const config = plugin(
      { name: 'Example', slug: 'example' },
      { configurationFile: 'storekit/Configuration.storekit' },
    );

    expect(config._internal?.pluginHistory?.[packageMetadata.name]).toEqual({
      name: packageMetadata.name,
      version: packageMetadata.version,
    });
  });
});
