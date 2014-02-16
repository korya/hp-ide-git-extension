define({
  author: 'hpsw',
  id: 'git-service',
  version: 1.00,
  description: 'Git repository management',
  moduleLoaders:[
    {
      id: 'git-service',
      main: 'client/git-service',
      dependencies:[]
    },
    {
      id: 'git-project-service-hooks',
      main: 'client/project-service-hooks',
      dependencies:['projects-service']
    }
  ]
});
