# GIT service extension for HP Pronq IDE

The extension provides a simple GIT service allowing: to commit changes,
push/pull changes from a remote GIT server.

## Install

```shell
$ cd <IDE source>
$ git submodule add \
    https://github.com/korya/hp-ide-git-extension.git \
    app/extensions/hpsw/git/1.00
```

Tell the server about to load the extension by adding the following line to
`server/file-system/extensions/manifest.json`:
```javascript
    {"id":"git-service","version":1,"author":"hpsw"},
```

## Details

The extension consists of 2 parts:
 1. back-end running on server side and responsible for:
   - storing actual git repositories
   - providing restful API for working with GIT
   The back-end uses: korya/node-git-rest-api
 2. front-end running on client side:
   - simple git service with exposing only minimal necessary functionality
     (which can be easily extended)
   - hooks for project page:
     * init a repo opon project creation
     * add and commit project template
   - Project GIT menu allowing:
     * manage remotes
     * commit project changes
