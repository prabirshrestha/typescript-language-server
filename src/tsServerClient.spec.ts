import * as chai from 'chai';
import { TsServerClient } from './tsServerClient';
import { createLogger } from './logger';
import * as path from 'path';
import * as fs from 'fs';

const assert = chai.assert
const expect = chai.expect

const server = new TsServerClient({
    logger : createLogger(undefined),
    tsserverPath : 'tsserver'
});

server.start();

function file(simpleName: string): string {
  return path.resolve(__dirname, `../test-data/${simpleName}.ts`);
}

function readContents(path: string): string {
  return fs.readFileSync(path, 'utf-8').toString();
}

describe('ts server client', () => {
  it('completion', () => {
    const f = file('module2')
    server.sendOpen({
      file: f,
      fileContent: readContents(f)
    });
    return server.sendCompletions(f, 1, 0, 'im').then( completions => {
      assert.equal(completions.body[1].name, "ImageData");
    });
  });

  it('references', () => {
    const f = file('module2')
    server.sendOpen({
      file: f,
      fileContent: readContents(f)
    });
    return server.sendReferences({
      file: f, 
      line: 8, 
      offset: 16
    }).then( references => {
      assert.equal(references.body.symbolName, "doStuff");
    });
  });
});