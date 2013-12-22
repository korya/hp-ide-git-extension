define({
  author: 'hpsw',
  id: 'git-service',
  version: 1.00,
  description: 'Git repository management',
  moduleLoaders:[
    {
      id: 'git-service',
      main: 'git-service',
      dependencies:[]
    },
    {
      id: 'git-project-service-hooks',
      main: 'project-service-hooks',
      dependencies:['projects-service']
    }
  ]
});
