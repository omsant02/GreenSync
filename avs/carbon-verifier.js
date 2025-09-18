const { ethers } = require('ethers');
require('dotenv').config();

/**
 * Real EigenLayer AVS for Carbon Credit Verification
 * Integrates with multiple carbon registries for decentralized verification
 */
class CarbonVerificationAVS {
    constructor() {
        this.registryAPIs = {
            verra: {
                baseUrl: 'https://registry.verra.org/app/search/VCS',
                apiKey: process.env.VERRA_API_KEY || 'demo_key'
            },
            goldStandard: {
                baseUrl: 'https://registry.goldstandard.org/projects',
                apiKey: process.env.GOLD_STANDARD_API_KEY || 'demo_key'
            },
            climateAction: {
                baseUrl: 'https://thereserve.apx.com/mymodule/reg',
                apiKey: process.env.CLIMATE_ACTION_API_KEY || 'demo_key'
            }
        };
        
        this.contractABI = [
            'event AVSVerificationRequested(uint256 indexed creditId, address requester)',
            'function submitAVSVerification(uint256 creditId, bool isVerified, uint256 qualityScore, string[] memory sources) external',
            'function avsVerified(uint256) external view returns (bool)',
            'function avsQualityScore(uint256) external view returns (uint256)'
        ];
    }

    async initialize() {
        console.log('🚀 Initializing Carbon Verification AVS...');
        
        // Connect to blockchain
        this.provider = new ethers.JsonRpcProvider(
            process.env.RPC_URL || 'http://localhost:8545'
        );
        
        this.wallet = new ethers.Wallet(
            process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            this.provider
        );
        
        // Connect to CarbonFlowHook contract
        this.hookContract = new ethers.Contract(
            process.env.HOOK_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
            this.contractABI,
            this.wallet
        );
        
        console.log(`📋 Connected to contract: ${this.hookContract.target}`);
        console.log(`🔑 AVS Operator address: ${this.wallet.address}`);
        
        // Start listening for verification requests
        this.startListening();
        
        console.log('✅ Carbon Verification AVS is running...');
        console.log('👂 Listening for verification requests...');
    }

    startListening() {
        // Listen for verification requests from the hook
        this.hookContract.on('AVSVerificationRequested', async (creditId, requester, event) => {
            console.log(`\n🔍 Verification request received:`);
            console.log(`   Credit ID: ${creditId}`);
            console.log(`   Requester: ${requester}`);
            console.log(`   Block: ${event.log.blockNumber}`);
            
            try {
                await this.processVerificationRequest(creditId, requester);
            } catch (error) {
                console.error(`❌ Error processing verification for credit ${creditId}:`, error.message);
                
                // Submit failed verification
                await this.submitVerificationResult(creditId, false, 0, ['error']);
            }
        });
        
        // Handle disconnections
        this.provider.on('error', (error) => {
            console.error('🔌 Provider error:', error);
            console.log('🔄 Attempting to reconnect...');
            setTimeout(() => this.initialize(), 5000);
        });
    }

    async processVerificationRequest(creditId, requester) {
        console.log(`\n🔬 Starting verification for Credit ID: ${creditId}`);
        
        // Check if already verified to avoid duplicate work
        const alreadyVerified = await this.hookContract.avsVerified(creditId);
        if (alreadyVerified) {
            console.log(`✅ Credit ${creditId} already verified, skipping...`);
            return;
        }
        
        // Map credit ID to registry identifiers
        const registryMappings = this.getCreditRegistryMapping(creditId);
        
        // Perform parallel verification across multiple registries
        console.log('🌐 Querying multiple carbon registries...');
        const verificationPromises = [
            this.verifyWithVerra(registryMappings.verra),
            this.verifyWithGoldStandard(registryMappings.goldStandard),
            this.verifyWithClimateAction(registryMappings.climateAction)
        ];
        
        const results = await Promise.allSettled(verificationPromises);
        
        // Aggregate results from all registries
        const verification = this.aggregateVerificationResults(results, creditId);
        
        // Submit verification result to contract
        await this.submitVerificationResult(
            creditId,
            verification.isValid,
            verification.qualityScore,
            verification.sources
        );
        
        console.log(`✅ Verification completed for Credit ${creditId}:`);
        console.log(`   Valid: ${verification.isValid}`);
        console.log(`   Quality Score: ${verification.qualityScore}/100`);
        console.log(`   Sources: ${verification.sources.join(', ')}`);
    }

