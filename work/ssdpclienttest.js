var ssdp = require('node-ssdp').Client
  , client = new ssdp({})

client.on('notify', function () {
  //console.log('Got a notification.')
})
let STS = {};
client.on('response', function inResponse(headers, code, rinfo) {
//  console.log('Got a response to an m-search:\n%d\n%s\n%s', code, JSON.stringify(headers, null, '  '), JSON.stringify(rinfo, null, '  '))
	if (!STS[headers.LOCATION]) {
		console.log("location =" + headers.LOCATION + " ST=" + headers.ST + " USN=" + headers.USN )
		STS[headers.LOCATION] = headers.ST;
		console.log(JSON.stringify(headers));
	}

})

//client.search('urn:schemas-upnp-org:service:ContentDirectory:1')
client.search("urn:smartthings-com:device:thingsim:1")
// Or maybe if you want to scour for everything after 5 seconds
setInterval(function() {
  //client.search('ssdp:all')
}, 5000)

// And after 10 seconds, you want to stop
setTimeout(function () {
   client.stop()
	}, 10000)
