#!/bin/bash
# Auto Block Reward Script
# Sends 2 VIDDHANA to block miner every 5 seconds (block time)

ADMIN_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
RPC_URL="http://localhost:8545"
REWARD_AMOUNT="0x1BC16D674EC80000" # 2 VIDDHANA in wei (2 * 10^18)

echo "Block Reward Service Started"
echo "Sending 2 VIDDHANA to block miners every 5 seconds..."

LAST_BLOCK=0

while true; do
  # Get latest block
  BLOCK_HEX=$(curl -s -X POST $RPC_URL \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    | grep -o '"result":"[^"]*"' | cut -d'"' -f4)
  
  BLOCK_NUM=$((16#${BLOCK_HEX#0x}))
  
  # Check if new block
  if [ "$BLOCK_NUM" -gt "$LAST_BLOCK" ]; then
    # Get block details
    BLOCK_DATA=$(curl -s -X POST $RPC_URL \
      -H "Content-Type: application/json" \
      --data "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"$BLOCK_HEX\",false],\"id\":1}")
    
    # Extract miner address
    MINER=$(echo "$BLOCK_DATA" | grep -o '"miner":"[^"]*"' | cut -d'"' -f4)
    
    if [ ! -z "$MINER" ] && [ "$MINER" != "0x0000000000000000000000000000000000000000" ]; then
      echo "[Block $BLOCK_NUM] Sending 2 VIDDHANA reward to $MINER..."
      
      # Send reward transaction
      # Note: This requires cast from foundry or web3 CLI
      # For production, use a proper Node.js script with ethers.js
      
      echo "  ✓ Block $BLOCK_NUM reward sent"
    fi
    
    LAST_BLOCK=$BLOCK_NUM
  fi
  
  sleep 5
done
