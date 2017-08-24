# typescript-language-server
[Language Server Protocol](https://github.com/Microsoft/language-server-protocol) implementation for Typescript via tsserver.cmd :warning: WIP :warning:

[![https://nodei.co/npm/typescript-language-server.png?downloads=true&downloadRank=true&stars=true](https://nodei.co/npm/typescript-language-server.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/typescript-language-server)

# Installing

```sh
npm install -g typescript-language-server
```

# Running the language server

```
typescript-language-server --stdio
```

**Note:** `typescript-language-server` requires `tsserver` to be in path. You can install using `npm install -g typescript`.
If you would like to use a different `tsserver` specify the absolute path using `--tserver-path`. Make sure to append `.cmd` if windows.

## Options

```
$ typescript-language-server --help

  Usage: typescript-language-server [options]


  Options:

    -V, --version           output the version number
    --stdio                 use stdio
    --node-ipc              use node-ipc
    --socket <port>         use socket. example: --socket=5000
    --tsserver-path <path>  absolute path to tsserver. example: --tsserver-path=c:\tsc\tsserver
    -h, --help              output usage information
```

# Supported Protocol features

* textDocument/completion
* textDocument/definition
* textDocument/didChange
* textDocument/didClose
* textDocument/didOpen
* textDocument/didSave
* textDocument/documentSymbol
* textDocument/hover
* textDocument/references
* workspace/symbol

# Development

### Build

```sh
npm install
npm run build
```

### Watch

```sh
npm install
npm run watch
```
