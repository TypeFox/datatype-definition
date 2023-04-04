/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ValidationAcceptor, ValidationChecks } from 'langium';
import { DatatypeDefinitionAstType, Type } from './generated/ast';
import type { DatatypeDefinitionServices } from './datatype-definitions-module';

export function registerValidationChecks(services: DatatypeDefinitionServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.DomainModelValidator;
    const checks: ValidationChecks<DatatypeDefinitionAstType> = {
        Type: validator.checkTypeStartsWithCapital
    };
    registry.register(checks, validator);
}

export class DatatypeDefinitionValidator {

    checkTypeStartsWithCapital(type: Type, accept: ValidationAcceptor): void {
        if (type.name) {
            const firstChar = type.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Type name should start with a capital.', { node: type, property: 'name' });
            }
        }
    }

}
