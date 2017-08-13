import {
    createConnection,
    CompletionList,
    CompletionItem,
    Definition,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    IConnection,
    InitializeParams,
    InitializeResult,
    TextDocumentPositionParams,
    TextDocumentSyncKind
} from 'vscode-languageserver';

import * as tempy from 'tempy';
import * as fs from 'fs';

import { ILogger, createLogger } from './logger';
import { TsServerClient } from './tsServerClient';

import * as utils from './utils';

export interface IServerOptions {
    logFile?: string;
    tsserverPath?: string;
    tsserverLogFile?: string;
}

export class Server {

    private connection: IConnection;

    private initializeParams: InitializeParams;
    private initializeResult: InitializeResult;
    private tsServerClient: TsServerClient;

    logger: ILogger;

    constructor(
        private options: IServerOptions) {
        this.logger = createLogger(options.logFile);
        this.connection = createConnection();

        this.registerLspEvents();
    }

    private registerLspEvents(): void {
        this.connection.onInitialize(this._onInitialize.bind(this));
        this.connection.onDidOpenTextDocument(this.onDidOpenTextDocument.bind(this));
        this.connection.onDidSaveTextDocument(this.onDidSaveTextDocument.bind(this));
        this.connection.onDidCloseTextDocument(this.onDidCloseTextDocument.bind(this));
        this.connection.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
    }

    listen() {
        this.logger.info('Server.listen()');
        this.connection.listen();
    }

    private _onInitialize(params: InitializeParams): InitializeResult {
        this.logger.info('Server._onInitialize()', params);

        // TODO: validate rootPath and rootUri

        this.initializeParams = params;

        this.tsServerClient = new TsServerClient({
            tsserverPath: this.options.tsserverPath || (utils.isWindows() ? 'tsserver.cmd' : 'tsserver'),
            logFile: this.options.tsserverLogFile,
            logger: this.logger
        });

        this.tsServerClient.start();

        this.initializeResult = {
            capabilities: {
                textDocumentSync: TextDocumentSyncKind.Full,
                completionProvider: {
                    triggerCharacters: ['.'],
                    resolveProvider: false
                },
                definitionProvider: true
            }
        };

        this.logger.info('Server._onInitialize() result', this.initializeResult);
        return this.initializeResult;
    }

    private onDidOpenTextDocument(params: DidOpenTextDocumentParams): void {
        const path = utils.uriToPath(params.textDocument.uri);
        this.logger.info('Server.onDidOpenTextDocument()', params, path);
        this.tsServerClient.sendOpen(path);
    }

    private onDidCloseTextDocument(params: DidOpenTextDocumentParams): void {
        const path = utils.uriToPath(params.textDocument.uri);
        this.logger.info('Server.onDidCloseTextDocument()', params, path);
        this.tsServerClient.sendClose(path);
    }

    private onDidChangeTextDocument(params: DidChangeTextDocumentParams): void {
        const path = utils.uriToPath(params.textDocument.uri),
            tempPath = tempy.file({ extension: 'ts'});

        this.logger.info('Server.onDidCloseTextDocument()', params, path, tempPath);

        fs.writeFileSync(tempPath, params.contentChanges[0].text, 'utf8');
        this.tsServerClient.sendReload(path, tempPath);
    }

    private onDidSaveTextDocument(params: DidChangeTextDocumentParams): void {
        const path = utils.uriToPath(params.textDocument.uri),
            tempPath = tempy.file({ extension: 'ts'});

        this.logger.info('Server.onDidChangeTextDocument()', params, path, tempPath);

        fs.writeFileSync(tempPath, params.contentChanges[0].text, 'utf8');
        this.tsServerClient.sendSaveTo(path, tempPath);
    }

    private onDefinition(params: TextDocumentPositionParams): Thenable<Definition[]> {
        const path = utils.uriToPath(params.textDocument.uri);

        this.logger.info('Server.onDefinition()', params, path);

        return this.tsServerClient.sendDefinition(
            path,
            params.position.line + 1,
            params.position.character + 1)
            .then(result => {
                return result.body
                    .map(definition => {
                        return <Definition>{
                            uri: utils.pathToUri(definition.file),
                            range: {
                                start: {
                                    line: definition.start.line - 1,
                                    character: definition.start.offset - 1
                                },
                                end: {
                                    line: definition.end.line - 1,
                                    character: definition.end.offset - 1
                                }
                            }
                        };
                    });
            });
    }

    private onCompletion(params: TextDocumentPositionParams): Thenable<CompletionList> {
        const path = utils.uriToPath(params.textDocument.uri);

        this.logger.info('Server.onCompletion()', params, path);

        return this.tsServerClient.sendCompletions(
            path,
            params.position.line + 1,
            params.position.character + 1,
            '')
            .then(result  => {
                return {
                    isIncomplete: false,
                    items: result.body
                        .map(item => {
                            return <CompletionItem>{
                                label: item.name,
                                kind: utils.completionKindsMapping[item.kind]
                            };
                        })
                };
            });
    }

}
