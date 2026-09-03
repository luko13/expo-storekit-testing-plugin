import type { PBXGroup, XcodeProject } from 'xcode';

const ERROR_PREFIX = '[expo-storekit-testing-plugin]';
const STOREKIT_GROUP_NAME = 'StoreKit';
const STOREKIT_FILE_NAME = 'Configuration.storekit';

function unquote(value: unknown): string | undefined {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : undefined;
}

function isPbxGroup(value: unknown): value is PBXGroup {
  return (
    typeof value === 'object' &&
    value !== null &&
    'children' in value &&
    Array.isArray(value.children)
  );
}

function findNativeProjectGroupKey(
  project: XcodeProject,
  projectName: string,
): string | undefined {
  const groups = project.hash.project.objects.PBXGroup;
  let nameMatch: string | undefined;

  for (const [key, value] of Object.entries(groups)) {
    if (key.endsWith('_comment') || !isPbxGroup(value)) {
      continue;
    }
    if (unquote(value.path) === projectName) {
      return key;
    }
    if (unquote(value.name) === projectName) {
      nameMatch = key;
    }
  }

  return nameMatch;
}

function matchingStoreKitGroupKeys(
  project: XcodeProject,
  appGroup: PBXGroup,
): string[] {
  return appGroup.children
    .map((child) => child.value)
    .filter((key) => {
      const group = project.getPBXGroupByKey(key);
      return (
        group !== undefined &&
        (unquote(group.name) === STOREKIT_GROUP_NAME ||
          unquote(group.path) === STOREKIT_GROUP_NAME)
      );
    });
}

function ensureStoreKitGroup(
  project: XcodeProject,
  appGroupKey: string,
): string {
  const appGroup = project.getPBXGroupByKey(appGroupKey);
  if (!appGroup) {
    throw new Error(`${ERROR_PREFIX} Native iOS project group is unreadable.`);
  }

  const matchingKeys = matchingStoreKitGroupKeys(project, appGroup);
  const groupKey =
    matchingKeys[0] ??
    project.addPbxGroup([], STOREKIT_GROUP_NAME, STOREKIT_GROUP_NAME).uuid;

  appGroup.children = appGroup.children.filter(
    (child) => !matchingKeys.includes(child.value) || child.value === groupKey,
  );

  if (!appGroup.children.some((child) => child.value === groupKey)) {
    project.addToPbxGroup(groupKey, appGroupKey);
  }

  return groupKey;
}

function addUniqueStoreKitFileReference(project: XcodeProject): string {
  const fileReferenceKey = project.generateUuid();
  const references = project.pbxFileReferenceSection();
  references[fileReferenceKey] = {
    isa: 'PBXFileReference',
    fileEncoding: 4,
    includeInIndex: 0,
    lastKnownFileType: 'text',
    name: `"${STOREKIT_FILE_NAME}"`,
    path: `"${STOREKIT_FILE_NAME}"`,
    sourceTree: '"<group>"',
  };
  references[`${fileReferenceKey}_comment`] = STOREKIT_FILE_NAME;
  return fileReferenceKey;
}

function ensureStoreKitFile(
  project: XcodeProject,
  storeKitGroupKey: string,
): void {
  const group = project.getPBXGroupByKey(storeKitGroupKey);
  if (!group) {
    throw new Error(`${ERROR_PREFIX} StoreKit Xcode group is unreadable.`);
  }

  const references = project.pbxFileReferenceSection();
  const matchingChildKeys = group.children
    .map((child) => child.value)
    .filter((key) => {
      const reference = references[key];
      return (
        typeof reference === 'object' &&
        reference !== null &&
        unquote(reference.path) === STOREKIT_FILE_NAME
      );
    });

  let fileReferenceKey = matchingChildKeys[0];
  if (!fileReferenceKey) {
    fileReferenceKey = addUniqueStoreKitFileReference(project);
  }

  group.children = group.children.filter(
    (child) =>
      !matchingChildKeys.includes(child.value) ||
      child.value === fileReferenceKey,
  );
  if (!group.children.some((child) => child.value === fileReferenceKey)) {
    group.children.push({
      value: fileReferenceKey,
      comment: STOREKIT_FILE_NAME,
    });
  }
}

export function addStoreKitFileReference(
  project: XcodeProject,
  projectName: string,
): XcodeProject {
  const appGroupKey = findNativeProjectGroupKey(project, projectName);
  if (!appGroupKey) {
    throw new Error(
      `${ERROR_PREFIX} Could not find the native iOS project group "${projectName}".`,
    );
  }

  const storeKitGroupKey = ensureStoreKitGroup(project, appGroupKey);
  ensureStoreKitFile(project, storeKitGroupKey);

  return project;
}
