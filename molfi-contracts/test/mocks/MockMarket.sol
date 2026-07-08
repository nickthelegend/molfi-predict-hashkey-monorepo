// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Minimal IMarket stand-in for escrow / confidential-bet tests: lets a test set
/// resolution state directly without driving the full Market lifecycle.
contract MockMarket {
    mapping(bytes32 => bool) public resolved;
    mapping(bytes32 => uint32) public outcome;

    function setResolved(bytes32 id, uint32 win) external {
        resolved[id] = true;
        outcome[id] = win;
    }

    function isResolved(bytes32 id) external view returns (bool) {
        return resolved[id];
    }

    function winningOutcome(bytes32 id) external view returns (uint32) {
        require(resolved[id], "not resolved");
        return outcome[id];
    }
}
