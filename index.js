/*!
 * verb-repo-helpers <https://github.com/verbose/verb-repo-helpers>
 *
 * Copyright (c) 2016-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

'use strict';

var fs = require('fs');
var util = require('util');
var path = require('path');
var debug = require('debug')('verb:generator:repo-helpers');
var utils = require('./utils');

module.exports = function plugin(app) {
  if (!utils.isValid(app, 'verb-repo-helpers')) return;
  debug('initializing <%s>, called by <%s>', __filename, module.parent.id);

  app.helper('relative', function(dest) {
    return (dest !== this.app.cwd) ? path.relative(dest, this.app.cwd) : './';
  });

  app.asyncHelper('section', function(name, locals, cb) {
    if (typeof locals === 'function') {
      cb = locals;
      locals = {};
    }
    var view = app.includes.getView(name);
    var fallback = '';

    if (typeof locals === 'string') {
      fallback = locals;
    }

    if (typeof view === 'undefined') {
      cb(null, fallback);
      return;
    }
    app.render(view, locals, function(err, res) {
      if (err) return cb(err);
      cb(null, res.content);
    });
  });

  app.asyncHelper('block', function(name, options, cb) {
    app.include(name, options.fn(this));
    cb(null, '');
  });

  /**
   * async helpers
   */

  app.asyncHelper('related', function() {
    return utils.related(this.options).apply(this, arguments);
  });

  app.asyncHelper('reflinks', function() {
    return utils.reflinks(this.options).apply(this, arguments);
  });

  /**
   * GitHub helpers, namespaces on the `gh` object
   */

  app.helperGroup('gh', {
    contributors: function(repo, options, cb) {
      if (typeof repo === 'function') {
        cb = repo;
        options = {};
        repo = null;
      }
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
      if (typeof repo !== 'string') {
        options = repo;
        repo = null;
      }

      var opt = Object.assign({}, this.options);
      delete opt.lookup;

      options = utils.merge({}, options || opt);
      var format = options.format || 'table';
      options.format = 'noop';

      repo = repo || this.context.repository;
      if (!repo) {
        cb();
        return;
      }

      utils.contributors(repo, options, function(err, people) {
        if (err) return cb(err);
        if (people.length === 0) {
          cb(null);
          return;
        }

        if (people.length === 1 && options.singleContributor !== true) {
          cb(null, '');
        }
        var opts = utils.merge({}, options, {format: format});
        cb(null, utils.formatPeople(people, opts));
      });
    }
  }, true);

  /**
   * Create a GitHub issue linke
   */

  app.helper('issue', function(options) {
    var opts = utils.merge({}, this.context, options);
    opts.owner = opts.owner || opts.author && opts.author.username;
    opts.repo = opts.name;
    return utils.issue(opts);
  });

  /**
   * Return `val` if a file or one of the given `files` exists on the file system.
   *
   * ```html
   * <%= ifExists(['foo.js', 'bar.js'], doSomething) %>
   * ```
   * @param {String|Array} `files`
   * @param {any} `val` The value to return if one of the given `files` exists
   * @param {Function} `cb` Callback
   * @api public
   */

  app.asyncHelper('ifExists', function(files, val, cb) {
    debug('ifExists helper', files, val);
    if (utils.exists(files, app.cwd)) {
      cb(null, val);
    } else {
      cb(null, '');
    }
  });

  /**
   * Include template `name`
   *
   * ```html
   * <%= maybeInclude('foo', doSomething) %>
   * ```
   * @param {String|Array} `files`
   * @param {any} `val` The value to return if one of the given `files` exists
   * @param {Function} `cb` Callback
   * @api public
   */

  app.asyncHelper('maybeInclude', function(name, helperName, cb) {
    debug('maybeInclude helper', name);
    if (typeof helperName === 'function') {
      cb = helperName;
      helperName = 'include';
    }

    var opts = utils.merge({}, this.options, this.context);
    if (opts[name]) {
      var fn = app.getAsyncHelper(helperName);
      return fn.apply(this, arguments);
    } else {
      cb(null, '');
    }
  });

  /**
   * Get a package.json from npm's API
   */

  app.asyncHelper('pkg', function fn(name, prop, cb) {
    debug('pkg helper: %s, <%s>', name, prop);
    if (typeof prop === 'function') {
      cb = prop;
      prop = null;
    }

    var key = name + ':' + String(prop);
    if (fn[key]) {
      cb(null, fn[key]);
      return;
    }

    utils.getPkg(name, function(err, pkg) {
      if (err) return cb(err);
      var res = prop ? utils.get(pkg, prop) : pkg;
      fn[key] = res;
      cb(null, res);
    });
  });

  app.asyncHelper('read', function(fp, cb) {
    debug('read helper', fp);
    fs.readFile(fp, 'utf8', cb);
  });

  /**
   * sync helpers
   */

  app.helper('require', function(name) {
    debug('require helper', name);
    try {
      return require(name);
    } catch (err) {}
    try {
      return require(path.resolve(name));
    } catch (err) {}
    return '';
  });

  // date helper
  app.helper('date', function() {
    debug('date helper');
    return utils.date.apply(this, arguments);
  });

  app.helper('apidocs', function() {
    debug('apidocs helper');
    var fn = utils.apidocs(this.options);
    return fn.apply(null, arguments);
  });

  app.helper('copyright', function() {
    debug('copyright helper');
    var fn = utils.copyright({linkify: true});
    return fn.apply(this, arguments);
  });

  /**
   * Display a commented line of code
   */

  app.helper('results', function(val) {
    debug('results helper', val);
    var fn = require(utils.resolve.sync(app.cwd));
    var lines = util.inspect(fn(val)).split('\n');
    return lines.map(function(line) {
      return '//' + line;
    }).join('\n');
  });

  app.helper('previous', function(increment, v) {
    var segs = String(v).split('.');
    var version = '';
    switch (increment) {
      case 'major':
        version = (segs[0] - 1) + '.0.0';
        break;
      case 'minor':
      default: {
        version = segs[0] + '.' + (segs[1] - 1) + '.0';
        break;
      }
    }
    return version;
  });

  debug('helpers finished');
  return plugin;
};
