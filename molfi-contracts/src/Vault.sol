// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IMolfi.sol";

/// @title Molfi LP Vault — a real yield-bearing vault (ERC-4626-style)
/// @notice Liquidity providers deposit mUSDC and receive vault **shares**. The 2%
///         protocol trading fee that `PredictEscrow` routes here on every redeem
///         accrues to the vault's assets, lifting NAV per share — so LPs earn
///         **real yield from real bet volume**. Withdraw burns shares for the
///         current pro-rata asset value (principal + accrued fees).
///
/// Share math uses a virtual offset (OpenZeppelin-style) to blunt the classic
/// first-depositor inflation/donation attack. Testnet asset is mUSDC (6 dp).
contract Vault {
    IERC20 public immutable asset; // mUSDC
    address public admin;

    string public constant name = "Molfi LP Vault";
    string public constant symbol = "mLP";
    uint8 public constant decimals = 6;

    uint256 public totalShares;
    mapping(address => uint256) public shares;
    /// Net principal an LP has deposited (for PnL display; not used in share math).
    mapping(address => uint256) public principal;

    // Virtual shares/assets offset — makes share price manipulation uneconomical.
    uint256 private constant VIRTUAL_SHARES = 1e6;
    uint256 private constant VIRTUAL_ASSETS = 1;

    event Deposit(address indexed lp, uint256 assets, uint256 sharesMinted);
    event Withdraw(address indexed lp, uint256 assets, uint256 sharesBurned);

    constructor(address admin_, address asset_) {
        admin = admin_;
        asset = IERC20(asset_);
    }

    /// Total mUSDC controlled by the vault — LP principal + accrued protocol fees.
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return (assets * (totalShares + VIRTUAL_SHARES)) / (totalAssets() + VIRTUAL_ASSETS);
    }

    function convertToAssets(uint256 shares_) public view returns (uint256) {
        return (shares_ * (totalAssets() + VIRTUAL_ASSETS)) / (totalShares + VIRTUAL_SHARES);
    }

    /// Deposit `assets` mUSDC (caller must approve first) → mint shares at NAV.
    function deposit(uint256 assets) external returns (uint256 minted) {
        require(assets > 0, "zero deposit");
        minted = convertToShares(assets);
        require(minted > 0, "no shares minted");
        require(asset.transferFrom(msg.sender, address(this), assets), "transfer failed");
        totalShares += minted;
        shares[msg.sender] += minted;
        principal[msg.sender] += assets;
        emit Deposit(msg.sender, assets, minted);
    }

    /// Burn `shares_` → withdraw the current pro-rata asset value (incl. yield).
    function withdraw(uint256 shares_) external returns (uint256 assets) {
        uint256 bal = shares[msg.sender];
        require(shares_ > 0 && bal >= shares_, "insufficient shares");
        assets = convertToAssets(shares_);
        // Retire principal in proportion to the shares burned (for PnL display).
        uint256 pOut = (principal[msg.sender] * shares_) / bal;
        principal[msg.sender] -= pOut;
        shares[msg.sender] = bal - shares_;
        totalShares -= shares_;
        require(asset.transfer(msg.sender, assets), "payout failed");
        emit Withdraw(msg.sender, assets, shares_);
    }

    /// Withdraw everything for the caller.
    function withdrawAll() external returns (uint256) {
        uint256 bal = shares[msg.sender];
        require(bal > 0, "no position");
        uint256 assets = convertToAssets(bal);
        principal[msg.sender] = 0;
        shares[msg.sender] = 0;
        totalShares -= bal;
        require(asset.transfer(msg.sender, assets), "payout failed");
        emit Withdraw(msg.sender, assets, bal);
        return assets;
    }

    // ── Views for the UI ─────────────────────────────────────────────────────

    /// Current asset value of an LP's shares (principal + their share of fees).
    function assetsOf(address lp) external view returns (uint256) {
        return convertToAssets(shares[lp]);
    }

    /// NAV per share, scaled by 1e6 (starts at ~1.000000, rises with accrued fees).
    function sharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e6;
        return (totalAssets() * 1e12) / totalShares;
    }

    /// Accrued yield for an LP = current value − net principal (0 if underwater).
    function earnedOf(address lp) external view returns (uint256) {
        uint256 val = convertToAssets(shares[lp]);
        uint256 p = principal[lp];
        return val > p ? val - p : 0;
    }

    function balanceOf(address lp) external view returns (uint256) {
        return shares[lp];
    }

    function balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
