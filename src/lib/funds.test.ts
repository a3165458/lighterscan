import assert from "node:assert/strict";
import test from "node:test";
import { extractFundPub, mapExplorerFundLog } from "./funds-map.ts";

const depositV2 = {
  tx_type: "L1Deposit",
  hash: "dep-v2",
  time: "2026-08-13T19:14:26.405Z",
  pubdata_type: "L1DepositV2",
  status: "executed",
  pubdata: {
    l1_deposit_pubdata_v2: {
      account_index: "1913",
      l1_address: "0x655b2c89862E4382e07Bf99d0bdA61aD92e65385",
      asset_index: "USDG",
      route_type: "PERPS",
      accepted_amount: "50.000000",
    },
  },
};

const transferV2 = {
  tx_type: "L2Transfer",
  hash: "xfer-v2",
  time: "2026-08-16T06:55:17.113Z",
  pubdata_type: "L2TransferV2",
  status: "nothing_to_execute",
  pubdata: {
    l2_transfer_pubdata_v2: {
      from_account_index: "1869",
      to_account_index: "1913",
      fee_account_index: "0",
      asset_index: "USDG",
      from_route_type: "SPOT",
      to_route_type: "SPOT",
      amount: "499.700000",
      usdc_fee: "0.000000",
    },
  },
};

const withdrawV2 = {
  tx_type: "L2Withdraw",
  hash: "wd-v2",
  time: "2026-07-01T20:13:44.124Z",
  pubdata_type: "WithdrawV2",
  status: "executed",
  pubdata: {
    withdraw_pubdata_v2: {
      from_account_index: "3",
      asset_index: "rhSPCX",
      route_type: "SPOT",
      amount: "0.050000",
    },
  },
};

const depositV1 = {
  hash: "dep-v1",
  time: "2026-01-02T00:00:00.000Z",
  pubdata_type: "L1Deposit",
  status: "executed",
  pubdata: {
    l1_deposit_pubdata: {
      account_index: "10",
      l1_address: "0xabc",
      usdc_amount: "12.5",
    },
  },
};

const withdrawV1 = {
  hash: "wd-v1",
  time: "2026-01-03T00:00:00.000Z",
  pubdata_type: "Withdraw",
  status: "committed",
  pubdata: {
    withdraw_pubdata: {
      from_account_index: "10",
      usdc_amount: "3",
    },
  },
};

const transferV1 = {
  hash: "xfer-v1",
  time: "2026-01-04T00:00:00.000Z",
  pubdata_type: "L2Transfer",
  status: "executed",
  pubdata: {
    l2_transfer_pubdata: {
      from_account_index: "10",
      to_account_index: "20",
      usdc_amount: "8.25",
    },
  },
};

test("L1DepositV2 maps to an inbound deposit with amount, asset, and time", () => {
  const row = mapExplorerFundLog(depositV2, [1913]);
  assert.ok(row);
  assert.equal(row.direction, "deposit");
  assert.equal(row.amount, 50);
  assert.equal(row.asset, "USDG");
  assert.equal(row.status, "executed");
  assert.equal(row.counterpartyKind, "address");
  assert.equal(row.timestamp, Date.parse("2026-08-13T19:14:26.405Z"));
  assert.equal(extractFundPub(depositV2)?.kind, "L1DepositV2");
});

test("L2TransferV2 is inbound for the receiver and outbound for the sender", () => {
  const inbound = mapExplorerFundLog(transferV2, ["1913"]);
  assert.ok(inbound);
  assert.equal(inbound.direction, "transfer_in");
  assert.equal(inbound.amount, 499.7);
  assert.equal(inbound.counterparty, "1869");
  assert.equal(inbound.counterpartyKind, "account");

  const outbound = mapExplorerFundLog(transferV2, [1869]);
  assert.ok(outbound);
  assert.equal(outbound.direction, "transfer_out");
  assert.equal(outbound.counterparty, "1913");
});

test("WithdrawV2 maps to an outbound withdrawal", () => {
  const row = mapExplorerFundLog(withdrawV2, [3]);
  assert.ok(row);
  assert.equal(row.direction, "withdraw");
  assert.equal(row.amount, 0.05);
  assert.equal(row.asset, "rhSPCX");
  assert.equal(row.route, "SPOT");
});

test("v1 deposit/withdraw/transfer use usdc_amount and default USDG", () => {
  const deposit = mapExplorerFundLog(depositV1, [10]);
  assert.ok(deposit);
  assert.equal(deposit.direction, "deposit");
  assert.equal(deposit.amount, 12.5);
  assert.equal(deposit.asset, "USDG");

  const withdraw = mapExplorerFundLog(withdrawV1, [10]);
  assert.ok(withdraw);
  assert.equal(withdraw.direction, "withdraw");
  assert.equal(withdraw.amount, 3);

  const out = mapExplorerFundLog(transferV1, [10]);
  assert.ok(out);
  assert.equal(out.direction, "transfer_out");
  assert.equal(out.amount, 8.25);
  const into = mapExplorerFundLog(transferV1, [20]);
  assert.ok(into);
  assert.equal(into.direction, "transfer_in");
});

test("unrelated accounts and trade logs are skipped", () => {
  assert.equal(mapExplorerFundLog(depositV2, [7]), null);
  assert.equal(mapExplorerFundLog(transferV2, [7]), null);
  assert.equal(
    mapExplorerFundLog({ pubdata_type: "Trade", pubdata: { trade_pubdata: {} } }, [1913]),
    null,
  );
});
