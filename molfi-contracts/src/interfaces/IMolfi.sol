// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal ERC-20 surface used across Molfi contracts.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// snarkjs Groth16 verifier with 2 public signals ([domain, x]).
interface IVerifier2 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[2] calldata pubSignals
    ) external view returns (bool);
}

/// snarkjs Groth16 verifier with 4 public signals.
interface IVerifier4 {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[4] calldata pubSignals
    ) external view returns (bool);
}

/// Molfi market resolution surface consumed by escrow / confidential-bet.
interface IMarket {
    function isResolved(bytes32 id) external view returns (bool);
    function winningOutcome(bytes32 id) external view returns (uint32);
}

/// Multi-asset push price oracle.
interface IOracle {
    function lastPrice(bytes32 asset) external view returns (int256 price, uint64 timestamp);
    function decimals() external view returns (uint8);
}
