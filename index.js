#!/usr/bin/env node

const fs = require('fs');
const {Cencr} = require("./cencr");
const configFile = (process && process.argv[2]) || 'config.json';

const c = new Cencr(configFile);
(async ()=> {
    await c.execute();
})();
