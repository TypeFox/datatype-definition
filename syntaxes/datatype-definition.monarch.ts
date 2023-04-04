// Monarch syntax highlighting for the DatatypeDefinition language.
export default {
    keywords: [
        'datatype','entity','enum','extends','many','nonNullable','package'
    ],
    operators: [
        ',','.',':','=','|'
    ],
    symbols:  /\(|\)|,|\.|:|=|\{|\||\}/,

    tokenizer: {
        initial: [
            { regex: /[_a-zA-Z][\w_]*/, action: { cases: { '@keywords': {"token":"keyword"}, '@default': {"token":"ID"} }} },
            { regex: /\d+/, action: {"token":"NUMBER"} },
            { regex: /["][^"]*["]|['][^']*[']/, action: {"token":"string"} },
            { include: '@whitespace' },
            { regex: /@symbols/, action: { cases: { '@operators': {"token":"operator"}, '@default': {"token":""} }} },
        ],
        whitespace: [
            { regex: /\s+/, action: {"token":"white"} },
            { regex: /\/\*/, action: {"token":"comment","next":"@comment"} },
            { regex: /\/\/[^\n\r]*/, action: {"token":"comment"} },
        ],
        comment: [
            { regex: /[^\/\*]+/, action: {"token":"comment"} },
            { regex: /\*\//, action: {"token":"comment","next":"@pop"} },
            { regex: /[\/\*]/, action: {"token":"comment"} },
        ],
    }
};
