// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SolvencyVerifier} from "../src/verifiers/SolvencyVerifier.sol";
import {ConfidentialBetVerifier} from "../src/verifiers/ConfidentialBetVerifier.sol";
import {WithdrawVerifier} from "../src/verifiers/WithdrawVerifier.sol";
import {MulVerifier} from "../src/verifiers/MulVerifier.sol";
import {ZkFixtures} from "./ZkFixtures.sol";

contract VerifiersTest is Test, ZkFixtures {
    SolvencyVerifier internal solvencyV;
    ConfidentialBetVerifier internal confV;
    WithdrawVerifier internal withdrawV;
    MulVerifier internal mulV;

    function setUp() public {
        solvencyV = new SolvencyVerifier();
        confV = new ConfidentialBetVerifier();
        withdrawV = new WithdrawVerifier();
        mulV = new MulVerifier();
    }

    // ── solvency ────────────────────────────────────────────────────────────────
    function test_SolvencyValid() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = solvencyProof();
        assertTrue(solvencyV.verifyProof(a, b, c, pub));
    }

    function test_SolvencyTamperedFails() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = solvencyProof();
        pub[0] = pub[0] + 1;
        assertFalse(solvencyV.verifyProof(a, b, c, pub));
    }

    // ── mul ───────────────────────────────────────────────────────────────────
    function test_MulValid() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = mulProof();
        assertTrue(mulV.verifyProof(a, b, c, pub));
    }

    function test_MulTamperedFails() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[2] memory pub) = mulProof();
        pub[1] = pub[1] + 1;
        assertFalse(mulV.verifyProof(a, b, c, pub));
    }

    // ── confidential_bet ──────────────────────────────────────────────────────
    function test_ConfidentialBetValid() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) =
            confidentialBetProof();
        assertTrue(confV.verifyProof(a, b, c, pub));
    }

    function test_ConfidentialBetTamperedFails() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) =
            confidentialBetProof();
        pub[2] = 1; // flip outcome
        assertFalse(confV.verifyProof(a, b, c, pub));
    }

    // ── withdraw ──────────────────────────────────────────────────────────────
    function test_WithdrawValid() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        assertTrue(withdrawV.verifyProof(a, b, c, pub));
    }

    function test_WithdrawTamperedFails() public view {
        (uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[4] memory pub) = withdrawProof();
        pub[3] = pub[3] + 1; // flip amount
        assertFalse(withdrawV.verifyProof(a, b, c, pub));
    }
}
