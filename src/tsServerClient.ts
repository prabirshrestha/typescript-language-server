import * as cp from 'child_process';
import * as readline from 'readline';
import * as protocol from 'typescript/lib/protocol';

import { ILogger } from './logger';

import * as utils from './utils';

export interface ITsServerClientOptions {
    logger: ILogger;
    tsserverPath: string;
    logFile?: string;
}

export class TsServerClient {
    private started = false;
    private cp: cp.ChildProcess;
    private seq = 0;

    private buffer = '';
    private header:Record<string, any>;

    private deferreds = {};

    get logger(): ILogger {
        return this.options.logger;
    }

    constructor(
        private options: ITsServerClientOptions) {
    }

    start() {
        if (this.started) {
            return;
        }

        this.logger.info('TsServerClient.start(): starting', { tsserverPath: this.options.tsserverPath, logFile: this.options.logFile });
        this.cp = cp.spawn(this.options.tsserverPath, this.options.logFile ? ['-logToFile', 'true', '-file', this.options.logFile] : [] );
        this.cp.stdout.setEncoding('utf8');
        this.cp.stdout.addListener('data', this.onTsServerData.bind(this));
        this.logger.info('TsServerClient.start(): started');
    }

    private onTsServerData(data): void {
        this.buffer += data;

        while(true) {
            if (!this.header) {
                this.logger.info('we have not parsed the header yet');
                const headerEndIndex = this.buffer.indexOf('\r\n\r\n');
                if (headerEndIndex >= 0) {
                    this.logger.info('we have full header');
                    this.header = {};

                    this.buffer.substring(0, headerEndIndex)
                        .split('\r\n')
                        .forEach(header => {
                            const kvp = header.split(':').map(values => values.trim());
                            if (kvp[0].toUpperCase() === 'CONTENT-LENGTH') {
                                this.header['Content-Length'] = parseInt(kvp[1]);
                            } else {
                                this.header[kvp[0]] = kvp[1];
                            }
                        });

                    this.buffer = this.buffer.substring(headerEndIndex + 4);
                } else {
                    this.logger.info('wait for next buffer to arrive');
                    break;
                }
            } else {
                const contentLength = this.header['Content-Length'] + 1;
                if (this.buffer.length >= contentLength) {
                    const messageString = this.buffer.substring(0, contentLength);
                    this.logger.info('we have the full message', this.header, messageString);
                    const message: protocol.Response = JSON.parse(messageString);
                    this.buffer = this.buffer.substring(contentLength);
                    this.header = null;

                    this.processMessage(message);

                    if (this.buffer.length > 0) {
                        this.logger.info('we have more data in the buffer so try parsing the new headers from top', this.buffer);
                        continue
                    } else {
                        this.logger.info('we are done processing the message here so stop')
                        break
                    }
                } else {
                    this.logger.info('we do not have the entire message body, so wait for the next bufer');
                    break;
                }
            }
        }
    }

    sendRequest(command: string, notification: boolean, args?: any): Thenable<any> | undefined {
        this.seq = this.seq + 1;

        let request: protocol.Request = {
            command,
            seq: this.seq,
            type: 'request'
        };

        if (args) {
            request.arguments = args;
        }

        const serializedRequest = JSON.stringify(request) + '\n';

        this.logger.info('---->', serializedRequest);

        if (!this.cp.stdin.write(serializedRequest)) {
            this.logger.info('not flushed');
        }

        return notification ? undefined : (this.deferreds[this.seq] = new utils.Deferred<any>()).promise;
    }

    private processMessage(message: protocol.Response): void {
        this.logger.info(Object.keys(message));
        const deferred = this.deferreds[message.request_seq];
        this.logger.info('has deferred', !!deferred, message.type, message.command, message.request_seq, Object.keys(this.deferreds));
        if (deferred) {
            if (message.success) {
                this.deferreds[message.request_seq].resolve(message);
            } else {
                this.deferreds[message.request_seq].reject(message);
            }
            delete this.deferreds[message.request_seq];
        }
    }

    sendOpen(file: string): void {
        const args = { file };
        this.logger.info('TsServerClient.sendOpen()', file);
        this.sendRequest('open', true, args);
    }

    sendClose(file: string): void {
        const args = { file };
        this.logger.info('TsServerClient.sendClose()', file);
        this.sendRequest('close', true, args);
    }

    sendSaveTo(file: string, tmpfile: string): void {
        const args = { file, tmpfile };
        this.logger.info('TsServerClient.sendSaveTo()', file, tmpfile);
        this.sendRequest('saveto', true, args);
    }

    sendReload(file: string, tmpfile: string): void {
        const args = { file, tmpfile };
        this.logger.info('TsServerClient.sendReload()', file, tmpfile);
        this.sendRequest('reload', true, args);
    }

    sendDefinition(file: string, line: number, offset: number): Thenable<any> {
        const args = { file, line, offset };
        this.logger.info('TsServerClient.sendDefinition()', args);
        return this.sendRequest('definition', false, args);
    }

    sendNavTo(searchValue: string, file: string): Thenable<any> {
        let args: any = { searchValue, file };
        this.logger.info('TsServerClient.sendNavTo()', args);
        return this.sendRequest('navto', false, args);
    }

    sendNavTree(file: string): Thenable<any> {
        const args = { file };
        this.logger.info('TsServerClient.sendNavTree()', args);
        return this.sendRequest('navtree', false, args);
    }

    sendCompletions(file: string, line: number, offset: number, prefix: string): Thenable<any> {
        const args = { file, line, offset, prefix };
        this.logger.info('TsServerClient.sendCompletions()', args);
        return this.sendRequest('completions', false, args);
    }

    sendQuickInfo(file: string, line: number, offset: number): Thenable<any> {
        const args = { file, line, offset };
        this.logger.info('TsServerClient.sendQuickInfo()', args);
        return this.sendRequest('quickinfo', false, args);
    }

    sendReferences(file: string, line: number, offset: number): Thenable<any> {
        const args = { file, line, offset };
        this.logger.info('TsServerClient.sendReferences()', args);
        return this.sendRequest('references', false, args);
    }

}
