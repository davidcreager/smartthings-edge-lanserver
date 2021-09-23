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
const uuidFileName = "./uuid.json"
let uuidStore = {}
try {
	uuidStore = JSON.parse( fs.readFileSync(uuidFileName) )
} catch(err) {
	if (err.code=="ENOENT") {
		try {
			fs.writeFileSync(uuidFileName, JSON.stringify( uuidStore ))
			console.log("[lanserver]\t\t Initialised uuidStore " + uuidFileName);
		} catch (e) {
			console.error("[lanserver]\t\t Initialising uuidStore error code=" + e.code + " error is " +  e);
		}
	} else {
		console.error("[lanserver]\t\t loading uuidStore error code=" + err.code + " error is " +  err)
	}
}
class baseSmartServer {
	constructor(config) {
		//super();
		this.app = express();
		this.config = config;
		this.app.listen(config.serverPort, "0.0.0.0", () => {
			console.log("[baseSmartServer]\t\t " + "listening on port " + config.serverPort);
		});
		this.devices = {};
		this.subscriptions = {};
		this.SSDPServers = {};
		this.deviceReferences = {};
		this.USNbase = this.config["ssdpConfig"].schema + "device:" + "smartdev:1"
		this.ssdpDescription = { root:{ $:{"xmlns": "urn:schemas-upnp-org:device-1-0" + " configId=" + "configuration number"},
						specVersion: {major:1,minor:0},
						device: null}};
		this.ssdpDevice = {deviceType: null, friendlyName: null, manufacturer: "DHC EA Consulting",
							modelDescription: null, modelName: "LAN SmartDevice", modelNumber: "0001.0001",
							serialNumber: "0001001", UDN: null, location: null, id: null};
		// this.devices[id] = {id,uniqueName,friendlyName,deviceref}
		this.validCommands = [];
		//this.app.get(config.serverQuery + "/:deviceID", (req, res) => {this.query(req,res)});
		//this.app.get(config.serverPath + "/:device/:command", (req, res) => {this.command(req,res)});
		this.app.get("/:device/:command", (req, res) => {this.command(req,res)});
	}	
	allocateUUID(deviceUniqueName) {
		if (!uuidStore[deviceUniqueName]) {
			uuidStore[deviceUniqueName] = uuidv4();
			try {
				fs.writeFileSync(uuidFileName, JSON.stringify( uuidStore ))
			} catch (e) {
				console.error("[baseSmartServer]\t\t Writing uuidStore error code=" + e.code + " error is " +  e);
			}
		}
		return uuidStore[deviceUniqueName]
	}
	createSSDP(device){
		//let USN = "uuid:" + device.id + ":" + this.config["ssdpConfig"].schema + "device:" + "smartdev:1";
		//'ST: urn:SmartThingsCommunity:device:LightBulbESP8266:1'
		let UDN = "uuid:" + device.id;
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
	}
	command(req,res) {
		console.log("[baseSmartServer][command]\t Command " + req.params.command + " for " + req.params.device + " Received" );
		let dev;
		Object.keys(this.devices).forEach( (key) => {
			if (this.devices[key].queryID == req.params.device) dev = this.devices[key];
		});
		if (!dev) {
			console.warn("[baseSmartServer][command][error]\t Invalid Device "  + req.params.command + " for " + req.params.device);
			res.status(500).send("invalid Device");
			return null;
		}
		if (req.params.command == "query") {
			this.ssdpDevice.friendlyName = dev.friendlyName;
			this.ssdpDevice.UDN = "uuid:" + dev.id;
			this.ssdpDevice.location = "http://"+ IP.address() + ":" + this.config.serverPort + "/" + dev.queryID
			this.ssdpDevice.id = dev.id;
			this.ssdpDevice.modelName = this.type;
			this.ssdpDevice.queryID = dev.queryID;
			this.ssdpDescription.device = this.ssdpDevice
			let xml = XMLBuilder.buildObject(this.ssdpDescription);
			res.send(xml);
			return null
		}
		if (req.params.command == "ping") {
			console.log("[baseSmartServer][command]\t Ping Received query=" + JSON.stringify(req.query));
			let serverIP = req.query.ip;
			let serverPort = req.query.port;
			this.subscriptions[req.params.device] = {port: serverPort, ip: serverIP};
			console.log("[baseSmartServer][command]\t Subscription " + " for " + req.params.device + " " + serverIP + ":" + serverPort);
			res.status(200).json("Received Ping");
			return null
		}
		if (req.params.command == "refresh") {
			console.log("[baseSmartServer][command]\t Refresh Received ");
			res.status(200).json("Received Refresh");
			return null
		}
		if (!this.validCommands.includes(req.params.command)) {
			console.warn("[baseSmartServer][command][error]\t Invalid Command "  + req.params.command + " for " + req.params.device);
			res.status(500).send("invalid command");
			return null;
		}
		console.log("[baseSmartServer][command]\t Processing "  + req.params.command + " for " + req.params.device);
		this[req.params.command](dev);		
		res.json({devices: this.devices, validCommands: this.validCommands});
		console.log("[baseSmartServer][command]\t responded host=" + req.get("host") + 
					" origin=" + req.get("origin") +
					" remIP=" + req.socket.remoteAddress +
					" params=" + JSON.stringify(req.params) +
					" query=" + JSON.stringify(req.query)
					);
		nCalls++;
	}
}

