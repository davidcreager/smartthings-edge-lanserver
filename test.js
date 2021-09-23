#!/usr/bin/env node
'use strict';
const nconf = require("nconf");
const findIphoneServer = require("./baseServer.js").findIphoneServer;
const bluetoothConnectServer = require("./baseServer.js").bluetoothConnectServer;
const rfxcomServer = require("./baseServer.js").rfxcomServer

const config = nconf.file("./config.json").get().config;
console.log("Starting " + JSON.stringify(config));

let btServer = new findIphoneServer(config);
btServer.discover();