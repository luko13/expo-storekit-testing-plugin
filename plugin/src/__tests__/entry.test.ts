import plugin from '../index';

describe('plugin entry point', () => {
  it('exports an Expo config plugin function from source', () => {
    expect(typeof plugin).toBe('function');
  });
});
