// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// IOracle stand-in whose `lastPrice` returns an explicitly-set (potentially old)
/// timestamp — unlike MockOracle which always stamps the current block time — so
/// Market.resolveFromOracle's staleness guard can be exercised.
contract MockStaleOracle {
    int256 public price;
    uint64 public ts;

    function set(int256 price_, uint64 ts_) external {
        price = price_;
        ts = ts_;
    }

    function lastPrice(bytes32) external view returns (int256, uint64) {
        return (price, ts);
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }
}
