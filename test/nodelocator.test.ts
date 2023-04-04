/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { AstNode, EmptyFileSystem } from 'langium';
import { parseDocument } from 'langium/test';
import { createDatatypeDefinitionServices } from '../src/language-server/datatype-definitions-module';
import { Definitions, PackageDeclaration } from '../src/language-server/generated/ast';

const services = createDatatypeDefinitionServices(EmptyFileSystem).datatypeDefinition;

const datatypeFile = `
datatype Int
datatype Decimal

package big {
    datatype Int
    datatype Decimal
}
 `;

describe('AstNode location', () => {
    test('Calculate path for nodes', async () => {
        const model = await getModel();
        expect(createPath(model.elements[0])).toEqual('/elements@0');
        expect(createPath((model.elements[2] as PackageDeclaration).elements[1])).toEqual('/elements@2/elements@1');
    });
    test('Locate node for path', async () => {
        const model = await getModel();
        expect(findNode(model, '/elements@0')).toEqual(model.elements[0]);
        expect(findNode(model, '/elements@2/elements@0')).toEqual((model.elements[2] as PackageDeclaration).elements[0]);
    });
});

async function getModel(): Promise<Definitions> {
    const doc = await parseDocument<Definitions>(services, datatypeFile);
    return doc.parseResult.value;
}

function createPath(node: AstNode): string {
    return services.workspace.AstNodeLocator.getAstNodePath(node);
}

function findNode(node: AstNode, path: string): AstNode | undefined {
    return services.workspace.AstNodeLocator.getAstNode(node, path);
}
