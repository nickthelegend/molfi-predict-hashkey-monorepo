// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PrivacyPool} from "../src/PrivacyPool.sol";
import {WithdrawVerifier} from "../src/verifiers/WithdrawVerifier.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ZkFixtures} from "./ZkFixtures.sol";

contract PrivacyPoolTest is Test, ZkFixtures {
    PrivacyPool internal pool;
    WithdrawVerifier internal verifier;
    MockUSDC internal usdc;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA);

    bytes32 internal root;
    address internal recipient;

    function setUp() public {
        usdc = new MockUSDC(admin);
        verifier = new WithdrawVerifier();
        pool = new PrivacyPool(admin, address(verifier), address(usdc));

        root = bytes32(W_ROOT);
        recipient = address(uint160(W_RECIPIENT));

        // fund a depositor
        vm.prank(admin);
        usdc.mint(alice, 10_000e6);
        vm.prank(alice);
        usdc.approve(address(pool), type(uint256).max);
    }

    function _deposit(uint256 amount) internal {
        vm.prank(alice);
        pool.deposit(keccak256("c"), amount);
    }

    // ── deposit ───────────────────────────────────────────────────────────────
    function test_DepositPullsCollateralAndEmits() public {
        vm.expectEmit(true, false, false, true, address(pool));
        emit PrivacyPool.Deposit(keccak256("c"), 0, 500e6);
        vm.prank(alice);
        uint256 idx = pool.deposit(keccak256("c"), 500e6);

        assertEq(idx, 0);
        assertEq(pool.leafCount(), 1);
        assertEq(usdc.balanceOf(address(pool)), 500e6);
    }

    function test_DepositZeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert("invalid amount");
        pool.deposit(keccak256("c"), 0);
    }

    // ── registerRoot ──────────────────────────────────────────────────────────
    function test_RegisterRootAdminOnly() public {
        vm.prank(admin);
        pool.registerRoot(root);
        assertTrue(pool.knownRoot(root));
        assertEq(pool.root(), root);
    }

    function test_RegisterRootRevertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("not admin");
        pool.registerRoot(root);
    }

    // ── withdraw ──────────────────────────────────────────────────────────────
    function test_WithdrawValidPaysOutAndBurnsNullifier() public {
        _deposit(2 * W_AMOUNT);
        vm.prank(admin);
        pool.registerRoot(root);

        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        pool.withdraw(a, b, c, pub, recipient, W_AMOUNT);

        assertEq(usdc.balanceOf(recipient), W_AMOUNT);
        assertTrue(pool.isNullifierUsed(bytes32(W_NULLIFIER)));
    }

    function test_WithdrawUnknownRootReverts() public {
        _deposit(2 * W_AMOUNT);
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        vm.expectRevert("unknown root");
        pool.withdraw(a, b, c, pub, recipient, W_AMOUNT);
    }

    function test_WithdrawUsedNullifierReverts() public {
        _deposit(2 * W_AMOUNT);
        vm.prank(admin);
        pool.registerRoot(root);

        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        pool.withdraw(a, b, c, pub, recipient, W_AMOUNT);

        vm.expectRevert("nullifier used");
        pool.withdraw(a, b, c, pub, recipient, W_AMOUNT);
    }

    function test_WithdrawRecipientMismatchReverts() public {
        _deposit(2 * W_AMOUNT);
        vm.prank(admin);
        pool.registerRoot(root);
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        vm.expectRevert("recipient mismatch");
        pool.withdraw(a, b, c, pub, address(0xBEEF), W_AMOUNT);
    }

    function test_WithdrawAmountMismatchReverts() public {
        _deposit(2 * W_AMOUNT);
        vm.prank(admin);
        pool.registerRoot(root);
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        vm.expectRevert("amount mismatch");
        pool.withdraw(a, b, c, pub, recipient, W_AMOUNT + 1);
    }

    function test_WithdrawBadProofReverts() public {
        _deposit(2 * W_AMOUNT);
        vm.prank(admin);
        pool.registerRoot(root);
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        // tamper the nullifier public signal: still-unused, recipient/amount still match,
        // but the pairing check fails => "proof rejected".
        pub[1] = pub[1] + 1;
        vm.expectRevert("proof rejected");
        pool.withdraw(a, b, c, pub, recipient, W_AMOUNT);
    }

    function test_WithdrawZeroAmountReverts() public {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        vm.expectRevert("invalid amount");
        pool.withdraw(a, b, c, pub, recipient, 0);
    }
}