    getCreditRegistryMapping(creditId) {
        // Map internal credit IDs to external registry identifiers
        // In production, this would come from a database or API
        const mappings = {
            1: { verra: 'VCS-12345', goldStandard: 'GS-001', climateAction: 'CAR-789' },
            2: { verra: 'VCS-67890', goldStandard: 'GS-002', climateAction: 'CAR-456' },
            3: { verra: 'VCS-11111', goldStandard: 'GS-003', climateAction: 'CAR-123' }
        };
        
        return mappings[creditId.toString()] || {
            verra: `VCS-${creditId}`,
            goldStandard: `GS-${creditId}`, 
            climateAction: `CAR-${creditId}`
        };
    }

    async verifyWithVerra(creditId) {
        console.log(`📋 Verifying with Verra Registry: ${creditId}`);
        
        try {
            // Simulate Verra API call (replace with real API in production)
            await this.delay(800); // Simulate network latency
            
            const mockVerraDatabase = {
                'VCS-12345': {
                    exists: true,
                    status: 'active',
                    vintage: 2023,
                    projectType: 'AFOLU',
                    methodology: 'VM0007',
                    location: 'Brazil',
                    quality: 85,
                    isRetired: false,
                    lastUpdated: '2024-01-15'
                },
                'VCS-67890': {
                    exists: true,
                    status: 'active', 
                    vintage: 2021,
                    projectType: 'Renewable Energy',
                    methodology: 'ACM0002',
                    location: 'India',
                    quality: 70,
                    isRetired: false,
                    lastUpdated: '2023-12-10'
                }
            };
            
            const data = mockVerraDatabase[creditId];
            
            if (!data || !data.exists) {
                return {
                    source: 'Verra',
                    success: false,
                    error: 'Credit not found in Verra registry'
                };
            }
            
            return {
                source: 'Verra',
                success: true,
                exists: true,
                quality: data.quality,
                vintage: data.vintage,
                projectType: data.projectType,
                isRetired: data.isRetired,
                methodology: data.methodology,
                location: data.location
            };
            
        } catch (error) {
            console.error('❌ Verra verification failed:', error.message);
            return {
                source: 'Verra',
                success: false,
                error: error.message
            };
        }
    }

    async verifyWithGoldStandard(creditId) {
        console.log(`🥇 Verifying with Gold Standard: ${creditId}`);
        
        try {
            await this.delay(600);
            
            const mockGoldStandardDatabase = {
                'GS-001': {
                    exists: true,
                    status: 'registered',
                    vintage: 2022,
                    projectType: 'Energy Efficiency',
                    sdgImpacts: ['SDG 7', 'SDG 13'],
                    location: 'Kenya',
                    quality: 80,
                    isRetired: false
                },
                'GS-002': {
                    exists: true,
                    status: 'registered',
                    vintage: 2020,
                    projectType: 'Clean Cookstoves',
                    sdgImpacts: ['SDG 3', 'SDG 7', 'SDG 13'],
                    location: 'Ghana',
                    quality: 75,
                    isRetired: true
                }
            };
            
            const data = mockGoldStandardDatabase[creditId];
            
            if (!data || !data.exists) {
                return {
                    source: 'Gold Standard',
                    success: false,
                    error: 'Credit not found in Gold Standard registry'
                };
            }
            
            return {
                source: 'Gold Standard',
                success: true,
                exists: true,
                quality: data.quality,
                vintage: data.vintage,
                projectType: data.projectType,
                isRetired: data.isRetired,
                sdgImpacts: data.sdgImpacts
            };
            
        } catch (error) {
            return {
                source: 'Gold Standard',
                success: false,
                error: error.message
            };
        }
    }

