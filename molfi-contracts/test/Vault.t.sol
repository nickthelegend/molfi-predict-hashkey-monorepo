// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract VaultTest is Test {
    Vault internal vault;
    MockUSDC internal usdc;
    address internal admin = address(0xA11CE);
    address internal alice = address(0xA);

    function setUp() public {
        vault = new Vault(admin);
        usdc = new MockUSDC(admin);
        // fund the vault
        vm.prank(admin);
        usdc.mint(address(vault), 1_000e6);
    }

    function test_AdminSet() public view {
        assertEq(vault.admin(), admin);
    }

    function test_BalanceView() public view {
        assertEq(vault.balance(address(usdc)), 1_000e6);
    }

    function test_SweepAdminOnly() public {
        vm.prank(admin);
        vault.sweep(address(usdc), alice, 400e6);
        assertEq(usdc.balanceOf(alice), 400e6);
        assertEq(vault.balance(address(usdc)), 600e6);
    }

    function test_SweepRevertsForNonAdmin() public {
        vm.prank(alice);
        vm.expectRevert("not admin");
        vault.sweep(address(usdc), alice, 1);
    }
}
