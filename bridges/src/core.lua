-- Bridge protocol core (spec 4.2 to 4.10). Targets Lua 5.3 and 5.4. It uses no `require`,
-- no string arithmetic and nothing from Lua 5.5. A build step joins it with one emulator shim.
--
-- The shim passed to core.new(shim) provides:
--   shim.info()          -> { bridge = "mgba"|"bizhawk", build = string, emulator = { name = string, version = string|nil } }
--   shim.game()          -> nil with no ROM, else { platform = "gb"|"gba"|"other", romName, crc32, sha1, domains = { [name] = size } }.
--                           Must return the same table until the game changes: the core compares by reference first.
--   shim.read(domain, offset, length) -> string of exactly `length` bytes
--   shim.bind_hint       -> optional text naming the port and the setting that controls it, for the bind log
--   shim.bind()          -> server, or nil and an error text
--   shim.clock()         -> seconds, any epoch
--   shim.log(text)
-- A server has :accept() -> connection or nil. A connection has :receive() -> string (empty when
-- nothing arrived) or nil, "closed"; :send(string) -> bytes sent (0 when it would block) or nil,
-- "closed"; and :close().

local core = {}

core.PROTOCOL = 1

core.FRAME_KIND = { HELLO = 1, GAME = 2, READ = 3, DATA = 4, ERROR = 5 }
local KIND_NAMES = { "HELLO", "GAME", "READ", "DATA", "ERROR" }

core.MAX_BODY = { HELLO = 4096, GAME = 4096, READ = 4610, DATA = 65536, ERROR = 4096 }
core.CAPS = { maxRanges = 512, maxBytes = 65536 }
core.DOMAIN_CODES = { rom = 1, ewram = 2, iwram = 3, wram = 4, hram = 5, sram = 6 }
core.ERROR_CODES = { "bad_frame", "busy", "no_game", "bad_range", "too_large", "unknown_kind", "internal" }
core.BIND_RETRY_SECONDS = 2

local HEADER = 5 -- kind (1) and id (4) count toward `length`
local RANGE_SIZE = 9
local RECEIVES_PER_STEP = 16 -- receive calls per step, so one chatty peer can't hold the callback

local DOMAIN_NAMES = {}
for name, code in pairs(core.DOMAIN_CODES) do
  DOMAIN_NAMES[code] = name
end

local ERROR_CODE_SET = {}
for _, code in ipairs(core.ERROR_CODES) do
  ERROR_CODE_SET[code] = true
end

function core.check_runtime()
  if type(string.pack) ~= "function" or type(utf8) ~= "table" then
    return false, "this bridge needs Lua 5.3 or later (string.pack and utf8 are missing)"
  end
  return true
end

-- JSON encoder: strings, booleans, integers, finite floats, `core.null`, arrays and string-keyed
-- objects with sorted keys. It has no decoder, because the bridge never reads JSON.

core.null = setmetatable({}, { __tostring = function() return "null" end })

local json_escapes = {
  ['"'] = '\\"', ["\\"] = "\\\\", ["\b"] = "\\b", ["\f"] = "\\f",
  ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t",
}

local function json_string(s)
  if not utf8.len(s) then
    -- Not UTF-8 (a ROM name in some emulator encoding). Read each high byte as Latin-1 so the JSON stays valid.
    s = (s:gsub("[\128-\255]", function(c) return utf8.char(c:byte()) end))
  end
  return '"' .. s:gsub('[%c"\\]', function(c)
    return json_escapes[c] or string.format("\\u%04x", c:byte())
  end) .. '"'
end

