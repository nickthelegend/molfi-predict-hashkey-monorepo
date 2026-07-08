// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Market} from "../src/Market.sol";
import {MockOracle} from "../src/MockOracle.sol";
import {MulVerifier} from "../src/verifiers/MulVerifier.sol";
import {MockStaleOracle} from "./mocks/MockStaleOracle.sol";
import {ZkFixtures} from "./ZkFixtures.sol";

contract MarketTest is Test, ZkFixtures {
    Market internal market;
    MockOracle internal oracle;
    MulVerifier internal mulV;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA);

    bytes32 internal btc;
    uint64 internal closeTs;

    function setUp() public {
        vm.warp(1000);
        mulV = new MulVerifier();
        oracle = new MockOracle(admin, 8);
        market = new Market(admin, address(mulV));
        btc = keccak256("BTC");
        closeTs = uint64(block.timestamp + 1 days);
    }

    // ── create ────────────────────────────────────────────────────────────────
    function test_CreateAdminOnly() public {
        vm.prank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        Market.MarketData memory m = market.getMarket(bytes32("m1"));
        assertEq(uint8(m.status), uint8(Market.Status.Trading));
        assertEq(m.outcome, market.OUTCOME_INVALID());
    }

    function test_CreateRevertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("not admin");
        market.create(bytes32("m1"), "Q?", closeTs);
    }

    function test_CreateRevertsOnDuplicate() public {
        vm.startPrank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        vm.expectRevert("market exists");
        market.create(bytes32("m1"), "Q?", closeTs);
        vm.stopPrank();
    }

    function test_CreateRevertsCloseTsNotFuture() public {
        vm.prank(admin);
        vm.expectRevert("invalid close time");
        market.create(bytes32("m1"), "Q?", uint64(block.timestamp));
    }

    // ── createPriceMarket ───────────────────────────────────────────────────────
    function test_CreatePriceMarketStoresSpec() public {
        vm.prank(admin);
        market.createPriceMarket(
            bytes32("p1"), "BTC>=100k?", closeTs, address(oracle), btc, 100_000 * 1e8, market.OP_GTE(), 1 days
        );
        Market.MarketData memory m = market.getMarket(bytes32("p1"));
        assertEq(m.closeTs, closeTs);
    }

    function test_CreatePriceMarketAdminOnly() public {
        vm.prank(alice);
        vm.expectRevert("not admin");
        market.createPriceMarket(
            bytes32("p1"), "Q", closeTs, address(oracle), btc, 1, market.OP_GTE(), 1 days
        );
    }

    function test_CreatePriceMarketRevertsInvalidOp() public {
        vm.prank(admin);
        vm.expectRevert("invalid op");
        market.createPriceMarket(bytes32("p1"), "Q", closeTs, address(oracle), btc, 1, 2, 1 days);
    }

    // ── resolve (admin) ─────────────────────────────────────────────────────────
    function test_ResolveAdminSetsOutcome() public {
        vm.startPrank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        market.resolve(bytes32("m1"), market.OUTCOME_YES());
        vm.stopPrank();
        assertTrue(market.isResolved(bytes32("m1")));
        assertEq(market.winningOutcome(bytes32("m1")), market.OUTCOME_YES());
    }

    function test_ResolveRevertsForNonAdmin() public {
        vm.prank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        vm.prank(alice);
        vm.expectRevert("not admin");
        market.resolve(bytes32("m1"), 0);
    }

    function test_ResolveRevertsInvalidOutcome() public {
        vm.startPrank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        vm.expectRevert("invalid outcome");
        market.resolve(bytes32("m1"), 3);
        vm.stopPrank();
    }

    function test_ResolveRevertsAlreadyResolved() public {
        vm.startPrank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        market.resolve(bytes32("m1"), 0);
        vm.expectRevert("already resolved");
        market.resolve(bytes32("m1"), 1);
        vm.stopPrank();
    }

    // ── resolveFromOracle ───────────────────────────────────────────────────────
    function _createBtcMarket(uint32 op, int256 threshold) internal {
        vm.prank(admin);
        market.createPriceMarket(bytes32("p1"), "Q", closeTs, address(oracle), btc, threshold, op, 1 days);
    }

    function test_ResolveFromOracleTooEarlyReverts() public {
        _createBtcMarket(market.OP_GTE(), 100_000 * 1e8);
        vm.expectRevert("too early");
        market.resolveFromOracle(bytes32("p1"));
    }

    function test_ResolveFromOracleStaleReverts() public {
        _createBtcMarket(market.OP_GTE(), 100_000 * 1e8);
        vm.prank(admin);
        oracle.setPrice(btc, 100_000 * 1e8); // stamped now
        // warp far past close AND past staleness window
        vm.warp(closeTs + 2 days);
        vm.expectRevert("stale price");
        market.resolveFromOracle(bytes32("p1"));
    }

    function test_ResolveFromOracleGteYes() public {
        _createBtcMarket(market.OP_GTE(), 100_000 * 1e8);
        vm.warp(closeTs + 1);
        vm.prank(admin);
        oracle.setPrice(btc, 100_000 * 1e8); // price == threshold => YES
        uint32 outcome = market.resolveFromOracle(bytes32("p1"));
        assertEq(outcome, market.OUTCOME_YES());
        assertEq(market.winningOutcome(bytes32("p1")), market.OUTCOME_YES());
    }

    function test_ResolveFromOracleGteNo() public {
        _createBtcMarket(market.OP_GTE(), 100_000 * 1e8);
        vm.warp(closeTs + 1);
        vm.prank(admin);
        oracle.setPrice(btc, 99_999 * 1e8); // below threshold => NO
        uint32 outcome = market.resolveFromOracle(bytes32("p1"));
        assertEq(outcome, market.OUTCOME_NO());
    }

    function test_ResolveFromOracleLtYes() public {
        _createBtcMarket(market.OP_LT(), 100_000 * 1e8);
        vm.warp(closeTs + 1);
        vm.prank(admin);
        oracle.setPrice(btc, 99_999 * 1e8); // below threshold => YES for OP_LT
        assertEq(market.resolveFromOracle(bytes32("p1")), market.OUTCOME_YES());
    }

    function test_ResolveFromOracleLtNo() public {
        _createBtcMarket(market.OP_LT(), 100_000 * 1e8);
        vm.warp(closeTs + 1);
        vm.prank(admin);
        oracle.setPrice(btc, 100_000 * 1e8); // == threshold => NO for OP_LT
        assertEq(market.resolveFromOracle(bytes32("p1")), market.OUTCOME_NO());
    }

    function test_ResolveFromOracleIsPermissionless() public {
        _createBtcMarket(market.OP_GTE(), 100_000 * 1e8);
        vm.warp(closeTs + 1);
        vm.prank(admin);
        oracle.setPrice(btc, 100_000 * 1e8);
        vm.prank(alice); // non-admin resolves
        market.resolveFromOracle(bytes32("p1"));
        assertTrue(market.isResolved(bytes32("p1")));
    }

    function test_ResolveFromOracleAlreadyResolvedReverts() public {
        _createBtcMarket(market.OP_GTE(), 100_000 * 1e8);
        vm.warp(closeTs + 1);
        vm.prank(admin);
        oracle.setPrice(btc, 100_000 * 1e8);
        market.resolveFromOracle(bytes32("p1"));
        vm.expectRevert("already resolved");
        market.resolveFromOracle(bytes32("p1"));
    }

    // ── views ───────────────────────────────────────────────────────────────────
    function test_WinningOutcomeRevertsIfNotResolved() public {
        vm.prank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        vm.expectRevert("not resolved");
        market.winningOutcome(bytes32("m1"));
    }

    function test_IsResolvedFalseForUnknown() public view {
        assertFalse(market.isResolved(bytes32("nope")));
    }

    function test_MarketsEnumeration() public {
        vm.startPrank(admin);
        market.create(bytes32("m1"), "Q1", closeTs);
        market.create(bytes32("m2"), "Q2", closeTs);
        vm.stopPrank();
        bytes32[] memory ids = market.markets();
        assertEq(ids.length, 2);
        assertEq(ids[0], bytes32("m1"));
        assertEq(ids[1], bytes32("m2"));
        assertEq(market.marketCount(), 2);
    }

    // ── resolveWithProof (gated on verifier = MulVerifier) ────────────────────────
    function test_ResolveWithProofValid() public {
        vm.prank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = mulProof();
        market.resolveWithProof(bytes32("m1"), market.OUTCOME_YES(), a, b, c, pub);
        assertTrue(market.isResolved(bytes32("m1")));
        assertEq(market.winningOutcome(bytes32("m1")), market.OUTCOME_YES());
    }

    function test_ResolveWithProofBadProofReverts() public {
        vm.prank(admin);
        market.create(bytes32("m1"), "Q?", closeTs);
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = mulProof();
        pub[1] = pub[1] + 1; // tamper public signal
        vm.expectRevert("proof rejected");
        market.resolveWithProof(bytes32("m1"), market.OUTCOME_YES(), a, b, c, pub);
    }
}
