import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Deployed on GenLayer Studio (studio.genlayer.com)
export const CONTRACT_ADDRESS = "0x5CCF4f0e7b3392C48ff2BE2A894e08A92863A2Db";

// Make sure the wallet is actively on GenLayer Studio before signing --
// genlayer-js's client requires the wallet's current chain to match, or
// write calls fail with "chainId should be same as current chainId".
// Pull chain id / RPC / explorer straight from genlayer-js's own `studionet`
// object instead of hardcoding them -- hardcoded values drifted from what
// the SDK actually uses and caused a chainId/RPC mismatch.
function toHexChainId(id) {
  return "0x" + id.toString(16);
}

export async function ensureStudioNetwork() {
  if (!window.ethereum) throw new Error("No injected wallet found (e.g. MetaMask).");
  const rpcUrl =
    studionet.rpcUrls?.default?.http?.[0] ?? studionet.rpcUrls?.[0];
  const explorerUrl = studionet.blockExplorers?.default?.url;

  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: toHexChainId(studionet.id),
        chainName: studionet.name ?? "GenLayer Studio",
        nativeCurrency: studionet.nativeCurrency ?? {
          name: "GEN",
          symbol: "GEN",
          decimals: 18,
        },
        rpcUrls: [rpcUrl],
        blockExplorerUrls: explorerUrl ? [explorerUrl] : [],
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

export async function recoverUnavailableJob(client, jobId, reason) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "recover_unavailable_job",
    args: [jobId, reason],
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
