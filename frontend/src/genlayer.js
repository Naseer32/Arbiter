import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

// Deployed on GenLayer Studio (studio.genlayer.com)
export const CONTRACT_ADDRESS = "0x34390D6ffEb7450727d71fBfad22cFE7095dAac9";

// Must match APPEAL_WINDOW in arbiter_contract.py exactly -- this is a
// display-only value (for showing an estimated deadline in the UI) and
// has no bearing on-chain enforcement, which the contract always governs.
// Update this alongside APPEAL_WINDOW whenever you change it, e.g. set to
// 2 * 60 * 1000 while testing with a shortened window, and back to
// 24 * 60 * 60 * 1000 (the default below) before final submission.
export const APPEAL_WINDOW_MS = 24 * 60 * 60 * 1000;

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

// Human-readable name + chain id, for network-status messaging in the UI.
export const REQUIRED_NETWORK_NAME = studionet.name ?? "GenLayer Studio";
export const REQUIRED_CHAIN_ID_HEX = toHexChainId(studionet.id);

// Returns the wallet's current chain id (hex string, e.g. "0x...") or null
// if no wallet is present. Used to show clear "wrong network" guidance
// instead of letting a chainId-mismatch error surface raw from a write call.
export async function getCurrentChainIdHex() {
  if (!window.ethereum) return null;
  return window.ethereum.request({ method: "eth_chainId" });
}

export function onChainChanged(callback) {
  if (!window.ethereum || !window.ethereum.on) return () => {};
  const handler = (chainIdHex) => callback(chainIdHex);
  window.ethereum.on("chainChanged", handler);
  return () => window.ethereum.removeListener("chainChanged", handler);
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

// create_job's actual return value is encoded in GenLayer's custom
// calldata binary format (same scheme used for call arguments), not plain
// JSON or hex -- decoding it client-side would mean reimplementing that
// codec in JS. Instead, since job ids are sequential and 1-based, we wait
// for the tx to confirm and then read job_count(), which *is* the new
// job's id right after creation -- using the same read-decoding path that
// already works correctly for get_job(). Caveat: if another job is created
// by someone else in the brief window between this tx confirming and the
// job_count() read, the count could reflect that job instead. Low risk for
// this app's expected usage, and far simpler than a custom binary decoder.
export async function createJob(client, worker, spec, amountWei) {
  const tx = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "create_job",
    args: [worker, spec],
    value: amountWei,
  });

  let jobId = null;
  try {
    await client.waitForTransactionReceipt({
      hash: tx,
      status: TransactionStatus.ACCEPTED,
    });
    const count = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "job_count",
      args: [],
    });
    jobId = count !== null && count !== undefined ? count.toString() : null;
  } catch {
    // Either the receipt wait or the job_count read failed -- doesn't mean
    // job creation itself failed (the write above already succeeded).
    // Just means we can't show the id immediately; it's still look-up-able.
  }

  return { tx, jobId };
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

export async function appealJob(client, jobId, reason) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "appeal",
    args: [jobId, reason],
  });
}

export async function finalizeJob(client, jobId) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "finalize",
    args: [jobId],
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

// Block explorer link for a tx hash, if Studio's chain config exposes one.
// The SDK's default explorer (studionet.blockExplorers.default.url) points
// to a third-party-hosted site that has been paused by its owner as of this
// writing -- confirmed working alternative: explorer-studio.genlayer.com,
// GenLayer's own Studio explorer. Hardcoded rather than trusting the SDK
// default, since that default is the one currently broken.
export const EXPLORER_BASE_URL = "https://explorer-studio.genlayer.com";

export function txExplorerUrl(txHash) {
  if (!EXPLORER_BASE_URL || !txHash) return null;
  return `${EXPLORER_BASE_URL.replace(/\/$/, "")}/tx/${txHash}`;
}
