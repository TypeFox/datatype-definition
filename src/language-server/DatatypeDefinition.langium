grammar DatatypeDefinition

entry Definitions:
    (elements+=AbstractElement)*;

AbstractElement:
    PackageDeclaration | Type;

PackageDeclaration:
    'package' name=QualifiedName '{'
        (elements+=AbstractElement)*
    '}';

Type:
    DataType | Entity | Enum;

DataType:
    'datatype' name=ID ( '=' unionMembers += [ Type:QualifiedName ] ('|' unionMembers += [ Type:QualifiedName ])*)?;

Entity:
    'entity' name=ID ('extends' superType=[Entity:QualifiedName])? '{'
        (features+=Feature)*
    '}';

Feature:
    nonNullable?='nonNullable'? (many?='many')? name=ID ':' type=[Type:QualifiedName];

Enum:
    'enum' name=ID '{'
        (literals+=EnumLiteral (',' literals+=EnumLiteral)* )?
    '}';

EnumLiteral:
    name=ID ( '(' args+= (ID|STRING|NUMBER) (',' args+= (ID|STRING|NUMBER))* ')')?;

QualifiedName returns string:
    ID ('.' ID)*;

hidden terminal WS: /\s+/;
terminal ID: /[_a-zA-Z][\w_]*/;
terminal NUMBER: /\d+/;
terminal STRING: /["][^"]*["]|['][^']*[']/;

hidden terminal ML_COMMENT: /\/\*[\s\S]*?\*\//;
hidden terminal SL_COMMENT: /\/\/[^\n\r]*/;