const rfxcom = require('rfxcom');
class rfxcomServer extends baseSmartServer {
	constructor(config) {
		super(config);
		this.type = "rfxcom";
		this.ssdpDevice.deviceType = this.type;
		this.ssdpDevice.modelDescription = this.type;
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
				msg.forEach( (rem) => {
					console.log("[rfxcomserver][deviceDiscovered]\t remote found " + JSON.stringify(rem));
					const devName = "Blind " + rem.deviceId + "[" + rem.unitCode + "]";
					if (!self.devices[devName]) {
						let ID = uuidv4()
						let device = { "id": ID, uniqueName: devName,
										friendlyName: rem.deviceId, deviceID: rem.deviceId,
										queryID: "uuid:" + ID + self.USNbase };
						self.devices[devName] = device;
						self.createSSDP(device);
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
let gAdapter = null;

class bluetoothConnectServer extends baseSmartServer {
	constructor(config) {
		super(config);
		this.type = "bluetoothConnect";
		this.discoveredPeripherals = {};
		this.validCommands = ["on", "off"];
		this.managementCommands = [];
		this.devices = {};
	}
	dumpDevices(){
		console.log("[bluetoothConnectServer][dumpdevices]\t " + this.devices.length + " devices found");
		this.devices.forEach( (dev) => {
			console.log("[bluetoothConnectServer][dumpdevices]\t dev=" + JSON.stringify(dev));
			});
	}
	async getAdapter() {
		//need to sort out gAdapter
		if ( (gAdapter=={}) || (!gAdapter) ) {
			log.info("BTDeviceHandler.getAdapter\t Creating Adapter");
			try {
				 const adapt = await bluetooth.defaultAdapter();
				 gAdapter = adapt;
				 return adapt;
				} catch (err) {
					log.error("getAdapater error=" + err);
					throw err;
				}
		} else {
			return gAdapter;
		}
	}
	async processDevice(device) {
		let dev = await gAdapter.getDevice(device);
		return Promise.all([
				device,
				dev.getAlias(),
				dev.getAddressType(),
				dev.getName().catch(()=> {return "No Name"})
				//dev.getServiceData().catch( () => {return "no Service Data"}),
				//dev.getManufacturerData().catch( () => {return "no Manufacturer Data"})
				]);
	}
	async discoverDevices() {
		try {
			if (!gAdapter) {
				log.error("discoverDevices\t adapter not there");
				return null;
			}
			if (! await gAdapter.isDiscovering()) await gAdapter.startDiscovery();
		} catch (err) {
			log.error("discoverDevices error in starting discovery=" + err);
			return null;
		}
		const retPromise = await new Promise(
			(resolve,reject) => {
				setTimeout( async () => {
					try {
						this.devices = await gAdapter.devices();
					} catch (err) {
						reject("Error getting Devices in promise " + err);
					}
					resolve(this.devices);
				},8000);
			});
		let devPromises =  retPromise.map( (device,ind) => this.processDevice(device) ); // With no await, this function returns a promise as it async!!!!
		return await Promise.all(devPromises);
	}
}
const ICloud = require('./icloud').iCloud;
const Encrypter = require('./encrypt');
class findIphoneServer extends baseSmartServer {
	constructor(config) {
		super(config);
		this.encrypter = new Encrypter("bollocks");
		this.type = "findIphone";
		let appleID = config[this.type].apple_id
		let applePwd = config[this.type].password;
		if (config[this.type].encrypted == true) {
			appleID = this.encrypter.dencrypt(appleID);
			applePwd = this.encrypter.dencrypt(applePwd);
		}
		this.iCloud = new ICloud(appleID, applePwd);
		this.validCommands = ["beep"];
		this.managementCommands = [];
		this.devices = {};
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
					//console.log(JSON.stringify(dev));
					/* console.log("FindIphone:discoverDevices: " + " name="  + dev.name + " modelDisplayName=" + dev.modelDisplayName+ " deviceDisplayName=" + dev.deviceDisplayName+ " batteryLevel=" + dev.batteryLevel
								); */
					const devName = dev.name + "[" + dev.deviceDisplayName + "]";
					if (!self.devices[devName]) {
						let ID = self.allocateUUID(devName)
						let device = { "id": ID, uniqueName: devName,
										friendlyName: dev.name, deviceID: dev.id,
										queryID: "uuid:" + ID + self.USNbase };
						let deviceInConfig = self.config[self.type].deviceMapping.find((ele) => device.uniqueName == ele.uniqueName);
						if ( (!self.config[self.type].deviceMapping) || (deviceInConfig) ) {
							if (deviceInConfig) device.friendlyName = deviceInConfig.friendlyName;
							console.log("[findIphoneServer][discover]\t Creating Device " + JSON.stringify(device));
							self.devices[devName] = device;
							self.createSSDP(device);
						}
					}

				} );
			}
		});
	};
}
module.exports = {findIphoneServer, bluetoothConnectServer, rfxcomServer}