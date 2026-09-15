import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const studioDevChain = {
  ...studionet,
  id: 61997,
  name: "GenLayer Studio (Dev)",
  rpcUrls: {
    default: { http: ["https://studio-next.genlayer.com/api"] },
  },
};

const CONTRACT_ADDRESS = "0x7FE6B2AC00dbe9857E91fEfD3A280C59C1a267b1";

const client = createClient({ chain: studioDevChain });

try {
  const count = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "job_count",
    args: [],
  });
  console.log("✅ Contract is LIVE on Studio Next (chain 61997)");
  console.log("job_count():", count.toString());

  if (Number(count) > 0) {
    const job = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_job",
      args: [Number(count)],
    });
    console.log("Latest job (id " + count.toString() + "):", job);
  }
} catch (e) {
  console.error("❌ Read failed:", e.message);
}
