-- Line-driven test harness: runs the protocol core with the fake shim. A Bun test relays real TCP
-- connections to it. Every command prints its output lines, then `done`. Bytes travel as hex.
--
--   step | time N | open ID | data ID HEX | peerclose ID
--   load PLATFORM CRC32|- SHA1|- ROMNAME|- DOMAIN=SIZE... | unload
--   failread [long] | failreceive | bindfail N | sendlimit N | emuversion TEXT|-
--   constants | version | quit
--
-- Output lines: `send ID HEX`, `close ID`, `log TEXT`, `constants JSON`, `version TEXT`, `done`.

local dir = (arg and arg[0] or ""):match("^(.*)/[^/]*$") or "."
local core = dofile(dir .. "/../src/core.lua")
local fake = dofile(dir .. "/fake_shim.lua")

local ok, why = core.check_runtime()
if not ok then
  io.stdout:write("fatal ", why, "\n")
  os.exit(1)
end

local shim = fake.new()
local bridge = core.new(shim)

local function from_hex(hex)
  return (hex:gsub("%x%x", function(h) return string.char(tonumber(h, 16)) end))
end

local function to_hex(s)
  return (s:gsub(".", function(c) return string.format("%02x", c:byte()) end))
end

local function drain()
  for _, item in ipairs(shim.outbox) do
    if item.close then
      io.stdout:write("close ", item.id, "\n")
    else
      io.stdout:write("send ", item.id, " ", to_hex(item.data), "\n")
    end
  end
  shim.outbox = {}
  for _, text in ipairs(shim.logs) do
    io.stdout:write("log ", (text:gsub("\n", " ")), "\n")
  end
  shim.logs = {}
end

local function dash(v)
  if v == "-" then return nil end
  return v
end

local commands = {}

function commands.step() bridge:step() end
function commands.time(n) shim.time = tonumber(n) end
function commands.open(id) shim.open(tonumber(id)) end
function commands.data(id, hex)
  local conn = shim.conns[tonumber(id)]
  if conn then conn.inbox = conn.inbox .. from_hex(hex) end
end
function commands.peerclose(id)
  local conn = shim.conns[tonumber(id)]
  if conn then conn.peer_closed = true end
end
function commands.load(platform, crc32, sha1, rom_name, ...)
  local sizes = {}
  for _, pair in ipairs({ ... }) do
    local name, size = pair:match("^(%a+)=(%d+)$")
    sizes[name] = tonumber(size)
  end
  shim.load(platform, dash(crc32), dash(sha1), dash(rom_name), sizes)
end
function commands.unload() shim.unload() end
function commands.failread(mode)
  shim.fail_read = mode == "long" and string.rep("boom ", 2000) or "boom"
end
function commands.failreceive() shim.fail_receive = true end
function commands.bindfail(n) shim.bind_failures = tonumber(n) end
function commands.sendlimit(n) shim.send_limit = tonumber(n) end
function commands.emuversion(v) shim.emulator_version = dash(v) end
function commands.constants()
  io.stdout:write("constants ", core.json_encode({
    protocol = core.PROTOCOL,
    frameKind = core.FRAME_KIND,
    maxBody = core.MAX_BODY,
    caps = core.CAPS,
    domainCodes = core.DOMAIN_CODES,
    errorCodes = core.ERROR_CODES,
  }), "\n")
end
function commands.version() io.stdout:write("version ", _VERSION, "\n") end

for line in io.stdin:lines() do
  local words = {}
  for word in line:gmatch("%S+") do words[#words + 1] = word end
  local name = table.remove(words, 1)
  if name == "quit" then break end
  local fn = commands[name]
  if fn then
    local ran, err = pcall(fn, table.unpack(words))
    if not ran then io.stdout:write("fatal ", tostring(err), "\n") end
  else
    io.stdout:write("fatal unknown command ", tostring(name), "\n")
  end
  drain()
  io.stdout:write("done\n")
  io.stdout:flush()
end
