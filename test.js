const {Cencr} = require("./cencr");

//TODO: defines should not create symbols other than the definition identifier

test('extractSymbols', async () => {
    let c = new Cencr();
    await c.extract();
    expect(c.headers).toStrictEqual({
        "example/test.h": {
            "CENCR_TEST_H": true,
            "hello": true,
            "myFunc": true,
            "world": true
        },
        "example/test2.h": {
            "abc": true,
            "my_define_in_test2": true
        }
    });
    expect(c.sources).toStrictEqual({
        "example/test.cpp": {
            "myFunc2": true
        }
    });
});

test('createHeaderSymbolsMapping', async () => {
    let c = new Cencr();
    await c.extract();
    expect(c.headerSymbolMapping).toStrictEqual({
        "CENCR_TEST_H": "XZA",
        "abc": "XZF",
        "hello": "XZC",
        "myFunc": "XZB",
        "my_define_in_test2": "XZE",
        "world": "XZD"
    });
});

test('encrypt', async () => {
    let c = new Cencr();
    await c.extract();
    const res = await c.encrypt(c.readFile('example/test.cpp'),
        {"myFunc2": "ABC", "ME": "BO"}, {"example/test.h": "example/enc_abc.h"});
    expect(res).toStrictEqual(
        '#include "example/enc_abc.h"\n' +
        '#include <linux/edd.h>\n' +
        '#include SKIP(ME)\n' +
        '#pragma skip2(me2)\n' +
        'int myFunc(int hello, int world) {\n' +
        'return hello + world + EDD_INFO_LOCKABLE;\n' +
        '}\n' +
        'static int ABC(void) {\n' +
        'return 4;\n' +
        '}\n');
});

test('encryptFiles', async () => {
    let c = new Cencr();
    await c.execute();
});
