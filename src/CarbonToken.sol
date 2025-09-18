// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "solmate/src/tokens/ERC20.sol";

contract CarbonToken is ERC20 {
    struct CreditMetadata {
        uint256 vintage;     // 2020, 2021, 2022, etc.
        string projectType;  // "forestry", "solar", "wind"
        uint256 quality;     // 1-5 rating (5 = highest)
        bool isRetired;      // true if retired for compliance
    }
    
    mapping(uint256 => CreditMetadata) public credits;
    uint256 public nextCreditId = 1;
    address public owner;
    
    event CreditCreated(uint256 indexed creditId, uint256 vintage, string projectType, uint256 quality);
    event CreditRetired(uint256 indexed creditId, address indexed retiredBy);
    
    constructor() ERC20("Carbon Credit Token", "CARBON", 18) {
        owner = msg.sender;
    }
    
    function createCredit(
        uint256 vintage,
        string memory projectType,
        uint256 quality,
        uint256 amount
    ) external returns (uint256 creditId) {
        require(quality >= 1 && quality <= 5, "Quality must be 1-5");
        require(vintage >= 2020 && vintage <= 2030, "Invalid vintage");
        
        creditId = nextCreditId++;
        credits[creditId] = CreditMetadata({
            vintage: vintage,
            projectType: projectType,
            quality: quality,
            isRetired: false
        });
        
        _mint(msg.sender, amount);
        emit CreditCreated(creditId, vintage, projectType, quality);
        return creditId;
    }
    
    function retireCredit(uint256 creditId, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        require(!credits[creditId].isRetired, "Credit already retired");
        
        _burn(msg.sender, amount);
        credits[creditId].isRetired = true;
        emit CreditRetired(creditId, msg.sender);
    }
}