/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { createDefaultModule, createDefaultSharedModule, DefaultSharedModuleContext, inject, LangiumServices, LangiumSharedServices, Module, PartialLangiumServices } from 'langium';
import { DatatypeDefinitionFormatter } from './datatype-definitions-formatter';
import { DatatypeDefinitionQualifiedNameProvider } from './datatype-definitions-naming';
import { DatatypeDefinitionRenameProvider } from './datatype-definitions-rename-refactoring';
import { DatatypeDefinitionScopeComputation } from './datatype-definitions-scope';
import { DatatypeDefinitionValidator, registerValidationChecks } from './datatype-definitions-validator';
import { DatatypeDefinitionGeneratedModule, DatatypeDefinitionGeneratedSharedModule } from './generated/module';

export type DatatypeDefinitionsAddedServices = {
    references: {
        QualifiedNameProvider: DatatypeDefinitionQualifiedNameProvider
    },
    validation: {
        DomainModelValidator: DatatypeDefinitionValidator
    }
}

export type DatatypeDefinitionServices = LangiumServices & DatatypeDefinitionsAddedServices

export const DatatypeDefinitionModule: Module<DatatypeDefinitionServices, PartialLangiumServices & DatatypeDefinitionsAddedServices> = {
    references: {
        ScopeComputation: (services) => new DatatypeDefinitionScopeComputation(services),
        QualifiedNameProvider: () => new DatatypeDefinitionQualifiedNameProvider()
    },
    validation: {
        DomainModelValidator: () => new DatatypeDefinitionValidator()
    },
    lsp: {
        Formatter: () => new DatatypeDefinitionFormatter(),
        RenameProvider: (services) => new DatatypeDefinitionRenameProvider(services)
    }
};

export function createDatatypeDefinitionServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    datatypeDefinition: DatatypeDefinitionServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        DatatypeDefinitionGeneratedSharedModule
    );
    const datatypeDefinition = inject(
        createDefaultModule({ shared }),
        DatatypeDefinitionGeneratedModule,
        DatatypeDefinitionModule
    );
    shared.ServiceRegistry.register(datatypeDefinition);
    registerValidationChecks(datatypeDefinition);
    return { shared, datatypeDefinition };
}
