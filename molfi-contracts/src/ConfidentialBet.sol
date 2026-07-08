// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IMarket, IVerifier4} from "./interfaces/IMolfi.sol";

/// @title Molfi Confidential Bet
/// @notice A prediction-market bet where the **side and owner are hidden**. A bet
///         is a commitment note `leaf = Poseidon(secret, nullifier, outcome)`
///         deposited for a fixed mUSDC denomination; nothing on-chain reveals
///         which outcome it backs.
///
/// 1. `commit(commitment)` — escrow one fixed-denom note. Uniform denominations
///    mix amounts; the commitment hides the side + owner. An off-chain service
///    inserts the leaf into a Poseidon Merkle tree and checkpoints the root via
///    `registerRoot`.
/// 2. The `Market` contract resolves the outcome.
/// 3. `claim(...)` — a winner proves in zero-knowledge that they own a note in
///    the tree whose `outcome` equals the **resolved winning outcome** (the
///    contract injects that outcome as a public input, so a losing note can't
///    produce a valid proof), reveals only a nullifier (burned), and is paid from
///    the pot — unlinkable to their deposit.
///
/// ZK: BN254 Groth16 verified on-chain by `ConfidentialBetVerifier`
/// (public signals `[root, nullifierHash, outcome, recipient]`).
contract ConfidentialBet {
    /// Winning note pays this multiple of its denomination (even-odds 2x).
    uint256 public constant PAYOUT_MULT = 2;

    address public admin;
    IERC20 public musdc;
    IVerifier4 public verifier;
    IMarket public market;
    uint256 public denom;

    uint256 public leafCount;
    uint256 public pot;
    mapping(bytes32 => bool) public knownRoot;
    mapping(bytes32 => bool) public nullifierUsedMap;

    event Commit(bytes32 indexed commitment, uint256 index);
    event RootRegistered(bytes32 indexed root);
    event Claim(address indexed recipient, uint256 payout);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor(address admin_, address musdc_, address verifier_, address market_, uint256 denom_) {
        admin = admin_;
        musdc = IERC20(musdc_);
        verifier = IVerifier4(verifier_);
        market = IMarket(market_);
        denom = denom_;
    }

    /// Escrow one fixed-denomination commitment note. The side + owner are
    /// hidden; only `commitment` (and the uniform denom transfer) are public.
    function commit(bytes32 commitment) external returns (uint256 index) {
        require(denom > 0, "invalid denom");
        require(musdc.transferFrom(msg.sender, address(this), denom), "transfer failed");
        index = leafCount;
        leafCount = index + 1;
        pot += denom;
        emit Commit(commitment, index);
    }

    /// Checkpoint a Merkle root computed off-chain over the committed notes.
    function registerRoot(bytes32 root) external onlyAdmin {
        knownRoot[root] = true;
        emit RootRegistered(root);
    }

    /// Claim a winning note. Verifies ON-CHAIN a ZK proof that a note in `root`
    /// has `outcome == market.winningOutcome` (the contract supplies that
    /// outcome, so losing notes can't prove), binds the payout `recipient`
    /// (anti-malleability), burns the nullifier, and pays `PAYOUT_MULT * denom`.
    ///
    /// Public signals passed to the verifier (fixed order):
    ///   [root, nullifierHash, winningOutcome, uint160(recipient)]
    function claim(
        bytes32 marketId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        bytes32 nullifierHash,
        bytes32 root,
        address recipient
    ) external returns (uint256) {
        require(market.isResolved(marketId), "market not resolved");
        uint32 win = market.winningOutcome(marketId);
        require(knownRoot[root], "unknown root");
        require(!nullifierUsedMap[nullifierHash], "nullifier used");

        uint256[4] memory pub;
        pub[0] = uint256(root);
        pub[1] = uint256(nullifierHash);
        pub[2] = uint256(win);
        pub[3] = uint256(uint160(recipient));
        require(verifier.verifyProof(a, b, c, pub), "proof rejected");

        nullifierUsedMap[nullifierHash] = true;

        uint256 payout = denom * PAYOUT_MULT;
        require(pot >= payout, "insolvent");
        pot -= payout;
        require(musdc.transfer(recipient, payout), "payout failed");
        emit Claim(recipient, payout);
        return payout;
    }

    // ── Views ────────────────────────────────────────────────────────────────
    function isNullifierUsed(bytes32 nullifierHash) external view returns (bool) {
        return nullifierUsedMap[nullifierHash];
    }

    function isRootKnown(bytes32 root) external view returns (bool) {
        return knownRoot[root];
    }
}
