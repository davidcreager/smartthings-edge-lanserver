--lanclient.lua
local socket = require 'socket'
local json = require 'dkjson'
local neturl = require('net.url')
local http = require('socket.http')
local ltn12 = require('ltn12')
--local inspect = require("inspect")
local log = require('log')
local config = require('config')
local client = {}
function client:_call(method, ...)
	local params = {...}
	local url = self.location
	local path = "/" .. params[1][1]
	local query = params[1][2]
	print("About to try sending LAN command url=" .. url .. " path=" .. path.." query=",query)
	local ret,jsonresp = client:send_lan_command(url, "get", path, {}, query)
	if not ret then
		log.info("lanclient:client:_call Lan Command Failed",jsonresp)
		return nil
	end
	return jsonresp or true
end

function client.new(meta)
  log.info('lanclient:client.new: creating client label=' .. (meta.label or "nil") ..
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
function client:command(device)
	return self:_call("command", device)
end
-- Send LAN HTTP Request
function client:send_lan_command(url, method, path, body,query)
	local dest_url = neturl.parse(url..path)
	if query then
		for k,v in pairs(query) do
			dest_url.query[k] = v
		end
	end
	local bod = neturl.buildQuery(body or {})
	local res_body = {}
	local _,code,_ = http.request{
					url = dest_url:build(),
					sink = ltn12.sink.table(res_body)
					}
	if code == 200 then
		print("client:send_lan_command Received Response",table.concat(res_body), " for ",dest_url)
		return true, table.concat(res_body)
	end
	--print("http failed " .. code .. " " .. table.concat(res_body))
	log.error('lanclient:client:send_lan_command: http failed code=' .. (code or "nil"))
	return false, table.concat(res_body)
end
return client