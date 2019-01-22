const dotenv = require('dotenv');
const CoreApp = require('../script/core-app').CoreApp;
const truffle = require('../truffle');
dotenv.config();

const coreApp = new CoreApp(truffle.networks[process.env.TRUFFLE_NETWORK_ALIAS], process.env.TRUFFLE_NETWORK_ALIAS);

contract('MultisigVault', (accounts) => {
    var tokenInstance;
    var tokenVaultInstance;
    var multisigInstance;

    before (async () => {
        tokenInstance = await coreApp.tokenContract.deployed();
        multisigInstance = await coreApp.multisigVaultContract.deployed();
    });

    it ('should be able to set master address', async () => {
        let masterAddress = await multisigInstance.master();
        console.log(`Master address before set: ${masterAddress}`);
        await multisigInstance.setMasterOwner(accounts[2], {from: accounts[0], gas: 1000000});
        masterAddress = await multisigInstance.master();
        console.log(`Master address after set: ${masterAddress}`);
        assert.equal(masterAddress, accounts[2], `Master address should be ${accounts[2]}`);
    });

    it ('should be able to send transaction by super master owner', async () => {
        web3.eth.sendTransaction({from: accounts[0], to: multisigInstance.address, value: web3.toWei(3), gas: 1000000});
        let balance = await web3.eth.getBalance(multisigInstance.address);
        console.log(`Balance before send: ${balance}`);

        await multisigInstance.setMasterOwner(accounts[2], {from: accounts[0], gas: 1000000});
        masterAddress = await multisigInstance.withdraw(accounts[3], web3.toWei(1, 'ether'), {from: accounts[2], gas: 1000000});
        let balanceAfter = await web3.eth.getBalance(multisigInstance.address);
        console.log(`Balance after send: ${balanceAfter}`);

        assert.equal(balanceAfter, web3.toWei(2, 'ether'), 'Remaining balance should be 2 ether');
    });

    it ('should be able to send token by super master owner', async () => {
        await tokenInstance.mint(multisigInstance.address, 100000000, {from: accounts[0], gas: 1000000});
        let balance = await tokenInstance.balanceOf(multisigInstance.address);
        console.log(`Token balance before send: ${balance}`);

        await multisigInstance.setMasterOwner(accounts[2], {from: accounts[0], gas: 1000000});
        masterAddress = await multisigInstance.withdrawToken(accounts[3], 50000000, {from: accounts[2], gas: 1000000});
        let balanceAfter = await tokenInstance.balanceOf(multisigInstance.address);
        console.log(`Token balance send: ${balanceAfter}`);

        assert.equal(balanceAfter, 50000000, 'Remaining token balance should be 50000000');
    });

    it ('should be able to send ether with multisig', async () => {
        web3.eth.sendTransaction({from: accounts[0], to: multisigInstance.address, value: web3.toWei(3), gas: 1000000});
        let balance = await web3.eth.getBalance(multisigInstance.address);
        console.log(`Balance before send: ${balance}`);

        await coreApp.sendEthMultisig(accounts[2], 1);
        let balanceAfter = await web3.eth.getBalance(multisigInstance.address);
        console.log(`Balance after send: ${balanceAfter}`);

        assert.equal(balanceAfter, web3.toWei(2, 'ether'), 'Remaining balance should be 2 ether');
    });

    it ('should be able to send tokens with multisig', async () => {
        await tokenInstance.mint(multisigInstance.address, 100000000, {from: accounts[0], gas: 1000000});
        let balance = await tokenInstance.balanceOf(multisigInstance.address);
        console.log(`Balance before send: ${balance}`);

        await coreApp.sendTokenMultisig(accounts[2], 50000000);
        let balanceAfter = await tokenInstance.balanceOf(multisigInstance.address);
        console.log(`Balance after send: ${balanceAfter}`);

        assert.equal(balanceAfter, 50000000, 'Remaining balance should be 50000000');
    });
});
