'use strict';

var fs = require('fs');
var http = require('http-https');
var path = require('path');
var url = require('url');

var Promise = require('bluebird');
var concatStream = require('concat-stream');
var semver = require('semver');
var tmpName_ = Promise.promisify(require('tmp').tmpName);
var hashFile = Promise.promisify(require('hash_file'));

module.exports = fetch;
module.exports.json = getJSON;
module.exports.choose = pickPackage;

function fetch (registry, packageSpec, destDir) {
  var _ = packageSpec.split('@'), name = _.shift(), versionRange = (_.shift() || 'latest');
  return getJSON(registry, name).then(function (doc) {
    return pickPackage(versionRange, doc);
  }).then(function (pkg) {
    return Promise.using(getStream(pkg.dist.tarball), tmpName(), function (src, tmp) {
      return writeStreamToFile(src, tmp).then(function () {
        return hashFile(tmp, 'sha1');
      }).then(function (hash) {
        if (pkg.dist.shasum !== hash) {
          throw new Error('Checksum for ' + pkg.dist.tarball + ' was invalid (' + tmp + ')');
        }
        return copy(tmp, path.join(destDir, pkg.dist.tarball.split('/').pop()));
      });
    });
  });
}

function getStream (uri) {
  return new Promise(function (resolve, reject) {
    console.log('GET', uri);
    http.get(url.parse(uri)).on('error', reject).on('response', resolve);
  });
}

function getJSON (registry, name) {
  var uri = [registry, name].join('/');
  return getStream(uri).then(concat).then(function (body) {
    try {
      return JSON.parse(body);
    } catch (e) {
      var err = new Error('Invalid JSON from ' + uri);
      err.stack = e.stack;
      throw err;
    }
  });
}

function pickPackage (versionRange, packageDoc) {
  var tags = packageDoc['dist-tags'] || {};
  var version;
  if (tags.hasOwnProperty(versionRange)) {
    version = tags[versionRange];
  }
  else if (semver.validRange(versionRange) === null) {
    throw new Error('Invalid version range "' + versionRange + '"');
  }
  else {
    version = semver.maxSatisfying(Object.keys(packageDoc.versions), versionRange);
  }
  return packageDoc.versions[version];
}
function writeStreamToFile (stream, filename) {
  return new Promise(function (resolve, reject) {
    stream
      .on('error', reject)
      .on('aborted', function () {
        reject(new Error('Writing ' + filename + ' failed, source aborted.'));
      })
      .pipe(fs.createWriteStream(filename))
      .on('error', reject)
      .on('finish', resolve);
  });
}

function copy (srcPath, destPath) {
  return writeStreamToFile(fs.createReadStream(srcPath), destPath);
}

function tmpName () {
  return tmpName_().disposer(function (tmpPath) {
    try { fs.unlinkSync(tmpPath); } catch (e) {}
  });
}

function concat (stream) {
  return new Promise(function (resolve, reject) {
    stream.on('error', reject).pipe(concatStream(resolve));
  });
}
