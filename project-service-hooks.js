define([
  'scripts/core/event-bus',
], function (eventBus) {

  var gitService,
      projectsService,
      contentTypeService,
      fileService;

  function getRelativePath(absPath, rootDir) {
    if (absPath.indexOf(rootDir) === -1) return null; // Crush it!
    return absPath.substr(rootDir.length);
  }

  /* XXX copy-paste from projects-service.js */
  function _buildRootDir() {
    var _workspaceID = 'workspace',
	_tenantID = 'tenant',
	_userID = 'user';

    return '/' + [_workspaceID, _tenantID , _userID].join('/') + '/';
  }

  function getProjectInfoFromItemId(itemId) {
    var rootDir = _buildRootDir();
    console.log('getInfo', {item: itemId, rootDir: rootDir});
    var id = getRelativePath(itemId, rootDir).split('/').shift();

    return {
      id: id,
      projectDirectory: rootDir + id + '/',
    };
  }

  function readFSFile(filepath) {
    var deferred = new $.Deferred();

    // The code was borrowed from project-service
    {
      var fileExtension = filepath.split('.').pop();
      var contentType = contentTypeService.contentTypeFromFileExtension(fileExtension);
      if (!contentType) {
	contentType = contentTypeService.contentTypeFromMimeType('text/plain');
      }
      var title = filepath.split('/').pop();

      function fileReadHandler(error, data) {
	if (!error) deferred.resolve(data);
	else deferred.reject('Failed to open file [' + filepath + ']');
      }

      if(contentType.id.indexOf('image') >= 0) {
	fileService.readFileAsData(filepath, 'dataURL', fileReadHandler);
      } else if(contentType.id.indexOf('text') >= 0) {
	fileService.readFileAsText(filepath, fileReadHandler);
      }
    }

    return deferred.promise();
  }

  function gitAddFSFile(repo, filePath, rootDir) {
    var relPath = getRelativePath(filePath, rootDir);

    return readFSFile(filePath).then(function (data) {
      return gitService.addFile(repo, relPath, data);
    });
  }

  function gitAddFSTree(repo, node, rootDir) {
    if (node === null) { return $.when(true); }
    if (node.name && !node.isDirectory) { return $.when(true); }

    if (!node.files) node.files = [];
    if (!node.directories) node.directories = [];

    var children = [];
    for (var i = 0; i < node.files.length; i++) 
      children.push(gitAddFSFile(repo, node.files[i].fullPath, rootDir));
    for (var i = 0; i < node.directories.length; i++)
      children.push(gitAddFSTree(repo, node.directories[i], rootDir));
    return $.when.apply(null, children);
  }

  function readFSTree(path) {
    var deferred = new $.Deferred();

    fileService.readTree(path, function (err, tree) {
      if (err) {
	deferred.reject('Projects Service: failed loading project files,' + err);
      } else deferred.resolve(tree);
    });

    return deferred.promise();
  }

  function createRepoForProject(project) {
    /* XXX At this point the project has no structure, thus we have to read its
     * from file service
     */
    var repo = project.id;
    var projectDir = project.projectDirectory;

    gitService.init(repo)
      .then(function () {
	/* Empty commit */
	return gitService.commit(repo, 'initial commit', true);
      })
      .then(function () {
	return readFSTree(projectDir);
      })
      .then(function (tree) {
	return gitAddFSTree(repo, tree, projectDir);
      })
      .then(function () {
	return gitService.commit(repo, 'add template');
      })
      .fail(function (err) {
	console.log('GIT: can\'t init project', project.name, ':', err);
      });
  }

  function deleteRepoForProject(projectId) {
    var repo = projectId;

    gitService.remove(repo)
      .fail(function (err) {
	console.log('GIT: can\'t remove project', project.name, ':', err);
      });
  }

  function createFile(project, fileItem) {
    var repo = project.id;

    if (fileItem.isFolder) return;

    gitAddFSFile(repo, fileItem.id, project.projectDirectory);
  }

  function moveFile(project, fileItem, oldId, newId) {
    var oldPath = getRelativePath(oldId, project.projectDirectory);
    var newPath = getRelativePath(newId, project.projectDirectory);
    var repo = project.id;

    gitService.moveFile(repo, oldPath, newPath);
  }

  function saveFile(itemId) {
    var info = getProjectInfoFromItemId(itemId);
    var repo = info.id;

    gitAddFSFile(repo, itemId, info.projectDirectory);
  }

  function deleteFile(project, itemId) {
    var repo = project.id;
    var relPath = getRelativePath(itemId, project.projectDirectory);

    gitService.removeFile(repo, relPath);
  }

  function createCommitDialog(dialogService, gitService, project) {
    var repo = project.id;
    var $message = $('<input type="text">');
    var $empty = $('<input type="checkbox">');
    var $error = $('<span style="color: red;">');
    var dialogParams = {
      closeOnEscape: true,
      draggable: true,
      modal: true,
      width: '400'
    };
    var dialog = dialogService.createDialog('Commit', dialogParams, [
      {
	label: 'Commit',
	title: 'Commit',
	handler: function() {
	  var message = $message.val();
	  var allowEmpty = $empty.is(':checked');
	  gitService.commit(repo, message, allowEmpty).then(function () {
	    dialog.close();
	  }, function (err) {
	    $error.text(err.responseJSON.error);
	    $error.show();
	  });
	},
      },
      {
	label: 'Cancel',
	title: 'Cancel',
	handler: function() { dialog.close(); }
      }
    ], function (dialog) {
      $(dialog.getDomElement())
        .append(
	  $('<div>').append($('<label>Commit Message:</label>')).append($message)
	)
        .append(
	  $('<div>').append($('<label>Allow empty commit:</label>')).append($empty)
	)
        .append( $('<div>').append($error) );
      $error.hide();
    });
  }

  function renderRemoteDialog($dialog, gitService, project) {
    var repo = project.id;

    function renderRemote($table, remote) {
      var $tr = $('<tr>');
      var $error = $('<span style="color: red;">');
      var $btn = $('<button type="button">Remove</button>');

      $btn.click(function () {
	$btn.attr('disabled', true);
	$error.hide();
	gitService.remRemote(repo, remote.name)
	  .done(function () {
	    $tr.remove();
	  })
	  .fail(function (error) {
	    $error.text(error);
	    $error.show();
	  })
	  .always(function () {
	    $btn.attr('disabled', false);
	  });
      });

      $tr
	.append($('<td>').append(remote.name))
	.append($('<td>').append(remote.url))
	.append($('<td>').append($btn.css('width', '100%')))
	.append($('<td>').append($error))
	.appendTo($table);
    }

    var $table = $('<table>').css('width', '500px');
      
    $('<tr>')
      .append($('<th>Name</th>').css('width', '130px'))
      .append($('<th>URL</th>').css('width', '300px'))
      .append($('<th></th>').css('width', '70px'))
      .appendTo($table);

    gitService.getRemotes(repo).done(function (remotes) {
      console.error('rs:', remotes);
      _.forEach(remotes, function (remote) {
	renderRemote($table, remote);
      });
    });

    var $name = $('<input type="text">').css('width', '130px');
    var $url = $('<input type="text">').css('width', '300px');
    var $error = $('<span style="color: red;">');
    var $btn = $('<button type="button">Add</button>').css('width', '70px');

    $btn.click(function () {
      var name = $name.val();
      var url = $url.val();

      $btn.attr('disabled', true);
      $error.hide();
      gitService.addRemote(repo, name, url)
	.done(function () {
	  renderRemote($table, {name:name, url:url})
	  $name.val('');
	  $url.val('');
	})
	.fail(function (error) {
	  $error.text(error);
	  $error.show();
	})
	.always(function () {
	  $btn.attr('disabled', false);
	});
    });

    $('<div>')
      .append($table)
      .append(
	$('<div>').append($name).append($url).append($btn).append($error)
      )
      .appendTo($dialog);
  }

  function createRemoteDialog(dialogService, gitService, project) {
    var dialogParams = {
      closeOnEscape: true,
      draggable: true,
      modal: true,
      width: '700'
    };

    var dialog = dialogService.createDialog('Edit Remotes', dialogParams, [
      {
	label: 'Close',
	title: 'Close',
	handler: function() { dialog.close(); }
      }
    ], function (dialog) {
      var $dialog = $(dialog.getDomElement());
      renderRemoteDialog($dialog, gitService, project);
    });
  }

  return {
    config: [
      'commands-serviceProvider', 'conditions-serviceProvider', 'menu-serviceProvider',
      function (commandsProvider, conditionsProvider, menuProvider) {
	commandsProvider.register(
	  'git.commit',
	  ['dialog-service', 'git-service', 'projects-service',
	  function (dialogService, gitService, projectsService) {
	    return function () {
	      var project = projectsService.getActiveProject();
	      createCommitDialog(dialogService, gitService, project);
	    };
	  }], 'activeProjectCondition');
	commandsProvider.register(
	  'git.remote.edit',
	  ['dialog-service', 'git-service', 'projects-service',
	  function (dialogService, gitService, projectsService) {
	    return function () {
	      var project = projectsService.getActiveProject();
	      createRemoteDialog(dialogService, gitService, project);
	    };
	  }], 'activeProjectCondition');

	menuProvider.registerMenu({
	  id : 'git.menu',
	  title : 'Git',
	  parentId : 'coreMainMenuProject'
	});
	menuProvider.registerMenuItem({
	  id : 'git.commit',
	  title : 'Git Commit',
	  parentId : 'git.menu',
	  order : -1,
	  commandId : 'git.commit'
	});
	menuProvider.registerMenuItem({
	  id : 'git.remote.edit',
	  title : 'Remotes edit',
	  parentId : 'git.menu',
	  order : -1,
	  commandId : 'git.remote.edit'
	});
      }
    ],
    run : [
      'git-service', 'projects-service', 'file-service', 'content-type-service',
      function(gitS, projectsS, fileS, contentTypeS) {
	console.log("[[git-project-service-hooks run]]");

	gitService = gitS;
	projectsService = projectsS;
	fileService = fileS;
	contentTypeService = contentTypeS;

	eventBus.vent.on('project:created', createRepoForProject);
	eventBus.vent.on('project:renamed', function (e) {
	  console.error('GIT service: missed project:renamed event:', e);
	});
	eventBus.vent.on('project:deleted', deleteRepoForProject);
	eventBus.vent.on('project:item:created', createFile);
	eventBus.vent.on('project:item:renamed', moveFile);
	eventBus.vent.on('project:item:saved', saveFile);
	eventBus.vent.on('project:item:deleted', deleteFile);
      }
    ],
  };
});
