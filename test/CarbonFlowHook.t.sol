// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CarbonToken} from "../src/CarbonToken.sol";

contract CarbonFlowTest is Test {
    CarbonToken carbonToken;

    function setUp() public {
        // Deploy our carbon token
        carbonToken = new CarbonToken();
        
        // Create some test carbon credits
        carbonToken.createCredit(2023, "forestry", 4, 1000 ether);
        carbonToken.createCredit(2021, "solar", 2, 500 ether);
    }
    
    function test_carbonCredits() public {
        // Test carbon credit creation
        (uint256 vintage, string memory projectType, uint256 quality, bool isRetired) = carbonToken.credits(1);
        assertEq(vintage, 2023);
        assertEq(quality, 4);
        assertFalse(isRetired);
        
        // Test second credit
        (vintage, projectType, quality, isRetired) = carbonToken.credits(2);
        assertEq(vintage, 2021);
        assertEq(quality, 2);
        assertFalse(isRetired);
    }
    
    function test_creditRetirement() public {
        // Test retiring credits
        uint256 balance = carbonToken.balanceOf(address(this));
        assertTrue(balance > 0);
        
        carbonToken.retireCredit(1, 100 ether);
        
        (,,, bool isRetired) = carbonToken.credits(1);
        assertTrue(isRetired);
        
        assertEq(carbonToken.balanceOf(address(this)), balance - 100 ether);
    }
}