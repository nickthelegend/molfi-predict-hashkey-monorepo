// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
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

/// Deploys the full Molfi stack to HashKey Chain and writes the addresses to
/// deployments/<chainid>.json for the backend / frontend / SDK to consume.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);
        uint256 denom = 100 * 1e6; // 100 mUSDC fixed confidential-bet denomination

        vm.startBroadcast(pk);

        MockUSDC musdc = new MockUSDC(admin);
        Vault vault = new Vault(admin, address(musdc));
        MockOracle oracle = new MockOracle(admin, 8); // 8-decimal price feed

        SolvencyVerifier solvencyV = new SolvencyVerifier();
        ConfidentialBetVerifier confV = new ConfidentialBetVerifier();
        WithdrawVerifier withdrawV = new WithdrawVerifier();
        MulVerifier mulV = new MulVerifier();

        Market market = new Market(admin, address(mulV));
        PredictEscrow escrow =
            new PredictEscrow(admin, address(musdc), address(vault), address(solvencyV), address(market));
        ConfidentialBet conf =
            new ConfidentialBet(admin, address(musdc), address(confV), address(market), denom);
        PrivacyPool pool = new PrivacyPool(admin, address(withdrawV), address(musdc));

        // Seed liquidity so pari-mutuel/confidential payouts have headroom.
        musdc.mint(admin, 1_000_000 * 1e6);
        // Seed an initial price on the oracle (BTC ~ $100k, 8dp).
        oracle.setPrice(keccak256("BTC"), 100_000 * 1e8);

        vm.stopBroadcast();

        // ── Persist addresses ────────────────────────────────────────────────
        string memory o = "molfi";
        vm.serializeAddress(o, "mUSDC", address(musdc));
        vm.serializeAddress(o, "vault", address(vault));
        vm.serializeAddress(o, "oracle", address(oracle));
        vm.serializeAddress(o, "solvencyVerifier", address(solvencyV));
        vm.serializeAddress(o, "confidentialBetVerifier", address(confV));
        vm.serializeAddress(o, "withdrawVerifier", address(withdrawV));
        vm.serializeAddress(o, "mulVerifier", address(mulV));
        vm.serializeAddress(o, "market", address(market));
        vm.serializeAddress(o, "predictEscrow", address(escrow));
        vm.serializeAddress(o, "confidentialBet", address(conf));
        vm.serializeUint(o, "denom", denom);
        string memory json = vm.serializeAddress(o, "privacyPool", address(pool));

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);

        console2.log("=== Molfi deployed on chain", block.chainid, "===");
        console2.log("mUSDC           ", address(musdc));
        console2.log("vault           ", address(vault));
        console2.log("oracle          ", address(oracle));
        console2.log("solvencyVerifier", address(solvencyV));
        console2.log("confVerifier    ", address(confV));
        console2.log("withdrawVerifier", address(withdrawV));
        console2.log("mulVerifier     ", address(mulV));
        console2.log("market          ", address(market));
        console2.log("predictEscrow   ", address(escrow));
        console2.log("confidentialBet ", address(conf));
        console2.log("privacyPool     ", address(pool));
        console2.log("wrote", path);
    }
}
