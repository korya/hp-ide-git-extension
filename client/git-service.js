define([
], function() {
  'use strict';

  var REST_API_URL = '/services/rest/v1';
  var GIT_SERVICE_URL = REST_API_URL + '/git';

  function getBaseUrl(repo) {
    if (!repo) return GIT_SERVICE_URL;
    return GIT_SERVICE_URL + '/repo/' + repo;
  }

  function getTreeUrl(repo, path) {
    return getBaseUrl(repo) + '/tree/' + path;
  }

  function ajax(params) {
    /* Get rid of jQuery ajax stuff */
    return $.ajax(params).then(function (res) {
      return $.when(res);
    }, function (xhr) {
      var error = '';
      if (xhr.responseJSON && xhr.responseJSON.error) {
	error += xhr.responseJSON.error.error;
	error += '\n\n';
	error += xhr.responseJSON.error.command;
	error += '\n\n';
	error += xhr.responseJSON.error.stackAtCall;
      } else if (xhr.responseText) {
	error += xhr.responseText;
      } else {
	error += xhr.status + ': ' + xhr.statusText;
      }
      console.error('GIT ajax error:', xhr.status,
	{xhr:xhr, error:error, params:params});
      return $.Deferred().reject(error).promise();
    });
  }

  function getLocalRepositories() {
    console.log('git list repositories');

    return ajax({
      type: 'GET',
      url: getBaseUrl() + '/',
    });
  }

  function init(repo) {
    console.log('git init:', {repo: repo});

    return ajax({
      type: 'POST',
      url: getBaseUrl() + '/init',
      data: JSON.stringify({ repo: repo }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function clone(remote, repo, bare) {
    console.log('git clone:', {repo: repo, remote: remote});

    return ajax({
      type: 'POST',
      url: getBaseUrl() + '/clone',
      data: JSON.stringify({ remote: remote, repo: repo, bare: !!bare }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function remove(repo) {
    console.log('git remove:', {repo: repo});

    return ajax({
      type: 'DELETE',
      url: getBaseUrl(repo),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function push(repo, remote, branch) {
    console.log('git push:', {repo: repo, remote: remote, branch:branch});

    return ajax({
      type: 'POST',
      url: getBaseUrl(repo) + '/push',
      data: JSON.stringify({ remote: remote, branch: branch }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function commit(repo, message, allowEmpty) {
    var params = {
      message: message,
    };

    if (allowEmpty) params['allow-empty'] = true;

    console.log('git commit:', {repo: repo, message: message});

    return ajax({
      type: 'POST',
      url: getBaseUrl(repo) + '/commit',
      data: JSON.stringify(params),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function commitShow(repo, sha1) {
    console.log('git show commit:', {repo: repo, sha1: sha1});

    return ajax({
      type: 'GET',
      url: getBaseUrl(repo) + '/commit/' + sha1,
    });
  }

  function log(repo) {
    console.log('git log:', {repo: repo});

    return ajax({
      type: 'GET',
      url: getBaseUrl(repo) + '/log',
    });
  }

  function addFile(repo, filepath, content) {
    function wrapContent(boundary, filename, content) {
      var str = '';
      str += '--' + boundary + '\r\n';
      str += 'Content-Disposition: form-data; name="file"; filename="'+filename+'"\r\n';
      str += 'Content-Type: image/png\r\n';
      str += '\r\n';
      str += content;
      str += '\r\n--' + boundary + '--';
      return str;
    }
    function basename(filepath) {
      return filepath.split('/').pop();
    }

    var boundary = Math.random();

    console.log('git add:', {repo: repo, file: filepath});

    return ajax({
      type: 'PUT',
      url: getTreeUrl(repo, filepath),
      contentType: 'multipart/form-data; boundary=' + boundary,
      data: wrapContent(boundary, basename(filepath), content),
    });
  }

  function readFile(repo, filepath) {
    console.log('git read:', {repo: repo, file: filepath});

    return ajax({
      type: 'GET',
      url: getTreeUrl(repo, filepath),
    });
  }

  function showFile(repo, filepath, revision) {
    var query = revision ? '?rev=' + revision : '';

    console.log('git show:', {repo: repo, file: filepath, revision: revision});

    return ajax({
      type: 'GET',
      url: getBaseUrl(repo) + '/show/' + filepath + query,
    });
  }

  function moveFile(repo, oldPath, newPath) {
    console.log('git move:', {repo: repo, src: oldPath, dst: newPath});

    return ajax({
      type: 'POST',
      url: getBaseUrl(repo) + '/mv',
      data: JSON.stringify({ source: oldPath, destination: newPath}),
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
    });
  }

  function removeFile(repo, filepath) {
    console.log('git remove:', {repo: repo, path: filepath});

    return ajax({
      type: 'DELETE',
      url: getTreeUrl(repo, filepath),
      contentType: 'application/json; charset=utf-8',
      dataType: 'json',
    });
  }

  function getRemotes(repo) {
    console.log('git get remotes:', {repo:repo});

    return ajax({
      type: 'GET',
      url: getBaseUrl(repo) + '/remote',
    });
  }

  function addRemote(repo, remoteName, remoteUrl) {
    console.log('git add remote:', {repo:repo, name:remoteName, url:remoteUrl});

    return ajax({
      type: 'POST',
      url: getBaseUrl(repo) + '/remote',
      data: JSON.stringify({ name:remoteName, url:remoteUrl }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function remRemote(repo, remoteName) {
    console.log('git rem remote:', {repo:repo, name:remoteName});

    return ajax({
      type: 'DELETE',
      url: getBaseUrl(repo) + '/remote',
      data: JSON.stringify({ name:remoteName }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  var gitService = {
    getLocalRepositories: getLocalRepositories,
    init: init,
    clone: clone,
    push: push,
    getRemotes: getRemotes,
    addRemote: addRemote,
    remRemote: remRemote,
    remove: remove,
    commit: commit,
    commitShow: commitShow,
    log: log,
    addFile: addFile,
    readFile: readFile,
    showFile: showFile,
    moveFile: moveFile,
    removeFile: removeFile,
  };

  return {
    factorys: {
      'git-service': function () {
	return gitService;
      },
    },
  };
});
