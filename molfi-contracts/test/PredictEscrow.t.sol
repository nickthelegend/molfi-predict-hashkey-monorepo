// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PredictEscrow} from "../src/PredictEscrow.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Vault} from "../src/Vault.sol";
import {SolvencyVerifier} from "../src/verifiers/SolvencyVerifier.sol";
import {MockMarket} from "./mocks/MockMarket.sol";
import {ZkFixtures} from "./ZkFixtures.sol";

contract PredictEscrowTest is Test, ZkFixtures {
    PredictEscrow internal escrow;
    MockUSDC internal usdc;
    Vault internal vault;
    SolvencyVerifier internal solvencyV;
    MockMarket internal market;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA);
    address internal bob = address(0xB);
    address internal carol = address(0xC);

    bytes32 internal constant MID = bytes32("m1");
    uint32 internal constant YES = 0;
    uint32 internal constant NO = 1;

    function setUp() public {
        usdc = new MockUSDC(admin);
        vault = new Vault(admin);
        solvencyV = new SolvencyVerifier();
        market = new MockMarket();
        escrow = new PredictEscrow(admin, address(usdc), address(vault), address(solvencyV), address(market));

        // fund bettors
        _fund(alice, 10_000e6);
        _fund(bob, 10_000e6);
        _fund(carol, 10_000e6);
    }

    function _fund(address who, uint256 amount) internal {
        vm.prank(admin);
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(escrow), type(uint256).max);
    }

    // ── bet ─────────────────────────────────────────────────────────────────────
    function test_BetPullsFundsAndUpdatesState() public {
        vm.prank(alice);
        escrow.bet(MID, YES, 100e6);

        assertEq(usdc.balanceOf(address(escrow)), 100e6);
        assertEq(escrow.pool(MID, YES), 100e6);
        assertEq(escrow.total(MID), 100e6);
        assertEq(escrow.position(MID, YES, alice), 100e6);
    }

    function test_BetInvalidOutcomeReverts() public {
        vm.prank(alice);
        vm.expectRevert("invalid outcome");
        escrow.bet(MID, 2, 100e6);
    }

    function test_BetZeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert("invalid amount");
        escrow.bet(MID, YES, 0);
    }

    // ── redeem: pari-mutuel exact numbers ─────────────────────────────────────────
    // YES: alice 100, carol 300 => 400 ; NO: bob 200 ; total = 600. YES wins.
    function _setupTwoSidedPot() internal {
        vm.prank(alice);
        escrow.bet(MID, YES, 100e6);
        vm.prank(carol);
        escrow.bet(MID, YES, 300e6);
        vm.prank(bob);
        escrow.bet(MID, NO, 200e6);
    }

    function test_RedeemPariMutuelExact() public {
        _setupTwoSidedPot();
        market.setResolved(MID, YES);

        // alice: 100*600/400 = 150 gross; fee 2% = 3; net 147
        vm.prank(alice);
        uint256 aliceNet = escrow.redeem(MID);
        assertEq(aliceNet, 147e6);
        assertEq(usdc.balanceOf(alice), 9_900e6 + 147e6); // started 10k, bet 100

        // carol: 300*600/400 = 450 gross; fee 9; net 441
        vm.prank(carol);
        uint256 carolNet = escrow.redeem(MID);
        assertEq(carolNet, 441e6);
        assertEq(usdc.balanceOf(carol), 9_700e6 + 441e6);

        // vault collected 3 + 9 = 12
        assertEq(usdc.balanceOf(address(vault)), 12e6);
        // escrow drained exactly
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_LoserCannotRedeem() public {
        _setupTwoSidedPot();
        market.setResolved(MID, YES);
        vm.prank(bob); // bob bet NO
        vm.expectRevert("nothing to redeem");
        escrow.redeem(MID);
    }

    function test_DoubleRedeemReverts() public {
        _setupTwoSidedPot();
        market.setResolved(MID, YES);
        vm.startPrank(alice);
        escrow.redeem(MID);
        vm.expectRevert("already redeemed");
        escrow.redeem(MID);
        vm.stopPrank();
    }

    function test_RedeemBeforeResolutionReverts() public {
        _setupTwoSidedPot();
        vm.prank(alice);
        vm.expectRevert("market not resolved");
        escrow.redeem(MID);
    }

    function test_RedeemNothingToRedeemReverts() public {
        _setupTwoSidedPot();
        market.setResolved(MID, YES);
        vm.prank(address(0xDEAD)); // never bet
        vm.expectRevert("nothing to redeem");
        escrow.redeem(MID);
    }

    // ── betZk (solvency proof) ────────────────────────────────────────────────────
    function test_BetZkSucceedsThenNullifierReuseReverts() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = solvencyProof();

        vm.prank(alice);
        escrow.betZk(MID, YES, 100e6, a, b, c, pub);

        assertEq(escrow.position(MID, YES, alice), 100e6);
        assertTrue(escrow.nullifierUsed(pub[0])); // domain = 424242 burned

        // second call same domain => revert
        vm.prank(bob);
        vm.expectRevert("nullifier used");
        escrow.betZk(MID, YES, 100e6, a, b, c, pub);
    }

    function test_BetZkBadProofReverts() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = solvencyProof();
        pub[1] = pub[1] + 1; // tamper threshold public signal
        vm.prank(alice);
        vm.expectRevert("proof rejected");
        escrow.betZk(MID, YES, 100e6, a, b, c, pub);
    }
}
