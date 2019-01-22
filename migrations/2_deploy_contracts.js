var BasicToken = artifacts.require('./BasicToken.sol');
var MultisigVault = artifacts.require('./MultisigVault.sol');
const vars = require('../config/vars.json');
const dotenv = require('dotenv');
const Web3 = require('web3');
dotenv.config();

// co-signers should be ready before deploy contract
const signers = [];
for (let signer of vars.signers) {
    signers.push(signer.address);
}

module.exports = function(deployer, network) {
    if (network === 'remote') {
        var provider = new Web3.providers.HttpProvider("https://" + process.env.GETH_REMOTE_URL, 5000, process.env.GETH_USER, process.env.GETH_PASSWORD);
        var web3 = new Web3(provider);
        web3.personal.unlockAccount(web3.eth.accounts[0], process.env.PASSWORD);
    } else if (network === 'local') {
        var provider = new Web3.providers.HttpProvider("http://localhost:8545");
        var web3 = new Web3(provider);
        web3.personal.unlockAccount(web3.eth.accounts[0], process.env.PASSWORD);
    }

    deployer.deploy(BasicToken).then(function () {
        console.log('--------------------------------------------------------');
        console.log('[BasicToken] contract deployed: ', BasicToken.address);
        return deployer.deploy(MultisigVault, BasicToken.address, signers).then(function () {
            console.log('---------------------------------------------------------');
            console.log('[MultisigVault] contract deployed: ', MultisigVault.address);
        });
    });
};
