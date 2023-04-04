/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import chalk from 'chalk';
import fs from 'fs';
import { AstNode, expandToNode as toNode, Generated, joinToNode, streamAllContents, StreamImpl, toString, TreeStream, TreeStreamImpl } from 'langium';
import { NodeFileSystem } from 'langium/node';
import _ from 'lodash';
import path from 'path';
import { createDatatypeDefinitionServices } from '../language-server/datatype-definitions-module';
import { AbstractElement, DataType, Definitions, Entity, Enum, EnumLiteral, Feature, isDataType, isDefinitions, isEntity, isEnum, isPackageDeclaration, isType, Type } from '../language-server/generated/ast';
import { DatatypeDefinitionLanguageMetaData } from '../language-server/generated/module';
import { extractAstNode, extractDestinationAndName, setRootFolder } from './cli-util';

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    try {
        const services = createDatatypeDefinitionServices(NodeFileSystem).datatypeDefinition;
        await setRootFolder(fileName, services, opts.root);
        const domainmodel = await extractAstNode<Definitions>(fileName, DatatypeDefinitionLanguageMetaData.fileExtensions, services);
        const generatedInfo = opts.target === 'ts'
            ? generateTypescript(domainmodel, fileName, opts.destination)
            : generateJava(domainmodel, fileName, opts.destination);
        if (!opts.quiet) {
            console.log(chalk.green(`${generatedInfo.target} generated successfully in: ${chalk.yellow(generatedInfo.path)}`));
        }
    } catch (error) {
        if (!opts.quiet) {
            console.error(chalk.red(String(error)));
        }
    }
};

export type GenerateOptions = {
    target?: 'java' | 'ts';
    destination?: string;
    root?: string;
    quiet: boolean;
}

export function generateJava(domainmodel: Definitions, fileName: string, destination?: string) {
    const data = extractDestinationAndName(fileName, destination);
    return generateAbstractElements(data.destination, domainmodel.elements, data.name);
}

const primitives = ['boolean', 'byte', 'char', 'float', 'double', 'short', 'int', 'long', 'number', 'string' ];

function generateAbstractElements(destination: string, elements: Array<AbstractElement | Type>, filePath: string) {
    const type2dataTypes = new Map<Type, DataType[]>();
    const dataTypes2primitives = new Map<DataType, DataType[]>();

    streamAllContents( { elements } as AstNode & { elements: Array<AbstractElement | Type> } ).filter(isDataType).forEach(
        dataType => dataType.unionMembers?.map(t => t.ref)?.filter(isType)?.forEach(member => {
                // populate type2dataTypes with (Entity -> [implemented datatypes (interfaces)])
                type2dataTypes.get(member)?.push(dataType) || type2dataTypes.set(member, [ dataType ]);

                if (isDataType(member) && [ 'boolean', 'int, long, float, double', 'number', 'string', 'object' ].some(t => t == member.name.toLocaleLowerCase())) {
                    dataTypes2primitives.get(dataType)?.push(member) || dataTypes2primitives.set(dataType, [ member ]);
                }
            }
        )
    );

    function generateAbstractElementsInternal(elements: Array<AbstractElement | Type>, filePath: string): string {
        const fullPath = path.join(destination, filePath);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }

        const packagePath = filePath.replace(/\//g, '.').replace(/^\.+/, '');
        for (const elem of elements) {
            if (isPackageDeclaration(elem)) {
                generateAbstractElementsInternal(elem.elements, path.join(filePath, elem.name.replace(/\./g, '/')));
            } else {
                if (isDataType(elem)) {
                    if (primitives.includes(elem.name.toLocaleLowerCase())) {
                        continue;
                    }
                }

                const fileNode = toNode`
                    package ${packagePath};

                    ${isDataType(elem)
                        ? generateDataType(elem)
                        : isEntity(elem)
                            ? generateEntity(elem, {types: type2dataTypes.get(elem), primitiveAliases: dataTypes2primitives })
                            : isEnum(elem)
                                ? generateEnum(elem)
                                : undefined}
                `;
                fs.writeFileSync(path.join(fullPath, `${elem.name}.java`), toString(fileNode));
            }
        }
        return fullPath;
    }

    return {
        target: 'Java classes',
        path: generateAbstractElementsInternal(elements, "")
    };
}

function generateDataType(dataType: AbstractElement): Generated {
    return toNode`
        public interface ${dataType.name} {
        }
    `;
}

function generateEntity(entity: Entity, { types, primitiveAliases } : { types: DataType[] | undefined, primitiveAliases: Map<Type, Type[]> } ): Generated {
    const maybeExtends = entity.superType ? ` extends ${entity.superType.$refText}` : '';
    const maybeImplements =  ((t: string|undefined) => t && ' implements ' + t || '')(types?.map( t=>t.name)?.join(', '));
    const featureData = entity.features.map(f => generateFeature(f, primitiveAliases));

    return toNode`
        public class ${entity.name}${maybeExtends}${maybeImplements} {
            ${joinToNode(featureData, ([generateField, , ]) => generateField(), { appendNewLineIfNotEmpty: true})}
            ${joinToNode(featureData, ([, generateSetter, generateGetter]) => toNode`

                ${generateSetter()}

                ${generateGetter()}
            `.appendNewLine())}
        }
    `.appendNewLine();
}

