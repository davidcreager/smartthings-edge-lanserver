"use strict"
const fs = require("fs");
const express = require("express");
const util =  require("util");
const xml2js = require("xml2js");
const XMLBuilder = new xml2js.Builder();
const nodessdp = require('node-ssdp').Server;

const IP = require("ip");
const { v4: uuidv4 } = require('uuid');
const Device = require("./device.js");
let nCalls = 0;
let cnt =0;

class serverManager {
	constructor(config) {
		this.app = express();
		this.config = config;
		this.app.listen(config.serverPort, "0.0.0.0", () => {
			console.log("[serverManager]\t\t\t " + "listening on " + IP.address() + ":" + this.config.serverPort);
		});
		this.servers = {};
		this.SSDPServers = {};
		this.USNbase = this.config["ssdpConfig"].USN //"urn:schemas-upnp-org:device:smartdev:1"
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
					console.log("[serverManager]\t\t Initialised uuidStore " + this.config.uuidFileName);
				} catch (e) {
					console.error("[serverManager]\t\t Initialising uuidStore error code=" + e.code + " error is " +  e);
				}
			} else {
				console.error("[serverManager]\t\t loading uuidStore error code=" + err.code + " error is " +  err)
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
		this.app.get('/favicon.ico', (req, res) => res.status(204).end());
		this.app.get("/list/:object", (req, res) => {this.listObjects(req,res)});
		this.app.get("/discovery", (req, res) => {this.discovery(res)});
		this.app.get("/:device/smartthings_command/:component/:capability/:command", (req, res) => {this.smartthingsCommand(req,res)});
		this.app.get("/:device/:command", (req, res) => {this.command(req,res)});
		this.app.get("/:device", (req, res) => {this.ssdpResponse(req,res)});
	}
	discovery(req,res) {
		if (this.servers) {
			Object.values(this.servers).forEach( (srv) => srv.discover() );
			if (res) res.status(200).json({response:"discovey initiated"});
		}
		if (res) res.status(500).json({response:"discovey failed, no servers"});
	}
	listObjects(req,res) {
		//req.params.object
		const validObjects = [ "devices", "subscriptions", "uuids", "config" ]
		if ( validObjects.includes(req.params.object) ) {
			if (req.params.object=="config" ) {
				res.status(200).json(this.config);
			}
			const obj = this[((req.params.object=="uuids") ? "uuidStore" : req.params.object)];
			const retVal = Object.keys(obj).map( (obk) => {
				switch (req.params.object) {
					case "uuids":
						return {uniqueName: obk, uuid: obj[obk]}
						break;
					case "devices":
						return {uniqueName: obk, 				
							queryID: obj[obk].queryID, 
							validCommands: obj[obk].validCommands,
							location: obj[obk].location,
							friendlyName: obj[obk].friendlyName, type: obj[obk].type,
							deviceLocation: obj[obk].deviceLocation}
					
						break;
					case "subscriptions":
						const subs = obj[obk].map( (sub) => sub.ip + ":" + sub.port );
						return {uniqueName: obk, servers: subs}
					break;
				}
				
			});
			res.status(200).json(retVal);
		} else {
			console.log("[serverManager][listObjects] \tunknown object to list, should be 'devices' or 'subscriptions' or 'uuids' or 'config'")
			res.status(200).send("unknown object to list, should be 'devices' or 'subscriptions' or 'uuids'");
		}	
		return
	}
	getDeviceInConfig(uniqueName,type) {
		const deviceInConfig = this.config[type].deviceMapping.find((ele) => uniqueName == ele.uniqueName);
		return deviceInConfig;		
	}
	addDevice(device, server){
		if (!this.uuidStore[device.uniqueName]) {
			this.uuidStore[device.uniqueName] = uuidv4();
			try {
				fs.writeFileSync(this.config.uuidFileName, JSON.stringify( this.uuidStore ))
			} catch (e) {
				console.error("[serverManager]\t\t Writing uuidStore error code=" + e.code + " error is " +  e);
			}
		}
		device.id = this.uuidStore[device.uniqueName];
		device.queryID = "uuid:" + device.id + "::" + this.USNbase;
		device.server = server;
		device.location = "http://"+ IP.address() + ":" + this.config.serverPort + "/" + device.queryID;
		const self = this
		device.emitter_on("device updated", (dev, updatedState) => {
			if (self.subscriptions[dev.uniqueName]) {
				self.subscriptions[dev.uniqueName].forEach( (sub) => {
					console.log("[serverManager][on device updated]\t Sending subscription update for " + dev.friendlyName + " address=" + sub.ip + ":" + sub.port + " state=" + updatedState)
				});
			}
			
		});
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
								//location: "http://"+ IP.address() + ":" + this.config.serverPort + "/" + device.queryID + "/query"
								location: "http://"+ IP.address() + ":" + this.config.serverPort + "/" + device.queryID
							});
		this.SSDPServers[device.uniqueName].addUSN(this.USNbase);
		this.SSDPServers[device.uniqueName].addUSN(UDN);
		console.log("addUSN Called on " + this.USNbase);
		this.SSDPServers[device.uniqueName].start();
		this.devices[device.uniqueName] = device;
		console.log("[serverManager][addDevice]\t Created Device for " + device.type + " " + 
							" Profile=" + device.modelName +
							" " + device.uniqueName + " - " + device.friendlyName + " " + device.id);
	}
	async smartthingsCommand(req,res) {
		let dev;
		Object.keys(this.devices).forEach( (key) => {
			if (this.devices[key].queryID == req.params.device) dev = this.devices[key];
		});
		if (!dev) {
			console.warn("[serverManager][smartthingsCommand][error]\t Invalid Device "  + req.params.command + " for " + req.params.device);
			res.status(500).send("invalid Device");
			return null;
		}
		//this.app.get("/:device/smartthings_command/:component/:capability/:command", (req, res) => {this.smartthingsCommand(req,res)});
		//const state = await dev[req.query.command](req.query.command,req.query.args);
		
		console.log("[smartthingsCommand] received params ", util.inspect(req.query), util.inspect(req.params))
		
		if (!dev.validCommands.includes(req.params.command)) {  
			console.warn("[serverManager][smartthingsCommand][error]\t Invalid Command "  + req.params.command + " for " + req.params.device + " query=" + util.inspect(req.query));
			res.status(500).send("invalid command");
			return null;
		}
		
		const state = await dev[req.params.command](req.params.command,req.query);
		res.status(200).json({response:"suceeded", cmd: req.query.command, query:req.query.args, state: state});
		
	}
	async ssdpResponse(req,res) {
		let dev;
		Object.keys(this.devices).forEach( (key) => {
			if (this.devices[key].queryID == req.params.device) dev = this.devices[key];
		});
		if (!dev) {
			console.warn("[serverManager][ssdpResponse][error]\t Invalid Device "  + req.params.device);
			res.status(500).send("invalid Device");
			return null;
		}
		let xml = XMLBuilder.buildObject(dev.getSSDPDescription(IP.address(),this.config.serverPort));
		res.status(200).send(xml);
		return null
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
		if (req.params.command == "query") {
			let xml = XMLBuilder.buildObject(dev.getSSDPDescription(IP.address(),this.config.serverPort));
			res.status(200).send(xml);
			return null
		}
		if (req.params.command == "JSONQuery") {
			let xml = XMLBuilder.buildObject(dev.getSSDPDescription(IP.address(),this.config.serverPort));
			res.status(200).json(dev.getJSONDescription(IP.address(),this.config.serverPort));
			return null
		}
		if (req.params.command == "ping") {
			let serverIP = req.query.ip;
			let serverPort = req.query.port;
			if (!this.subscriptions[dev.uniqueName]) this.subscriptions[dev.uniqueName] = []
			let found = false;
			this.subscriptions[dev.uniqueName].forEach( (sub) => {
				if (sub.ip == serverIP) {
					sub.port = serverPort
					found = true;
				}
			})
			if (!found) this.subscriptions[dev.uniqueName].push({port: serverPort, ip: serverIP});
			if (!found) console.log("[serverManager][command]\t Subscription " + " for " + dev.friendlyName + " " + serverIP + ":" + serverPort);
			res.status(200).json({response: "suceeded", cmd: "ping", query:req.query.value, state:dev.state});
			return null
		}
		if (req.params.command == "refresh") {
			res.status(200).json({response: "suceeded", cmd: "refresh", query:req.query.value, state:dev.state});
			return null
		}
		if (!dev.validCommands.includes(req.params.command)) {  
			console.warn("[serverManager][command][error]\t Invalid Command "  + req.params.command + " for " + req.params.device + " query=" + util.inspect(req.query));
			res.status(500).send("invalid command");
			return null;
		}
		console.log("[serverManager][command]\t Processing "  + req.params.command + " for " + dev.friendlyName + " query is " + util.inspect(req.query));
		const state = await dev[req.params.command](req.params.command, req.query);
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