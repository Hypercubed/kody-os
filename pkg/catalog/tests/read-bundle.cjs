'use strict';
// Shared catalog-test reader: returns a definition's bundle files map
// whether the on-disk definition carries the inline contents map or the
// on-disk manifest list (bundle files on disk next to definition.json).
// Keeps the per-app tests working across the inline-to-manifest move
// without one-off path logic in every file.
const fs = require('fs');
const path = require('path');

function readBundleFiles(definitionPath) {
  var definition = JSON.parse(fs.readFileSync(definitionPath, 'utf8'));
  var files = definition.bundle.files;
  if (Array.isArray(files)) {
    var dir = path.dirname(definitionPath);
    var map = {};
    for (var i = 0; i < files.length; i++) {
      map[files[i]] = fs.readFileSync(path.join(dir, files[i]), 'utf8');
    }
    return { definition: definition, files: map };
  }
  return { definition: definition, files: files };
}

module.exports = { readBundleFiles: readBundleFiles };
