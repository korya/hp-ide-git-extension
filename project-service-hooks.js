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
	  }], conditionsProvider.ALWAYS_ON);

	menuProvider.registerMenuItem({
	  id : 'git.commit',
	  title : 'Git Commit',
	  parentId : 'coreMainMenuProject',
	  order : -1,
	  commandId : 'git.commit'
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
