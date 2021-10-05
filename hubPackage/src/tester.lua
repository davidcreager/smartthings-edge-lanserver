
local neturl = require("net.url")
local inspect = require("inspect")
local json = require('dkjson')
local function calller(command)
	local cmd = command.command
	local subcmd = command.args
	if cmd=="on" or cmd=="off" then
		subcmd = {value=cmd}
		cmd = "power"
	end
	print (" cmd=" .. inspect(cmd) .. " subcmd=" .. inspect(subcmd))
	if cmd == "ping" then
		--commandReturn = locClient:command{cmd,{ip = driver.server.ip, port = driver.server.port}}
		print("calling ",cmd,inspect({ip = "12.12.12.12", port = 1234}))
	elseif subcmd ~= nil then
		--commandReturn = locClient:command{cmd,subcmd}
		print (" calling cmd=" .. inspect(cmd) .. " subcmd=" .. inspect(subcmd))	
	else
		print (" calling cmd=" .. inspect(cmd) .. " subcmd=" .. inspect(subcmd))
	end
end
local obj1 = {command="refresh"}
local obj2 = json.decode('{"positional_args":[],"capability":"tone","args":[],"component":"main","command":"beep"}')
local obj3 = {command="ping"}
--print("obj1=" .. inspect(obj1) .. " obj2" .. inspect(obj2))

calller(obj1)
calller(obj2)
calller(obj3)

