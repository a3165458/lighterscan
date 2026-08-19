import assert from "node:assert/strict";
import test from "node:test";
import { formatFundingPct, publicAddressLabel, tokenIconCandidates } from "./format.ts";

test("formatFundingPct shows the native RH rate as a signed percent", () => {
  assert.equal(formatFundingPct(0.000096), "+0.0096%");
  assert.equal(formatFundingPct(-0.000008), "-0.0008%");
  assert.equal(formatFundingPct(0), "0.0000%");
});

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
