const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const exampleRoot = path.join(projectRoot, 'example');
const packageMetadata = require(path.join(projectRoot, 'package.json'));
const nativeProjectName = 'StoreKitTestingExample';
const tarballName = `${packageMetadata.name}-${packageMetadata.version}.tgz`;

function packageManagerInvocation(binary) {
  if (process.platform !== 'win32') {
    return { command: binary, prefix: [] };
  }

  const cliName = binary === 'npm' ? 'npm-cli.js' : 'npx-cli.js';
  const configuredCli = binary === 'npm' ? process.env.npm_execpath : undefined;
  const cliPath =
    configuredCli ??
    path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      cliName,
    );
  if (fs.existsSync(cliPath)) {
    return { command: process.execPath, prefix: [cliPath] };
  }
  return { command: `${binary}.cmd`, prefix: [] };
}

const npm = packageManagerInvocation('npm');
const npx = packageManagerInvocation('npx');

function parseArguments(argv) {
  const options = { sdk: '57', keep: false, workspace: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--sdk') {
      const sdk = argv[index + 1];
      if (!sdk || sdk.startsWith('--')) {
        throw new Error('--sdk requires a version.');
      }
      options.sdk = sdk;
      index += 1;
    } else if (argument === '--workspace') {
      const workspace = argv[index + 1];
      if (!workspace || workspace.startsWith('--')) {
        throw new Error('--workspace requires a directory path.');
      }
      options.workspace = workspace;
      index += 1;
    } else if (argument === '--keep') {
      options.keep = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!['54', '55', '56', '57'].includes(options.sdk)) {
    throw new Error('--sdk must be one of 54, 55, 56, or 57.');
  }
  return options;
}

function run(command, args, cwd) {
  const result = childProcess.spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: '1',
      EXPO_OFFLINE: '1',
      npm_config_audit: 'false',
      npm_config_fund: 'false',
    },
    encoding: 'utf8',
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command),
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    const reason = result.error?.message ? ` ${result.error.message}` : '';
    throw new Error(`Command failed (${command} ${args.join(' ')}).${reason}`);
  }
}

function copyExample(workspace) {
  if (!fs.statSync(exampleRoot).isDirectory()) {
    throw new Error('The example directory is missing.');
  }
  if (fs.existsSync(workspace)) {
    throw new Error(`Workspace already exists: ${workspace}`);
  }

  fs.mkdirSync(path.dirname(workspace), { recursive: true });
  fs.cpSync(exampleRoot, workspace, {
    recursive: true,
    filter(source) {
      const relative = path.relative(exampleRoot, source);
      return !relative
        .split(path.sep)
        .some((part) => ['.expo', 'ios', 'node_modules'].includes(part));
    },
  });
  const copiedLockfile = path.join(workspace, 'package-lock.json');
  if (fs.existsSync(copiedLockfile)) {
    fs.rmSync(copiedLockfile);
  }
}

