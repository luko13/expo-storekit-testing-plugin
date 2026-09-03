import { XML } from 'expo/config-plugins';

const ERROR_PREFIX = '[expo-storekit-testing-plugin]';
const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

function schemeError(message: string, cause?: unknown): never {
  throw new Error(
    `${ERROR_PREFIX} ${message}`,
    cause === undefined ? undefined : { cause },
  );
}

function isXmlObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function transformSchemeXml(
  source: string,
  storeKitReference: string,
): Promise<string> {
  let schemeDocument;
  try {
    schemeDocument = await XML.parseXMLAsync(source);
  } catch (error) {
    schemeError('Could not parse the Xcode scheme XML.', error);
  }

  const scheme = schemeDocument.Scheme;
  const launchActions = isXmlObject(scheme) ? scheme.LaunchAction : undefined;
  if (!Array.isArray(launchActions) || launchActions.length === 0) {
    schemeError('Xcode scheme has no LaunchAction to configure.');
  }

  const launchAction = launchActions[0];
  if (!isXmlObject(launchAction)) {
    schemeError('Xcode scheme has an invalid LaunchAction.');
  }

  launchAction.StoreKitConfigurationFileReference = [
    { $: { identifier: storeKitReference } },
  ];

  const formatted = XML.format(schemeDocument).trim();
  const withoutDeclaration = formatted.startsWith('<?xml')
    ? formatted.replace(/^<\?xml[^?]*\?>\s*/, '')
    : formatted;

  return `${XML_DECLARATION}\n${withoutDeclaration}\n`;
}
