import * as path from 'path';

import {
    Location,
    Position
} from 'vscode-languageserver';

import * as TsProtocol from 'typescript/lib/protocol';

import {
    CompletionItemKind
} from 'vscode-languageserver';

export function isWindows(): boolean {
    return /^win/.test(process.platform);
}

export function uriToPath(uri: string): string {
    const p = path.resolve(uri.replace(/file:\/\/\//, ''));
    return isWindows() ? p.replace(/\//g, '\\') : p;
}

export function pathToUri(p: string): string {
    return 'file://' + (isWindows() ? '/' + p.replace(/\//g, '/') : p);
}

export function tsServerLocationToLspPosition(location: TsProtocol.Location): Position {
    return <Position>{
        line: location.line - 1,
        character: location.offset - 1
    }
}

export function tsServerFileSpanToLspLocation(fileSpan: TsProtocol.FileSpan): Location {
    return <Location>{
        uri: pathToUri(fileSpan.file),
        range: {
            start: tsServerLocationToLspPosition(fileSpan.start),
            end: tsServerLocationToLspPosition(fileSpan.end)
        }
    };
}

export const completionKindsMapping: { [name: string]: CompletionItemKind } = {
    class: CompletionItemKind.Class,
    constructor: CompletionItemKind.Constructor,
    enum: CompletionItemKind.Enum,
    field: CompletionItemKind.Field,
    file: CompletionItemKind.File,
    function: CompletionItemKind.Function,
    interface: CompletionItemKind.Interface,
    keyword: CompletionItemKind.Keyword,
    method: CompletionItemKind.Method,
    module: CompletionItemKind.Module,
    property: CompletionItemKind.Property,
    reference: CompletionItemKind.Reference,
    snippet: CompletionItemKind.Snippet,
    text: CompletionItemKind.Text,
    unit: CompletionItemKind.Unit,
    value: CompletionItemKind.Value,
    variable: CompletionItemKind.Variable
};

export class Deferred<T> {
    resolve: (value?: T) => void;
    reject: (err?: any) => void;

    promise = new Promise((resolve, reject) => {
        this.resolve = resolve;
        this.reject = reject;
    });
}
