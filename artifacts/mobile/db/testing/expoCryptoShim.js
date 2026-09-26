// Test-only: expo-crypto for the Node child of the kill test.
const crypto = require("node:crypto");
module.exports = {
  randomUUID: () => crypto.randomUUID(),
  getRandomBytes: (n) => new Uint8Array(crypto.randomBytes(n)),
};
