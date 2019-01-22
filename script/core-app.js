const fs = require('fs');
const ethUtil = require('ethereumjs-util');
const soliditySha3 = require('solidity-sha3').default;
const leftPad = require('leftpad');
const BigNumber = require('bignumber');
const Web3 = require('web3');
const contract = require('truffle-contract');
const vars = require('../config/vars.json');

// contract initiation
const BasicToken = JSON.parse(fs.readFileSync('build/contracts/BasicToken.json'));
const MultisigVault = JSON.parse(fs.readFileSync('build/contracts/MultisigVault.json'));

const dotenv = require('dotenv');
dotenv.config();

class CoreApp {
    constructor(network, alias) {
        this.provider = network.provider();
        console.log(this.provider);
        this.web3 = new Web3(this.provider);
        this.gasPrice = process.env.GAS_PRICE;
        this.gasLimit = process.env.GAS_LIMIT;

        this.tokenContract = contract(BasicToken);
        this.multisigVaultContract = contract(MultisigVault);

        this.tokenContract.setProvider(this.provider);
        this.multisigVaultContract.setProvider(this.provider);
        this.owner = this.web3.eth.accounts[0];

        if (alias !== 'development') { // don't have to unlock for ganache
            this.web3.personal.unlockAccount(this.web3.eth.accounts[0], process.env.PASSWORD);
            this.web3.personal.unlockAccount(this.web3.eth.accounts[1], process.env.PASSWORD);
            this.web3.personal.unlockAccount(this.web3.eth.accounts[2], process.env.PASSWORD);
            this.web3.personal.unlockAccount(this.web3.eth.accounts[3], process.env.PASSWORD);
        }
    }

    generateWithdrawSign(signerPk, multisigAddr, destinationAddr, amount, nonce, data) {
        let input = '0x19' + '00' + multisigAddr.slice(2) + destinationAddr.slice(2) + leftPad(amount.toString('16'), '64', '0')  + data.slice(2) + leftPad(nonce.toString('16'), '64', '0');
        let hash = soliditySha3(input);
        let signature = ethUtil.ecsign(Buffer.from(hash.slice(2), 'hex'), Buffer.from(signerPk, 'hex'));
        return signature;
    }

    async sendTokenMultisig(withdrawAddr, amount) {
        const sigR = [], sigS = [], sigV = [];
        const tokenInstance = await this.tokenContract.deployed();
        const multisigVaultInstance = await this.multisigVaultContract.deployed();
        const nonce = await multisigVaultInstance.nonce();

        for (let i = 0; i < vars.threshold; i++) {
            let pk = vars.signers[i].pkey;
            let sign = this.generateWithdrawSign(pk, multisigVaultInstance.address, withdrawAddr, web3.toWei(amount), nonce, '0x');
            sigR.push('0x' + sign.r.toString('hex'));
            sigS.push('0x' + sign.s.toString('hex'));
            sigV.push(sign.v);
        }

        const balanceBeforeWithdraw = await tokenInstance.balanceOf(multisigVaultInstance.address);
        console.log(`Balance Before Withdraw: ${balanceBeforeWithdraw}`);

        await multisigVaultInstance.sendTokenTransaction(sigV, sigR, sigS, withdrawAddr, web3.toWei(amount), '0x', {from: this.owner, gas: this.gasLimit});

        const balanceAfterWithdraw = await tokenInstance.balanceOf(multisigVaultInstance.address);
        console.log(`Balance After Withdraw: ${balanceAfterWithdraw}`);

        return balanceAfterWithdraw;
    }

    async sendEthMultisig(withdrawAddr, amount) {
        const sigR = [], sigS = [], sigV = [];
        const multisigVaultInstance = await this.multisigVaultContract.deployed();
        const nonce = await multisigVaultInstance.nonce();
        console.log(withdrawAddr);
        console.log(multisigVaultInstance.address);

        for (let i = 0; i < vars.threshold; i++) {
            let pk = vars.signers[i].pkey;
            let sign = this.generateWithdrawSign(pk, multisigVaultInstance.address, withdrawAddr, web3.toWei(amount, 'ether'), nonce, '0x');
            sigR.push('0x' + sign.r.toString('hex'));
            sigS.push('0x' + sign.s.toString('hex'));
            sigV.push(sign.v);
        }

        const balanceBeforeWithdraw = await web3.eth.getBalance(multisigVaultInstance.address);
        console.log(`Balance Before Withdraw: ${balanceBeforeWithdraw}`);

        await multisigVaultInstance.sendEthTransaction(sigV, sigR, sigS, withdrawAddr, web3.toWei(amount, 'ether'), '0x', {from: this.owner, gas: this.gasLimit});

        const balanceAfterWithdraw = await web3.eth.getBalance(multisigVaultInstance.address);
        console.log(`Balance After Withdraw: ${balanceAfterWithdraw}`);

        return balanceAfterWithdraw;
    }
}

exports.CoreApp = CoreApp;
