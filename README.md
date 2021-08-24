# cencr
C/C++ source code encryption / obfuscation / mangling / minify

It will remove all comments and will mangle all symbols in your code that might explain what it does. It will detect whether a symbol comes from an external header file, or whether it belongs to the specified list of sources.

The tool uses a tokenizer, but does not fully compile your code. Therefore, it does not need to know definitions, but it does need to know all locations where it can find the source files, header files, and external header files.

## Installation
npm install -g

## Usage
`cencr my_config.json`

This will encrypt all files specified in the configuration file. It will also generate some json files with information about the encryption.

## Configuration file
The json configuration file should contain a list of properties:

```
{
  property: value
}
```
### Configuration properties
- `headers`: An array of all the header files to encrypt.
- `sources`: An array of all the source files to encrypt.
- `outDir`: A folder where the encrypted files will go.
- `infoDir`: A folder where the information files will go.
- `symbolOutPrefix`: A prefix for all encrypted identifiers.
- `encryptFilenames`: `true`|`false`.
- `fileOutPrefix`: A prefix for all encrypted filenames.
- `excludedSymbols`: An array of extra symbols that should not be encrypted.
- `excludedFiles`: An array of header files that contain symbols that should not be encrypted, and were not found by parsing the files (for example, because you want to use preprocessor first).
- `searchDirs`: An array of all absolute paths were headers, sources, or external headers can be found.
### Example
```
{
    "headers": [
        "example/test.h",
        "example/test2.h"
    ],
    "sources": [
        "example/test.cpp"
    ],
    "outDir": "out",
    "symbolOutPrefix": "XZ",
    "encryptFilenames": true,
    "fileOutPrefix": "enc_",
    "excludedSymbols": [
        "excluded1"
    ],
    "excludedFiles": [
    ],
    "searchDirs": [
        "c:/dev/linux/2.6.32-279.el6.x86_64/include",
        "c:/dev/linux/2.6.32-279.el6.x86_64/arch/x86/include",
        "c:/dev/linux/2.6.32-279.el6.x86_64/arch/x86/asm",
        "c:/cygwin64/usr/include"
    ]
}
```
