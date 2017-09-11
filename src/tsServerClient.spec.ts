
import * as chai from 'chai';
import { TsServerClient } from './tsServerClient';
import { createLogger } from './logger';
import * as path from 'path';

const assert = chai.assert
const expect = chai.expect

const server = new TsServerClient({
    logger : createLogger(undefined),
    tsserverPath : 'tsserver'
});

const thisFile = path.resolve(__dirname , "../src/tsServerClient.spec.ts");

describe('ts server client', () => {
  it('completion', (done) => {
    server.start();
    server.sendOpen(thisFile);
    server.sendCompletions(thisFile, 1, 0, 'im').then( completions => {
      assert.equal(completions.body[1].name, "import");
      done();
    });
  });

  it('completion', (done) => {
    server.start();
    server.sendOpen(thisFile);
    server.sendReferences(thisFile, 9, 8).then( references => {
      assert.equal(references.body.symbolName, "server");
      done();
    });
  });
});