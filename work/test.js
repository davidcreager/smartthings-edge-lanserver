const fs = require("fs")
const uuidFileName = "./uuid.json"
let uuidStore = {}
try {
	uuidStore = JSON.parse( fs.readFileSync(uuidFileName) )
} catch(err) {
	if (err.code=="ENOENT") {
		try {
			fs.writeFileSync(uuidFileName, JSON.stringify( uuidStore ))
			console.log("Initialised uuidStore " + uuidFileName);
		} catch (e) {
			console.log("baseserver:Initialising uuidStore error code=" + e.code + " error is " +  e);
		}
	} else {
		console.log("baseserver:loading uuidStore error code=" + err.code + " error is " +  err)
	}
}
/*
uuidStore["testing"] = "bollocks"
uuidStore["nextUuid"] = "tits"
try {
	fs.writeFileSync(uuidFileName, JSON.stringify( uuidStore ))
} catch (e) {
	console.log("baseserver:Writing uuidStore error code=" + e.code + " error is " +  e);
}
*/
console.log(JSON.stringify(uuidStore))