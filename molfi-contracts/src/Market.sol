// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IOracle, IVerifier2} from "./interfaces/IMolfi.sol";

/// @title Molfi Market
/// @notice Lifecycle + resolution for a binary (YES/NO) prediction market.
///         State machine: `Trading -> Resolving -> Resolved`. This contract is
///         the on-chain source of truth for which markets exist and how they
///         resolved — the signal `PredictEscrow`/`ConfidentialBet` read when
///         paying winners.
///
/// Three resolution paths:
///   - `resolve`            — admin-attested (v1).
///   - `resolveFromOracle`  — permissionless, from a push price feed.
///   - `resolveWithProof`   — ZK-attested; a Groth16 proof is the authority.
contract Market {
    // Outcome codes.
    uint32 public constant OUTCOME_YES = 0;
    uint32 public constant OUTCOME_NO = 1;
    uint32 public constant OUTCOME_INVALID = 2;

    // Oracle comparison ops.
    uint32 public constant OP_GTE = 0; // YES iff price >= threshold
    uint32 public constant OP_LT = 1; // YES iff price <  threshold

    enum Status {
        Trading,
        Resolving,
        Resolved
    }

    struct MarketData {
        bytes32 id;
        string question;
        uint64 closeTs;
        Status status;
        uint32 outcome;
    }

    struct OracleSpec {
        address oracle;
        bytes32 asset;
        int256 threshold;
        uint32 op;
        uint64 maxStaleness;
        bool set;
    }

    address public admin;
    IVerifier2 public verifier;

    mapping(bytes32 => MarketData) private _markets;
    mapping(bytes32 => bool) private _exists;
    mapping(bytes32 => OracleSpec) private _oracleSpec;
    bytes32[] private _registry;

    event MarketCreated(bytes32 indexed id, uint64 closeTs);
    event MarketResolved(bytes32 indexed id, uint32 outcome);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    constructor(address admin_, address verifier_) {
        admin = admin_;
        verifier = IVerifier2(verifier_);
    }

    function create(bytes32 id, string calldata question, uint64 closeTs) external onlyAdmin {
        require(!_exists[id], "market exists");
        require(closeTs > block.timestamp, "invalid close time");
        _markets[id] = MarketData(id, question, closeTs, Status.Trading, OUTCOME_INVALID);
        _exists[id] = true;
        _registry.push(id);
        emit MarketCreated(id, closeTs);
    }

    /// Create a market whose outcome settles from a price oracle —
    /// "Will BTC be >= $100k at close?".
    function createPriceMarket(
        bytes32 id,
        string calldata question,
        uint64 closeTs,
        address oracle,
        bytes32 oracleAsset,
        int256 threshold,
        uint32 op,
        uint64 maxStaleness
    ) external onlyAdmin {
        require(!_exists[id], "market exists");
        require(closeTs > block.timestamp, "invalid close time");
        require(op <= OP_LT, "invalid op");
        _markets[id] = MarketData(id, question, closeTs, Status.Trading, OUTCOME_INVALID);
        _exists[id] = true;
        _oracleSpec[id] = OracleSpec(oracle, oracleAsset, threshold, op, maxStaleness, true);
        _registry.push(id);
        emit MarketCreated(id, closeTs);
    }

    /// Permissionless oracle settlement: after close, anyone can settle by
    /// reading the oracle price and applying the market's rule.
    function resolveFromOracle(bytes32 id) external returns (uint32) {
        MarketData storage m = _markets[id];
        require(_exists[id], "market not found");
        require(m.status != Status.Resolved, "already resolved");
        require(block.timestamp >= m.closeTs, "too early");
        OracleSpec memory spec = _oracleSpec[id];
        require(spec.set, "no oracle");

        (int256 price, uint64 ts) = IOracle(spec.oracle).lastPrice(spec.asset);
        require(block.timestamp - ts <= spec.maxStaleness, "stale price");

        bool yes = spec.op == OP_GTE ? price >= spec.threshold : price < spec.threshold;
        uint32 outcome = yes ? OUTCOME_YES : OUTCOME_NO;
        m.status = Status.Resolved;
        m.outcome = outcome;
        emit MarketResolved(id, outcome);
        return outcome;
    }

    function beginResolution(bytes32 id) external onlyAdmin {
        MarketData storage m = _markets[id];
        require(_exists[id], "market not found");
        require(m.status == Status.Trading, "not trading");
        require(block.timestamp >= m.closeTs, "too early");
        m.status = Status.Resolving;
    }

    /// Admin-attested resolution (v1). Requires `beginResolution` first.
    function resolve(bytes32 id, uint32 outcome) external onlyAdmin {
        _finalize(id, outcome);
    }

    /// ZK-attested resolution: finalize iff `proof` verifies against the
    /// domain-bound Groth16 statement. No admin auth — the proof is the
    /// authority. `pubSignals = [domain, outcomeWitness]`.
    function resolveWithProof(
        bytes32 id,
        uint32 outcome,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata pubSignals
    ) external {
        require(verifier.verifyProof(a, b, c, pubSignals), "proof rejected");
        _finalize(id, outcome);
    }

    // ── Views consumed by escrow / confidential-bet ──────────────────────────

    function isResolved(bytes32 id) external view returns (bool) {
        return _exists[id] && _markets[id].status == Status.Resolved;
    }

    function winningOutcome(bytes32 id) external view returns (uint32) {
        require(_exists[id], "market not found");
        require(_markets[id].status == Status.Resolved, "not resolved");
        return _markets[id].outcome;
    }

    function getMarket(bytes32 id) external view returns (MarketData memory) {
        require(_exists[id], "market not found");
        return _markets[id];
    }

    function markets() external view returns (bytes32[] memory) {
        return _registry;
    }

    function marketCount() external view returns (uint256) {
        return _registry.length;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _finalize(bytes32 id, uint32 outcome) internal {
        require(_exists[id], "market not found");
        require(outcome <= OUTCOME_INVALID, "invalid outcome");
        MarketData storage m = _markets[id];
        // Allow admin resolve directly from Trading OR Resolving for demo ergonomics.
        require(m.status != Status.Resolved, "already resolved");
        m.status = Status.Resolved;
        m.outcome = outcome;
        emit MarketResolved(id, outcome);
    }
}
