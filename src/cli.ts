#!/usr/bin/env node

import { Command } from 'commander';

import { Server } from './server';

const program = new Command('typescript-language-server')
    .version(require('../package.json').version)
    .option('--stdio', 'use stdio')
    .option('--node-ipc', 'use node-ipc')
    .option('--socket <port>', 'use socket. example: --socket=5000')
    .parse(process.argv);

if (!(program.stdio || program.socket || program['node-ipc'])) {
    console.log('Connection type required (stdio, node-ipc, socket). Refer help for more details.');
    process.exit(1);
}

new Server({}).listen();
