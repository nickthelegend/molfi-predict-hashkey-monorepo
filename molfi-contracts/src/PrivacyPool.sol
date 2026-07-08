// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IVerifier4} from "./interfaces/IMolfi.sol";

/// @title Molfi Privacy Pool
/// @notice Privacy-Pools-style shielded pool for confidential positions.
///        
///
/// - **Deposit (public):** a trader transfers collateral in and inserts a
///   commitment `C = Poseidon(secret, nullifier, amount)` into an off-chain
///   Poseidon Merkle tree. The amount + depositor are visible; the link to any
///   future withdrawal is not.
/// - **Withdraw (private):** the trader submits a Groth16 proof (checked by
///   `WithdrawVerifier`) demonstrating knowledge of a commitment in the tree at a
///   checkpointed `root` and revealing only a `nullifierHash`. The nullifier is
///   burned to prevent double-spend; the proof never reveals which deposit it
///   corresponds to.
///
/// The Poseidon commitment tree is maintained off-chain and each new root is
/// checkpointed via `registerRoot` — the standard pattern for a ZK pool, since
/// on-chain Poseidon over BN254 would be prohibitively expensive per deposit.
///
/// Withdraw public signals (fixed order): [root, nullifierHash, recipient, amount].
contract PrivacyPool {
    address public admin;
    IVerifier4 public verifier;
    IERC20 public collateral;

    uint256 public leafCount;
    bytes32 public currentRoot;
    mapping(bytes32 => bool) public knownRoot;
    mapping(bytes32 => bool) public nullifierUsedMap;

    event Deposit(bytes32 indexed commitment, uint256 leafIndex, uint256 amount);
    event RootRegistered(bytes32 indexed root);
    event Withdraw(bytes32 indexed nullifierHash, address indexed to, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor(address admin_, address verifier_, address collateral_) {
        admin = admin_;
        verifier = IVerifier4(verifier_);
        collateral = IERC20(collateral_);
    }

    /// Deposit `amount` collateral and register `commitment` as a new leaf.
    /// `commitment` is computed off-chain so the pool never sees the secret.
    function deposit(bytes32 commitment, uint256 amount) external returns (uint256 leafIndex) {
        require(amount > 0, "invalid amount");
        require(collateral.transferFrom(msg.sender, address(this), amount), "transfer failed");
        leafIndex = leafCount;
        leafCount = leafIndex + 1;
        emit Deposit(commitment, leafIndex, amount);
    }

    /// Checkpoint a Merkle root produced off-chain (operator maintains the
    /// Poseidon tree and registers each new root here).
    function registerRoot(bytes32 root) external onlyAdmin {
        knownRoot[root] = true;
        currentRoot = root;
        emit RootRegistered(root);
    }

    /// Private withdrawal gated by a REAL Groth16 membership + nullifier proof.
    /// Binds `recipient` and `amount` to the proof so a relayer cannot re-target
    /// or change the payout. On success the nullifier is burned and `amount` of
    /// collateral is released to `to`.
    function withdraw(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata pubSignals,
        address to,
        uint256 amount
    ) external {
        require(amount > 0, "invalid amount");
        bytes32 root = bytes32(pubSignals[0]);
        bytes32 nullifierHash = bytes32(pubSignals[1]);

        require(knownRoot[root], "unknown root");
        require(!nullifierUsedMap[nullifierHash], "nullifier used");
        require(pubSignals[2] == uint256(uint160(to)), "recipient mismatch");
        require(pubSignals[3] == amount, "amount mismatch");

        require(verifier.verifyProof(a, b, c, pubSignals), "proof rejected");

        nullifierUsedMap[nullifierHash] = true;
        require(collateral.transfer(to, amount), "payout failed");
        emit Withdraw(nullifierHash, to, amount);
    }

    // ── Views ────────────────────────────────────────────────────────────────
    function isNullifierUsed(bytes32 nullifierHash) external view returns (bool) {
        return nullifierUsedMap[nullifierHash];
    }

    function root() external view returns (bytes32) {
        return currentRoot;
    }
}
