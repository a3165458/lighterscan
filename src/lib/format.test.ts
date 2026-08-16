import assert from "node:assert/strict";
import test from "node:test";
import { publicAddressLabel, tokenIconCandidates } from "./format.ts";

test("publicAddressLabel preserves the official leaderboard prefix", () => {
  assert.equal(
    publicAddressLabel("0x9C**************************************"),
    "0x9C…",
  );
  assert.equal(
    publicAddressLabel("0x1234567890abcdef1234567890abcdef12345678"),
    "0x1234567890abcdef1234567890abcdef12345678",
  );
  assert.equal(publicAddressLabel(""), "—");
});

test("tokenIconCandidates prefers lowercase png before svg for all assets", () => {
  assert.deepEqual(tokenIconCandidates("ANSEM"), [
    "https://assets.lighter.xyz/fe/token/ansem.png",
    "https://assets.lighter.xyz/fe/token/ansem.svg",
  ]);
  assert.deepEqual(tokenIconCandidates("PLTR-PERP"), [
    "https://assets.lighter.xyz/fe/token/pltr.png",
    "https://assets.lighter.xyz/fe/token/pltr.svg",
  ]);
  assert.deepEqual(tokenIconCandidates("INTC/USDC"), [
    "https://assets.lighter.xyz/fe/token/intc.png",
    "https://assets.lighter.xyz/fe/token/intc.svg",
  ]);
});
