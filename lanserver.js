const express = require("express");
const node-ssdp = require('node-ssdp').Server;
const app = express();

const querystring = require('querystring');
const URL = require('url');
const IP = require("ip")

const G_serverPort = 3300;
app.listen(G_serverPort, "0.0.0.0", () => {
  console.log("[lanSmartDeviceServer]" + " listening on port " + G_serverPort);
});

const ssdpConfig = {
	UDN: "smartLanDevices",
	schema: "urn:schemas-upnp-org:device:",
	path: "/query",
	get USN() {return(this.schema + this.UDN + ":1")}
};

const ssdpServer = new node-ssdp({allowWildcards:true,sourcePort:1900,udn: ssdpConfig.UDN, 
						location:"http://"+ IP.address() + ":" + G_serverPort + ssdpConfig.path})
lanDevicesSSDP.addUSN(ssdpConfig.USN);
lanDevicesSSDP.start();
console.log("[lanSmartDeviceServer]" + " Starting SSDP Annoucements for Bridge " + 
		" location=" +  "http://"+ IP.address() + ":" + G_serverPort + ssdpConfig.path + " usn=" + ssdpConfig.USN);

app.get("/query", (req, res) => {
	//res.json("Here I Am");
	console.log("[lanSmartDeviceServer]" + " Received Query " + JSON.stringify(req));
	let dev = lanserver;
	let devType = "lanServer"
	let resp =  '<?xml version="1.0"?>' +
				'<root xmlns="urn:schemas-upnp-org:device:' + devType + ':1">' +
				'<device>' +
				'<deviceType>urn:schemas-upnp-org:device:' + devType + ':1</deviceType>' +
				'<friendlyName>' + dev + '</friendlyName>' +
				'<uniqueName>' + dev + '</uniqueName>' +
				'<UDN>' + ssdpConfig.UDN + '</UDN>' +
				'<IP>' + IP.address() + '</IP>' +
				'<port>' + G_serverPort + '</port>' +
				'</device>' +
				'</root>'
	res.send(resp);
	console.log("[lanSmartDeviceServer]" + " Sent response " + resp);			
});
/* Thingsim respond to query device
              "HTTP/1.1 200 OK",
              "CACHE-CONTROL: 60",
              "DATE: " .. os.date("!%a, %d %b %Y %H:%M:%S GMT"),
              "EXT:", -- intentionally left blank, req for back compat, in spec
              "LOCATION: http://"..localip..":7474/", -- TODO: dynamic port
              "SERVER: UPnP/2.0 thingsim/0",
              "ST: urn:smartthings-com:device:thingsim:1",
              "USN: uuid:" .. tostring(thing.id) .. ":urn:smartthings-com:device:thingsim:1",
              "BOOTID.UPNP.ORG: "..tostring(messagecounter),
			  "NAME.SMARTTHINGS.COM: "..thing.name
			  "RPC.SMARTTHINGS.COM: rpc://" .. localip .. ":" .. thing.servers.rpc.port
*/

