const argv = require('yargs').argv;
const fs = require('fs-extra');
const path = require('path');
const glob = require('glob-promise');
const babel = require('@babel/core');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!argv.target) {
  throw new Error('Required parameter "--target" missing.');
}

const SPECS_DIR = path.join(__dirname, './specs');
const TEST_DIR = path.join(__dirname, `./${argv.target}/test`);

function build(file) {
  let singular = false;
  let files = file;

  if (!Array.isArray(file)) {
    singular = true;
    files = [file];
  }

  return Promise
    .all(files.map(function (file) {
      return babel.transformFileAsync(file);
    }))
    .then(function (results) {
      return singular ? results[0] : results;
    });
}

function copy(files) {
  return build(files)
    .then(function (results) {
      return Promise.all(results
        .map(function (result) {
          result.code = result.code.replace('__SDK__', `kinvey-${argv.target}-sdk`);

          if (argv.runner === 'jest') {
            // Adjust mocha-style `before`s to jest syntax
            result.code = result.code.replace(/before\(/g, 'beforeAll(');
            result.code = result.code.replace(/after\(/g, 'afterAll(');
          }

          return result;
        })
        .map(function (result) {
          const filePath = path.join(TEST_DIR, result.options.filename.replace(SPECS_DIR, ''));
          return fs.outputFile(filePath, result.code);
        }));
    });
}

fs.remove(TEST_DIR)
  .then(() => {
    return []
      .concat(glob.sync(path.join(SPECS_DIR, '*.js')))
      .concat(glob.sync(path.join(SPECS_DIR, 'common/**/*.js')))
      .concat(glob.sync(path.join(SPECS_DIR, `${argv.target}/**/*.js`)));
  })
  .then((files) => copy(files))
  .catch(function (error) {
    console.log(error);
  });
