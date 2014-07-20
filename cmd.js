#!/usr/bin/env node
'use strict';

var argv = require('minimist')(process.argv.slice(2));
var Promise = require('bluebird');

var fetch = require('./fetch.js');

if (!argv._.length) {
  console.error('usage: np fetch [options] package[@version] ...');
  process.exit(1);
}

var registry = argv.registry || process.env.np_config_registry;

if (!registry) {
  console.error(
    'running np-fetch directly does not load configuration files, use "np fetch" instead'
  );
  registry = 'https://registry.npmjs.org';
}

var destination = argv.to || process.env.np_cwd || process.cwd();

Promise.map(argv._, function (packageSpec) {
  return fetch(registry, packageSpec, destination);
}).catch(function (err) {
  console.error(err);
  process.exit(err.exitCode || 1);
}).done();
