const fs = require('fs');
const path = require('path');
const tokenize = require('c-tokenizer');
const Readable = require('stream').Readable;

const reservedCppKeywords = [
    'alignas', 'alignof', 'and', 'and', 'and_eq', 'asm', 'atomic_cancel', 'atomic_commit', 'atomic_noexcept',
    'auto', 'bitand', 'bitor', 'bool', 'break', 'case', 'catch', 'char', 'char16_t', 'char32_t', 'class', 'compl',
    'concept', 'const', 'constexpr', 'const_cast', 'continue', 'co_await', 'co_return', 'co_yield', 'decltype',
    'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'export', 'extern', 'false',
    'float', 'for', 'friend', 'goto', 'if', 'import', 'inline', 'int', 'long', 'module', 'mutable', 'namespace',
    'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'override',
    'private', 'protected', 'public',
    'register', 'reinterpret_cast', 'requires', 'return', 'short', 'signed', 'sizeof', 'static', 'static_assert',
    'static_cast', 'struct', 'switch', 'synchronized', 'template', 'this', 'thread_local', 'throw', 'true', 'try',
    'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t',
    'while', 'xor', 'xor_eq'
];

function pathJoin() {
    return [...arguments].filter(a => a != null && a.length).join('/');
}

function writeFile(dir, text) {
    fs.mkdirSync(path.dirname(dir), {recursive: true});
    fs.writeFileSync(dir, text);
}

function numberToName(num, isLocal = false) {
    let v = String.fromCharCode((isLocal ? 'a' : 'A').charCodeAt(0) + (num % 26));
    num = Math.floor(num / 26);
    while (num) {
        const n = num % 62;
        let startChar = n < 10 ? '0' : n < 36 ? 'a' : 'A';
        let charOffset = n < 10 ? 0 : n < 36 ? 10 : 36;
        v += String.fromCharCode(startChar.charCodeAt(0) + n - charOffset);
        num = Math.floor(num / 62);
    }
    return v;
}

function numberToFilename(num, dir, prefix, ext) {
    let v = String.fromCharCode('a'.charCodeAt(0) + (num % 26));
    num = Math.floor(num / 26);
    while (num) {
        const n = num % 36;
        let startChar = n < 10 ? '0' : 'a';
        let charOffset = n < 10 ? 0 : 10;
        v += String.fromCharCode(startChar.charCodeAt(0) + n - charOffset);
        num = Math.floor(num / 36);
    }
    return pathJoin(dir, prefix + v + ext);
}


class Cencr {
    sharedSymbols = {};
    includeFiles = {};
    headers;
    sources;
    headerSymbolMapping;
    fileMapping;

    constructor(configFile = 'config.json') {
        this.config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        this.config.excludedSymbols.forEach(s => this.sharedSymbols[s] = true);
        reservedCppKeywords.forEach(s => this.sharedSymbols[s] = true);
        this.preventHeaderSymbolsToBeIgnored();
    }

    preventHeaderSymbolsToBeIgnored() {
        this.config.headers.forEach(d => {
            const rp = this.resolvePath(d);
            this.includeFiles[rp] = true;
        });
    }

    resolvePath(dir, rPath='') {
        if (this.config.ignoredFiles.includes(dir)) return null;
        if (fs.existsSync(dir)) return path.normalize(dir);
        for (const d of this.config.searchDirs) {
            const p = pathJoin(d, dir);
            if (fs.existsSync(p)) return path.normalize(p);
        }
        console.log(`${rPath} Cannot find file ${dir}. Skipping...`);
        return null;
    }

    readFile(dir) {
        const p = this.resolvePath(dir);
        return p && fs.readFileSync(p, 'utf-8');
    }

    async processIncludeFile(dir, rPath='') {
        const rp = this.resolvePath(dir, rPath);
        if (rp && !this.includeFiles[rp]) {
            this.includeFiles[rp] = true;
            const symbols = await this.extractSymbolsFromFile(rp, rPath);
            Object.assign(this.sharedSymbols, symbols);
        }
    }

    numberToUniqueName(num, isLocal) {
        const r = numberToName(num, isLocal);
        if (!this.sharedSymbols[r]) return r;
        for (let i = 0; ; i++) {
            const r2 = r + numberToName(i);
            if (!this.sharedSymbols[r2]) return r2;
        }
    }

