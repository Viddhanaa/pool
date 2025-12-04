#!/bin/bash
#
# Create Test Miners for Load Testing
# Creates authenticated miners with JWT tokens for comprehensive testing
#

set -e

API_URL="http://localhost:4000"
WALLET_PREFIX="0x1111111111111111111111111111111111111"

echo "=========================================="
echo "   CREATING TEST MINERS"
echo "=========================================="
echo ""

# Array to store miner IDs and tokens
declare -a MINER_IDS
declare -a TOKENS

# Create 100 test miners
for i in {1..100}; do
    # Pad number to 3 digits (001, 002, etc)
    NUM=$(printf "%03d" $i)
    WALLET="${WALLET_PREFIX}${NUM}"
    
    echo -n "Creating miner ${i}/100 (${WALLET})... "
    
    # Register miner
    RESPONSE=$(curl -s -X POST "${API_URL}/api/miner/register" \
        -H "Content-Type: application/json" \
        -d "{\"wallet_address\":\"${WALLET}\",\"device_type\":\"load-test\"}" 2>&1)
    
    if echo "$RESPONSE" | grep -q "token"; then
        TOKEN=$(echo "$RESPONSE" | jq -r '.token' 2>/dev/null || echo "")
        MINER_ID=$(echo "$RESPONSE" | jq -r '.miner_id' 2>/dev/null || echo "")
        
        if [ -n "$TOKEN" ] && [ -n "$MINER_ID" ]; then
            MINER_IDS+=("$MINER_ID")
            TOKENS+=("$TOKEN")
            echo "✓ ID: ${MINER_ID}"
        else
            echo "⚠ Partial success"
        fi
    else
        echo "✗ Failed"
    fi
    
    # Small delay to avoid rate limiting
    sleep 0.1
done

echo ""
echo "=========================================="
echo "   TEST MINERS CREATED"
echo "=========================================="
echo ""
echo "Total miners created: ${#MINER_IDS[@]}"
echo ""

# Save to file for other tests to use
cat > /tmp/test-miners.json <<EOF
{
  "miners": [
EOF

for i in "${!MINER_IDS[@]}"; do
    if [ $i -gt 0 ]; then
        echo "," >> /tmp/test-miners.json
    fi
    cat >> /tmp/test-miners.json <<EOF
    {
      "id": ${MINER_IDS[$i]},
      "token": "${TOKENS[$i]}",
      "wallet": "${WALLET_PREFIX}$(printf "%03d" $((i+1)))"
    }
EOF
done

cat >> /tmp/test-miners.json <<EOF

  ]
}
EOF

echo "Test miners data saved to: /tmp/test-miners.json"
echo ""

# Display sample
echo "Sample miners (first 5):"
head -20 /tmp/test-miners.json
echo "..."
echo ""

# Give all miners some initial balance for withdrawal tests
echo "Funding miners for withdrawal tests..."
for i in {1..10}; do
    MINER_ID=${MINER_IDS[$i-1]}
    if [ -n "$MINER_ID" ]; then
        # Simulate earning by making them active
        docker compose exec postgres psql -U postgres -d asdminer -c \
            "UPDATE miners SET balance = 10.0 WHERE id = ${MINER_ID};" \
            > /dev/null 2>&1
        echo "  ✓ Miner ${MINER_ID} funded with 10 VIDDHANA"
    fi
done

echo ""
echo "✅ Setup complete! Ready for comprehensive load testing."
echo ""