function generateFeature(feature: Feature, primitiveAliases: Map<Type, Type[]>): [() => Generated, () => Generated, () => Generated] {
    const name = feature.name;
    const type = feature.type.$refText + (feature.many ? '[]' : '');
    const aliasCandidates = feature.type.ref && primitiveAliases.get(feature.type.ref);

    const typeName = (t: Type) => [ 'number', 'string' ].includes(t.name) ? _.upperFirst(t.name) : t.name;

    return [
        // generate the field
        () => toNode`
            private ${aliasCandidates ? 'Object' : type} ${name};
        `,
        // generate the setter(s)
        () => toNode`
            public void set${_.upperFirst(name)}(${type} ${name}) {
                this.${name} = ${name};
            }
        `.appendIf(!!aliasCandidates, node => node.append(
            joinToNode(aliasCandidates!, p => toNode`


                public void set${_.upperFirst(name)}(${typeName(p)} ${name}) {
                    this.${name} = ${name};
                }
            `)
        )),
        // generate the getter(s)
        () => toNode`
            public ${type} get${_.upperFirst(name)}() {
                return ${ !!aliasCandidates ? '(' + type + ') ' : ''}this.${name};
            }
        `.appendIf(!!aliasCandidates, node => node.append(
            joinToNode(aliasCandidates!, p => toNode`


                public ${typeName(p)} get${_.upperFirst(name)}As${_.upperFirst(p.name)}() {
                    return this.${name} instanceof ${typeName(p)} ? (${typeName(p)}) this.${name} : null;
                }
            `)
        ))
    ];
}

function generateEnum(theEnum: Enum): Generated {
    return toNode`
        public enum ${theEnum.name} {
            ${joinToNode(theEnum.literals, generateEnumLiteral, { suffix: (e, i, isLast) => isLast ? ';' : ',', appendNewLineIfNotEmpty: true })}

            private ${theEnum.name}() {
            }
        }
    `;
}

function generateEnumLiteral(enumLiteral: EnumLiteral): Generated {
    return `${enumLiteral.name}()`;
}


function generateTypescript(domainmodel: Definitions, fileName: string, destination?: string) {
    const data = extractDestinationAndName(fileName, destination);
    const fullPath = data.destination;

    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }

    const entity2subtypes = new Map<Entity, Entity[]>();
    streamAllContents(domainmodel).filter(isEntity).forEach(
        e => new StreamImpl<{ current: Entity }, Entity>(() => ({ current: e }), state => {
            console.log(state.current?.name + " " + !!state.current);
            return <IteratorResult<Entity>>{ value: state.current = state.current?.superType?.ref!, done: !state.current }
    }).filter(isEntity).forEach(
            s => {
                return entity2subtypes.get(s)?.push(e) || entity2subtypes.set(s, [e])
            }
        )
    );

    const stream = (new TreeStreamImpl<Definitions|AbstractElement>(
        domainmodel, e => isDefinitions(e) ? e.elements : isPackageDeclaration(e) ? e.elements : []
    ) as TreeStream<Definitions|AbstractElement>).filter(isType);

    const generateElement = (e: Type): Generated => {
        if (isEntity(e)) {
            return toNode`
                export interface ${e.name}${((e: Type|undefined) => e && ' extends ' + e.name || '')(e.superType?.ref)} {
                    $type: '${e.name}'${ entity2subtypes.has(e) ? entity2subtypes.get(e)?.map(s => ` | '${s.name}'`)?.join() : '' };
                    ${joinToNode(e.features, f => toNode`${f.name}${!f.nonNullable?'?':''}: ${f.type.$refText}${f.many ? '[]' : ''};`, { appendNewLineIfNotEmpty: true })}
                }

                export function create${e.name}(data: Omit<${e.name}, '$type'>): ${e.name} {
                    return {
                        $type: '${e.name}', ...data
                    }
                }
            `.appendNewLine();

        } else if (isDataType(e) && e.unionMembers?.length) {
            return toNode`
                export type ${e.name} = ${ e.unionMembers.map(t => t.ref?.name).join(' | ') };
            `.appendNewLine();

         } else if (isEnum(e)){
            return toNode`
                export type ${e.name} = ${ e.literals.map(l => `'${l.name}'`).join(' | ') };
            `.appendNewLine();

         } else {
            return undefined;
         }
    }

    fs.writeFileSync(
        path.join(fullPath, path.basename(fileName, path.extname(fileName))) + '.ts',
        toString(
            joinToNode(stream, generateElement, { separator: toNode``.appendNewLine() })
        )
    );
    return {
        target: 'TypeScript definitions',
        path: fullPath
    };
}