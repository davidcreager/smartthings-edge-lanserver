local neturl = require('net.url')
local inspect = require("inspect")
local json = require('dkjson')

local jcmd1 = '{"capability":"switchLevel","component":"main","positional_args":[100],"command":"setLevel","args":{"level":100}}'
local jcmd2 = '{"capability":"colorControl","component":"main","positional_args":[{"hue":96.111111111111,"saturation":34.0}],"command":"setColor","args":{"color":{"hue":96.111111111111,"saturation":34.0}}}'
local jcmd3 = '{"command":"refresh"}'
local jcmd4 = '{"args":{}, "capability":"tone", "command":"beep", "component":"main", "positional_args":{}}'
local jcmd5 = '{"args":{}, "capability":"switch", "command":"off", "component":"main", "positional_args":{}}'
local cmd1 = json.decode(jcmd1)
local cmd2 = json.decode(jcmd2)
local cmd3 = json.decode(jcmd3)
local cmd4 = json.decode(jcmd4)
local cmd5 = json.decode(jcmd5)
--print(" cmd1=" .. inspect(cmd1) .. " cmd2=" .. inspect(cmd2) .. " cmd3=" .. inspect(cmd3) .. " cmd4=" .. inspect(cmd4) .. " cmd5=" .. inspect(cmd5))

function lanCommand(url, method, path, body, query)
	--print("Entering lan command with url=" .. inspect(url) .. " method=" .. inspect(method)  .. " query=" .. inspect(query) .. " body=" .. inspect(body))
	
	local dest_url = neturl.parse(url..path)
	if query then
		for k,v in pairs(query) do
			--print(k,v)
			dest_url.query[k] = v
		en
	end
	local bod = neturl.buildQuery(body or {})
	bod = neturl.buildQuery(query)
	local res_body = {}
	print("http " .. inspect(dest_url:build()))
end
function caller(method, ...)
	local params = {...}
	local url = "http://192.168.1.59:13032/uuid:a4d47846::urn:upnp-org:device:smartdev:1" .. "/"  .. method
	--local path = "/" .. (params[1]["command"] or "n/a")
	local query = params[1]["args"]
	--print ("lan cmd method = " .. method)
	print("Lan cmd " .. url .. " query=", query)
	lanCommand(url, "get", "", {}, query)

end
--caller(cmd1.command,cmd1)
caller(cmd2.command,cmd2)
--caller(cmd3.command,cmd3)
--caller(cmd4.command,cmd4)
--caller(cmd5.command,cmd5)
