// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20, IMarket, IVerifier2} from "./interfaces/IMolfi.sol";

/// @title Molfi Predict Escrow
/// @notice Pari-mutuel binary (YES/NO) betting with **real mUSDC at stake** —
///         the on-chain core an agent or user calls to put money on a market.
///        
///
/// 1. `bet` / `betZk` — escrow `amount` mUSDC on an outcome. `betZk` additionally
///    gates the bet on a Groth16 **solvency** proof (prove hidden collateral >=
///    threshold) verified on-chain, and burns the proof's domain as a single-use
///    nullifier (anti-replay / privacy-set membership).
/// 2. Resolution — the `Market` contract decides the winning outcome; this
///    contract never decides outcomes itself, it reads `market.winningOutcome`.
/// 3. `redeem` — a winner claims a pro-rata share of the WHOLE pot
///    (stake * total_pool / winning_pool). A 2% protocol fee goes to the `vault`.
contract PredictEscrow {
    uint32 public constant OUTCOME_YES = 0;
    uint32 public constant OUTCOME_NO = 1;

    /// Protocol fee on winnings, in basis points (2%).
    uint256 public constant FEE_BPS = 200;
    uint256 private constant BPS_DENOM = 10_000;

    address public admin;
    IERC20 public musdc;
    address public vault;
    IVerifier2 public verifier; // SolvencyVerifier ([domain, threshold])
    IMarket public market;

    // (market, outcome) => total escrowed.
    mapping(bytes32 => mapping(uint32 => uint256)) public pool;
    // market => total escrowed (both sides).
    mapping(bytes32 => uint256) public total;
    // (market, outcome, bettor) => stake.
    mapping(bytes32 => mapping(uint32 => mapping(address => uint256))) public position;
    // (market, bettor) => redeemed?
    mapping(bytes32 => mapping(address => bool)) public redeemed;
    // consumed ZK nullifiers (domain of the solvency proof).
    mapping(uint256 => bool) public nullifierUsed;

    event Bet(bytes32 indexed marketId, address indexed bettor, uint32 outcome, uint256 amount);
    event Redeemed(bytes32 indexed marketId, address indexed bettor, uint256 net);

    constructor(address admin_, address musdc_, address vault_, address verifier_, address market_) {
        admin = admin_;
        musdc = IERC20(musdc_);
        vault = vault_;
        verifier = IVerifier2(verifier_);
        market = IMarket(market_);
    }

    /// Simple, agent-friendly path — no proof required.
    /// Caller must have approved this contract for `amount` mUSDC.
    function bet(bytes32 marketId, uint32 outcome, uint256 amount) external {
        _escrowBet(marketId, msg.sender, outcome, amount);
    }

    /// Privacy-gated bet: identical escrow, but only succeeds if `proof` verifies
    /// a **solvency** statement (hidden balance >= threshold) against the on-chain
    /// verifier. `pubSignals = [domain, threshold]`. The domain is burned as a
    /// single-use nullifier so a proof can't be replayed — this is how an agent
    /// proves eligibility in the privacy set without revealing its balance.
    function betZk(
        bytes32 marketId,
        uint32 outcome,
        uint256 amount,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata pubSignals
    ) external {
        uint256 domain = pubSignals[0];
        require(!nullifierUsed[domain], "nullifier used");
        require(verifier.verifyProof(a, b, c, pubSignals), "proof rejected");
        nullifierUsed[domain] = true;
        _escrowBet(marketId, msg.sender, outcome, amount);
    }

    /// Claim winnings after the market resolves. Pays the bettor's pro-rata share
    /// of the whole pot, minus a 2% fee routed to the vault. Returns net paid.
    function redeem(bytes32 marketId) external returns (uint256) {
        require(!redeemed[marketId][msg.sender], "already redeemed");
        require(market.isResolved(marketId), "market not resolved");
        uint32 win = market.winningOutcome(marketId);

        uint256 stake = position[marketId][win][msg.sender];
        require(stake > 0, "nothing to redeem");
        uint256 winningPool = pool[marketId][win];
        uint256 pot = total[marketId];

        // Pari-mutuel: winners split the entire pot in proportion to stake.
        uint256 gross = (stake * pot) / winningPool;
        uint256 fee = (gross * FEE_BPS) / BPS_DENOM;
        uint256 net = gross - fee;

        redeemed[marketId][msg.sender] = true;
        position[marketId][win][msg.sender] = 0;

        require(musdc.transfer(msg.sender, net), "payout failed");
        if (fee > 0) {
            require(musdc.transfer(vault, fee), "fee failed");
        }
        emit Redeemed(marketId, msg.sender, net);
        return net;
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function config() external view returns (address, address, address, address) {
        return (address(musdc), vault, address(verifier), address(market));
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _escrowBet(bytes32 marketId, address bettor, uint32 outcome, uint256 amount) internal {
        require(amount > 0, "invalid amount");
        require(outcome == OUTCOME_YES || outcome == OUTCOME_NO, "invalid outcome");

        // Pull real mUSDC into escrow (bettor must have approved).
        require(musdc.transferFrom(bettor, address(this), amount), "transfer failed");

        pool[marketId][outcome] += amount;
        total[marketId] += amount;
        position[marketId][outcome][bettor] += amount;

        emit Bet(marketId, bettor, outcome, amount);
    }
}
