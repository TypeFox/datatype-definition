# Datatype Definition Language

Provides single definiton of datatypes and generation of implementations in different target languages, currently Java & TypeScript.
Simplifies data exchange between different programming environments, e.g. via [JSON-RPC](https://en.wikipedia.org/wiki/JSON-RPC).

## Generator CLI

The _Datatype Definition_ language features a generator that you can run via cli.
It produces datatype implementations in the selected target language, defaults to Java.

* Ensure the complete project was properly built, otherwise run `npm install` from the project root dir.
* Use `node <projectRoot>/bin/cli` to run the cli, than follow the instructions.

You also can use `datatypes-cli` as a replacement for `node ./bin/cli`, if you install the cli globally.
* Run `npm install -g ./` from the domainmodel directory.
* Use `datatypes-cli` to run the cli and follow the instructions.

## VSCode Extension

Please use the VSCode run configuration "Launch Datatype Definition Extension" to launch a new VSCode instance including the extension for this language.
Use the run configuration "Attach" to attach the debugger.
