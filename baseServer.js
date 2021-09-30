"use strict"
const fs = require("fs");
const express = require("express");
const util =  require("util");
const xml2js = require("xml2js");
const XMLBuilder = new xml2js.Builder();
const nodessdp = require('node-ssdp').Server;
const IP = require("ip");
const { v4: uuidv4 } = require('uuid');
let nCalls = 0;
let cnt =0;
const simpLog = function(typ,obj,newb) {
	//console.log(" cnt=" + classCounter + " Constructing a " + typ + " class=" + obj.constructor.name + 
	//				" target=" + newb + " ssdpUSNPrefix=" + ssdpUSNPrefix + " ssdpUDN=" + ssdpUDN);
}

class ssdpDevice {
	constructor({deviceType, friendlyName, UDN, location, id, modelDescription, queryID} = {}) {
		this.deviceType = deviceType;
		this.friendlyName = friendlyName;
		this.UDN = UDN;
		this.location = location;
		this.id = id;
		this.manufacturer = "DHC EA Consulting";
		this.modelName = deviceType;
		this.modelNumber = "0001.0001";
		this.modelDescription = modelDescription;
		this.serialNumber = "0001001";
		this.queryID = queryID;
	}
}	
class ssdpDescription {
	constructor(ssdpDevice) {
		this.root = { $: {"xmlns": "urn:schemas-upnp-org:device-1-0" + " configId=" + "configuration number"} };
		this.specVersion = {major:1,minor:0};
		this.device = ssdpDevice;
	}
}
class serverManager {
	constructor(config) {
		this.app = express();
		this.config = config;
		this.app.listen(config.serverPort, "0.0.0.0", () => {
			console.log("[baseSmartServer]\t\t " + "listening on port " + config.serverPort);
		});
		this.servers = {};
		this.SSDPServers = {};
		this.USNbase = this.config["ssdpConfig"].schema + "device:" + "smartdev:1"

		this.classMap = { bluetoothConnectServer: bluetoothConnectServer, rfxcomServer: rfxcomServer, findIphoneServer: findIphoneServer}
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
					if (this.servers[server.type]) console.error("[serverManager] creating servers weird! more than one per type");
					this.servers[server.type] = server;
					
					server.discover();
					console.log("Creating " + srv);
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
						validCommands: this.devices[dev].server.validCommands,
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
				console.error("[baseSmartServer]\t\t Writing uuidStore error code=" + e.code + " error is " +  e);
			}
		}
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
		console.log("[serverManager][addDevice] Created Device for " + device.type + "\t" +
							device.uniqueName + " - " + device.friendlyName + "\t" + device.id);
	}
	command(req,res) {
		let dev;
		Object.keys(this.devices).forEach( (key) => {
			if (this.devices[key].queryID == req.params.device) dev = this.devices[key];
		});
		if (!dev) {
			console.warn("[serverManager][command][error]\t Invalid Device "  + req.params.command + " for " + req.params.device);
			res.status(500).send("invalid Device");
			return null;
		}
		console.log("[serverManager][command]\t Command " + req.params.command + " for " + dev.uniqueName + " " + req.params.device + " Received" );
		if (req.params.command == "query") {
			let ssdpdesc =  new ssdpDescription( 
										new ssdpDevice( {friendlyName: dev.friendlyName,
														UDN: "uuid:" + dev.id,
														location: "http://"+ IP.address() + ":" + this.config.serverPort + "/" + dev.queryID,
														id: dev.id, 
														modelName: dev.type,
														queryID: dev.queryID,
														deviceType: dev.type,
														modelDescription: "LAN Smartdevice"}
													)
											)				
			let xml = XMLBuilder.buildObject(ssdpdesc);
			res.status(200).send(xml);
			return null
		}
		if (req.params.command == "ping") {
			console.log("[serverManager][command]\t Ping Received query=" + JSON.stringify(req.query));
			let serverIP = req.query.ip;
			let serverPort = req.query.port;
			//this.subscriptions[req.params.device] = {port: serverPort, ip: serverIP};
			if (!this.subscriptions[dev.uniqueName]) this.subscriptions[dev.uniqueName] = []
			this.subscriptions[dev.uniqueName].push({port: serverPort, ip: serverIP});
			console.log("[serverManager][command]\t Subscription " + " for " + req.params.device + " " + serverIP + ":" + serverPort);
			res.status(200).json({response: "ping", cmd: "power", value:"off", level:0});
			return null
		}
		if (req.params.command == "refresh") {
			console.log("[serverManager][command]\t Refresh Received ");
			res.status(200).json({response: "refresh", cmd: "power", value:"off", level:0});
			return null
		}
		//const server = servers[dev.type]
		const server = dev.server
		if (!server.validCommands.includes(req.params.command)) {  
			console.warn("[serverManager][command][error]\t Invalid Command "  + req.params.command + " for " + req.params.device);
			res.status(500).send("invalid command");
			return null;
		}
		console.log("[baseSmartServer][command]\t Processing "  + req.params.command + " for " + req.params.device);
		
		server[req.params.command](dev,req.params.command,req.query);
		res.status(200).json({response:"suceeded", cmd: req.params.command, value:req.query.value});
		console.log("[serverManager][command]\t responded host=" + req.get("host") + 
					" origin=" + req.get("origin") +
					" remIP=" + req.socket.remoteAddress +
					" params=" + JSON.stringify(req.params) +
					" query=" + JSON.stringify(req.query)
					);
		nCalls++;
	}
}

