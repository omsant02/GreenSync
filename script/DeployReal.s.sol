// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {CarbonToken} from "../src/CarbonToken.sol";
import {CarbonFlowHook} from "../src/CarbonFlowHook.sol";
import {IPoolManager} from "lib/uniswap-hooks/lib/v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "lib/uniswap-hooks/lib/v4-core/src/PoolManager.sol";
import {Hooks} from "lib/uniswap-hooks/lib/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "lib/uniswap-hooks/lib/v4-periphery/src/utils/HookMiner.sol";

contract DeployReal is Script {
    // CREATE2 deployer address for Foundry
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        vm.startBroadcast();
        
        console.log("=== DEPLOYING CARBONFLOW WITH REAL HOOK ===");
        
        // Deploy PoolManager
        PoolManager poolManager = new PoolManager(msg.sender);
        console.log("PoolManager deployed at:", address(poolManager));
        
        // Deploy CarbonToken
        CarbonToken carbonToken = new CarbonToken();
        console.log("CarbonToken deployed at:", address(carbonToken));
        
        // Create demo credits
        carbonToken.createCredit(2023, "forestry", 4, 1000 ether);
        carbonToken.createCredit(2021, "solar", 2, 500 ether);
        carbonToken.createCredit(2022, "wind", 3, 750 ether);
        console.log("Created demo carbon credits");
        
        // Define hook flags
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);
        console.log("Hook flags required:", flags);
        
        // Mine for hook address using HookMiner
        bytes memory constructorArgs = abi.encode(address(poolManager), address(carbonToken));
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            type(CarbonFlowHook).creationCode,
            constructorArgs
        );
        
        console.log("Mined hook address:", hookAddress);
        console.log("Salt:", uint256(salt));
        
        // Deploy hook using CREATE2 with mined salt
        CarbonFlowHook hook = new CarbonFlowHook{salt: salt}(
            IPoolManager(address(poolManager)),
            address(carbonToken)
        );
        
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("CarbonFlowHook deployed at:", address(hook));
        
        // Test hook functionality
        console.log("\n=== TESTING HOOK FUNCTIONS ===");
        
        // Test corporate buyer
        hook.addCorporateBuyer(msg.sender);
        console.log("Corporate buyer added successfully");
        
        vm.stopBroadcast();
        
        console.log("\n=== DEPLOYMENT SUCCESS ===");
        console.log("PoolManager:", address(poolManager));
        console.log("CarbonToken:", address(carbonToken));
        console.log("CarbonFlowHook:", address(hook));
        console.log("All real sponsor integrations deployed!");
        
        console.log("\n=== TESTING COMMANDS ===");
        console.log("Test corporate stats:");
        console.log(string(abi.encodePacked("cast call ", vm.toString(address(hook)), ' "getCorporateStats(address)" ', vm.toString(msg.sender), " --rpc-url http://localhost:8545")));
        
        console.log("Test AVS verification:");
        console.log(string(abi.encodePacked("cast call ", vm.toString(address(hook)), ' "getAVSVerificationDetails(uint256)" 1 --rpc-url http://localhost:8545')));
        
        console.log("Update AVS .env with:");
        console.log(string(abi.encodePacked("HOOK_CONTRACT_ADDRESS=", vm.toString(address(hook)))));
    }
}