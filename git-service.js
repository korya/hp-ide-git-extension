define([
], function() {
  'use strict';

  function getBaseUrl(repo) {
    if (!repo) return '/git';
    return '/git/' + repo;
  }

  function getTreeUrl(repo, path) {
    return getBaseUrl(repo) + '/tree/' + path;
  }

  function init(repo) {
    console.log('git init:', {repo: repo});

    return $.ajax({
      type: 'POST',
      url: getBaseUrl() + '/init',
      data: JSON.stringify({ repo: repo }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function clone(remote, repo) {
    console.log('git clone:', {repo: repo, remote: remote});

    return $.ajax({
      type: 'POST',
      url: getBaseUrl() + '/clone',
      data: JSON.stringify({ remote: remote, repo: repo }),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
    });
  }

  function remove(repo) {
    console.log('git remove:', {repo: repo});

    return $.ajax({
      type: 'DELETE',
      url: getBaseUrl(repo),
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

    return $.ajax({
      type: 'POST',
      url: getBaseUrl(repo) + '/commit',
      data: JSON.stringify(params),
      contentType: "application/json; charset=utf-8",
      dataType: "json",
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

    return $.ajax({
      type: 'PUT',
      url: getTreeUrl(repo, filepath),
      contentType: 'multipart/form-data; boundary=' + boundary,
      data: wrapContent(boundary, basename(filepath), content),
    });
  }

  function readFile(repo, filepath) {
    console.log('git read:', {repo: repo, file: filepath});

    return $.ajax({
      type: 'GET',
      url: getTreeUrl(repo, filepath),
    });
  }

  function showFile(repo, filepath, revision) {
    var query = revision ? '?rev=' + revision : '';

    console.log('git show:', {repo: repo, file: filepath, revision: revision});

    return $.ajax({
      type: 'GET',
      url: getBaseUrl(repo) + '/show/' + filepath + query,
    });
  }

  return {
    init: function (extModule) {
      var deferred = $.Deferred();

      extModule.provider('git-service',function() {
	var gitService = {
          init: init,
          clone: clone,
	  remove: remove,
          commit: commit,
          addFile: addFile,
          readFile: readFile,
          showFile: showFile,
	};
	this.$get = function () {
	  return gitService;
	};
      });

      deferred.resolve();

      return deferred.promise();
    },
  };
});
