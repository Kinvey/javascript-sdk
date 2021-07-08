const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const chalk = require('chalk');
const isArray = require('lodash/isArray');
const spawn = require('cross-spawn');
const del = require('del');
const fs = require('fs-extra');
const glob = require('glob');
const webpack = require('webpack');
const babel = require('@babel/core');
const pkg = require('../package.json');
const webpackConfig = require('../webpack.config');
const argv = require('yargs').argv

const appName = 'TestApp';
const rootPath = path.join(__dirname, '..');
const appPath = path.join(rootPath, appName);
const sharedTestsPath = path.join(rootPath, '../specs');
const appTestsPath = path.join(appPath, '/app/tests');
const tmpPath = path.join(rootPath, 'tmp');

function runCommand(command, args, cwd = process.cwd(), silent = true) {
  const proc = spawn.sync(command, args, { cwd });

  if (proc.error) {
    console.log(JSON.stringify(proc.error));
  }

  if (!silent) {
    console.log(proc.stdout.toString());
    console.error(proc.stderr.toString());
  }
}

function build(file) {
  let singular = false;
  let files = file;

  if (!isArray(file)) {
    singular = true;
    files = [file];
  }

  const results = files.map((file) => {
    return babel.transformFileSync(file);
  });

  return singular ? results[0] : results;
}

if (argv.clean) {
  // Remove the existing app
  console.log('Removing an exisiting NativeScript Test App...');
  del.sync([appPath]);

  // Create a NativeScript app
  console.log('Creating a NativeScript app...');
  runCommand('tns', ['create', appName], rootPath);

  // Setup the app for testing
  console.log('Setting up the NativeScript app for testing...');
  runCommand('tns', ['test', 'init', '--framework', 'mocha'], appPath);
}

// Copy nativescript.config.ts
fs.copyFileSync(path.join(rootPath, 'scripts', 'nativescript.config.ts'), path.join(appPath, 'nativescript.config.ts'));

// Copy app.gradle
fs.copyFileSync(path.join(rootPath, 'scripts', 'app.gradle'), path.join(appPath, 'App_Resources', 'Android', 'app.gradle'));

// Copy AndroidManifest.xml
fs.copyFileSync(path.join(rootPath, 'scripts', 'AndroidManifest.xml'), path.join(appPath, 'App_Resources', 'Android', 'src', 'main', 'AndroidManifest.xml'));

// Copy fix-nativescript-build-xcconfig.js
fs.copyFileSync(path.join(rootPath, 'scripts', 'fix-nativescript-build-xcconfig.js'), path.join(appPath, 'hooks', 'after-prepare', 'fix-nativescript-build-xcconfig.js'));

// Copy karma.conf.js
fs.copyFileSync(path.join(rootPath, 'karma.conf.js'), path.join(appPath, 'karma.conf.js'));

// Copy mocha.opts
fs.copyFileSync(path.join(rootPath, 'mocha.opts'), path.join(appPath, 'mocha.opts'));

// Remove the existing app tests
del.sync([appTestsPath]);

// Pack and copy the kinvey-js-sdk
console.log('Packing and copying SDK to the NativeScript app...');
const jsSdkPath = path.join(__dirname, '../../../../packages/js-sdk');
// Remove the existing packages
del.sync([path.join(jsSdkPath, '*.tgz')], { force: true });

runCommand('npm', ['pack'], jsSdkPath);
const jsSdkFile = glob
  .sync(path.join(jsSdkPath, '*.tgz'))
  .filter((file) => file.indexOf('kinvey-js-sdk') !== -1)
  .shift();
fs.copyFileSync(jsSdkFile, path.join(appPath, 'kinvey-js-sdk.tgz'));

// Pack and copy the kinvey-nativescript-sdk
const nativescriptSdkPath = path.join(__dirname, '../../../../packages/nativescript-sdk');
// Remove the existing packages
del.sync([path.join(nativescriptSdkPath, '*.tgz')], { force: true });

runCommand('npm', ['pack'], nativescriptSdkPath);
const nativescriptSdkFile = glob
  .sync(path.join(nativescriptSdkPath, '*.tgz'))
  .filter((file) => file.indexOf('kinvey-nativescript-sdk') !== -1)
  .shift();
fs.copyFileSync(nativescriptSdkFile, path.join(appPath, 'kinvey-nativescript-sdk.tgz'));

// Update the app package.json
const appPackageJson = require(path.join(appPath, 'package.json'));
const newDependencies = Object.assign({}, appPackageJson.dependencies, pkg.dependencies, { 'kinvey-js-sdk': 'file:kinvey-js-sdk.tgz', 'kinvey-nativescript-sdk': 'file:kinvey-nativescript-sdk.tgz', 'buffer': '6.0.3' });
const newAppPackageJson = Object.assign({}, appPackageJson, { dependencies: newDependencies });
fs.outputFileSync(path.join(appPath, 'package.json'), JSON.stringify(newAppPackageJson, null, 4));

// Build shared tests and copy them to the app
console.log('Bundling test files and copying them to the the NativeScript app...');
const testFiles = []
  .concat(glob.sync(path.join(sharedTestsPath, '*.js')))
  .concat(glob.sync(path.join(sharedTestsPath, 'common/**/*.js')))
  .concat(glob.sync(path.join(sharedTestsPath, 'nativescript/**/*.js')));
build(testFiles)
  .map((result) => {
    return Object.assign({}, result, {
      code: result.code.replace('__SDK__', 'kinvey-nativescript-sdk')
    });
  })
  .forEach((result) => {
    const filePath = path.join(tmpPath, result.options.filename.replace(sharedTestsPath, ''));
    return fs.outputFileSync(filePath, result.code);
  });

// Bundle test files
webpack(webpackConfig, (err, stats) => {
  if (err) {
    console.log(chalk.red(err.stack || err));
    if (err.details) {
      console.error(chalk.red(err.details));
    }

    console.error('Unable to test NativeScript.');
    return;
  }

  // Remove the tmp directory
  del.sync([tmpPath]);

  console.log(`Done! cd ${appName} and run tns test ios.`);
});
