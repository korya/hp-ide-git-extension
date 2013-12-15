define([
  'scripts/core/event-bus',
], function (eventBus) {

  var gitService,
      projectsService,
      contentTypeService,
      fileService;

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

  function gitAddFSFile(repo, file, rootDir) {
    var relPath = file.fullPath.substr(rootDir.length);
    return readFSFile(file.fullPath).then(function (data) {
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
      children.push(gitAddFSFile(repo, node.files[i], rootDir));
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
    var repo = project.name;
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
    var project = projectsService.getProject(projectId);
    var repo = project.name;

    gitService.remove(repo)
      .fail(function (err) {
	console.log('GIT: can\'t remove project', project.name, ':', err);
      });
  }

  return {
    run : [
      'git-service', 'projects-service', 'file-service', 'content-type-service',
      function(gitS, projectsS, fileS, contentTypeS) {
	console.log("[[git-project-service-hooks run]]");

	gitService = gitS;
	projectsService = projectsS;
	fileService = fileS;
	contentTypeService = contentTypeS;

	eventBus.vent.on('project:created', createRepoForProject);
	eventBus.vent.on('project:deleted', deleteRepoForProject);
      }
    ],
  };
});
