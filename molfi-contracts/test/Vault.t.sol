// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Vault} from "../src/Vault.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract VaultTest is Test {
    MockUSDC musdc;
    Vault vault;
    address admin = address(0xA11CE);
    address lp1 = address(0xB0B);
    address lp2 = address(0xCAFE);
    uint256 constant U = 1e6;

    function setUp() public {
        vm.prank(admin);
        musdc = new MockUSDC(admin);
        vault = new Vault(admin, address(musdc));
        vm.prank(lp1); musdc.faucet(lp1); // 10,000 mUSDC
        vm.prank(lp2); musdc.faucet(lp2);
    }

    function _deposit(address lp, uint256 amt) internal returns (uint256) {
        vm.startPrank(lp);
        musdc.approve(address(vault), amt);
        uint256 s = vault.deposit(amt);
        vm.stopPrank();
        return s;
    }

    function test_FirstDepositMintsShares() public {
        _deposit(lp1, 1000 * U);
        assertGt(vault.balanceOf(lp1), 0);
        assertEq(vault.totalAssets(), 1000 * U);
        assertApproxEqAbs(vault.assetsOf(lp1), 1000 * U, 2);
    }

    function test_YieldAccruesToLp() public {
        _deposit(lp1, 1000 * U);
        // Protocol fees arrive (simulate PredictEscrow routing 2% fees in).
        vm.prank(admin); musdc.mint(address(vault), 200 * U);
        assertApproxEqAbs(vault.assetsOf(lp1), 1200 * U, 3);
        assertApproxEqAbs(vault.earnedOf(lp1), 200 * U, 3);
        vm.prank(lp1);
        uint256 out = vault.withdrawAll();
        assertApproxEqAbs(out, 1200 * U, 3);
        assertGt(out, 1000 * U); // real yield
    }

    function test_TwoLpsShareYieldProRata() public {
        _deposit(lp1, 1000 * U);
        _deposit(lp2, 250 * U);
        vm.prank(admin); musdc.mint(address(vault), 250 * U);
        assertApproxEqAbs(vault.earnedOf(lp1), 200 * U, 1e4);
        assertApproxEqAbs(vault.earnedOf(lp2), 50 * U, 1e4);
    }

    function test_SharePriceRisesWithFees() public {
        _deposit(lp1, 1000 * U);
        uint256 p0 = vault.sharePrice();
        vm.prank(admin); musdc.mint(address(vault), 100 * U);
        assertGt(vault.sharePrice(), p0);
    }

    function test_PartialWithdraw() public {
        uint256 s = _deposit(lp1, 1000 * U);
        vm.prank(lp1);
        uint256 out = vault.withdraw(s / 2);
        assertApproxEqAbs(out, 500 * U, 2);
        assertApproxEqAbs(vault.assetsOf(lp1), 500 * U, 2);
    }

    function test_WithdrawTooMuchReverts() public {
        uint256 s = _deposit(lp1, 100 * U);
        vm.prank(lp1);
        vm.expectRevert(bytes("insufficient shares"));
        vault.withdraw(s + 1);
    }

    function test_ZeroDepositReverts() public {
        vm.startPrank(lp1);
        vm.expectRevert(bytes("zero deposit"));
        vault.deposit(0);
        vm.stopPrank();
    }
}