class baseSmartServer {
	constructor(manager) {
		//super();
		this.manager = manager;
		this.validCommands = [];
	}
	
}
const rfxcom = require('rfxcom');
class rfxcomServer extends baseSmartServer {
	constructor(config) {
		super(config);
		this.type = "rfxcom";
		this.rfxtrx = new rfxcom.RfxCom(config[this.type].usbPort, {debug: false});
		this.rfy = new rfxcom.Rfy(this.rfxtrx, rfxcom.rfy.RFY);
		this.validCommands = ["up", "down", "stop","doCommand"];
		this.managementCommands = ["program", "erase", "eraseAll", "listRemotes"];
		let self = this;
		this.rfxtrx.on("status", (msg) => {console.log("[rfxcomserver][status]\t" +  " msg=" + msg)});
		this.rfxtrx.on("rfyremoteslist", (msg) => {
			console.log("[rfxcomserver][RemoteList]\t" +  " msg=" + msg)
			self.deviceDiscovered(msg);
			});
		this.rfxtrx.on("connecting", (msg) => {console.log("[rfxcomserver][connecting]\t" +  " msg=" + msg)});
		this.rfxtrx.on("connectfailed", (msg) => {console.error("[rfxcomserver][connectfailed]\t" +  " msg=" + msg)});
		this.rfxtrx.on("ready", (msg) => {console.log("[rfxcomserver][ready]\t" +  " msg=" + msg)});
		this.rfxtrx.on("disconnect", (msg) => {console.log("[rfxcomserver][disconnect]\t" +  " msg=" + msg)});
		this.rfxtrx.on("response", (msg) => {console.log("[rfxcomserver][response]\t" +  " msg=" + msg)});
		this.rfxtrx.on("receiverstarted", (msg) => {console.log("[rfxcomserver][receiverstarted]\t" +  " msg=" + msg)});
		this.rfxtrx.on("end", (msg) => {console.log("[rfxcomserver][end]\t" +  " msg=" + msg)});
		this.rfxtrx.on("drain", (msg) => {console.log("[rfxcomserver][drain]\t" +  " msg=" + msg)});
		this.rfxtrx.on("receive", (msg) => {console.log("[rfxcomserver][receive]\t" +  " msg=" + msg)});
		this.rfxtrx.initialise(function () {
			console.log("[rfxcomserver][constructor]\t Device initialised Listing remotes");
			self.rfy.listRemotes();
		});
	}
	deviceDiscovered(msg) {
		if (typeof(msg) == "object") {
			if (Array.isArray(msg)) {
				msg.forEach( (dev) => {
					console.log("[rfxcomserver][deviceDiscovered]\t remote found " + JSON.stringify(dev));
					const uniqueName = dev.deviceId + "[" + dev.unitCode + "]";
					const deviceInConfig = self.manager.getDeviceInConfig(uniqueName,self.type);
					if ( !self.manager.devices[uniqueName] && deviceInConfig  ) {
						let device = {
							uniqueName: uniqueName,
							type: self.type,
							config: deviceInConfig,
							friendlyName: deviceInConfig.friendlyName,
							deviceID: dev.deviceId,
							alias: null,
							addressType: null,
							mac: null,
							bleDevice: null
							};
						this.manager.addDevice(device, this);
					}					
				});
			} else {
				console.error("[rfxcomserver][deviceDiscovered]\t msg not an array" +  " msg=" + JSON.stringify(msg));
			}
		} else {
			console.error("[rfxcomserver][deviceDiscovered]\t msg not an object" +  " msg=" + msg);
		}
	}
}
const {createBluetooth} = require('node-ble');
const {bluetooth, destroy} = createBluetooth();
class bluetoothConnectServer extends baseSmartServer {
	constructor(manager) {
		super(manager);
		this.type = "bluetoothConnect";
		this.validCommands = ["power", "color","temperature","level"];
		this.managementCommands = [];
		this.adapter = null;
		this.cmdLookup = {
			power:		[[0x43,0x40],[]],     		// 0x01 is on 0x02 off],
			level:		[[0x43,0x42],[]],  			/// plus parsint(tostring(16)level, 16)  0-64
			color:		[[0x43,0x41],[0xFF,0x65]], 	//r,g,b in the middle  parseInt(tostring(16),16)
			ct:			[0x43,0x43,0x00,0x00,0x00],
			notify:		[0x43,0x67,0xde,0xad,0xbe,0xbf]
		}
	}
	dumpDevices(){
		console.log("[bluetoothConnectServer][dumpdevices]\t " + this.devices.length + " devices found");
		this.devices.forEach( (dev) => {
			console.log("[bluetoothConnectServer][dumpdevices]\t dev=" + JSON.stringify(dev));
			});
	}
	async getAdapter() {
		console.log("[bluetoothConnectServer][getAdapter] Getting Adapter " + (this.adapter=={}));
		//need to sort out gAdapter
		if ( (this.adapter=={}) || (!this.adapter) ) {
			console.log("BTDeviceHandler.getAdapter\t Creating Adapter");
			try {
				 this.adapter = await bluetooth.defaultAdapter();
				 return this.adapter;
				} catch (err) {
					console.error("getAdapater error=" + err);
					throw err;
				}
		} else {
			console.log("[bluetoothConnectServer][getAdapter] returning current  Adapter " + this.adapter.adapter);
			return this.adapter;
		}
		console.log("[bluetoothConnectServer][getAdapter] Weirdness no return");
	}
	async processDevice(adapter,device) {
		let dev = await this.adapter.getDevice(device);
		return Promise.all([
				device,
				dev.getAlias(),
				dev.getAddressType(),
				dev.getName().catch(()=> {return "No Name"})
				//dev.getServiceData().catch( () => {return "no Service Data"}),
				//dev.getManufacturerData().catch( () => {return "no Manufacturer Data"})
				]);
	}
	receiveNotification(device,data) {
		console.log("bleyees:\t received valueChanged " + "\t" + util.inspect(data));
		console.log("bleyees:\t received power: " + data[2] + " bright: " + data[8]);
	}
	async sendCommand(device, cmd, subcmd) {
		const bleMagic = [];
		bleMagic.length = 18;
		bleMagic[0] = 0x43;bleMagic[1] = 0x67;bleMagic[2] = 0xde;bleMagic[3] = 0xad;bleMagic[4] = 0xbe;bleMagic[5] = 0xbf;
		const bleCmd = [];
		this.cmdLookup[cmd][0].forEach( (val,ind) => bleCmd.push(val) );
		if (cmd=="power") bleCmd.push( ((subcmd=="off") ? 0x02 : 0x01) )
		if (cmd=="level") bleCmd.push(parseInt(subcmd.toString(16),16));
		if (cmd=="color") colors[subcmd].forEach((val)=> bleCmd.push(parseInt(val.toString(16),16)))
		this.cmdLookup[cmd][1].forEach( (val,ind) => bleCmd.push(val) );
		bleCmd.length = 18
		const self = this;
		if ( (!device.bleDevice.isConnected) || !(await device.bleDevice.isConnected()) ){
			try {
				console.log("baseSmartServer:sendCommand: connecting to " + device.mac )
				//device.bleDevice = await this.adapter.waitDevice(device.device.mac,20 * 10000);
				device.bleDevice = await this.adapter.waitDevice(device.mac);
				console.log("baseSmartServer:sendCommand: connected to " + device.mac )
				if (device.bleDevice) {
					await device.bleDevice.connect();
					device.bleDevice.gattServer = await device.bleDevice.gatt();
					device.bleDevice.serviceRef = await device.bleDevice.gattServer.getPrimaryService(device.config.SERVICE_UUID);
					device.bleDevice.controlCharacteristic = await device.bleDevice.serviceRef.getCharacteristic(device.config.CONTROL_UUID);
					device.bleDevice.notifyCharacteristic = await device.bleDevice.serviceRef.getCharacteristic(device.config.NOTIFY_UUID);
					device.bleDevice.notifyCharacteristic.on("valuechanged", (data) => self.receiveNotification(device, data));
					await device.bleDevice.notifyCharacteristic.startNotifications();
				} else {
					console.log("baseSmartServer:sendCommand: Cannot connect to Device" )
					return null;
				}
			} catch(er) {
				console.log("baseSmartServer:sendCommand: Cannot reach Device " + er )
				return null;
			}
		}
		await device.bleDevice.controlCharacteristic.writeValue(Buffer.from(bleMagic),{"type":"reliable"}); //command, request, reliable
		await device.bleDevice.controlCharacteristic.writeValue(Buffer.from(bleCmd),{"type":"reliable"}); //command, request, reliable
	}
	power( device, cmd, subcmd ) {
		console.log("Power command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	level( device, cmd, subcmd ) {
		console.log("level command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	temperature( device, cmd, subcmd ) {
		console.log("temperature command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	color( device, cmd, subcmd ) {
		console.log("Color command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	async discover() {
		const self = this;
		const adapter = await this.getAdapter();
		console.log("[bluetoothConnectServer][discover]  Adapter Obtained " + adapter.adapter);
		if (! await this.adapter.isDiscovering()) await adapter.startDiscovery();
		console.log("[bluetoothConnectServer][discover]  Adapter discovering " + await this.adapter.isDiscovering());
		const retPromise = await new Promise(
			(resolve,reject) => {
				setTimeout( async () => {
					try {
						const discoveredDevices = await self.adapter.devices();
						console.log("[bluetoothConnectServer][discover]  Discovered Devices " + JSON.stringify(discoveredDevices));
						resolve(discoveredDevices);
					} catch (err) {
						reject("Error getting Devices in promise " + err);
					}
				},self.manager.config[self.type]["DiscoveryTime"]);
			});
		console.log("[bluetoothConnectServer][discover]  About to create promises ");
		const devPromises =  retPromise.map( (device,ind) => this.processDevice(this.adapter,device) ); // With no await, this function returns a promise as it async!!!!
		console.log("[bluetoothConnectServer][discover]  created promises ");
		//let devs = await Promise.all(devPromises);
		let devices = []
		for ( let dev of (await Promise.all(devPromises)) ) {
			const uniqueName = ((dev[3]=="No Name") ? dev[1] : dev[3]) + "[" + dev[0] + "]";
			const deviceInConfig = self.manager.getDeviceInConfig(uniqueName,self.type);
			if (deviceInConfig) {
				let device = {
					uniqueName: uniqueName,
					friendlyName: deviceInConfig.friendlyName,
					deviceID: dev[0],
					alias: dev[1],
					addressType: dev[2],
					config: deviceInConfig,
					mac: dev[0],
					type: self.type,
					bleDevice: {}
				}
				self.manager.addDevice(device, self);
			}
		}
		console.log("[bluetoothConnectServer][discover]  About to stop Discovery");
		await this.adapter.stopDiscovery();
	}
}
const ICloud = require('./icloud').iCloud;
const Encrypter = require('./encrypt');
class findIphoneServer extends baseSmartServer {
	constructor(manager) {
		super(manager);
		this.encrypter = new Encrypter("bollocks");
		this.type = "findIphone";
		let appleID = this.manager.config[this.type].apple_id
		let applePwd = this.manager.config[this.type].password;
		if (this.manager.config[this.type].encrypted == true) {
			appleID = this.encrypter.dencrypt(appleID);
			applePwd = this.encrypter.dencrypt(applePwd);
		}
		this.iCloud = new ICloud(appleID, applePwd);
		this.validCommands = ["beep"];
		this.managementCommands = [];
	}
	beep(device) {
		console.log("[findIphoneServer][beep]\t Alerting " + device.friendlyName + " deviceID=" + device.deviceID);
		const self = this;
		let validSession =  this.iCloud.checkSession( (err, res, body) => {
			if (err) {
				console.log("[findIphoneServer][beep]\t Session invalid " + err);
				validSession = self.iCloud.login( (err,res,body) => {
					if (err) {
						console.error("[findIphoneServer][beep]\t login Cannot login " + err);
						return false;
					}
					console.log("[findIphoneServer][beep]\t checkSession:login Logged in again");
					return true;
				})
				return validSession
			} else {
				console.log("[findIphoneServer][beep]\t checkSession: Reusing session");
				return true;
			}
		});
		if (!validSession) {
			console.log("[findIphoneServer][beep]\t validSession = " + validSession)
			//return null
		}
		this.iCloud.alertDevice(device.deviceID, (err,resp,body) => {
			if ( (err) || (resp.statusCode != 200) ) {
				console.warn("[findIphoneServer][beep]\t Error sending beep " + err + " statuscode=" + resp.statusCode);
				return;
			}
			return
		});
	}
	async discover() {
		console.log("[findIphoneServer][discover]\t Starting Iphone discovery")
		const self = this;
		this.iCloud.getDevices(function(err, devices) {
			if (err) return console.error('[findIphoneServer][discover]\t ERROR:',err);
			if (devices.length === 0) {
				return console.warn("[findIphoneServer][discover]\t No devices found!");
			} else {
				console.log("[findIphoneServer][discover]\t Found " + devices.length.toString() + " devices");
				devices.forEach( (dev) => {
					const uniqueName = dev.name + "[" + dev.deviceDisplayName + "]";
					const deviceInConfig = self.manager.getDeviceInConfig(uniqueName,self.type);
					if ( !self.manager.devices[uniqueName] && deviceInConfig  ) {
						let device = {
							uniqueName: uniqueName,
							type: self.type,
							config: deviceInConfig,
							friendlyName: deviceInConfig.friendlyName,
							deviceID: dev.id,
							alias: null,
							addressType: null,
							mac: null,
							bleDevice: null
							};
						self.manager.addDevice(device, self);
					}
				});
			}
		});
	};
}
module.exports = {serverManager, findIphoneServer, bluetoothConnectServer, rfxcomServer}