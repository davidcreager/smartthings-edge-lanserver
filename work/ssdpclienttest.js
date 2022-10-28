var ssdp = require('node-ssdp').Client
  , client = new ssdp({})

client.on('notify', function () {
  //console.log('Got a notification.')
})
let STS = {};
let first = true;
client.on('response', function inResponse(headers, code, rinfo) {
//  console.log('Got a response to an m-search:\n%d\n%s\n%s', code, JSON.stringify(headers, null, '  '), JSON.stringify(rinfo, null, '  '))
	//if (!STS[headers.USN]) {
		let wk = headers.LOCATION;
		if (headers.LOCATION.indexOf("description.xml")!=-1) wk = headers.LOCATION.slice(0,(headers.LOCATION.indexOf("description.xml")));
		console.log("location =" + wk + " ST=" + headers.ST + " USN=" + headers.USN )
		//console.log("location =" + headers.LOCATION + " ST=" + headers.ST + " USN=" + headers.USN )
		STS[headers.USN] = headers.ST;
		if (first) {
			first = false;
			console.log(JSON.stringify(headers));
		} else {
			//console.log("," + JSON.stringify(headers));
		}
	//}

})
//client.search('urn:smartthings-com:device:')
//client.search('ssdp:all')
//client.search('urn:schemas-upnp-org:service:ContentDirectory:1')
//client.search("urn:smartthings-com:device:thingsim:1")
//urn:schemas-upnp-org:device:smartdev:1
//client.search("urn:schemas-upnp-org:device:smartdev:1")
client.search("urn:schemas-upnp-org:device:smartdev")
// Or maybe if you want to scour for everything after 5 seconds
setInterval(function() {
  //client.search('ssdp:all')
}, 5000)

// And after 10 seconds, you want to stop
setTimeout(function () {
   client.stop()
	}, 10000)
