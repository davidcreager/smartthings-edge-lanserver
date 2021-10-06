"use strict"
const fs = require("fs");
const express = require("express");
const util =  require("util");
const xml2js = require("xml2js");
const XMLBuilder = new xml2js.Builder();
const nodessdp = require('node-ssdp').Server;
//const findIphoneServer = require("./findIphoneServer");
//const rfxcomServer = require("./rfxcomServer");
//const BTConnectServer = require("./BTConnectServer");
const IP = require("ip");
const { v4: uuidv4 } = require('uuid');
const Device = require("./device.js");
let nCalls = 0;
let cnt =0;
const simpLog = function(typ,obj,newb) {
	//console.log(" cnt=" + classCounter + " Constructing a " + typ + " class=" + obj.constructor.name + 
	//				" target=" + newb + " ssdpUSNPrefix=" + ssdpUSNPrefix + " ssdpUDN=" + ssdpUDN);
}


class serverManager {
	constructor(config) {
		this.app = express();
		this.config = config;
		this.app.listen(config.serverPort, "0.0.0.0", () => {
			console.log("[serverManager]\t\t\t " + "listening on " + IP.address() + ":" + this.config.serverPort);
		});
		this.servers = {};
		this.SSDPServers = {};
		this.USNbase = this.config["ssdpConfig"].schema + "device:" + "smartdev:1"

		//this.classMap = { BTConnectServer: BTConnectServer, rfxcomServer: rfxcomServer, findIphoneServer: findIphoneServer}
		this.classMap = { BTConnectServer: require("./BTConnectServer"), 
							rfxcomServer: require("./rfxcomServer"),
							findIphoneServer: require("./findIphoneServer")
							}
		this.subscriptions = {};
		this.uuidStore = {};
		this.devices = {};
		try {
			this.uuidStore = JSON.parse( fs.readFileSync(this.config.uuidFileName) )
		} catch(err) {
			if (err.code=="ENOENT") {
				try {
					fs.writeFileSync(this.config.uuidFileName, JSON.stringify( this.uuidStore ))
					console.log("[lanserver]\t\t Initialised uuidStore " + this.config.uuidFileName);
				} catch (e) {
					console.error("[lanserver]\t\t Initialising uuidStore error code=" + e.code + " error is " +  e);
				}
			} else {
				console.error("[lanserver]\t\t loading uuidStore error code=" + err.code + " error is " +  err)
			}
		}
		if (this.config.startServers) {
			Object.keys(this.config.startServers).forEach( (srv) => {
				if (this.config.startServers[srv]) {
					const server = new this.classMap[srv](this)
					if (this.servers[server.serverType]) console.error("[serverManager] creating servers weird! more than one per type");
					this.servers[server.serverType] = server;
					
					server.discover();
					console.log("[serverManager]\t\t\t Creating " + srv);
				}
			})
		}
		this.app.get("/discovery", (req, res) => {this.discovery(res)});
		this.app.get("/devices", (req, res) => {this.listDevices(req,res)});
		this.app.get("/:device/:command", (req, res) => {this.command(req,res)});
	}
	discovery(req,res) {
		if (this.servers) {
			Object.values(this.servers).forEach( (srv) => srv.discover() );
			if (res) res.status(200).json({response:"discovey initiated"});
		}
		if (res) res.status(500).json({response:"discovey failed, no servers"});
	}
	listDevices(req,res) {
		const devList = Object.keys(this.devices).map( (dev) => {
			return {uniqueName: this.devices[dev].uniqueName, 
						queryID: this.devices[dev].queryID, 
						validCommands: dev.validCommands,
						location: this.devices[dev].location,
						friendlyName: this.devices[dev].friendlyName, type: this.devices[dev].type}
			});
		//console.log(JSON.stringify(devList))
		res.status(200).json(devList);
		return
	}
	getDeviceInConfig(uniqueName,type) {
		const deviceInConfig = this.config[type].deviceMapping.find((ele) => uniqueName == ele.uniqueName);
		return deviceInConfig;		
	}
	addDevice(device, server){
		//let USN = "uuid:" + device.id + ":" + this.config["ssdpConfig"].schema + "device:" + "smartdev:1";
		//'ST: urn:SmartThingsCommunity:device:LightBulbESP8266:1'
		if (!this.uuidStore[device.uniqueName]) {
			this.uuidStore[device.uniqueName] = uuidv4();
			try {
				fs.writeFileSync(this.config.uuidFileName, JSON.stringify( this.uuidStore ))
			} catch (e) {
				console.error("[serverManager]\t\t Writing uuidStore error code=" + e.code + " error is " +  e);
			}
		}
		//console.log("DEBUG " + util.inspect(device))
		device.id = this.uuidStore[device.uniqueName];
		device.queryID = "uuid:" + device.id + "::" + this.USNbase;
		device.server = server;
		device.location = "http://"+ IP.address() + ":" + this.config.serverPort + "/" + device.queryID;
		const UDN = "uuid:" + device.id;
		this.SSDPServers[device.uniqueName] = new nodessdp({
								allowWildcards: true, 
								sourcePort: 1900, 
								suppressRootDeviceAdvertisements:true,
								udn: UDN,
								headers: {	"name.smartthings.com": device.uniqueName,
											"http.smartthings.com": "http://"+ IP.address() + ":" + this.config.serverPort + "/" + device.queryID,
											"UDN": UDN
										},
								location: "http://"+ IP.address() + ":" + this.config.serverPort + "/" + device.queryID
							});
		this.SSDPServers[device.uniqueName].addUSN(this.USNbase);
		this.SSDPServers[device.uniqueName].start();
		this.devices[device.uniqueName] = device;
		console.log("[serverManager][addDevice]\t Created Device for " + device.type + "\t" + 
							" Profile=" + device.modelName +
							"\t" + device.uniqueName + " - " + device.friendlyName + "\t" + device.id);
	}
	async command(req,res) {
		let dev;
		Object.keys(this.devices).forEach( (key) => {
			if (this.devices[key].queryID == req.params.device) dev = this.devices[key];
		});
		if (!dev) {
			console.warn("[serverManager][command][error]\t Invalid Device "  + req.params.command + " for " + req.params.device);
			res.status(500).send("invalid Device");
			return null;
		}
		//console.log("[serverManager][command]\t Command " + req.params.command + " for " + dev.uniqueName + " " + req.params.device + " Received" );
		if (req.params.command == "query") {
			let xml = XMLBuilder.buildObject(dev.getSSDPDescription(IP.address(),this.config.serverPort));
			res.status(200).send(xml);
			return null
		}
		if (req.params.command == "ping") {
			//console.log("[serverManager][command]\t Ping Received query=" + JSON.stringify(req.query));
			let serverIP = req.query.ip;
			let serverPort = req.query.port;
			//this.subscriptions[req.params.device] = {port: serverPort, ip: serverIP};
			if (!this.subscriptions[dev.uniqueName]) this.subscriptions[dev.uniqueName] = []
			this.subscriptions[dev.uniqueName].push({port: serverPort, ip: serverIP});
			//console.log("[serverManager][command]\t Subscription " + " for " + req.params.device + " " + serverIP + ":" + serverPort);
			res.status(200).json({response: "suceeded", cmd: "ping", query:req.query.value, state:dev.state});
			return null
		}
		if (req.params.command == "refresh") {
			//console.log("[serverManager][command]\t Refresh Received ");
		//  res.status(200).json({response: "refresh", cmd: "power", value:"off", level:0});
			res.status(200).json({response: "suceeded", cmd: "refresh", query:req.query.value, state:dev.state});
			return null
		}
		//const server = servers[dev.type]
		if (!dev.validCommands.includes(req.params.command)) {  
			console.warn("[serverManager][command][error]\t Invalid Command "  + req.params.command + " for " + req.params.device + " query=" + util.inspect(req.query));
			//console.warn("[serverManager][command][error]\t DEBUG - " + util.inspect(dev))
			res.status(500).send("invalid command");
			return null;
		}
		console.log("[serverManager][command]\t Processing "  + req.params.command + " for " + dev.friendlyName + " query is " + util.inspect(req.query));
		
		//dev[req.params.command](dev,req.params.command,req.query);
		const state = await dev[req.params.command](req.params.command,req.query);
		res.status(200).json({response:"suceeded", cmd: req.params.command, query:req.query.value, state: state});
		console.log("[serverManager][command]\t responded host=" + req.get("host") + 
					" origin=" + req.get("origin") +
					" remIP=" + req.socket.remoteAddress +
					" params=" + JSON.stringify(req.params) +
					" query=" + JSON.stringify(req.query)
					);
		nCalls++;
	}
}

module.exports = serverManager;