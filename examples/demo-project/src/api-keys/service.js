"use strict";

/**
 * api-keys service (example stub) — implements .specs/api-keys.
 * Referenced by tasks via `_Implements: src/api-keys/service.js_` so `dev-spec trace` can
 * tie the spec to real code. This is an illustrative skeleton, not a working implementation.
 */

const crypto = require("crypto");

function hashKey(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// US-1.AC-1 — create a key, return token once, store only the hash + prefix.
function createKey(/* tenantId, name */) {
  throw new Error("NotImplemented: createKey");
}

// US-1.AC-2 / AC-3 / AC-4 — verify a key, fail closed, scope to tenant.
function verifyKey(/* token */) {
  throw new Error("NotImplemented: verifyKey");
}

// US-2.AC-1 — rotate, keep old valid for the grace window.
function rotateKey(/* id */) {
  throw new Error("NotImplemented: rotateKey");
}

module.exports = { hashKey, createKey, verifyKey, rotateKey };
