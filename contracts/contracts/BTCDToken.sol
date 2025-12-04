// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BTCD Token
 * @dev Simple ERC20 token for BTCD
 */
contract BTCDToken is ERC20, Ownable {
    constructor() ERC20("BTCD Token", "BTCD") {
        // Mint 21 million BTCD (same as Bitcoin supply) to deployer
        _mint(msg.sender, 21_000_000 * 10**decimals());
    }

    /**
     * @dev Mint new tokens (only owner)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
