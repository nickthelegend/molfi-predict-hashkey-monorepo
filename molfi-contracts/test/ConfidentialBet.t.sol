// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConfidentialBet} from "../src/ConfidentialBet.sol";
import {ConfidentialBetVerifier} from "../src/verifiers/ConfidentialBetVerifier.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockMarket} from "./mocks/MockMarket.sol";
import {ZkFixtures} from "./ZkFixtures.sol";

contract ConfidentialBetTest is Test, ZkFixtures {
    ConfidentialBet internal conf;
    ConfidentialBetVerifier internal verifier;
    MockUSDC internal usdc;
    MockMarket internal market;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA);

    bytes32 internal constant MID = bytes32("m1");
    uint256 internal constant DENOM = 100e6;

    bytes32 internal root;
    bytes32 internal nullifier;
    address internal recipient;

    function setUp() public {
        usdc = new MockUSDC(admin);
        verifier = new ConfidentialBetVerifier();
        market = new MockMarket();
        conf = new ConfidentialBet(admin, address(usdc), address(verifier), address(market), DENOM);

        root = bytes32(CB_ROOT);
        nullifier = bytes32(CB_NULLIFIER);
        recipient = address(uint160(CB_RECIPIENT));

        // fund a committer
        vm.prank(admin);
        usdc.mint(alice, 10_000e6);
        vm.prank(alice);
        usdc.approve(address(conf), type(uint256).max);
    }

    function _commit(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            vm.prank(alice);
            conf.commit(keccak256(abi.encode("leaf", i)));
        }
    }

    function _claim() internal returns (uint256) {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c,) = confidentialBetProof();
        return conf.claim(MID, a, b, c, nullifier, root, recipient);
    }

    // ── commit ────────────────────────────────────────────────────────────────
    function test_CommitPullsDenomIncrementsLeafAndPot() public {
        vm.prank(alice);
        uint256 idx = conf.commit(keccak256("leaf0"));
        assertEq(idx, 0);
        assertEq(conf.leafCount(), 1);
        assertEq(conf.pot(), DENOM);
        assertEq(usdc.balanceOf(address(conf)), DENOM);

        vm.prank(alice);
        uint256 idx2 = conf.commit(keccak256("leaf1"));
        assertEq(idx2, 1);
        assertEq(conf.leafCount(), 2);
        assertEq(conf.pot(), 2 * DENOM);
    }

    // ── registerRoot ────────────────────────────────────────────────────────────
    function test_RegisterRootAdminOnly() public {
        vm.prank(admin);
        conf.registerRoot(root);
        assertTrue(conf.isRootKnown(root));
    }

    function test_RegisterRootRevertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("not admin");
        conf.registerRoot(root);
    }

    // ── claim ─────────────────────────────────────────────────────────────────
    function test_ClaimRevertsMarketNotResolved() public {
        _commit(2);
        vm.prank(admin);
        conf.registerRoot(root);
        vm.expectRevert("market not resolved");
        _claim();
    }

    function test_ClaimRevertsUnknownRoot() public {
        _commit(2);
        market.setResolved(MID, uint32(CB_OUTCOME)); // outcome 0 (YES)
        vm.expectRevert("unknown root");
        _claim();
    }

    function test_ClaimPaysTwiceDenom() public {
        _commit(2); // pot = 200
        market.setResolved(MID, uint32(CB_OUTCOME));
        vm.prank(admin);
        conf.registerRoot(root);

        uint256 payout = _claim();
        assertEq(payout, 2 * DENOM);
        assertEq(usdc.balanceOf(recipient), 2 * DENOM);
        assertEq(conf.pot(), 0);
        assertTrue(conf.isNullifierUsed(nullifier));
    }

    function test_ClaimRevertsUsedNullifier() public {
        _commit(3); // pot = 300, enough for one claim (200) then re-claim
        market.setResolved(MID, uint32(CB_OUTCOME));
        vm.prank(admin);
        conf.registerRoot(root);

        _claim(); // burns nullifier
        vm.expectRevert("nullifier used");
        _claim();
    }

    function test_ClaimRevertsInsolventPot() public {
        _commit(1); // pot = 100 < payout 200
        market.setResolved(MID, uint32(CB_OUTCOME));
        vm.prank(admin);
        conf.registerRoot(root);
        vm.expectRevert("insolvent");
        _claim();
    }

    function test_ClaimRevertsBadProofWrongOutcome() public {
        _commit(2);
        // proof was generated for outcome 0; resolve to 1 so injected pub[2] mismatches
        market.setResolved(MID, 1);
        vm.prank(admin);
        conf.registerRoot(root);
        vm.expectRevert("proof rejected");
        _claim();
    }
}
