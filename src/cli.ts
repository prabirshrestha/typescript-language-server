#!/usr/bin/env node

import { Command } from 'commander';

import { Server } from './server';
import * as utils from './utils';

const program = new Command('typescript-language-server')
    .version(require('../package.json').version)
    .option('--stdio', 'use stdio')
    .option('--node-ipc', 'use node-ipc')
    .option('--socket <port>', 'use socket. example: --socket=5000')
    .option('--logFile <logFile>', 'Specify a log file. example: --logFile=logs.txt')
    .option('--tsserver-path <path>',
        `absolute path to tsserver. example: --tsserver-path=${utils.isWindows() ? 'c:\\tsc\\tsserver.cmd' : '/bin/tsserver'}`,
        utils.isWindows() ? 'tsserver.cmd' : 'tsserver')
    .parse(process.argv);

if (!(program.stdio || program.socket || program['node-ipc'])) {
    console.error('Connection type required (stdio, node-ipc, socket). Refer to --help for more details.');
    process.exit(1);
}

new Server({
    tsserverPath: program.tsserverPath,
    logFile : program.logFile
}).listen();
