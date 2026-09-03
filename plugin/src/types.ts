export interface StoreKitTestingPluginProps {
  /** Path to an existing `.storekit` file, relative to the Expo project root. */
  configurationFile: string;
  /** Shared Xcode scheme name without the `.xcscheme` extension. */
  scheme?: string;
}
