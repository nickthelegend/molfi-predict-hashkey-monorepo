// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title mUSDC — Molfi's testnet stablecoin (HashKey Chain)
/// @notice Minimal ERC-20 with an OPEN `faucet` anyone can call to receive test
///         mUSDC, plus an admin `mint` to seed liquidity. Testnet only — no real
///         value. an ERC-20 with a public faucet (6 dp).
contract MockUSDC {
    string public constant name = "Molfi USD";
    string public constant symbol = "mUSDC";
    uint8 public constant decimals = 6;

    /// 10,000 mUSDC per faucet claim (6 decimals).
    uint256 public constant FAUCET_AMOUNT = 10_000 * 1e6;

    address public admin;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Faucet(address indexed to, uint256 value);

    constructor(address admin_) {
        admin = admin_;
    }

    /// Open faucet — anyone can claim test mUSDC to `to`.
    function faucet(address to) external {
        _mint(to, FAUCET_AMOUNT);
        emit Faucet(to, FAUCET_AMOUNT);
    }

    /// Admin mint (e.g. to seed liquidity / vault).
    function mint(address to, uint256 amount) external {
        require(msg.sender == admin, "not admin");
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "insufficient allowance");
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function burn(uint256 amount) external {
        uint256 bal = balanceOf[msg.sender];
        require(bal >= amount, "insufficient balance");
        balanceOf[msg.sender] = bal - amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 bal = balanceOf[from];
        require(bal >= amount, "insufficient balance");
        unchecked {
            balanceOf[from] = bal - amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        unchecked {
            balanceOf[to] += amount;
        }
        emit Transfer(address(0), to, amount);
    }
}
