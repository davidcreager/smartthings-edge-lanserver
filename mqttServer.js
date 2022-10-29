'use strict';
const util = require("util");
const Device = require("./device.js");
const mqtt = require("async-mqtt");
function timeOutAfter(seconds) {
	return new Promise( (resolve, reject) => {
		setTimeout(() => {
			//reject(new Error("timeout"));
			reject("timeout");
			}, seconds * 1000);
	});
}
class mqttServer {
	constructor(manager) {
		this.manager = manager;
		this.serverType = "mqtt";
		this.mqttDeviceName = "smartserver";
		this.mqttClient = mqtt.connect("mqtt://CREAGERS-WHS:1883",{"clientId":"smartserver", keepalive:30, });
		this.mqttClient.on("connect",  () => {console.log("[mqttClient][mqttServer]\t connect received");this.connected()});
		this.mqttClient.on("reconnect",  () => console.log("[mqttClient][mqttServer]\t reconnect received"));
		this.mqttClient.on("close",  () => console.log("[mqttClient][mqttServer]\t close received"));
		this.mqttClient.on("disconnect",  () => console.log("[mqttClient][mqttServer]\t disconnect received"));
		this.mqttClient.on("offline",  () => console.log("[mqttClient][mqttServer]\t offline received"));
		this.mqttClient.on("error",  (err) => console.log("[mqttClient][mqttServer]\t error received " + err));
		this.mqttClient.on("end",  () => console.log("[mqttClient][mqttServer]\t end received"));
		this.mqttClient.on("message",  (topic,message,packet) => {console.log("[mqttClient][mqttServer]\t message received");this.messageReceived(topic,message,packet)});
		//this.mqttClient.on("packetsend",  (packet) => console.log("[mqttClient][mqttServer]\t packetsend received"));
		//this.mqttClient.on("packetreceive",  (packet) => console.log("[mqttClient][mqttServer]\t packetreceive received"));	
		const self = this;
		//this.devicesRefreshed = new Promise( (resolve,reject) => {self.refreshed = resolve;self.refreshedFailed = reject} );

		this.mqttDeviceName = "smartserver";
	}
	async init() {
		try {
			await this.mqttClient.subscribe(this.mqttDeviceName + "/#");
			console.log("[mqttServer][init]:\t  subscribed");
			await this.mqttClient.publish(this.mqttDeviceName + "/fromserver" + "/" + "hereiam",JSON.stringify({req:"hereiam"}));
			//await this.mqttClient.publish(this.mqttDeviceName + "/" + "hereiam",JSON.stringify({req:"hereiam"}));
			console.log("[mqttServer][init]:\t  published");
		} catch (err) {
			console.error
		}
	}
	async connected() {
		try {
			if (!this.mqttClient.isConnected) {
				//this.mqttClient =  await this.mqttClient.reconnect();
				console.log("[mqttServer][connected]:\t not connected");
			} else {
				console.log("[mqttServer][connected]:\t is connected");
			}
			//this.init();
		} catch (err) {
			console.error("[mqttServer][connected]:\t " + " Error " + err);
		}
	}
	async messageReceived(topic, message, packet) {
		console.log("[mqttServer][messageReceived]\t " + topic + "\t" + message);
		if ((topic.includes("getDevices")) && topic.includes("toserver")) {
			let msg = null;
			try {
				msg = JSON.parse(message);
			} catch (err) {
				console.log("[mqttServer][messageReceived]\t cannot parse message into json" + topic + "\t" + message);
			}
			if (Array.isArray(msg)) {
				const retDevices = msg.map( (dev) => dev ) ;
				this.refreshed(retDevices);
			} else {
				console.log("[mqttServer][messageReceived]\t expected an array " + topic + "\t" + message);
			}	
			//console.log(" Devices set up " + util.inspect(this.devices));
		}
	}
	async getDevices(){
		console.log("[mqttServer][getDevices] called");
		const self = this;
		if (this.devicesRefreshed) {
			console.error("[mqttServer][discover]\t devicesRefreshed not null   this is weird");
			return null;
		}
		try {
			this.devicesRefreshed = new Promise( (resolve,reject) => {self.refreshed = resolve;self.refreshedFailed = reject} );
			await this.mqttClient.publish(this.mqttDeviceName + "/fromserver" + "/" + "getDevices",JSON.stringify({req:"hereiam"}));
			const response = await Promise.race( [this.devicesRefreshed, timeOutAfter(5)] );
			console.log("[mqttServer][discover]\t response = " + util.inspect(response) + " this devicesrefreshed=" + util.inspect(this.devicesRefreshed));	
			console.log("[mqttServer][discover]\t devices discovered " + util.inspect(this.devices));
		} catch(err) {
			this.refreshedFailed(err);
			console.log("[mqttServer][discover]\t rejection = " + util.inspect(err) + " this devicesrefreshed="  + util.inspect(this.devicesRefreshed));		
		}
	}
	async discover() {
		console.log("[mqttServer][discover] called");
		const self = this;
		if (this.devicesRefreshed) {
			console.error("[mqttServer][discover]\t devicesRefreshed not null   this is weird");
			return null;
		}
		try {
			this.devicesRefreshed = new Promise( (resolve,reject) => {self.refreshed = resolve;self.refreshedFailed = reject} );
			await this.mqttClient.publish(this.mqttDeviceName + "/fromserver" + "/" + "getDevices",JSON.stringify({req:"hereiam"}));
			const response = await Promise.race( [this.devicesRefreshed, timeOutAfter(5)] );
			for (let dev of response) {
				console.log("received device - " + dev.deviceName + " service=" + dev.service);
			}
				
			//console.log("[mqttServer][discover]\t response = " + util.inspect(response) ) //+ " this devicesrefreshed=" + util.inspect(this.devicesRefreshed));	
			//console.log("[mqttServer][discover]\t devices discovered " + util.inspect(this.devicesRefreshed));
		} catch(err) {
			this.refreshedFailed(err);
			console.log("[mqttServer][discover]\t rejection = " + util.inspect(err) + " this devicesrefreshed="  + util.inspect(this.devicesRefreshed));		
		}
		
		
	}
}
module.exports = mqttServer;