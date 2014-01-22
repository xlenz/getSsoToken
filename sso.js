'use strict';

var request = require('request');
var cheerio = require('cheerio');
var querystring = require('querystring');
var libxmljs = require("libxmljs");

var usrAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1700.76 Safari/537.36';
var loginUrl = 'http://{0}/workcenter/tmtrack.dll?shell=swc';
var authUrl = 'http://{0}:8085/idp/login?sid={1}&continue=http%3A%2F%2F{0}' +
  '%2Fworkcenter%2Ftmtrack.dll%3Fshell%3Dswc';
var re = /sid=(.*?)(&)/;

//params: host, usr, pwd, isEncoded

function getSSOToken(params, callback) {
  var usr = params.usr ? params.usr : 'admin';
  var pwd = params.pwd ? params.pwd : '';
  var isEncoded = params.isEncoded ? params.isEncoded : false;

  if (!params.host) {
    throw new Error('host name should be provided');
  }
  if (!callback) {
    throw new Error('you must use callback in order to get token');
  }
  console.log('Getting sso, host: "{0}", usr: "{1}", pwd: "{2}", isEncoded: "{3}" \n'
    .format(params.host, usr, pwd, isEncoded));

  loginUrl = loginUrl.format(params.host);
  authUrl = authUrl.format(params.host, '{0}');

  getAuthData(usr, pwd, isEncoded, callback);
}

function getAuthData(usr, pwd, isEncoded, callback) {
  request({
      headers: {
        'User-Agent': usrAgent
      },
      method: 'GET',
      uri: loginUrl
    },
    function (err, res, body) {
      var $ = cheerio.load(body);
      var loginAction = $('form#LoginForm').attr('action');
      if (!loginAction) {
        throw new Error('Failed to get SSO login page.');
      }
      var matches = loginAction.match(re);
      var sid = matches[1];
      var opaque = $('input[name=opaque]').val();

      authUrl = authUrl.format(sid);
      var form = {
        username: usr,
        password: pwd,
        opaque: opaque,
        logintype: '1'
      };

      auth(querystring.stringify(form), isEncoded, callback);
    });
}

function auth(formData, isEncoded, callback) {
  var contentLength = formData.length;
  request({
    headers: {
      'Content-Length': contentLength,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    uri: authUrl,
    body: formData,
    method: 'POST'
  }, function (err, res, body) {
    var $ = cheerio.load(body);
    var inputWresult = $('input[name=wresult]').val();
    if (!inputWresult) {
      throw new Error('Seems that user or password is invalid.');
    }
    var wresult = inputWresult.replace(/\+/g, ' ');
    var unescaped = querystring.unescape(wresult);

    var xmlDoc = libxmljs.parseXml(unescaped);
    var gchild = xmlDoc.find('//saml:Assertion', {
      saml: 'urn:oasis:names:tc:SAML:1.0:assertion'
    });
    var tokenXml = gchild[0].toString();

    var buf = new Buffer(tokenXml);
    var tokenBase64 = buf.toString('base64');

    var token = isEncoded ? tokenXml : tokenBase64;

    callback(token);
  });
}

if (!String.prototype.format) {
  String.prototype.format = function () {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function (match, number) {
      return typeof args[number] != 'undefined' ? args[number] : match;
    });
  };
}

module.exports = getSSOToken;

/*
getSSOToken({
  host: 'stl-qa-oalmt3'
}, function (token) {
  console.log(token);
});
*/
