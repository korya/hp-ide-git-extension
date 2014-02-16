# GIT extension for HP Pronq IDE

The extension provides a very simple GIT service allowing: to commit changes,
push/pull changes from a remote GIT server.

The extension contradicts the main principle of Pronq IDE
`no data is stored on server side`.
This extension stores *all* the data on server side :D
It was written to provide a revision control service required for development
of [Code Review extension](https://github.com/korya/hp-ide-code-review-extension).
Now this code can be used as an example of an extension involving development
on both server and client sides.

## Install

Fast and easy way:

```bash
$ cd <IDE source>
$ curl -s https://raw.github.com/korya/hp-ide-git-extension/master/install.sh | sh
```

Otherwise, use the steps below.

#### Manual installation

We will use [jsontool](https://github.com/trentm/json) in order to modify
`JSON`-formatted configuration files, so first make sure it's installed:

```bash
$ npm install -g jsontool
```

Now clone the extension into your tree:

```bash
$ cd <IDE source>
$ git submodule add \
    https://github.com/korya/hp-ide-git-extension.git \
    app/extensions/hpsw/git-service/1.00
```

Install the dependencies:

```bash
$ json -I -f package.json -E 'this.dependencies["git-rest-api"]="0.1.1"'
$ npm install git-rest-api@0.1.1
```

Tell the server to load the extension by adding the following line to
`server/file-system/extensions/manifest.json`:

Tell the server to load the extension:
 - add server side code by editing
   `server/file-system/config-files/config.json`:
   ```bash
   $ json -I -f server/file-system/config-files/config.json \
     -E 'this.modules["git-service"]="../app/extensions/hpsw/git-service/1.00/server"'
   ```
 - add client side code by editing
   `server/file-system/extensions/manifest.json`:
   ```bash
   $ json -I -f server/file-system/extensions/manifest.json \
     -E 'this.defaultExtension.push({"id":"git-service","version":1,"author":"hpsw"})'
   ```

## Details

The extension consists of 2 parts:
 1. back-end running on server side and responsible for:
   - storing actual git repositories
   - providing restful API for working with GIT
   The back-end uses: [korya/node-git-rest-api][1]
 2. front-end running on client side:
   - simple git service with exposing only minimal necessary functionality
     (which can be easily extended)
   - hooks for project page:
     * init a repo opon project creation
     * add and commit project template
   - Project GIT menu allowing:
     * manage remotes
     * commit project changes

## Example

The extension is used in [Code Review extension][2]. For example look [here][3].

[1]: https://github.com/korya/node-git-rest-api
[2]: https://github.com/korya/hp-ide-code-review-extension
[3]: https://github.com/korya/hp-ide-git-extension/blob/master/client/project-service-hooks.js
