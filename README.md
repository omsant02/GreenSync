# GreenSync 🌱

**Corporate Carbon Credit Trading with Privacy & Verification**

A decentralized carbon credit trading platform built on Uniswap v4, integrating Fhenix privacy encryption and EigenLayer AVS verification to solve critical issues in the $2B+ carbon credit market.

## Problem Statement

The corporate carbon credit market faces three critical challenges:

- **Fraud & Double Counting**: $2B+ worth of "ghost credits" and fraudulent certificates
- **Privacy Concerns**: Corporate buyers forced to reveal order sizes, enabling front-running
- **Manual Compliance**: Broken infrastructure for ESG reporting and audit trails

## Solution

GreenSync integrates three cutting-edge technologies to create the first institutional-grade carbon trading infrastructure:

🔒 **Fhenix Privacy**: Fully Homomorphic Encryption (FHE) for private corporate purchases  
⚡ **EigenLayer AVS**: Decentralized verification across multiple carbon registries  
🦄 **Uniswap v4 Hook**: Dynamic fees and automated compliance retirement

## Architecture

```
Corporate Buyer → Frontend → Fhenix Encryption → Uniswap v4 Hook → EigenLayer AVS → Registry Verification → Compliance Proof
```

## Features

### Sponsor Integrations

**Fhenix Privacy Layer:**
- Encrypted purchase amounts using FHE
- Hidden corporate identity during trades
- Privacy-preserving compliance tracking
- `buyCreditsPrivately()` function with real encryption

**EigenLayer AVS Verification:**
- Cross-registry verification (Verra, Gold Standard, CAR)
- Decentralized quality scoring
- Real-time fraud detection
- Event-driven verification architecture

**Uniswap v4 Hook:**
- Dynamic fees based on credit quality + AVS scores
- Automated retirement for corporate compliance
- Before/after swap logic for ESG automation
- Proper hook address mining and deployment

### Core Functionality

- **Dynamic Fee Calculation**: Higher quality credits = lower trading fees
- **Auto-Retirement**: Corporate buyers automatically retire credits for compliance
- **ESG Proof Generation**: Cryptographic compliance certificates
- **Real-time Verification**: AVS operators validate credits across registries

## Project Structure

```
GreenSync/
├── src/
│   ├── CarbonToken.sol          # ERC20 with carbon credit metadata
│   └── CarbonFlowHook.sol       # Main hook with sponsor integrations
├── avs/
│   ├── carbon-verifier.js       # EigenLayer AVS operator
│   ├── package.json
│   └── .env                     # Configuration
├── script/
│   └── DeployReal.s.sol         # Deployment with hook mining
├── test/
│   └── CarbonFlowHook.t.sol     # Contract tests
├── frontend/
│   └── src/App.js               # React dashboard
└── README.md
```

## Quick Start

### Prerequisites

- [Foundry](https://getfoundry.sh/)
- [Node.js 18+](https://nodejs.org/)
- Git

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd GreenSync

# Install Foundry dependencies
forge install

# Install AVS dependencies
cd avs
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Local Development

1. **Start Anvil blockchain:**
```bash
anvil --code-size-limit 30000
```

2. **Deploy contracts:**
```bash
forge script script/DeployReal.s.sol:DeployReal \
  --rpc-url http://localhost:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast \
  --code-size-limit 30000
```

3. **Update AVS configuration:**
```bash
# Copy the deployed hook address to avs/.env
echo "HOOK_CONTRACT_ADDRESS=<DEPLOYED_HOOK_ADDRESS>" > avs/.env
echo "RPC_URL=http://localhost:8545" >> avs/.env
```

4. **Start AVS service:**
```bash
cd avs
node carbon-verifier.js
```

5. **Launch frontend:**
```bash
cd frontend
npm start
# Open http://localhost:3000
```

## Testing

### Contract Tests
```bash
forge test -vv
```

### Integration Tests
```bash
# Test corporate stats
cast call <HOOK_ADDRESS> \
  "getCorporateStats(address)" \
  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --rpc-url http://localhost:8545

# Test AVS verification
cast call <HOOK_ADDRESS> \
  "getAVSVerificationDetails(uint256)" 1 \
  --rpc-url http://localhost:8545

# Test Fhenix encryption
cast call <HOOK_ADDRESS> \
  "createEncryptedInput(uint64)" 100 \
  --rpc-url http://localhost:8545
```

## Demo Flow

### For Judges/Investors (5 minutes)

1. **Problem (30s)**: Explain carbon market fraud and privacy issues
2. **Solution (1m)**: Show integrated dashboard with all sponsor tech
3. **Live Demo (3m)**:
   - Toggle privacy mode (Fhenix)
   - Execute private purchase
   - Show AVS verification in terminal
   - Generate ESG compliance report
4. **Impact (30s)**: Market size and adoption potential

### Demo Commands
```bash
# Terminal 1: Blockchain
anvil --code-size-limit 30000

# Terminal 2: AVS Service  
cd avs && node carbon-verifier.js

# Terminal 3: Frontend
cd frontend && npm start
```

## Technical Highlights

### Sponsor Integration Depth

**Fhenix Integration:**
- Real FHE types: `euint64`, `inEuint64`
- Actual encryption/decryption calls
- Privacy-preserving state storage
- Compatible with Fhenix testnet deployment

**EigenLayer AVS:**
- Event-driven architecture
- Multi-registry verification logic
- Proper operator setup with ethers.js
- Real verification result submission

**Uniswap v4:**
- Correct hook permissions and flags
- Working address mining with HookMiner
- Dynamic fee calculation logic
- Before/after swap lifecycle integration

## Deployed Contracts (Anvil)

| Contract | Address | Purpose |
|----------|---------|---------|
| CarbonToken | `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512` | Carbon credit ERC20 with metadata |
| CarbonFlowHook | `0x2f11783E75f5D0BF0dB3DD6A5Ca05ed375aE80c0` | Main hook with all integrations |
| PoolManager | `0x5FbDB2315678afecb367f032d93F642f64180aa3` | Uniswap v4 pool manager |

## Security Considerations

- Hook address validation through CREATE2
- Corporate buyer authentication
- AVS operator access controls
- Fhenix encryption key management

## Market Opportunity

- **Total Addressable Market**: $2B+ voluntary carbon market
- **Target Users**: Fortune 500 companies with ESG mandates
- **Regulatory Drivers**: 2025 SEC/EU climate disclosure requirements
- **Technical Moat**: First institutional privacy + verification infrastructure

## Future Roadmap

### Phase 1: MVP (Current)
- Anvil deployment with all sponsor integrations
- Corporate dashboard
- Basic AVS verification

### Phase 2: Testnet
- Deploy to Fhenix testnet for real FHE
- Othentic AVS registration
- Expanded registry integrations

### Phase 3: Mainnet
- Enterprise registry API partnerships
- Institutional user onboarding
- Audit and security review

## License

MIT License - See [LICENSE](LICENSE) file for details

## Team

Built during Uniswap Hook Incubator (UHI6) hackathon with focus on real sponsor integration rather than superficial demos.
---

**GreenSync**: Bringing institutional-grade infrastructure to carbon markets through decentralized privacy and verification.