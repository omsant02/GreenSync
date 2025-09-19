#!/bin/bash

echo "🌱 GreenSync Auto-Deploy and Update"
echo "===================================="

# Check if Anvil is running
if ! curl -s http://localhost:8545 > /dev/null; then
    echo "❌ Anvil not running. Please start Anvil first:"
    echo "anvil --code-size-limit 30000"
    exit 1
fi

echo "✅ Anvil is running"

# Deploy contracts and capture the full output
echo "📦 Deploying contracts..."
DEPLOY_OUTPUT=$(forge script script/DeployReal.s.sol:DeployReal \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast \
  --code-size-limit 30000 2>&1)

echo "$DEPLOY_OUTPUT"

# Check if deployment was successful
if echo "$DEPLOY_OUTPUT" | grep -q "DEPLOYMENT SUCCESS"; then
    echo ""
    echo "✅ Deployment successful!"
    
    # Extract the hook address from the specific line
    HOOK_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "HOOK_CONTRACT_ADDRESS=" | cut -d'=' -f2)
    
    if [ -n "$HOOK_ADDRESS" ]; then
        echo "📋 Found Hook Address: $HOOK_ADDRESS"
        
        # Update AVS .env file automatically
        echo "🔧 Updating AVS .env file..."
        cat > avs/.env << EOF
HOOK_CONTRACT_ADDRESS=$HOOK_ADDRESS
RPC_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
VERRA_API_KEY=demo_key
GOLD_STANDARD_API_KEY=demo_key
CLIMATE_ACTION_API_KEY=demo_key
EOF
        
        echo "✅ AVS .env updated with: $HOOK_ADDRESS"
        
        # Test the contract connection
        echo ""
        echo "🧪 Testing contract connection..."
        
        if cast call $HOOK_ADDRESS "getCorporateStats(address)" 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 --rpc-url http://localhost:8545 > /dev/null 2>&1; then
            echo "✅ Hook contract responding"
        else
            echo "❌ Hook contract not responding"
        fi
        
        echo ""
        echo "🚀 Ready to run AVS service!"
        echo ""
        echo "Next steps:"
        echo "1. Terminal 2: cd avs && node carbon-verifier.js"
        echo "2. Terminal 3: cd frontend && python3 -m http.server 3000"
        
    else
        echo "❌ Could not extract hook address from deployment output"
        echo "Please manually update avs/.env with the hook address"
    fi
    
else
    echo "❌ Deployment failed or incomplete"
    echo "Please check the error messages above"
fi
