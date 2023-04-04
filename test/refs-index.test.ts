/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, EmptyFileSystem, getDocument, LangiumDocument, ReferenceDescription } from 'langium';
import { parseDocument } from 'langium/test';
import { describe, expect, test } from 'vitest';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { createDatatypeDefinitionServices } from '../src/language-server/datatype-definitions-module';
import { Definitions } from '../src/language-server/generated/ast';

const services = createDatatypeDefinitionServices(EmptyFileSystem).datatypeDefinition;

describe('Cross references indexed after affected process', () => {
    test('Fixed reference is in index', async () => {
        const docs = await updateDocuments<Definitions, Definitions>('entity SomeEntity extends SuperEntity {}', 'entity NoSuperEntity {}');
        const superDoc = docs.super;
        let allRefs = await getReferences(superDoc.parseResult.value.elements[0]);
        expect(allRefs.length).toEqual(0); // linking error

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textDocs: any = services.shared.workspace.TextDocuments;
        textDocs._syncedDocuments.set(superDoc.textDocument.uri.toString(),
            TextDocument.create(superDoc.textDocument.uri.toString(), superDoc.textDocument.languageId, 0, 'entity SuperEntity {}'));
        await services.shared.workspace.DocumentBuilder.update([superDoc.uri], []);

        const updatedSuperDoc = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(superDoc.uri) as (LangiumDocument<Definitions>);
        const superEntity = updatedSuperDoc.parseResult.value.elements[0];
        allRefs = await getReferences(superEntity);
        expect(allRefs.length).toEqual(1); // re-linked

        const extendsEntity = docs.extends.parseResult.value.elements[0];
        expect(refString(allRefs[0])).toEqual(nodeRefString(extendsEntity, superEntity));
    });
});

async function updateDocuments<S extends AstNode, E extends AstNode>(extendsFile: string, superFile: string): Promise<{ 'super': LangiumDocument<S>, 'extends': LangiumDocument<E> }> {
    const superDoc: LangiumDocument<S> = await parseDocument(services, superFile);
    const extendsDoc: LangiumDocument<E> = await parseDocument(services, extendsFile);

    await services.shared.workspace.DocumentBuilder.build<AstNode>([extendsDoc, superDoc]);
    return { 'super': superDoc, 'extends': extendsDoc };
}

async function getReferences(node: AstNode): Promise<ReferenceDescription[]> {
    const allRefs: ReferenceDescription[] = [];
    services.shared.workspace.IndexManager.findAllReferences(node, createPath(node))
        .forEach((ref) => allRefs.push(ref));
    return allRefs;
}

function refString(ref: ReferenceDescription): string {
    return asString(ref.sourceUri, ref.sourcePath, ref.targetUri, ref.targetPath);
}

function nodeRefString(from: AstNode, to: AstNode): string {
    return asString(getDocument(from).uri, createPath(from), getDocument(to).uri, createPath(to));
}

function createPath(node: AstNode): string {
    return services.workspace.AstNodeLocator.getAstNodePath(node);
}

function asString(fromUri: URI, fromPath: string, toUri: URI, toPath: string): string {
    return fromUri + fromPath + ' -> ' + toUri + toPath;
}
