// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockOracle} from "../src/MockOracle.sol";

contract MockOracleTest is Test {
    MockOracle internal oracle;
    address internal admin = address(0xA11CE);
    address internal alice = address(0xA);

    bytes32 internal btc;
    bytes32 internal eth;

    function setUp() public {
        oracle = new MockOracle(admin, 8);
        btc = keccak256("BTC");
        eth = keccak256("ETH");
    }

    function test_Decimals() public view {
        assertEq(oracle.decimals(), 8);
        assertEq(oracle.admin(), admin);
    }

    function test_AssetIdMatchesKeccak() public view {
        assertEq(oracle.asset("BTC"), keccak256("BTC"));
    }

    function test_SetPriceAdminOnly() public {
        vm.prank(admin);
        oracle.setPrice(btc, 100_000 * 1e8);
        (int256 price,) = oracle.lastPrice(btc);
        assertEq(price, 100_000 * 1e8);
    }

    function test_SetPriceRevertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("not admin");
        oracle.setPrice(btc, 1);
    }

    function test_MultiAssetIndependentPrices() public {
        vm.startPrank(admin);
        oracle.setPrice(btc, 100_000 * 1e8);
        oracle.setPrice(eth, 3_000 * 1e8);
        vm.stopPrank();

        (int256 pBtc,) = oracle.lastPrice(btc);
        (int256 pEth,) = oracle.lastPrice(eth);
        assertEq(pBtc, 100_000 * 1e8);
        assertEq(pEth, 3_000 * 1e8);
    }

    function test_LastPriceTimestampIsCurrentBlock() public {
        vm.warp(123456);
        vm.prank(admin);
        oracle.setPrice(btc, 5);
        (, uint64 ts) = oracle.lastPrice(btc);
        assertEq(ts, 123456);
    }

    function test_UpdatedAtStampedOnSet() public {
        vm.warp(500);
        vm.prank(admin);
        oracle.setPrice(btc, 5);
        assertEq(oracle.updatedAt(btc), 500);
    }

    function test_UnsetAssetReturnsZero() public view {
        (int256 price,) = oracle.lastPrice(eth);
        assertEq(price, 0);
    }
}
