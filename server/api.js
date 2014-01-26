var api = require('git-rest-api'),
    os = require('os'),
    path = require('path'),
    config = require(path.join(global.rootDirectory, 'core/config'));

exports.initRoutes = function (app) {
  var restServicePath = config.applicationPaths().restServicePath;

  return api.init(app, {
    prefix: restServicePath + 'git',
    tmpDir: path.join(os.tmpdir(), 'git-temp-dir'),
  });
};
