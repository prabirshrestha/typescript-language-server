import {
    createConnection,
    CompletionList,
    CompletionItem,
    Definition,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    Hover,
    IConnection,
    InitializeParams,
    InitializeResult,
    Location,
    SymbolKind,
    SymbolInformation,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    WorkspaceSymbolParams
} from 'vscode-languageserver';

import * as tempy from 'tempy';
import * as fs from 'fs';

import { ILogger, createLogger } from './logger';
import { TsServerClient } from './tsServerClient';

import * as TsProtocol from 'typescript/lib/protocol';

import * as utils from './utils';

export interface IServerOptions {
    logFile?: string;
    tsserverPath: string;
    tsserverLogFile?: string;
}

export class Server {

    private connection: IConnection;

    private initializeParams: InitializeParams;
    private initializeResult: InitializeResult;
    private tsServerClient: TsServerClient;

    logger: ILogger;

    private _lastFile: string; // dummy file required for navto

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
        this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onReferences(this.onReferences.bind(this));
        this.connection.onWorkspaceSymbol(this.onWorkspaceSymbol.bind(this));
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
            tsserverPath: this.options.tsserverPath,
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
                definitionProvider: true,
                documentSymbolProvider: true,
                hoverProvider: true,
                referencesProvider: true,
                workspaceSymbolProvider: true
            }
        };

        this.logger.info('Server._onInitialize() result', this.initializeResult);
        return this.initializeResult;
    }

    private onDidOpenTextDocument(params: DidOpenTextDocumentParams): void {
        const path = utils.uriToPath(params.textDocument.uri);
        this._lastFile = path;
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

        this._lastFile = path;

        this.logger.info('Server.onDidCloseTextDocument()', params, path, tempPath);

        fs.writeFileSync(tempPath, params.contentChanges[0].text, 'utf8');
        this.tsServerClient.sendReload(path, tempPath);
    }

    private onDidSaveTextDocument(params: DidChangeTextDocumentParams): void {
        const path = utils.uriToPath(params.textDocument.uri),
            tempPath = tempy.file({ extension: 'ts'});

        this._lastFile = path;

        this.logger.info('Server.onDidChangeTextDocument()', params, path, tempPath);

        fs.writeFileSync(tempPath, params.contentChanges[0].text, 'utf8');
        this.tsServerClient.sendSaveTo(path, tempPath);
    }

    private onDefinition(params: TextDocumentPositionParams): Thenable<Definition> {
        const path = utils.uriToPath(params.textDocument.uri);

        this.logger.info('Server.onDefinition()', params, path);

        return this.tsServerClient.sendDefinition(
            path,
            params.position.line + 1,
            params.position.character + 1)
            .then(result => {
                return result.body
                    .map(fileSpan => utils.tsServerFileSpanToLspLocation(fileSpan));
            });
    }

    private onDocumentSymbol(params: TextDocumentPositionParams): Thenable<SymbolInformation[]> {
        const path = utils.uriToPath(params.textDocument.uri);

        this.logger.info('Server.onDocumentSymbol()', params, path);

        return this.tsServerClient.sendNavTree(
            path)
            .then(result => {
                // walk navtree in pre-order
                const symbols: SymbolInformation[] = [],
                    stack: TsProtocol.NavigationTree[] = [];

                if (!!result.body) {
                    stack.push(result.body);
                }

                while (stack.length > 0) {
                    const item = stack.pop(),
                        span = item.spans[0];

                    if (span) {
                        symbols.push({
                            location: {
                                uri: params.textDocument.uri,
                                range: {
                                    start: utils.tsServerLocationToLspPosition(span.start),
                                    end: utils.tsServerLocationToLspPosition(span.end)
                                }
                            },
                            // TODO: for now make everything as variable for unknown
                            kind: utils.symbolKindsMapping[item.kind] || SymbolKind.Variable,
                            name: item.text
                        });
                    }

                    if (item.childItems) {
                        item.childItems.forEach(childItem => stack.push(childItem));
                    }
                }

                return symbols;
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

    private onHover(params: TextDocumentPositionParams): Thenable<Hover> {
        const path = utils.uriToPath(params.textDocument.uri);

        this.logger.info('Server.onHover()', params, path);

        return this.tsServerClient.sendQuickInfo(
            path,
            params.position.line + 1,
            params.position.character + 1)
            .then(result => {
                return <Hover>{
                    contents: result.body.displayString,
                    range: {
                        start: utils.tsServerLocationToLspPosition(result.body.start),
                        end: utils.tsServerLocationToLspPosition(result.body.end)
                    }
                };
            });
    }

    private onReferences(params: TextDocumentPositionParams): Thenable<Location[]> {
        const path = utils.uriToPath(params.textDocument.uri);

        this.logger.info('Server.onReferences()', params, path);

        return this.tsServerClient.sendReferences(
            path,
            params.position.line + 1,
            params.position.character + 1)
            .then(result => {
                return result.body.refs
                    .map(fileSpan => utils.tsServerFileSpanToLspLocation(fileSpan));
            });
    }

    private onWorkspaceSymbol(params: WorkspaceSymbolParams): Thenable<SymbolInformation[]> {
        return this.tsServerClient.sendNavTo(
            params.query,
            this._lastFile
        )
        .then((result) => {
            return result.body.map(item => {
                return <SymbolInformation>{
                    location: {
                        uri: utils.pathToUri(item.file),
                        range: {
                            start: utils.tsServerLocationToLspPosition(item.start),
                            end: utils.tsServerLocationToLspPosition(item.end)
                        }
                    },
                    // TODO: for now make everything as variable for unknown
                    kind: utils.symbolKindsMapping[item.kind] || SymbolKind.Variable,
                    name: item.name
                };
            });
        });
    }


}
