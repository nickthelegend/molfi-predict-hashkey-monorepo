// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal admin = address(0xA11CE);
    address internal alice = address(0xA);
    address internal bob = address(0xB);

    function setUp() public {
        usdc = new MockUSDC(admin);
    }

    function test_Metadata() public view {
        assertEq(usdc.name(), "Molfi USD");
        assertEq(usdc.symbol(), "mUSDC");
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.admin(), admin);
        assertEq(usdc.FAUCET_AMOUNT(), 10_000 * 1e6);
    }

    function test_FaucetMints10k() public {
        usdc.faucet(alice);
        assertEq(usdc.balanceOf(alice), 10_000 * 1e6);
        assertEq(usdc.totalSupply(), 10_000 * 1e6);
    }

    function test_FaucetAnyoneCanCall() public {
        vm.prank(bob);
        usdc.faucet(alice);
        assertEq(usdc.balanceOf(alice), 10_000 * 1e6);
    }

    function test_MintAdminOnly() public {
        vm.prank(admin);
        usdc.mint(alice, 500e6);
        assertEq(usdc.balanceOf(alice), 500e6);
    }

    function test_MintRevertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("not admin");
        usdc.mint(alice, 500e6);
    }

    function test_TransferAndBalance() public {
        usdc.faucet(alice);
        vm.prank(alice);
        usdc.transfer(bob, 1_000e6);
        assertEq(usdc.balanceOf(alice), 9_000e6);
        assertEq(usdc.balanceOf(bob), 1_000e6);
    }

    function test_TransferInsufficientBalanceReverts() public {
        vm.prank(alice);
        vm.expectRevert("insufficient balance");
        usdc.transfer(bob, 1);
    }

    function test_ApproveAndAllowance() public {
        vm.prank(alice);
        usdc.approve(bob, 777e6);
        assertEq(usdc.allowance(alice, bob), 777e6);
    }

    function test_TransferFromDecrementsAllowance() public {
        usdc.faucet(alice);
        vm.prank(alice);
        usdc.approve(bob, 1_000e6);

        vm.prank(bob);
        usdc.transferFrom(alice, bob, 400e6);

        assertEq(usdc.balanceOf(bob), 400e6);
        assertEq(usdc.balanceOf(alice), 9_600e6);
        assertEq(usdc.allowance(alice, bob), 600e6);
    }

    function test_TransferFromInfiniteAllowanceNotDecremented() public {
        usdc.faucet(alice);
        vm.prank(alice);
        usdc.approve(bob, type(uint256).max);

        vm.prank(bob);
        usdc.transferFrom(alice, bob, 400e6);

        assertEq(usdc.allowance(alice, bob), type(uint256).max);
    }

    function test_TransferFromInsufficientAllowanceReverts() public {
        usdc.faucet(alice);
        vm.prank(alice);
        usdc.approve(bob, 100e6);

        vm.prank(bob);
        vm.expectRevert("insufficient allowance");
        usdc.transferFrom(alice, bob, 200e6);
    }

    function test_Burn() public {
        usdc.faucet(alice);
        vm.prank(alice);
        usdc.burn(4_000e6);
        assertEq(usdc.balanceOf(alice), 6_000e6);
        assertEq(usdc.totalSupply(), 6_000e6);
    }

    function test_BurnInsufficientBalanceReverts() public {
        vm.prank(alice);
        vm.expectRevert("insufficient balance");
        usdc.burn(1);
    }
}
