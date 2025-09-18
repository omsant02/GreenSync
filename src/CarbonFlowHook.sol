// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {CarbonToken} from "./CarbonToken.sol";

contract CarbonFlowHook is BaseHook {
    using PoolIdLibrary for PoolKey;

    // Track corporate buyers for auto-retirement
    mapping(address => bool) public corporateBuyers;
    mapping(address => uint256) public purchasedCredits;

    CarbonToken public carbonToken;

    event CorporatePurchase(address indexed buyer, uint256 amount, uint256 creditId);
    event AutoRetirement(address indexed corporate, uint256 amount);

    constructor(IPoolManager _poolManager, address _carbonToken) BaseHook(_poolManager) {
        carbonToken = CarbonToken(_carbonToken);

        // Add some mock corporate buyers
        corporateBuyers[address(0x1234567890123456789012345678901234567890)] = true; // Microsoft mock
        corporateBuyers[address(0x2345678901234567890123456789012345678901)] = true; // Apple mock
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true, // For dynamic fees
            afterSwap: true, // For auto-retirement
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function _beforeSwap(address, PoolKey calldata key, SwapParams calldata, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // Extract credit ID from hookData to determine quality
        uint256 creditId = 1; // Default to credit 1 for now
        if (hookData.length > 0) {
            creditId = abi.decode(hookData, (uint256));
        }

        // Get credit metadata
        (uint256 vintage,, uint256 quality,) = carbonToken.credits(creditId);

        // Dynamic fee calculation: higher quality = lower fees
        uint24 baseFee = 3000; // 0.3%
        uint24 dynamicFee;

        if (quality >= 4) {
            dynamicFee = baseFee - 500; // 0.25% for high quality
        } else if (quality >= 3) {
            dynamicFee = baseFee; // 0.3% for medium quality
        } else {
            dynamicFee = baseFee + 1000; // 0.4% for low quality
        }

        // Older vintage gets higher fees
        if (vintage < 2022) {
            dynamicFee += 500;
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee);
    }

    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        // Get purchase amount
        uint256 amount = uint256(int256(-delta.amount1()));

        // Track purchase
        purchasedCredits[sender] += amount;

        uint256 creditId = 1;
        if (hookData.length > 0) {
            creditId = abi.decode(hookData, (uint256));
        }

        emit CorporatePurchase(sender, amount, creditId);

        // Auto-retirement for corporate buyers
        if (corporateBuyers[sender]) {
            emit AutoRetirement(sender, amount);
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // Admin function to add corporate buyers
    function addCorporateBuyer(address buyer) external {
        corporateBuyers[buyer] = true;
    }
}