function installExample(workspace, sdkVersion) {
  const manifestPath = path.join(workspace, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.dependencies = {
    ...manifest.dependencies,
    expo: `~${sdkVersion}.0.0`,
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  run(
    npm.command,
    [
      ...npm.prefix,
      'install',
      '--no-audit',
      '--no-fund',
      '--package-lock=true',
    ],
    workspace,
  );
  run(
    npx.command,
    [...npx.prefix, '--no-install', 'expo', 'install', '--fix', '--npm'],
    workspace,
  );
  run(
    npx.command,
    [...npx.prefix, '--no-install', 'expo', 'install', '--check'],
    workspace,
  );
}

function section(source, name) {
  const start = source.indexOf(`/* Begin ${name} section */`);
  const end = source.indexOf(`/* End ${name} section */`);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Xcode project has no ${name} section.`);
  }
  return source.slice(start, end);
}

function projectObjects(source, sectionName) {
  const content = section(source, sectionName);
  return [
    ...content.matchAll(
      /^\s*[A-F0-9]{24} \/\* .*? \*\/ = \{\s*$([\s\S]*?)^\s*\};\s*$/gm,
    ),
  ].map((match) => match[0]);
}

function countMatches(source, expression) {
  return [...source.matchAll(expression)].length;
}

function verifyNativeArtifacts(workspace, expectedCatalog) {
  const iosDirectory = path.join(workspace, 'ios');
  const destinationCatalog = path.join(
    iosDirectory,
    nativeProjectName,
    'StoreKit',
    'Configuration.storekit',
  );
  const schemePath = path.join(
    iosDirectory,
    `${nativeProjectName}.xcodeproj`,
    'xcshareddata',
    'xcschemes',
    `${nativeProjectName}.xcscheme`,
  );
  const projectPath = path.join(
    iosDirectory,
    `${nativeProjectName}.xcodeproj`,
    'project.pbxproj',
  );

  const copiedCatalog = fs.readFileSync(destinationCatalog);
  if (!copiedCatalog.equals(expectedCatalog)) {
    throw new Error('Generated StoreKit catalog does not match its source.');
  }

  const scheme = fs.readFileSync(schemePath, 'utf8');
  const nodeCount = countMatches(
    scheme,
    /<StoreKitConfigurationFileReference\b/g,
  );
  if (nodeCount !== 1) {
    throw new Error(`Shared scheme contains ${nodeCount} StoreKit references.`);
  }
  if (
    !scheme.includes(
      'identifier="../StoreKitTestingExample/StoreKit/Configuration.storekit"',
    )
  ) {
    throw new Error('Shared scheme points to the wrong StoreKit catalog.');
  }

  const project = fs.readFileSync(projectPath, 'utf8');
  const fileReferenceCount = countMatches(
    section(project, 'PBXFileReference'),
    /^\s*[A-F0-9]{24} \/\* Configuration\.storekit \*\/ = \{[^\n]*\bisa = PBXFileReference;[^\n]*\bpath = "?Configuration\.storekit"?;[^\n]*\};$/gm,
  );
  if (fileReferenceCount !== 1) {
    throw new Error(
      `Xcode project contains ${fileReferenceCount} StoreKit file references.`,
    );
  }

  const storeKitGroups = projectObjects(project, 'PBXGroup').filter(
    (object) =>
      /\bisa = PBXGroup;/.test(object) &&
      /\b(?:name|path) = StoreKit;/.test(object),
  );
  if (storeKitGroups.length !== 1) {
    throw new Error(
      `Xcode project contains ${storeKitGroups.length} StoreKit groups.`,
    );
  }
  if (
    countMatches(storeKitGroups[0], /\/\* Configuration\.storekit \*\//g) !== 1
  ) {
    throw new Error(
      'StoreKit group does not contain exactly one catalog child.',
    );
  }

  const buildFiles = section(project, 'PBXBuildFile');
  const resourcePhases = section(project, 'PBXResourcesBuildPhase');
  if (
    buildFiles.includes('Configuration.storekit') ||
    resourcePhases.includes('Configuration.storekit')
  ) {
    throw new Error(
      'StoreKit catalog unexpectedly has target membership or a resources build phase entry.',
    );
  }

  return { scheme };
}

function prebuild(workspace, clean = false) {
  const args = [
    '--no-install',
    'expo',
    'prebuild',
    '--platform',
    'ios',
    '--no-install',
  ];
  if (clean) {
    args.push('--clean');
  }
  run(npx.command, [...npx.prefix, ...args], workspace);
}

function verifyTarball(workspace) {
  const tarballPath = path.join(workspace, tarballName);
  if (!fs.existsSync(tarballPath) || !fs.statSync(tarballPath).isFile()) {
    throw new Error(
      `Example tarball is missing. Create example/${tarballName} with npm pack first.`,
    );
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const temporaryRoot = options.workspace
    ? path.resolve(projectRoot, options.workspace)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'storekit-example-'));
  const workspace = options.workspace
    ? temporaryRoot
    : path.join(temporaryRoot, 'example');
  const shouldRemove = !options.keep;
  let workspaceCreated = false;

  try {
    copyExample(workspace);
    workspaceCreated = true;
    verifyTarball(workspace);
    installExample(workspace, options.sdk);

    const sourcePath = path.join(
      workspace,
      'storekit',
      'Configuration.storekit',
    );
    const initialCatalog = fs.readFileSync(sourcePath);

    prebuild(workspace);
    const initialArtifacts = verifyNativeArtifacts(workspace, initialCatalog);

    prebuild(workspace);
    const repeatedArtifacts = verifyNativeArtifacts(workspace, initialCatalog);
    if (repeatedArtifacts.scheme !== initialArtifacts.scheme) {
      throw new Error(
        'Repeated prebuild changed the normalized shared scheme.',
      );
    }

    const changedCatalog = Buffer.concat([initialCatalog, Buffer.from('\n')]);
    fs.writeFileSync(sourcePath, changedCatalog);
    prebuild(workspace);
    verifyNativeArtifacts(workspace, changedCatalog);

    prebuild(workspace, true);
    verifyNativeArtifacts(workspace, changedCatalog);

    process.stdout.write(
      `Expo SDK ${options.sdk} prebuild verified in ${workspace}.\n`,
    );
  } finally {
    if (shouldRemove && (!options.workspace || workspaceCreated)) {
      const cleanupTarget = options.workspace ? workspace : temporaryRoot;
      fs.rmSync(cleanupTarget, { recursive: true, force: true });
    }
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Example verification failed: ${message}\n`);
  process.exitCode = 1;
}
