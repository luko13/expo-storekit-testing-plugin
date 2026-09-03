describe('package entry point', () => {
  it('loads as an Expo config plugin function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const plugin = require('../../../app.plugin.js');

    expect(typeof plugin).toBe('function');
  });
});
