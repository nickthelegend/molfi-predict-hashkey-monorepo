// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IMolfi.sol";

/// @title Molfi LP / fee Vault
/// @notice Sink for the 2% protocol fee routed by `PredictEscrow` on redeem.
///         Holds mUSDC; admin can sweep. Minimal by design — the escrow just
///         `transfer`s fees to this address.
contract Vault {
    address public admin;

    event Swept(address indexed token, address indexed to, uint256 amount);

    constructor(address admin_) {
        admin = admin_;
    }

    function sweep(address token, address to, uint256 amount) external {
        require(msg.sender == admin, "not admin");
        IERC20(token).transfer(to, amount);
        emit Swept(token, to, amount);
    }

    function balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
