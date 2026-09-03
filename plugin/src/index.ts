import {
  createRunOncePlugin,
  IOSConfig,
  withDangerousMod,
  withXcodeProject,
  type ConfigPlugin,
} from 'expo/config-plugins';

import { configureStoreKitTestingFiles } from './native';
import type { StoreKitTestingPluginProps } from './types';
import { resolveConfigurationFile, validatePluginProps } from './validation';
import { addStoreKitFileReference } from './xcode';

const PACKAGE_NAME = 'expo-storekit-testing-plugin';
const PACKAGE_VERSION = '0.1.0';

const withStoreKitTesting: ConfigPlugin<StoreKitTestingPluginProps> = (
  config,
  rawProps,
) => {
  const props = validatePluginProps(rawProps);

  config = withDangerousMod(config, [
    'ios',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
      const sourcePath = resolveConfigurationFile(
        projectRoot,
        props.configurationFile,
      );

      await configureStoreKitTestingFiles({
        projectRoot,
        projectName,
        schemeName: props.scheme ?? projectName,
        sourcePath,
      });

      return modConfig;
    },
  ]);

  config = withXcodeProject(config, (modConfig) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(
      modConfig.modRequest.projectRoot,
    );
    modConfig.modResults = addStoreKitFileReference(
      modConfig.modResults,
      projectName,
    );
    return modConfig;
  });

  return config;
};

export type { StoreKitTestingPluginProps } from './types';

export default createRunOncePlugin(
  withStoreKitTesting,
  PACKAGE_NAME,
  PACKAGE_VERSION,
);