    async parse(text, onInclude, onIdentifier, onToken) {
        let directive = null;
        let directiveText;
        var t = tokenize((src, token) => {
            const {type} = token;
            if (type != 'line comment' && type != 'area comment') {
                if (type == 'directive' && (src == '#include' || src == '#pragma')) {
                    directive = src;
                    directiveText = '';
                } else if (directive != null) {
                    if (type == 'whitespace' && src.indexOf("\n") >= 0) {
                        directiveText = directiveText.trim();
                        if (directive == '#include' && /["<>]/.test(directiveText)) {
                            let retVal = onInclude(directiveText.replace(/["<>]/g, ''));
                            if (retVal != null)
                                directiveText = directiveText.replace(/[^"<>]+/, retVal);
                        }
                        if (onToken) onToken(' ' + directiveText, 'directiveText');
                        directive = null;
                    } else {
                        directiveText += src;
                        return;
                    }
                }
            }
            if (type == 'identifier') {
                if (onIdentifier) {
                    const newVal = onIdentifier(src);
                    if (newVal != null) src = newVal;
                }
            }
            if (onToken) onToken(src, type);
        });
        if (text.length && text.charAt(text.length - 1) != "\n") text += "\n";
        return this.tokenize(text, t);
    }

    async tokenize(text, t) {
        return new Promise((resolve, reject) => {
            Readable.from(text).pipe(t).on('finish', () => {
                resolve();
            }).on('error', (err) => {
                reject(err.message);
            });
        });
    }

    async processIncludes(text, rPath='') {
        if (text == null) return;
        const includes = [];
        await this.parse(text, dir => includes.push(dir), null, null);
        for (const i of includes) {
            await this.processIncludeFile(i, rPath);
        }
    }

    async extractfileSymbols(text, rPath='') {
        await this.processIncludes(text, rPath);
        const symbols = {};
        await this.parse(text, dir => this.processIncludeFile(dir, rPath), s => {
            symbols[s] = true;
        }, null);
        return symbols;
    }

    async extractSymbols() {
        this.headers = {};
        this.sources = {};
        this.fileMapping = {};
        let num = 0;
        const addFileMapping = file => {
            if (this.config.encryptFilenames) {
                this.fileMapping[file] =
                    numberToFilename(num, path.dirname(file), this.config.fileOutPrefix, path.extname(file));
                num++;
            }
        };
        for (const file of this.config.headers) {
            this.headers[file] = await this.extractSymbolsFromFile(file);
            addFileMapping(file);
        }
        Object.entries(this.headers).forEach(e => this.filterOutExternalSymbols(e[1]));

        for (const file of this.config.headers) {
            const symbols = this.headers[file];
            Object.assign(this.sharedSymbols, symbols);
        }


        for (const file of this.config.sources) {
            let symbols = await this.extractSymbolsFromFile(file);
            this.filterOutExternalSymbols(symbols);
            this.sources[file] = symbols;
            addFileMapping(file);
        }
    }

    filterOutExternalSymbols(symbols) {
        if (symbols == null) debugger
        Object.keys(this.sharedSymbols).forEach(k => delete symbols[k]);
    }

    async extractSymbolsFromFile(file, rPath='') {
        rPath += file.split(/[/\\]/g).pop() + ':';
        try {
            return await this.extractfileSymbols(this.readFile(file), rPath);
        } catch (err) {
            console.log(`${rPath} ${err}`);
            return {};
        }
    }

    createHeaderSymbolsMapping() {
        this.headerSymbolMapping = {};
        for (const e of Object.entries(this.headers)) {
            Object.assign(this.headerSymbolMapping, e[1]);
        }
        this.createMapping(this.headerSymbolMapping, this.config.symbolOutPrefix, false);
    }

    createMapping(symbols, prefix, isLocal) {
        let num = 0;
        for (const e of Object.keys(symbols)) {
            symbols[e] = prefix + this.numberToUniqueName(num, isLocal);
            num++;
        }
    }

    saveHeaders() {
        writeFile(pathJoin(this.config.outDir, 'headers.json'),
            JSON.stringify(Object.keys(this.includeFiles))
        );
    }

    saveHeaderSymbols() {
        writeFile(pathJoin(this.config.outDir, 'headerSymbols.json'),
            JSON.stringify(Object.keys(this.headerSymbolMapping))
        );
    }

    saveFileMapping() {
        writeFile(pathJoin(this.config.outDir, 'files.json'),
            JSON.stringify(this.fileMapping)
        );
    }

    async execute() {
        await this.extract();
        await this.encryptFiles();
    }

    async extract() {
        (this.config.excludedFiles || []).forEach(dir => this.processIncludeFile(dir));
        await this.extractSymbols();
        this.createHeaderSymbolsMapping();
        this.saveHeaders();
        this.saveHeaderSymbols();
        this.saveFileMapping();
    }

    async encryptFiles() {
        for (const name of Object.keys(this.headers)) {
            await this.encryptFile(name, this.headerSymbolMapping);
        }
        for (const [name, symbols] of Object.entries(this.sources)) {
            const mapping = {...symbols};
            this.createMapping(mapping, '', true);
            await this.encryptFile(name, {...this.headerSymbolMapping, ...mapping});
        }
    }

    async encryptFile(name, mapping) {
        const e = await this.encrypt(this.readFile(name), mapping, this.fileMapping);
        let p = pathJoin(this.config.outDir, this.fileMapping[name] || name);
        writeFile(p, e);
    }

    async encrypt(text, mapping, fileMapping) {
        let out = '';
        await this.parse(text,
            dir => fileMapping[dir] || dir,
            s => mapping[s] || s,
            (src, type) => {
                let seg;
                if (type == 'whitespace') {
                    const lastWasLineEnding = !out.length || out.charAt(out.length - 1) == "\n";
                    seg = lastWasLineEnding ? '' : src.charAt(0);
                    seg = seg == "\t" ? ' ' : seg;
                } else if (type == 'line comment' || type == 'area comment')
                    seg = '';
                else
                    seg = src;
                out += seg;
            });
        return out;
    }
}

module.exports = {
    Cencr
};