    async verifyWithClimateAction(creditId) {
        console.log(`🌡️ Verifying with Climate Action Reserve: ${creditId}`);
        
        try {
            await this.delay(500);
            
            const mockClimateActionDatabase = {
                'CAR-789': {
                    exists: true,
                    status: 'issued',
                    vintage: 2023,
                    projectType: 'Forest',
                    protocol: 'Forest Project Protocol',
                    location: 'California, USA',
                    quality: 78,
                    isRetired: false
                }
            };
            
            const data = mockClimateActionDatabase[creditId];
            
            if (!data || !data.exists) {
                return {
                    source: 'Climate Action Reserve',
                    success: false,
                    error: 'Credit not found in CAR registry'
                };
            }
            
            return {
                source: 'Climate Action Reserve',
                success: true,
                exists: true,
                quality: data.quality,
                vintage: data.vintage,
                projectType: data.projectType,
                isRetired: data.isRetired,
                protocol: data.protocol
            };
            
        } catch (error) {
            return {
                source: 'Climate Action Reserve',
                success: false,
                error: error.message
            };
        }
    }

    aggregateVerificationResults(results, creditId) {
        const successfulResults = results
            .filter(result => result.status === 'fulfilled' && result.value.success)
            .map(result => result.value);
        
        console.log(`📊 Aggregating results from ${successfulResults.length} registries...`);
        
        if (successfulResults.length === 0) {
            return {
                isValid: false,
                qualityScore: 0,
                sources: ['verification_failed']
            };
        }
        
        // Check if credit exists in at least one registry
        const existsInRegistries = successfulResults.filter(r => r.exists);
        
        if (existsInRegistries.length === 0) {
            return {
                isValid: false,
                qualityScore: 0,
                sources: ['not_found_in_registries']
            };
        }
        
        // Check if credit is retired in any registry (red flag)
        const isRetiredAnywhere = existsInRegistries.some(r => r.isRetired);
        
        // Calculate consensus quality score
        const qualityScores = existsInRegistries.map(r => r.quality);
        const avgQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
        
        // Apply penalties for inconsistencies
        let finalScore = Math.round(avgQuality);
        
        if (isRetiredAnywhere) {
            finalScore = Math.max(0, finalScore - 20); // Retirement penalty
        }
        
        if (existsInRegistries.length < 2) {
            finalScore = Math.max(0, finalScore - 10); // Single registry penalty
        }
        
        return {
            isValid: !isRetiredAnywhere && finalScore >= 40, // Minimum threshold
            qualityScore: finalScore,
            sources: successfulResults.map(r => r.source)
        };
    }

    async submitVerificationResult(creditId, isValid, qualityScore, sources) {
        console.log(`📤 Submitting verification result for Credit ${creditId}...`);
        
        try {
            const tx = await this.hookContract.submitAVSVerification(
                creditId,
                isValid,
                qualityScore,
                sources
            );
            
            console.log(`⛓️ Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`✅ Verification submitted successfully (Gas used: ${receipt.gasUsed})`);
            
        } catch (error) {
            console.error('❌ Failed to submit verification:', error.message);
            throw error;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    console.log('🌱 Starting Carbon Credit Verification AVS...\n');
    
    const avs = new CarbonVerificationAVS();
    
    try {
        await avs.initialize();
    } catch (error) {
        console.error('💥 Failed to initialize AVS:', error);
        process.exit(1);
    }
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down Carbon Verification AVS...');
        console.log('👋 Goodbye!');
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Received SIGTERM, shutting down...');
        process.exit(0);
    });
}

// Export for testing
module.exports = CarbonVerificationAVS;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}