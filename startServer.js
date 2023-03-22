#!/usr/bin/env node
'use strict';
const util = require("util");
const nconf = require("nconf");
const ServerManager = require("./serverManager.js");
let configFileName = (process.argv.length > 2) ? process.argv[2] : "config.json";
if (!configFileName.includes(".")) configFileName = configFileName + ".json"
if (!configFileName.includes("/")) configFileName = "./" + configFileName
console.log("[startServer]\t\t\t Loading Configuration from " + configFileName)
const config = nconf.file(configFileName).get().config;
const serverManager = new ServerManager(config);