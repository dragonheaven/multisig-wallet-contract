pragma solidity ^0.4.21;

import "./lib/Ownable.sol";
import "./lib/SafeMath.sol";
import "./lib/ERC20Basic.sol";

/**
 * @title MultisigVault Contract
 */
contract MultisigVault is Ownable {
    using SafeMath for uint256;

    ERC20Basic public token;

    // counter to prevent replay attack
    uint public nonce;
    // minimum number of owners to authorize for a transaction
    uint public constant threshold = 2;
    // master owner
    address public master;
    // array of owners' addresses
    address[] public ownersArr;
    // if address is owner or not
    mapping (address => bool) isOwner;

    modifier onlyMasterOwner() {
        require(msg.sender == master);
        _;
    }

    constructor (ERC20Basic _token, address[] _owners) public onlyOwner {
        require(_owners.length == 3, "Invalid input values");
        require(address(_token) != 0, "Token address should not be zero");

        address lastAdd = address(0);
        for (uint i = 0; i < _owners.length; i++) {
            require(_owners[i] > lastAdd, "Duplicated address");   // prevent duplicated owner addresses
            isOwner[_owners[i]] = true;
            lastAdd = _owners[i];
        }
        ownersArr = _owners;
        token = _token;
    }

    function setMasterOwner(address _master) public onlyOwner {
        require(_master != address(0x0));
        master = _master;
    }

    /**
     * @dev Function to send eth to destination
     * @param sigV array of signature v of signers
     * @param sigR array of signature r
     * @param sigS array of signature s
     * @param destination destination address
     * @param data data byte code
     */
    function sendEthTransaction(uint8[] sigV, bytes32[] sigR, bytes32[] sigS, address destination, uint256 value, bytes data) public {
        require(sigR.length == threshold, "Invalid Signature");
        require(sigR.length == sigS.length && sigR.length == sigV.length, "Invalid Signature");
        require(value <= address(this).balance);

        // follows ERC191 signature scheme: https://github.com/ethereum/EIPs/issues/191
        bytes32 txHash = keccak256(byte(0x19), byte(0), this, destination, value, data, nonce);

        address lastAdd = address(0); // cannot have address(0) as an owner
        for (uint i = 0; i < threshold; i++) {
            address recovered = ecrecover(txHash, sigV[i], sigR[i], sigS[i]);
            require(recovered > lastAdd && isOwner[recovered]);
            lastAdd = recovered;
        }

        // if we make it here all signatures are accounted for
        nonce = nonce + 1;

        // finally transfer all remaining eth to destination
        if (!destination.call.value(value)()) {revert();}
    }

    /**
     * @dev Function to transfer tokens to destination
     * @param sigV array of signature v of signers
     * @param sigR array of signature r
     * @param sigS array of signature s
     * @param destination destination address
     * @param data data byte code
     */
    function sendTokenTransaction(uint8[] sigV, bytes32[] sigR, bytes32[] sigS, address destination, uint256 value, bytes data) public {
        require(sigR.length == threshold, "Invalid Signature");
        require(sigR.length == sigS.length && sigR.length == sigV.length, "Invalid Signature");
        require(value < token.balanceOf(address(this)));

        // follows ERC191 signature scheme: https://github.com/ethereum/EIPs/issues/191
        bytes32 txHash = keccak256(byte(0x19), byte(0), this, destination, value, data, nonce);

        address lastAdd = address(0); // cannot have address(0) as an owner
        for (uint i = 0; i < threshold; i++) {
            address recovered = ecrecover(txHash, sigV[i], sigR[i], sigS[i]);
            require(recovered > lastAdd && isOwner[recovered]);
            lastAdd = recovered;
        }

        // if we make it here all signatures are accounted for
        nonce = nonce + 1;

        // finally transfer all remaining tokens to destination
        token.transfer(destination, value);
    }

    function withdraw(address destination, uint256 value) public onlyMasterOwner {
        require(value <= address(this).balance);
        if (!destination.call.value(value)()) {revert();}
    }

    function withdrawToken(address destination, uint256 value) public onlyMasterOwner {
        require(value <= token.balanceOf(address(this)));
        token.transfer(destination, value);
    }

    function () public payable {}
}
