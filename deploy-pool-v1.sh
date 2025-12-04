#!/bin/bash

# Pool v1 Deployment Quick Start
# This script provides a guided deployment process for the BTCD staking pool v1

set -e

echo "=========================================="
echo "Pool v1 Deployment Quick Start"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠ PostgreSQL client not found (optional)${NC}"
else
    echo -e "${GREEN}✓ PostgreSQL client found${NC}"
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}✗ npx not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npx found${NC}"

echo ""

# Check .env file
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠ backend/.env not found${NC}"
    echo "Creating from .env.example..."
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}Please edit backend/.env with your configuration${NC}"
    echo ""
    read -p "Press enter when ready to continue..."
fi

# Load environment
source backend/.env 2>/dev/null || true

# Check required variables
echo "Checking required environment variables..."

if [ -z "$BTCD_TOKEN_ADDRESS" ] || [ "$BTCD_TOKEN_ADDRESS" = "0x0000000000000000000000000000000000000000" ]; then
    echo -e "${RED}✗ BTCD_TOKEN_ADDRESS not set in backend/.env${NC}"
    exit 1
fi
echo -e "${GREEN}✓ BTCD_TOKEN_ADDRESS set${NC}"

if [ -z "$ADMIN_PRIVATE_KEY" ] || [ "$ADMIN_PRIVATE_KEY" = "0xYOUR_PRIVATE_KEY" ]; then
    echo -e "${RED}✗ ADMIN_PRIVATE_KEY not set in backend/.env${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ADMIN_PRIVATE_KEY set${NC}"

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠ DATABASE_URL not set, using default${NC}"
fi

echo ""

# Deployment menu
echo "=========================================="
echo "Deployment Steps"
echo "=========================================="
echo "1. Deploy smart contracts"
echo "2. Initialize backend database"
echo "3. Fund pool rewards"
echo "4. Complete deployment (all steps)"
echo "5. Exit"
echo ""

read -p "Select option [1-5]: " choice

case $choice in
    1)
        echo ""
        echo "=========================================="
        echo "Step 1: Deploy Smart Contracts"
        echo "=========================================="
        echo ""
        echo "This will deploy:"
        echo "  - RiskEngine"
        echo "  - RewardDistributor"
        echo "  - Pool (vBTCD)"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Cancelled."
            exit 0
        fi
        
        cd contracts
        npm run deploy:pool
        cd ..
        
        echo ""
        echo -e "${GREEN}✓ Contracts deployed!${NC}"
        echo ""
        echo -e "${YELLOW}IMPORTANT: Update backend/.env with contract addresses!${NC}"
        echo ""
        ;;
        
    2)
        echo ""
        echo "=========================================="
        echo "Step 2: Initialize Backend Database"
        echo "=========================================="
        echo ""
        
        if [ -z "$POOL_CONTRACT_ADDRESS" ] || [ "$POOL_CONTRACT_ADDRESS" = "0x0000000000000000000000000000000000000000" ]; then
            echo -e "${RED}✗ POOL_CONTRACT_ADDRESS not set in backend/.env${NC}"
            echo "Please run step 1 first and update .env"
            exit 1
        fi
        
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Cancelled."
            exit 0
        fi
        
        cd backend
        npm run pool:init
        cd ..
        
        echo ""
        echo -e "${GREEN}✓ Backend initialized!${NC}"
        echo ""
        ;;
        
    3)
        echo ""
        echo "=========================================="
        echo "Step 3: Fund Pool Rewards"
        echo "=========================================="
        echo ""
        
        if [ -z "$REWARD_DISTRIBUTOR_ADDRESS" ] || [ "$REWARD_DISTRIBUTOR_ADDRESS" = "0x0000000000000000000000000000000000000000" ]; then
            echo -e "${RED}✗ REWARD_DISTRIBUTOR_ADDRESS not set in backend/.env${NC}"
            echo "Please run step 1 first and update .env"
            exit 1
        fi
        
        read -p "Amount of BTCD to fund: " amount
        
        if [ -z "$amount" ]; then
            echo -e "${RED}✗ Amount required${NC}"
            exit 1
        fi
        
        read -p "Fund $amount BTCD? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Cancelled."
            exit 0
        fi
        
        cd backend
        npm run pool:fund "$amount"
        cd ..
        
        echo ""
        echo -e "${GREEN}✓ Pool funded!${NC}"
        echo ""
        ;;
        
    4)
        echo ""
        echo "=========================================="
        echo "Complete Deployment"
        echo "=========================================="
        echo ""
        echo "This will run all deployment steps:"
        echo "  1. Deploy contracts"
        echo "  2. Initialize backend"
        echo "  3. Fund pool rewards"
        echo ""
        read -p "Continue? (y/n): " confirm
        if [ "$confirm" != "y" ]; then
            echo "Cancelled."
            exit 0
        fi
        
        # Step 1: Deploy contracts
        echo ""
        echo ">>> Step 1/3: Deploying contracts..."
        cd contracts
        npm run deploy:pool
        cd ..
        echo -e "${GREEN}✓ Step 1 complete${NC}"
        
        echo ""
        echo -e "${YELLOW}Please update backend/.env with the contract addresses shown above${NC}"
        read -p "Press enter when ready to continue..."
        
        # Reload environment
        source backend/.env 2>/dev/null || true
        
        # Step 2: Initialize backend
        echo ""
        echo ">>> Step 2/3: Initializing backend..."
        cd backend
        npm run pool:init
        cd ..
        echo -e "${GREEN}✓ Step 2 complete${NC}"
        
        # Step 3: Fund rewards
        echo ""
        echo ">>> Step 3/3: Funding rewards..."
        read -p "Amount of BTCD to fund: " amount
        
        if [ -z "$amount" ]; then
            echo -e "${YELLOW}⚠ Skipping funding step${NC}"
        else
            cd backend
            npm run pool:fund "$amount"
            cd ..
            echo -e "${GREEN}✓ Step 3 complete${NC}"
        fi
        
        echo ""
        echo "=========================================="
        echo -e "${GREEN}✓ Deployment Complete!${NC}"
        echo "=========================================="
        echo ""
        echo "Next steps:"
        echo "  1. Test deposit/withdraw functionality"
        echo "  2. Set up monitoring"
        echo "  3. Configure frontend with contract addresses"
        echo ""
        echo "See docs/POOL_V1_DEPLOYMENT.md for detailed testing instructions."
        echo ""
        ;;
        
    5)
        echo "Exiting."
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Deployment script complete"
echo "=========================================="