local function json_value(v, out)
  local t = type(v)
  if v == core.null then
    out[#out + 1] = "null"
  elseif t == "string" then
    out[#out + 1] = json_string(v)
  elseif t == "boolean" then
    out[#out + 1] = v and "true" or "false"
  elseif t == "number" then
    if math.type(v) == "integer" then
      out[#out + 1] = string.format("%d", v)
    elseif v ~= v or v == math.huge or v == -math.huge then
      error("cannot encode a non-finite number")
    elseif v == math.floor(v) and math.abs(v) < 2 ^ 53 then
      out[#out + 1] = string.format("%d", math.floor(v))
    else
      out[#out + 1] = string.format("%.17g", v)
    end
  elseif t == "table" then
    if v[1] ~= nil then
      out[#out + 1] = "["
      for i = 1, #v do
        if i > 1 then out[#out + 1] = "," end
        json_value(v[i], out)
      end
      out[#out + 1] = "]"
    else
      local keys = {}
      for k in pairs(v) do
        if type(k) ~= "string" then error("object keys must be strings") end
        keys[#keys + 1] = k
      end
      table.sort(keys)
      out[#out + 1] = "{"
      for i, k in ipairs(keys) do
        if i > 1 then out[#out + 1] = "," end
        out[#out + 1] = json_string(k)
        out[#out + 1] = ":"
        json_value(v[k], out)
      end
      out[#out + 1] = "}"
    end
  else
    error("cannot encode a " .. t)
  end
end

function core.json_encode(v)
  local out = {}
  json_value(v, out)
  return table.concat(out)
end

-- Frames: u32 length | u8 kind | u32 id | body, big-endian. `length` counts every byte after itself.

function core.encode_frame(kind, id, body)
  return string.pack(">I4I1I4", #body + HEADER, kind, id) .. body
end

-- Returns frame, consumed on success, nil when more bytes are needed, or nil, nil, reason for a bad frame.
local function take_frame(buf)
  if #buf < 4 then return nil end
  local length = string.unpack(">I4", buf)
  if length < HEADER then return nil, nil, "length " .. length .. " is below the " .. HEADER .. " header bytes" end
  if #buf < 5 then return nil end
  local kind = buf:byte(5)
  local name = KIND_NAMES[kind]
  if not name then return nil, nil, "unknown frame kind " .. kind end
  if length > core.MAX_BODY[name] + HEADER then
    return nil, nil, name .. " frame length " .. length .. " exceeds its " .. core.MAX_BODY[name] .. " byte body limit"
  end
  if #buf < 4 + length then return nil end
  local id = string.unpack(">I4", buf, 6)
  return { kind = kind, id = id, body = buf:sub(10, 4 + length) }, 4 + length
end

core.take_frame = take_frame

local function error_body(code, message)
  assert(ERROR_CODE_SET[code], "unknown error code " .. tostring(code))
  message = tostring(message)
  if #message > 1000 then message = message:sub(1, 1000) end
  while true do
    local body = core.json_encode({ code = code, message = message })
    if #body <= core.MAX_BODY.ERROR or #message == 0 then return body end
    message = message:sub(1, #message // 2)
  end
end

local function game_body(game)
  if game == nil then return "null" end
  local function nullable(v)
    if v == nil then return core.null end
    return v
  end
  local domains = {}
  for name, size in pairs(game.domains or {}) do
    if core.DOMAIN_CODES[name] then domains[name] = size end
  end
  return core.json_encode({
    platform = game.platform,
    romName = nullable(game.romName),
    crc32 = nullable(game.crc32),
    sha1 = nullable(game.sha1),
    domains = domains,
  })
end

local Bridge = {}
Bridge.__index = Bridge

function core.new(shim)
  return setmetatable({
    shim = shim,
    server = nil,
    next_bind = 0,
    client = nil,
    extras = {}, -- refused connections that are flushing their last frames
    game = nil,
    game_ref = false, -- last table seen from shim.game(), compared by reference first
    game_key = nil, -- its encoded body, to catch a changed table
  }, Bridge)
end

local function new_client(conn)
  return { conn = conn, rbuf = "", sbuf = "", closing = false, served = false }
end

local function queue_frame(client, kind, id, body)
  client.sbuf = client.sbuf .. core.encode_frame(kind, id, body)
end

local function queue_error(client, id, code, message)
  queue_frame(client, core.FRAME_KIND.ERROR, id, error_body(code, message))
end

function Bridge:hello_body()
  local info = self.shim.info()
  local emulator = info.emulator or {}
  return core.json_encode({
    bridge = info.bridge,
    protocol = core.PROTOCOL,
    build = info.build,
    emulator = {
      name = emulator.name or "unknown",
      version = emulator.version == nil and core.null or emulator.version,
    },
  })
end

function Bridge:refresh_game()
  local game = self.shim.game()
  if game == self.game_ref then return false end
  self.game_ref = game
  self.game = game
  local key = game_body(game)
  if key == self.game_key then return false end
  self.game_key = key
  return true
end

function Bridge:drop_client()
  local client = self.client
  self.client = nil
  if not client then return end
  if client.served then self.shim.log("serving session ended") end
  pcall(client.conn.close, client.conn)
end

-- Returns the DATA body, or nil, code, message.
function Bridge:handle_read(body)
  if #body < 2 then return nil, "bad_frame", "READ body is shorter than its range count" end
  local count = string.unpack(">I2", body)
  if #body ~= 2 + RANGE_SIZE * count then
    return nil, "bad_frame", "READ body holds " .. #body .. " bytes but " .. count .. " ranges need " .. (2 + RANGE_SIZE * count)
  end
  local ranges = {}
  local total = 0
  for i = 1, count do
    local code, offset, length = string.unpack(">I1I4I4", body, 3 + (i - 1) * RANGE_SIZE)
    ranges[i] = { code = code, offset = offset, length = length }
    total = total + length
  end
  local game = self.game
  if game == nil then return nil, "no_game", "no ROM is loaded" end
  if total > core.CAPS.maxBytes then
    return nil, "too_large", "request asks for " .. total .. " bytes, the cap is " .. core.CAPS.maxBytes
  end
  for i, range in ipairs(ranges) do
    local name = DOMAIN_NAMES[range.code]
    local size = name and game.domains and game.domains[name]
    if not size then
      return nil, "bad_range", "range " .. i .. " names domain " .. range.code .. ", which this ROM doesn't have"
    end
    if range.offset + range.length > size then
      return nil, "bad_range", "range " .. i .. " ends at " .. (range.offset + range.length) .. ", past the " .. size .. " bytes of " .. name
    end
    range.name = name
  end
  local parts = {}
  for i, range in ipairs(ranges) do
    local bytes = self.shim.read(range.name, range.offset, range.length)
    if type(bytes) ~= "string" or #bytes ~= range.length then
      error("shim read of " .. range.name .. " returned the wrong length")
    end
    parts[i] = bytes
  end
  return table.concat(parts)
end

function Bridge:dispatch(client, frame)
  if frame.kind ~= core.FRAME_KIND.READ then
    queue_error(client, frame.id, "unknown_kind", KIND_NAMES[frame.kind] .. " is not a kind a bridge accepts")
    return
  end
  if not client.served then
    client.served = true
    self.shim.log("serving session started")
  end
  local ok, data, code, message = pcall(self.handle_read, self, frame.body)
  if not ok then
    queue_error(client, frame.id, "internal", data)
  elseif data == nil and code == "bad_frame" then
    -- A body that can't be parsed is a bad frame: error with id 0, then close (spec 4.5, 4.6).
    queue_error(client, 0, "bad_frame", message)
    client.closing = true
  elseif data == nil then
    queue_error(client, frame.id, code, message)
  else
    queue_frame(client, core.FRAME_KIND.DATA, frame.id, data)
  end
end

local function flush(client)
  while #client.sbuf > 0 do
    local sent, err = client.conn:send(client.sbuf)
    if sent == nil then return false, err end
    if sent == 0 then break end
    client.sbuf = client.sbuf:sub(sent + 1)
  end
  return true
end

function Bridge:ensure_server()
  if self.server then return true end
  local now = self.shim.clock()
  if now < self.next_bind then return false end
  local server, err = self.shim.bind()
  if not server then
    local hint = self.shim.bind_hint and (" (" .. self.shim.bind_hint .. ")") or ""
    self.shim.log("bind failed: " .. tostring(err) .. hint .. ". Retrying in " .. core.BIND_RETRY_SECONDS .. " seconds")
    self.next_bind = now + core.BIND_RETRY_SECONDS
    return false
  end
  self.server = server
  self.shim.log("listening")
  return true
end

function Bridge:accept_all()
  for _ = 1, 8 do
    local conn = self.server:accept()
    if not conn then return end
    local client = new_client(conn)
    queue_frame(client, core.FRAME_KIND.HELLO, 0, self:hello_body())
    if self.client then
      queue_error(client, 0, "busy", "another program already holds this bridge")
      client.closing = true
      self.extras[#self.extras + 1] = client
    else
      self.client = client
      self:refresh_game()
      queue_frame(client, core.FRAME_KIND.GAME, 0, self.game_key)
    end
  end
end

function Bridge:flush_extras()
  local keep = {}
  for _, client in ipairs(self.extras) do
    local ok = flush(client)
    if ok and #client.sbuf > 0 then
      keep[#keep + 1] = client
    else
      pcall(client.conn.close, client.conn)
    end
  end
  self.extras = keep
end

function Bridge:serve_client()
  local client = self.client
  if self:refresh_game() then
    queue_frame(client, core.FRAME_KIND.GAME, 0, self.game_key)
  end
  if not client.closing then
    for _ = 1, RECEIVES_PER_STEP do
      local data, err = client.conn:receive()
      if data == nil then
        if err == "closed" then
          self:drop_client()
          return
        end
        break
      end
      if #data == 0 then break end
      client.rbuf = client.rbuf .. data
    end
  end
  while not client.closing do
    local frame, consumed, reason = take_frame(client.rbuf)
    if reason then
      queue_error(client, 0, "bad_frame", reason)
      client.closing = true
      client.rbuf = ""
    elseif frame then
      client.rbuf = client.rbuf:sub(consumed + 1)
      self:dispatch(client, frame)
    else
      break
    end
  end
  local ok = flush(client)
  if not ok then
    self:drop_client()
  elseif client.closing and #client.sbuf == 0 then
    self:drop_client()
  end
end

-- One script callback's worth of work. Call it from the emulator's frame callback or yield loop.
function Bridge:step()
  local ok, err = pcall(function()
    if not self:ensure_server() then return end
    self:accept_all()
    self:flush_extras()
    if self.client then self:serve_client() end
  end)
  if not ok then
    -- An error outside a request handler closes the client, so the adapter sees a close and reconnects (spec 4.6).
    pcall(self.shim.log, "bridge error: " .. tostring(err))
    self:drop_client()
  end
end

return core
