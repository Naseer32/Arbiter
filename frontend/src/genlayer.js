import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Deployed on GenLayer Studio (studio.genlayer.com)
export const CONTRACT_ADDRESS = "0xEF16CB5F1b8958e83dcaaaADCee20342Ce56ba09";

// NOTE: Studio-only for now. This app is not configured for any testnet
// (Bradbury/Asimov) until a contract is deployed there and this file is
// updated on purpose.

export async function connectWallet() {
  if (!window.ethereum) throw new Error("No injected wallet found (e.g. MetaMask).");
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
