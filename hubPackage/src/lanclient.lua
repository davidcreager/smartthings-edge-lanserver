--lanclient.lua
local socket = require 'socket'
local utils = require('st.utils')
local json = require 'dkjson'
local neturl = require('net.url')
local http = require('socket.http')
local ltn12 = require('ltn12')
--local inspect = require("inspect")
local log = require('log')
local config = require('config')
local client = {}
function client.new(meta)
  log.info('[lanclient:client.new]\t creating client label=' .. (meta.label or "nil") ..
			' location=' .. (meta.location or "nil"))
  -- device metadata table
  local metadata = {
    type = config.DEVICE_TYPE,
    device_network_id = meta.device_network_id,
	location = meta.location,
	UDN = meta.UDN,
    label = meta.label,
    profile = config.DEVICE_PROFILE,
    manufacturer = meta.mn,
    model = meta.model,
    vendor_provided_label = string.gsub(meta.UDN,"uuid:",""),
	id = meta.id
  }
  --print ("client.new " .. inspect(metadata))
  setmetatable(metadata, {__index = client})
  return metadata
end
function client:_call(method, ...)
	local params = {...}
	print("[lanclient:client:_call]\t DEBUG 1 method=" .. method .. " params=",utils.stringify_table(params))
	local url = self.location .. "/" .. method
	--local query = params[1]["args"]
	local ret,jsonresp = client:send_lan_command(url, params)
	if not ret then
		log.info("[lanclient:client:_call]\t Lan Command Failed", jsonresp)
		return nil
	end
	return jsonresp or true
end
function client:command(command)
	--print("[lanclient:client:command]\t DEBUG 2 device=",utils.stringify_table(device))
	print("[lanclient:client:command]\t DEBUG 2 command[1]=" .. utils.stringify_table(command[1]) .. " command[2]=" .. utils.stringify_table(command[2]))
	--return self:_call("command", device)
	return self:_call(command[1], command[2])
end
-- Send LAN HTTP Request
function client:send_lan_command(url, query)
	print("[lanclient:client:send_lan_command]\t url=" .. url .. " query=" .. utils.stringify_table(query))
	local dest_url = neturl.parse(url)
	local res_body = {}
	if query then
		for k,v in pairs(query) do
			dest_url.query[k] = v
		end
	end
	local _,code,_ = http.request{
					url = dest_url:build(),
					sink = ltn12.sink.table(res_body)
					}
	if code == 200 then
		print("[lanclient:client:send_lan_command]\t Received Response", table.concat(res_body), " for ",dest_url)
		return true, table.concat(res_body)
	end
	log.error('[lanclient:client:send_lan_command]\t http failed code=' .. (code or "nil"))
	return false, table.concat(res_body)
end
return client