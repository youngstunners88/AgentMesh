// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AgentMesh Settlement Contract
 * @notice Escrow and payment settlement for agent deals
 * @dev Part of the AgentMesh autonomous economic ecosystem
 */
contract AgentMeshSettlement {
    
    enum DealStatus { Pending, Funded, Executed, Disputed, Refunded }
    
    struct Escrow {
        address payer;
        address payee;
        uint256 amount;
        bytes32 dealHash;
        DealStatus status;
        uint256 createdAt;
        uint256 timeout;
        address arbiter;
    }
    
    mapping(bytes32 => Escrow) public escrows;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public reputation;
    mapping(address => bool) public authorizedAgents;
    
    address public owner;
    uint256 public constant MINIMUM_ESCROW = 0.001 ether;
    uint256 public constant PLATFORM_FEE = 25; // 0.25%
    uint256 public constant DISPUTE_WINDOW = 3 days;
    
    event EscrowCreated(bytes32 indexed dealId, address payer, uint256 amount);
    event EscrowFunded(bytes32 indexed dealId, uint256 amount);
    event EscrowReleased(bytes32 indexed dealId, address payee, uint256 amount);
    event DisputeRaised(bytes32 indexed dealId, address initiator, string reason);
    event DisputeResolved(bytes32 indexed dealId, address winner, uint256 amount);
    event AgentAuthorized(address agent, uint256 initialReputation);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(authorizedAgents[msg.sender] || msg.sender == owner, "Unauthorized agent");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    function authorizeAgent(address agent, uint256 initialRep) external onlyOwner {
        authorizedAgents[agent] = true;
        reputation[agent] = initialRep;
        emit AgentAuthorized(agent, initialRep);
    }
    
    function createEscrow(
        bytes32 dealId,
        address payee,
        uint256 timeout,
        address arbiter
    ) external payable onlyAuthorized returns (bool) {
        require(msg.value >= MINIMUM_ESCROW, "Below minimum");
        require(escrows[dealId].createdAt == 0, "Deal exists");
        require(payee != address(0), "Invalid payee");
        
        escrows[dealId] = Escrow({
            payer: msg.sender,
            payee: payee,
            amount: msg.value,
            dealHash: keccak256(abi.encodePacked(dealId, msg.sender, payee, msg.value)),
            status: DealStatus.Funded,
            createdAt: block.timestamp,
            timeout: timeout,
            arbiter: arbiter
        });
        
        emit EscrowCreated(dealId, msg.sender, msg.value);
        emit EscrowFunded(dealId, msg.value);
        
        return true;
    }
    
    function releaseEscrow(bytes32 dealId, bytes32 executionProof) external onlyAuthorized {
        Escrow storage e = escrows[dealId];
        require(e.status == DealStatus.Funded, "Invalid status");
        require(
            msg.sender == e.payer || 
            msg.sender == e.payee || 
            msg.sender == e.arbiter ||
            block.timestamp > e.timeout,
            "Unauthorized"
        );
        
        uint256 fee = (e.amount * PLATFORM_FEE) / 10000;
        uint256 payout = e.amount - fee;
        
        e.status = DealStatus.Executed;
        balances[owner] += fee;
        
        // Transfer to payee
        (bool success, ) = e.payee.call{value: payout}("");
        require(success, "Transfer failed");
        
        // Update reputation
        reputation[e.payee] += 10;
        reputation[e.payer] += 5;
        
        emit EscrowReleased(dealId, e.payee, payout);
    }
    
    function raiseDispute(bytes32 dealId, string calldata reason) external {
        Escrow storage e = escrows[dealId];
        require(
            msg.sender == e.payer || msg.sender == e.payee,
            "Not party"
        );
        require(e.status == DealStatus.Funded, "Invalid status");
        require(block.timestamp < e.createdAt + DISPUTE_WINDOW, "Window closed");
        
        e.status = DealStatus.Disputed;
        
        emit DisputeRaised(dealId, msg.sender, reason);
    }
    
    function resolveDispute(
        bytes32 dealId,
        address winner,
        uint256 penaltyPercent
    ) external {
        Escrow storage e = escrows[dealId];
        require(msg.sender == e.arbiter || msg.sender == owner, "Not arbiter");
        require(e.status == DealStatus.Disputed, "Not disputed");
        require(winner == e.payer || winner == e.payee, "Invalid winner");
        
        uint256 fee = (e.amount * PLATFORM_FEE) / 10000;
        uint256 penalty = (e.amount * penaltyPercent) / 100;
        uint256 payout = e.amount - fee - penalty;
        
        e.status = DealStatus.Executed;
        balances[owner] += fee + penalty;
        
        (bool success, ) = winner.call{value: payout}("");
        require(success, "Transfer failed");
        
        // Reputation penalties
        address loser = winner == e.payer ? e.payee : e.payer;
        if (reputation[loser] >= 20) {
            reputation[loser] -= 20;
        }
        
        emit DisputeResolved(dealId, winner, payout);
    }
    
    function getEscrowDetails(bytes32 dealId) external view returns (Escrow memory) {
        return escrows[dealId];
    }
    
    function getAgentReputation(address agent) external view returns (uint256) {
        return reputation[agent];
    }
    
    receive() external payable {
        balances[owner] += msg.value;
    }
}