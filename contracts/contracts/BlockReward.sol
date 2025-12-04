// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title BlockReward Contract
 * @notice Automatically mints 2 ASD reward for block validators
 * @dev This contract is called by the consensus engine after each block
 */
contract BlockReward {
    uint256 public constant BLOCK_REWARD = 2 ether; // 2 ASD per block
    
    mapping(address => uint256) public totalRewards;
    uint256 public totalMinted;
    
    event RewardMinted(address indexed validator, uint256 amount, uint256 blockNumber);
    
    /**
     * @dev Called by the validator address at the end of each block
     * Mints 2 ASD to the block producer
     */
    function reward() external returns (bool) {
        address validator = block.coinbase;
        
        // Mint reward to validator
        totalRewards[validator] += BLOCK_REWARD;
        totalMinted += BLOCK_REWARD;
        
        // Transfer reward
        payable(validator).transfer(BLOCK_REWARD);
        
        emit RewardMinted(validator, BLOCK_REWARD, block.number);
        
        return true;
    }
    
    /**
     * @dev Fallback to fund the contract
     */
    receive() external payable {}
    
    /**
     * @dev Get validator total rewards
     */
    function getValidatorRewards(address validator) external view returns (uint256) {
        return totalRewards[validator];
    }
}
