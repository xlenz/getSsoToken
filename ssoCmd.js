'use strict';

var getSSOToken = require('./sso.js');
var host = process.argv[2] || null;
var usr = process.argv[3] || null;
var pwd = process.argv[4] || null;
var isEncoded = process.argv[5] || false;

getSSOToken({
  host: host,
  usr: usr,
  pwd: pwd,
  isEncoded: isEncoded
}, function (token) {
  console.log(token);
});
