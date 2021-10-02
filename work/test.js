"use strict";
const prompt = require("prompt");
const util = require("util");
const Services = [{"0000180a-0000-1000-8000-00805f9b34fb":
				{	chars:["00002a26-0000-1000-8000-00805f9b34fb",
					"00002a29-0000-1000-8000-00805f9b34fb",
					"00002a24-0000-1000-8000-00805f9b34fb",
					"00002a27-0000-1000-8000-00805f9b34fb"],
					notify : null}
			},
			{"00010203-0405-0607-0809-0a0b0c0d1910":
				{	chars:["00010203-0405-0607-0809-0a0b0c0d1911",
					"00010203-0405-0607-0809-0a0b0c0d1912",
					"00010203-0405-0607-0809-0a0b0c0d1913",
					"00010203-0405-0607-0809-0a0b0c0d1914"],
					notify: "00010203-0405-0607-0809-0a0b0c0d1911"}
			},
			{"0000fe87-0000-1000-8000-00805f9b34fb":
				{	chars:[
					"aa7d3f34-2d4f-41e0-807f-52fbf8cf7443",
					"8f65073d-9f57-4aaa-afea-397d19d5bbeb"],
					notify: "8f65073d-9f57-4aaa-afea-397d19d5bbeb"}
			},
			];
( async () => {
	console.log(util.inspect(await selectUUIDs(Services)))
	/*
	Services.forEach( (srv,ind) => {
		console.log("Service Ind=" + ind + "\t" + Object.keys(srv)[0])
		
	});
	const {serverIndex} = await prompt.get(["serverIndex"]);
	const serviceUUID = Object.keys(Services[serverIndex])[0]
	//console.log("serverIndex=",serverIndex, " uuid=" + serviceUUID, util.inspect(Services[serverIndex]));
	console.log("serverIndex=",serverIndex, " uuid=" + serviceUUID);
	Services[serverIndex][serviceUUID].chars.forEach( (chr,ind) => {
		console.log("characterIndex=",ind, chr);
	});
	const {characterIndex} = await prompt.get(["characterIndex"]);
	console.log("characterIndex=" + characterIndex,Services[serverIndex][serviceUUID].chars[characterIndex]);
	const charUUID = Services[serverIndex][serviceUUID].chars[characterIndex];
	const notifyUUID = Services[serverIndex][serviceUUID].notify;
	console.log(" Selected ServiceUUID= " + serviceUUID + "\t char= " + charUUID + "\t notify= " + notifyUUID);
	*/
} )()
async function selectUUIDs(services) {
	services.forEach( (srv,ind) => {
		console.log("Service Ind=" + ind + "\t" + Object.keys(srv)[0])
	});
	let promptObj = numberPrompter("serverIndex",services.length-1);
	const {serverIndex} = await prompt.get(promptObj);
	const serviceUUID = Object.keys(services[serverIndex])[0]
	services[serverIndex][serviceUUID].chars.forEach( (chr,ind) => {
		console.log("characterIndex=",ind, chr);
	});
	const chars = services[serverIndex][serviceUUID].chars
	promptObj = numberPrompter("characterIndex",chars.length-1);
	//const {characterIndex} = await prompt.get(["characterIndex"]);
	const {characterIndex} = await prompt.get(promptObj);
	const charUUID = chars[characterIndex];
	const notifyUUID = services[serverIndex][serviceUUID].notify;
	return {serviceUUID: serviceUUID, characterUUID: charUUID, notifyUUID: notifyUUID}
}
function numberPrompter(fieldName, max=999) {
	return {properties: {[fieldName]: {type:"number", message: "must be a number in range 0 to " + max,
				required: true, conform: (v) => {return (Number.isInteger(v) && (v>=0) && (v<=max) )}}}}
}


