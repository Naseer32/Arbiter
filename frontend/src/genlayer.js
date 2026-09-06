import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Deployed on GenLayer Studio
export const CONTRACT_ADDRESS = "0xEF16CB5F1b8958e83dcaaaADCee20342Ce56ba09";

// Add Studio to the connected wallet if it isn't already configured there.
// MetaMask (and most injected wallets) support wallet_addEthereumChain.
// NOTE: Studio is for dev/testing -- its state can reset periodically.
// Switch back to testnetBradbury (see git history / earlier version of this
// file) before final hackathon submission for a persistent deployment.
export async function ensureStudioNetwork() {
  if (!window.ethereum) throw new Error("No injected wallet found (e.g. MetaMask).");
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: "0xf21f", // 61999 in hex
        chainName: "GenLayer Studio",
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
        rpcUrls: ["https://studio.genlayer.com/api"],
        blockExplorerUrls: ["https://explorer-studio.genlayer.com"],
      },
    ],
  });
}

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No injected wallet found (e.g. MetaMask).");
  await ensureStudioNetwork();
  const [account] = await window.ethereum.request({ method: "eth_requestAccounts" });
  return account;
}

export function getClient(account) {
  return createClient({
    chain: studionet,
    account,
  });
}

// Subscribe to wallet account switches so the app can rebuild its client with
// the new account instead of continuing to sign with a stale one.
// Returns an unsubscribe function.
export function onAccountsChanged(callback) {
  if (!window.ethereum || !window.ethereum.on) return () => {};
  const handler = (accounts) => callback(accounts[0] ?? null);
  window.ethereum.on("accountsChanged", handler);
  return () => window.ethereum.removeListener("accountsChanged", handler);
}

export async function createJob(client, worker, spec, amountWei) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "create_job",
    args: [worker, spec],
    value: amountWei,
  });
}

export async function submitWork(client, jobId, deliverable, isUrl) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "submit_work",
    args: [jobId, deliverable, isUrl],
  });
}

export async function approveJob(client, jobId) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "approve",
    args: [jobId],
  });
}

export async function disputeJob(client, jobId, reason) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "dispute",
    args: [jobId, reason],
  });
}

export async function recoverUnavailableJob(client, jobId) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "recover_unavailable_job",
    args: [jobId],
  });
}

export async function abandonJob(client, jobId, reason) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "abandon_job",
    args: [jobId, reason],
  });
}

export async function getJob(client, jobId) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_job",
    args: [jobId],
  });
}
