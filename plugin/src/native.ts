import fs from 'node:fs';
import path from 'node:path';

import { transformSchemeXml } from './scheme';

const ERROR_PREFIX = '[expo-storekit-testing-plugin]';
const NATIVE_CATALOG_PATH = path.join('StoreKit', 'Configuration.storekit');

export interface NativeStoreKitOptions {
  projectRoot: string;
  projectName: string;
  schemeName: string;
  sourcePath: string;
}

export interface NativeStoreKitChanges {
  catalogChanged: boolean;
  schemeChanged: boolean;
}

function filesHaveEqualContent(firstPath: string, secondPath: string): boolean {
  if (!fs.existsSync(secondPath)) {
    return false;
  }
  return fs.readFileSync(firstPath).equals(fs.readFileSync(secondPath));
}

function copyCatalogIfChanged(
  sourcePath: string,
  destinationPath: string,
): boolean {
  if (filesHaveEqualContent(sourcePath, destinationPath)) {
    return false;
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  fs.copyFileSync(sourcePath, destinationPath);
  return true;
}

export async function configureStoreKitTestingFiles({
  projectRoot,
  projectName,
  schemeName,
  sourcePath,
}: NativeStoreKitOptions): Promise<NativeStoreKitChanges> {
  const schemePath = path.join(
    projectRoot,
    'ios',
    `${projectName}.xcodeproj`,
    'xcshareddata',
    'xcschemes',
    `${schemeName}.xcscheme`,
  );
  if (!fs.existsSync(schemePath) || !fs.statSync(schemePath).isFile()) {
    throw new Error(
      `${ERROR_PREFIX} Shared Xcode scheme "${schemeName}" was not found at ${schemePath}. ` +
        'Use a shared scheme name without the .xcscheme extension.',
    );
  }

  const destinationPath = path.join(
    projectRoot,
    'ios',
    projectName,
    NATIVE_CATALOG_PATH,
  );
  const originalScheme = fs.readFileSync(schemePath, 'utf8');
  const storeKitReference = `../${projectName}/StoreKit/Configuration.storekit`;
  const transformedScheme = await transformSchemeXml(
    originalScheme,
    storeKitReference,
  );

  const catalogChanged = copyCatalogIfChanged(sourcePath, destinationPath);
  const schemeChanged = transformedScheme !== originalScheme;
  if (schemeChanged) {
    fs.writeFileSync(schemePath, transformedScheme);
  }

  return { catalogChanged, schemeChanged };
}
