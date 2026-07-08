// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Molfi Mock Oracle (multi-asset push price oracle)
/// @notice A minimal push price oracle for demos and tests. `setPrice` (admin)
///         sets the quote per asset; `lastPrice` returns it stamped with the
///         current block time so it is never considered stale. The Molfi `Market`
///         contract's `resolveFromOracle` reads this as a standard multi-asset push feed (asset = keccak256 of the symbol).
///
/// On production you would point markets at a real feed (e.g. a Chainlink data
/// feed on HashKey); this keeps the on-chain resolution path identical and fully
/// demonstrable without depending on external feed availability.
contract MockOracle {
    address public admin;
    uint8 public decimals;

    mapping(bytes32 => int256) private _price;
    mapping(bytes32 => uint64) private _updatedAt;

    event PriceSet(bytes32 indexed asset, int256 price, uint64 timestamp);

    constructor(address admin_, uint8 decimals_) {
        admin = admin_;
        decimals = decimals_;
    }

    /// Asset id for a ticker symbol, e.g. asset("BTC").
    function asset(string calldata symbol) external pure returns (bytes32) {
        return keccak256(bytes(symbol));
    }

    /// Admin sets the latest price for `asset` (scaled by `decimals`).
    function setPrice(bytes32 asset_, int256 price) external {
        require(msg.sender == admin, "not admin");
        _price[asset_] = price;
        _updatedAt[asset_] = uint64(block.timestamp);
        emit PriceSet(asset_, price, uint64(block.timestamp));
    }

    /// Oracle read: returns the stored price for `asset`, stamped at the current
    /// block time (so a freshly-set feed is never stale).
    function lastPrice(bytes32 asset_) external view returns (int256 price, uint64 timestamp) {
        return (_price[asset_], uint64(block.timestamp));
    }

    function updatedAt(bytes32 asset_) external view returns (uint64) {
        return _updatedAt[asset_];
    }
}
