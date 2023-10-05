#!/usr/bin/env node

module.exports = Formatter

var util = require('util')
var reporters = require('./lib/reporters/index.js')
Formatter.types = Object.keys(reporters).sort()
var Writable = require('stream').Writable

var Runner = require('./lib/runner.js')
var Parser = require('tap-parser')

util.inherits(Formatter, Writable)

var exitCode
function Formatter (type, options) {
  if (!(this instanceof Formatter)) {
    return new Formatter(type, options)
  }
  var _reporter = reporters[type];
  if (!_reporter) {
    try {
      _reporter = require(type);
    } catch (err) {
      console.warn(err);
    }
  }
  if (!_reporter) {
    console.error('Unknown format type: %s\n\n%s', type, avail())
    type = 'silent'
  }

  this.writable = true

  // don't actually need a reporter to report the tap we're getting
  // just parse it so that we exit with the correct code, but otherwise
  // dump it straight through to stdout.
  if (type === 'tap') {
    var p = new Parser()
    this.write = function (chunk) {
      process.stdout.write(chunk)
      return p.write(chunk)
    }
    this.end = p.end.bind(p)
    p.on('complete', function () {
      if (!p.ok)
        exitCode = 1
    })
    return this
  }

  var runner = this.runner = new Runner(options)
  var reporter = this.reporter = new _reporter(this.runner, {})
  Writable.call(this, options)

  runner.on('end', function () {
    if (!runner.parser.ok)
      exitCode = 1

    if (reporter.done) {
      reporter.done(runner.stats.failures, process.exit)
    }
  })
}

process.on('exit', function (code) {
  if (!code && exitCode)
    process.exit(exitCode)
})

Formatter.prototype.write = function () {
  return this.runner.write.apply(this.runner, arguments)
}

Formatter.prototype.end = function () {
  return this.runner.end.apply(this.runner, arguments)
}

function avail () {
  var types = Formatter.types.reduce(function (str, t) {
    var ll = str.split('\n').pop().length + t.length
    if (ll < 40)
      return str + ' ' + t
    else
      return str + '\n' + t
  }, '').trim()

  return 'Available format types:\n\n' + types
}


function usage (err) {
  console[err ? 'error' : 'log'](function () {/*
Usage:
  tap-mocha-reporter <type>

Reads TAP data on stdin, and formats to stdout using the specified
reporter.  (Note that some reporters write to files instead of stdout.)

%s
*/}.toString().split('\n').slice(1, -1).join('\n'), avail())
}

if (require.main === module) {
  var type = process.argv[2]
  if (!type)
    return usage()

  process.stdin.pipe(new Formatter(type))
}
