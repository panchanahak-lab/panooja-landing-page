import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const FRONTEND_SCRIPTS = ['script.js', 'cart.js', 'auth.js'];

for (const file of FRONTEND_SCRIPTS) {
  test(`Frontend Syntax - ${file} parses without syntax errors`, () => {
    const code = fs.readFileSync(file, 'utf8');
    assert.doesNotThrow(() => {
      new vm.Script(code, { filename: file });
    }, `${file} must have valid JavaScript syntax`);
  });
}
