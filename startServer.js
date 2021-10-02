#!/usr/bin/env node
'use strict';
const util = require("util");
const nconf = require("nconf");
const ServerManager = require("./serverManager.js");


let configFileName = null;
if (process.argv.length > 2) {
	configFileName = process.argv[2];
} else {
	configFileName = "config.json"
}
console.log("[startServer]\t\t\t argv length=" + process.argv.length + " fname=" +configFileName )
if (!configFileName.includes(".")) configFileName = configFileName + ".json"
if (!configFileName.includes("/")) configFileName = "./" + configFileName
console.log("[startServer]\t\t\t Loading Configuaration from " + configFileName)
const config = nconf.file(configFileName).get().config;
const serverManager = new ServerManager(config);