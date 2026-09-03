import path from 'node:path';
import xcode from 'xcode';

import { addStoreKitFileReference } from '../xcode';

const createProject = (): xcode.XcodeProject => {
  const project = xcode.project(
    path.join(__dirname, 'fixtures', 'project.pbxproj'),
  );
  project.parseSync();
  return project;
};

const unquote = (value: string | undefined): string | undefined =>
  value?.replace(/^"|"$/g, '');

describe('Xcode project transformation', () => {
  it('adds one StoreKit group and one visible file reference', () => {
    const project = addStoreKitFileReference(createProject(), 'Example');
    const appGroupKey = project.findPBXGroupKey({ path: 'Example' });
    const appGroup = project.getPBXGroupByKey(appGroupKey);
    const storeKitChildren = appGroup.children.filter((child) => {
      const group = project.getPBXGroupByKey(child.value);
      return group?.name === 'StoreKit' && unquote(group.path) === 'StoreKit';
    });

    expect(storeKitChildren).toHaveLength(1);

    const storeKitGroup = project.getPBXGroupByKey(storeKitChildren[0].value);
    const matchingReferences = storeKitGroup.children.filter((child) => {
      const reference = project.pbxFileReferenceSection()[child.value];
      return unquote(reference?.path) === 'Configuration.storekit';
    });

    expect(matchingReferences).toHaveLength(1);
    expect(
      project.pbxFileReferenceSection()[matchingReferences[0].value]
        .lastKnownFileType,
    ).toBe('text');
  });

  it('does not add target membership or a Copy Bundle Resources entry', () => {
    const project = addStoreKitFileReference(createProject(), 'Example');
    const buildFileComments = Object.values(
      project.pbxBuildFileSection(),
    ).filter((value) => value === 'Configuration.storekit in Resources');
    const resources = Object.values(
      project.hash.project.objects.PBXResourcesBuildPhase ?? {},
    );

    expect(buildFileComments).toHaveLength(0);
    expect(JSON.stringify(resources)).not.toContain('Configuration.storekit');
  });

  it('is byte-for-byte idempotent after the first transformation', () => {
    const project = createProject();
    addStoreKitFileReference(project, 'Example');
    const once = project.writeSync();

    addStoreKitFileReference(project, 'Example');
    const twice = project.writeSync();

    expect(twice).toBe(once);
  });

  it('collapses duplicate visible StoreKit groups to one group', () => {
    const project = createProject();
    const appGroupKey = project.findPBXGroupKey({ path: 'Example' });
    const duplicate = project.addPbxGroup([], 'StoreKit', 'StoreKit');
    project.addToPbxGroup(duplicate.uuid, appGroupKey);
    project.addToPbxGroup(
      project.addPbxGroup([], 'StoreKit', 'StoreKit').uuid,
      appGroupKey,
    );

    addStoreKitFileReference(project, 'Example');

    const appGroup = project.getPBXGroupByKey(appGroupKey);
    const visibleStoreKitGroups = appGroup.children.filter((child) => {
      const group = project.getPBXGroupByKey(child.value);
      return group?.name === 'StoreKit' && unquote(group.path) === 'StoreKit';
    });
    expect(visibleStoreKitGroups).toHaveLength(1);
  });

  it('does not reuse a same-named file reference from an unrelated group', () => {
    const project = createProject();
    const unrelatedGroup = project.addPbxGroup([], 'Unrelated', 'Unrelated');
    const unrelatedFile = project.addFile(
      'Configuration.storekit',
      unrelatedGroup.uuid,
      { lastKnownFileType: 'text' },
    );

    addStoreKitFileReference(project, 'Example');

    const appGroupKey = project.findPBXGroupKey({ path: 'Example' });
    const appGroup = project.getPBXGroupByKey(appGroupKey);
    const storeKitGroupKey = appGroup.children.find(
      (child) => project.getPBXGroupByKey(child.value)?.name === 'StoreKit',
    )?.value;
    const storeKitGroup = project.getPBXGroupByKey(storeKitGroupKey!);

    expect(storeKitGroup.children).toHaveLength(1);
    expect(storeKitGroup.children[0].value).not.toBe(unrelatedFile?.fileRef);
  });

  it('rejects a project that has no matching native project group', () => {
    expect(() => addStoreKitFileReference(createProject(), 'Missing')).toThrow(
      '[expo-storekit-testing-plugin] Could not find the native iOS project group "Missing"',
    );
  });
});
