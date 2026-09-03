const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(projectRoot, 'package.json'));

function npmInvocation() {
  if (process.platform !== 'win32') {
    return { command: 'npm', prefix: [] };
  }

  const npmCli =
    process.env.npm_execpath ??
    path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    );
  if (fs.existsSync(npmCli)) {
    return { command: process.execPath, prefix: [npmCli] };
  }
  return { command: 'npm.cmd', prefix: [] };
}

const npm = npmInvocation();

const allowedRootFiles = new Set([
  'app.plugin.js',
  'CHANGELOG.md',
  'LICENSE',
  'package.json',
  'README.md',
]);
const requiredFiles = new Set([
  ...allowedRootFiles,
  'plugin/build/index.d.ts',
  'plugin/build/index.js',
  'plugin/build/index.js.map',
]);

function run(command, args, options = {}) {
  const result = childProcess.spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env,
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command),
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  if (result.status !== 0) {
    const details = [result.error?.message, result.stdout, result.stderr]
      .filter(Boolean)
      .join('\n');
    throw new Error(
      `Command failed (${command} ${args.join(' ')}).${
        details ? `\n${details}` : ''
      }`,
    );
  }

  return result.stdout.trim();
}

function parsePackResult(output) {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error('npm pack did not return its JSON manifest.');
  }

  const result = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error('npm pack returned an unexpected number of packages.');
  }
  return result[0];
}

function normalizedPackagePath(file) {
  return file.path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function auditManifest(packResult) {
  if (!Array.isArray(packResult.files)) {
    throw new Error('npm pack did not report the files in the tarball.');
  }

  const packagedFiles = new Set(packResult.files.map(normalizedPackagePath));
  const unexpected = [...packagedFiles].filter(
    (file) => !allowedRootFiles.has(file) && !file.startsWith('plugin/build/'),
  );
  const missing = [...requiredFiles].filter((file) => !packagedFiles.has(file));

  if (unexpected.length > 0) {
    throw new Error(
      `Tarball contains files outside the allowlist:\n${unexpected.join('\n')}`,
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `Tarball is missing required files:\n${missing.join('\n')}`,
    );
  }

  const forbiddenBuildFiles = [...packagedFiles].filter(
    (file) =>
      file.includes('/__tests__/') ||
      file.endsWith('.test.js') ||
      file.endsWith('.test.d.ts'),
  );
  if (forbiddenBuildFiles.length > 0) {
    throw new Error(
      `Tarball contains test artifacts:\n${forbiddenBuildFiles.join('\n')}`,
    );
  }

  return packagedFiles.size;
}

function verifyInstalledPackage(tarballPath, temporaryDirectory) {
  const consumerDirectory = path.join(temporaryDirectory, 'consumer');
  fs.mkdirSync(consumerDirectory);
  fs.writeFileSync(
    path.join(consumerDirectory, 'package.json'),
    JSON.stringify({ private: true }, null, 2),
  );

  run(
    npm.command,
    [
      ...npm.prefix,
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--no-package-lock',
      '--omit=dev',
      '--omit=peer',
      tarballPath,
    ],
    { cwd: consumerDirectory },
  );

  const installedRoot = path.join(
    consumerDirectory,
    'node_modules',
    packageJson.name,
  );
  const validationProgram = [
    "const fs = require('node:fs');",
    "const path = require('node:path');",
    'const packageRoot = process.argv[1];',
    'const loaded = require(packageRoot);',
    'const plugin = loaded.default ?? loaded;',
    "if (typeof plugin !== 'function') throw new Error('Package entry point does not export a config plugin.');",
    "const metadata = require(path.join(packageRoot, 'package.json'));",
    "if (!metadata.types) throw new Error('Package metadata has no types entry.');",
    'const declarations = path.join(packageRoot, metadata.types);',
    "if (!fs.statSync(declarations).isFile()) throw new Error('Type declarations cannot be loaded.');",
  ].join('\n');

  run(process.execPath, ['-e', validationProgram, installedRoot], {
    cwd: consumerDirectory,
    env: {
      ...process.env,
      NODE_PATH: path.join(projectRoot, 'node_modules'),
    },
  });
}

function main() {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'storekit-plugin-pack-'),
  );

  try {
    const output = run(npm.command, [
      ...npm.prefix,
      'pack',
      '--json',
      '--ignore-scripts',
      '--pack-destination',
      temporaryDirectory,
    ]);
    const packResult = parsePackResult(output);
    const fileCount = auditManifest(packResult);
    const tarballPath = path.join(temporaryDirectory, packResult.filename);

    if (!fs.statSync(tarballPath).isFile()) {
      throw new Error('npm pack did not create the expected tarball.');
    }

    verifyInstalledPackage(tarballPath, temporaryDirectory);
    process.stdout.write(
      `Tarball verified: ${packResult.filename} (${fileCount} files).\n`,
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Package audit failed: ${message}\n`);
  process.exitCode = 1;
}
