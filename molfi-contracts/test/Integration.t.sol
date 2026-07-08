// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {MockOracle} from "../src/MockOracle.sol";
import {Vault} from "../src/Vault.sol";
import {Market} from "../src/Market.sol";
import {PredictEscrow} from "../src/PredictEscrow.sol";
import {ConfidentialBet} from "../src/ConfidentialBet.sol";
import {PrivacyPool} from "../src/PrivacyPool.sol";
import {SolvencyVerifier} from "../src/verifiers/SolvencyVerifier.sol";
import {ConfidentialBetVerifier} from "../src/verifiers/ConfidentialBetVerifier.sol";
import {WithdrawVerifier} from "../src/verifiers/WithdrawVerifier.sol";
import {MulVerifier} from "../src/verifiers/MulVerifier.sol";
import {ZkFixtures} from "./ZkFixtures.sol";

/// End-to-end lifecycle mirroring script/Deploy.s.sol.
contract IntegrationTest is Test, ZkFixtures {
    MockUSDC internal musdc;
    MockOracle internal oracle;
    Vault internal vault;
    Market internal market;
    PredictEscrow internal escrow;
    ConfidentialBet internal conf;
    PrivacyPool internal pool;

    SolvencyVerifier internal solvencyV;
    ConfidentialBetVerifier internal confV;
    WithdrawVerifier internal withdrawV;
    MulVerifier internal mulV;

    address internal admin = address(0xA11CE);
    address internal alice = address(0xA); // bets YES
    address internal bob = address(0xB); // bets NO
    address internal committer = address(0xC);
    address internal depositor = address(0xD);

    uint256 internal constant DENOM = 100e6;
    bytes32 internal constant PMID = bytes32("BTC-100k");
    uint32 internal constant YES = 0;
    uint32 internal constant NO = 1;

    bytes32 internal btc;

    function setUp() public {
        vm.warp(1_000_000);
        vm.startPrank(admin);
        musdc = new MockUSDC(admin);
        vault = new Vault(admin);
        oracle = new MockOracle(admin, 8);
        solvencyV = new SolvencyVerifier();
        confV = new ConfidentialBetVerifier();
        withdrawV = new WithdrawVerifier();
        mulV = new MulVerifier();
        market = new Market(admin, address(mulV));
        escrow = new PredictEscrow(admin, address(musdc), address(vault), address(solvencyV), address(market));
        conf = new ConfidentialBet(admin, address(musdc), address(confV), address(market), DENOM);
        pool = new PrivacyPool(admin, address(withdrawV), address(musdc));

        musdc.mint(admin, 1_000_000e6);
        btc = keccak256("BTC");
        oracle.setPrice(btc, 100_000 * 1e8);
        vm.stopPrank();

        _fund(alice);
        _fund(bob);
        _fund(committer);
        _fund(depositor);
    }

    function _fund(address who) internal {
        vm.prank(admin);
        musdc.mint(who, 10_000e6);
        vm.startPrank(who);
        musdc.approve(address(escrow), type(uint256).max);
        musdc.approve(address(conf), type(uint256).max);
        musdc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    function test_FullLifecycle() public {
        uint64 closeTs = uint64(block.timestamp + 1 days);

        // 1. create a price market: "BTC >= $100k at close?"
        vm.prank(admin);
        market.createPriceMarket(
            PMID, "BTC>=100k?", closeTs, address(oracle), btc, 100_000 * 1e8, 0 /*OP_GTE*/, 1 days
        );

        // 2. two bettors bet opposite sides (each 100 mUSDC)
        vm.prank(alice);
        escrow.bet(PMID, YES, 100e6);
        vm.prank(bob);
        escrow.bet(PMID, NO, 100e6);
        assertEq(escrow.total(PMID), 200e6);

        // 3. warp past close, keep oracle fresh, resolve permissionlessly
        vm.warp(closeTs + 1);
        vm.prank(admin);
        oracle.setPrice(btc, 100_000 * 1e8); // refresh so not stale
        vm.prank(bob); // anyone can resolve
        market.resolveFromOracle(PMID);
        assertTrue(market.isResolved(PMID));
        assertEq(market.winningOutcome(PMID), YES);

        // 4. winner (alice) redeems whole pot minus 2% fee; loser (bob) cannot
        vm.prank(alice);
        uint256 net = escrow.redeem(PMID);
        // gross = 100 * 200 / 100 = 200 ; fee 2% = 4 ; net = 196
        assertEq(net, 196e6);
        assertEq(vault.balance(address(musdc)), 4e6);
        assertEq(musdc.balanceOf(alice), 9_900e6 + 196e6);

        vm.prank(bob);
        vm.expectRevert("nothing to redeem");
        escrow.redeem(PMID);

        // ── Confidential bet path (reuses the resolved YES market) ────────────────
        // proof was generated for outcome 0 (YES) and recipient 987654321987654321
        vm.startPrank(committer);
        conf.commit(keccak256("cn0"));
        conf.commit(keccak256("cn1")); // pot = 200
        vm.stopPrank();
        vm.prank(admin);
        conf.registerRoot(bytes32(CB_ROOT));

        address cbRecipient = address(uint160(CB_RECIPIENT));
        (uint256[2] memory ca, uint256[2][2] memory cb, uint256[2] memory cc,) = confidentialBetProof();
        uint256 payout = conf.claim(PMID, ca, cb, cc, bytes32(CB_NULLIFIER), bytes32(CB_ROOT), cbRecipient);
        assertEq(payout, 2 * DENOM);
        assertEq(musdc.balanceOf(cbRecipient), 2 * DENOM);

        // ── Privacy pool path ─────────────────────────────────────────────────────
        vm.prank(depositor);
        pool.deposit(keccak256("pc"), 2 * W_AMOUNT);
        vm.prank(admin);
        pool.registerRoot(bytes32(W_ROOT));

        address wRecipient = address(uint160(W_RECIPIENT));
        (uint256[2] memory wa, uint256[2][2] memory wb, uint256[2] memory wc, uint256[4] memory wpub) = withdrawProof();
        pool.withdraw(wa, wb, wc, wpub, wRecipient, W_AMOUNT);
        assertEq(musdc.balanceOf(wRecipient), W_AMOUNT);
        assertTrue(pool.isNullifierUsed(bytes32(W_NULLIFIER)));
    }
}
