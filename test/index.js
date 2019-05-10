const assert = require('assert');
const isal = require('..');
const path = require('path');
const missingTests = [];

// Check all keys on isal and, for each, run a test by the key name and pass
// the corresponding sub-export to it.
Object.keys(isal).forEach((item) => {
  const subExport = isal[item];
  if (typeof subExport === 'object') {
    // Find a test named after `item` and, if found, run it.
    let subExportTestPath = undefined;
    try {
      subExportTestPath = require.resolve(path.join(__dirname, 'bindings', item));
    } catch (anError) {
      assert.strictEqual(anError.code, 'MODULE_NOT_FOUND');
    }
    if (subExportTestPath) {
      require(subExportTestPath)(isal);
    } else {
      missingTests.push(item);
    }
  }
});

assert.deepStrictEqual(missingTests, []);
