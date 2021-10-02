local inspect=require("inspect")
--[[
local function parse_ssdp(data)
  local res = {}
  res.status = data:sub(0, data:find('\r\n'))
  for k, v in data:gmatch('([%w-\\.]+): ([%a+-: /=]+)') do
    res[k:lower()] = v
	print (" k=" .. k .. " v=" .. v)
	end
  --print("parse_sdp: data=" .. inspect(data))
  print("parse_sdp: res=" .. inspect(res))
  return res
end

local dd = "HTTP/1.1 200 OK\r\nST: urn:schemas-upnp-org:device:smartdev:1\r\nUSN: uuid:885bff14-3495-4495-bbac-e37c35d6ae87::urn:schemas-upnp-org:device:smartdev:1\r\nCACHE-CONTROL: max-age=1800\r\nDATE: Sat, 18 Sep 2021 21:27:25 GMT\r\nSERVER: node.js/15.14.0 UPnP/1.1 node-ssdp/4.0.1\r\nEXT: \r\nrpc.smartthings.com: rpc://192.168.1.59:13030\r\nname.smartthings.com: iPhone[iPhone 12 Pro]\r\nhttp.smartthings.com: http://192.168.1.59:13030\r\nLOCATION: http://192.168.1.59:13030/command\r\n\r\n"

local ee = parse_ssdp(dd)
---]]
local neturl = require("net.url")
local inspect = require("inspect")
local function test(url, method, path, body, query)
	local dest_url = neturl.parse(url..path)
	for k,v in pairs(query) do
		dest_url.query[k] = v
	end
	print(dest_url:build().."")
	return dest_url
end

local function calller(method, ...)
	--self.last_req_id = self.last_req_id + 1
	local params = {...}
	--print(" params=" .. inspect(params))
	--local id = self.last_req_id
	local p1 = params[1]
	local p2 = params[2]
	print("params ="..inspect(params))
	print("p1="..inspect(p1))
	print("p2="..inspect(p2))
end
print( test("http://192.168.1.52:3000","get","/command",{},{ip="192.168.1.65",port=1453}) )
calller("get","par1",{tt="tit",uu="bols"})

