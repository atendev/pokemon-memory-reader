import { expect, test } from "bun:test";
import { TYPES } from "@pokemon-memory-reader/api/schemas";
import { parseIconPath } from "../../src/icons/keys";

test("each route shape parses to its key", () => {
  expect(parseIconPath("/icons/emerald-us-1.0/pokemon/25")).toEqual({
    kind: "pokemon",
    profileId: "emerald-us-1.0",
    id: 25,
    shiny: false,
  });
  expect(parseIconPath("/icons/emerald-us-1.0/pokemon/25/shiny")).toEqual({
    kind: "pokemon",
    profileId: "emerald-us-1.0",
    id: 25,
    shiny: true,
  });
  expect(parseIconPath("/icons/p/icon/0")).toEqual({
    kind: "icon",
    profileId: "p",
    id: 0,
  });
  expect(parseIconPath("/icons/p/item/65535")).toEqual({
    kind: "item",
    profileId: "p",
    id: 65535,
  });
  expect(parseIconPath("/icons/p/type/fire")).toEqual({
    kind: "type",
    profileId: "p",
    typeName: "fire",
  });
});

test("every type enum value parses, URL-encoded or not", () => {
  for (const name of TYPES)
    expect(parseIconPath(`/icons/p/type/${encodeURIComponent(name)}`)).toEqual({
      kind: "type",
      profileId: "p",
      typeName: name,
    });
});

test("ids must be decimal integers from 0 to 65535 with no leading zeros", () => {
  for (const bad of [
    "01",
    "00",
    "-1",
    "65536",
    "1.5",
    "1e3",
    "0x10",
    "",
    "+1",
    "123456",
  ])
    expect(parseIconPath(`/icons/p/item/${bad}`)).toBeNull();
  expect(parseIconPath("/icons/p/item/١٢")).toBeNull();
});

test("a profile id outside the grammar is rejected", () => {
  for (const bad of [".", "..", "a%2Fb", "%2e%2e", "a b", "é", "a:b", "a\\b"])
    expect(parseIconPath(`/icons/${bad}/item/1`)).toBeNull();
  expect(parseIconPath("/icons//item/1")).toBeNull();
  expect(parseIconPath("/icons/a.b_c-D9/item/1")).not.toBeNull();
});

test("shiny is valid only on pokemon routes, and only spelled exactly", () => {
  for (const kind of ["icon", "item"])
    expect(parseIconPath(`/icons/p/${kind}/1/shiny`)).toBeNull();
  expect(parseIconPath("/icons/p/type/fire/shiny")).toBeNull();
  expect(parseIconPath("/icons/p/pokemon/1/Shiny")).toBeNull();
  expect(parseIconPath("/icons/p/pokemon/1/shiny/")).toBeNull();
  expect(parseIconPath("/icons/p/pokemon/1/shiny/x")).toBeNull();
});

test("unknown kinds, type names, short paths, trailing slashes and bad encodings are rejected", () => {
  expect(parseIconPath("/icons/p/sprite/1")).toBeNull();
  expect(parseIconPath("/icons/p/type/Fire")).toBeNull();
  expect(parseIconPath("/icons/p/type/%3F%3F%3F")).toBeNull();
  expect(parseIconPath("/icons/p/type/%E0%A4%A")).toBeNull();
  expect(parseIconPath("/icons/p/type/..%2Ffire")).toBeNull();
  expect(parseIconPath("/icons/p/pokemon")).toBeNull();
  expect(parseIconPath("/icons/p")).toBeNull();
  expect(parseIconPath("/icons/")).toBeNull();
  expect(parseIconPath("/icons/p/pokemon/1/")).toBeNull();
  expect(parseIconPath("/api/v2/status")).toBeNull();
});
