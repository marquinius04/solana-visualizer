/**
 * src/api/solana.ts
 *
 * NOTE: Direct RPC connections (with API keys) have been removed.
 * The frontend no longer calls Helius directly — all requests go through
 * the /api/tokens serverless proxy so HELIUS_API_KEY stays server-side.
 *
 * If you need a Connection object for on-chain reads that don't require
 * an API key (e.g. getBalance via public RPC), use the public endpoint below.
 * For indexed/DAS data (getAssetsByOwner) always use the proxy.
 */
import { Connection, PublicKey } from "@solana/web3.js";

// Public Solana RPC — no API key needed, suitable for basic reads only.
const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
export const connection = new Connection(PUBLIC_RPC, "confirmed");

export const getBalance = async (address: string): Promise<number> => {
    const key = new PublicKey(address);
    const balance = await connection.getBalance(key);
    return balance / 1_000_000_000; // lamports → SOL
};