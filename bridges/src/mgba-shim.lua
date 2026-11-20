-- mGBA shim for the protocol core (spec 4.1, 4.9). The build step joins core.lua and this file
-- into one mgba.lua and fills the three @...@ settings below.
--
-- Checked live in mGBA 0.10.5 (Lua 5.4) on Emerald US 1.0 in the First live run on mGBA ticket:
-- batched reads, the CRC32 checksum, hello and game messages, and polling while paused all work.
-- CI runs this file against a stub of the mGBA scripting API (bridges/test/mgba_stub.lua).
-- mGBA 0.10.x has no scripting call that returns its version (the docs and `scripting.c` list
-- none), so emulator.version stays null.
--
-- `core` is the protocol core, provided by the build step as a local before this code.

local HOST = "@HOST@"
local PORT = @PORT@
local BUILD = "@BUILD@"

local ok, why = core.check_runtime()
if not ok then
  console:error("PMR bridge stopped: " .. why)
  return
end

local shim = {}

shim.bind_hint = "port " .. PORT .. ", adapters.mgba.port"

function shim.info()
  return { bridge = "mgba", build = BUILD, emulator = { name = "mGBA", version = nil } }
end

function shim.log(text)
  console:log("PMR bridge: " .. text)
end

function shim.clock()
  return os.time()
end

-- Domain names to mGBA's emu.memory fields, per platform. The GBA's `wram` is EWRAM.
local DOMAIN_FIELDS = {
  gba = { rom = "cart0", ewram = "wram", iwram = "iwram" },
  gb = { rom = "cart0", wram = "wram", hram = "hram", sram = "sram" },
}

local game_table = nil
local game_platform = nil

local function checksum_text()
  local good, value = pcall(function() return emu:checksum(C.CHECKSUM.CRC32) end)
  if not good or value == nil then return nil end
  if math.type(value) == "integer" then return string.format("%08x", value) end
  if type(value) == "string" then
    if #value == 8 and value:match("^%x+$") then return value:lower() end
    if #value == 4 then
      return (value:gsub(".", function(c) return string.format("%02x", c:byte()) end))
    end
  end
  return nil
end

local function describe_game()
  if emu == nil then return nil end
  local platform = emu:platform()
  local kind = "other"
  if platform == C.PLATFORM.GBA then kind = "gba" elseif platform == C.PLATFORM.GB then kind = "gb" end
  local fields = DOMAIN_FIELDS[kind]
  local domains = {}
  if fields then
    for name, field in pairs(fields) do
      local domain = emu.memory[field]
      if domain then domains[name] = domain:size() end
    end
  end
  local title = emu:getGameTitle()
  game_platform = kind
  return {
    platform = kind,
    romName = (title ~= nil and title ~= "") and title or nil,
    crc32 = checksum_text(),
    sha1 = nil,
    domains = domains,
  }
end

-- The core compares shim.game() by reference first, so the table is built once per ROM load
-- and rebuilt on start, reset and shutdown.
local function reset_game() game_table = nil; game_platform = nil end

function shim.game()
  if game_table == nil then game_table = describe_game() end
  return game_table
end

function shim.read(domain, offset, length)
  local fields = DOMAIN_FIELDS[game_platform]
  local mem = fields and emu.memory[fields[domain]]
  if mem == nil then error("no memory domain " .. tostring(domain), 0) end
  return mem:readRange(offset, length)
end

-- mGBA's socket API is non-blocking and polled once per frame (spec 4.1).
local function wrap_connection(c)
  local conn = {}
  function conn:receive()
    local data, err = c:receive(4096)
    if data ~= nil then return data end
    if err == socket.ERRORS.AGAIN then return "" end
    return nil, "closed"
  end
  function conn:send(data)
    local n, err = c:send(data)
    if n ~= nil then return n end
    if err == socket.ERRORS.AGAIN then return 0 end
    return nil, "closed"
  end
  function conn:close() c:close() end
  return conn
end

function shim.bind()
  local server, err = socket.bind(HOST, PORT)
  if server == nil then
    if err == socket.ERRORS.ADDRESS_IN_USE then return nil, "address in use" end
    return nil, tostring(err)
  end
  local listening, listen_err = server:listen()
  if listening == nil and listen_err ~= nil then
    server:close()
    return nil, tostring(listen_err)
  end
  local wrapped = {}
  function wrapped:accept()
    local c = server:accept()
    if c == nil then return nil end
    return wrap_connection(c)
  end
  return wrapped
end

local bridge = core.new(shim)

callbacks:add("frame", function() bridge:step() end)
callbacks:add("start", reset_game)
callbacks:add("reset", reset_game)
callbacks:add("shutdown", reset_game)

-- Bind now, so a script loaded between frames is already listening.
bridge:step()
