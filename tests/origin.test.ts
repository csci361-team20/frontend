import { test } from "node:test";
import assert from "node:assert/strict";
import { isCrossSite } from "../lib/server/origin";

const req = (method: string, headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/backend/orders", { method, headers });

test("requests from this site pass", () => {
  assert.equal(isCrossSite(req("POST", { host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" })), false);
  assert.equal(isCrossSite(req("GET", { host: "localhost:3000", origin: "https://evil.example" })), false);
  assert.equal(isCrossSite(req("POST", { host: "localhost:3000" })), false);
});

test("state-changing requests from other sites are refused", () => {
  assert.equal(isCrossSite(req("POST", { host: "localhost:3000", origin: "https://evil.example" })), true);
  assert.equal(isCrossSite(req("DELETE", { host: "localhost:3000", "sec-fetch-site": "cross-site" })), true);
  assert.equal(isCrossSite(req("PATCH", { host: "localhost:3000", origin: "null" })), true);
});
