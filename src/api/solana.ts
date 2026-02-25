import { Connection, PublicKey } from "@solana/web3.js";

// Usamos la variable del archivo .env
const RPC_URL = import.meta.env.VITE_HELIUS_RPC;
export const connection = new Connection(RPC_URL, "confirmed");

export const getBalance = async (address: string): Promise<number> => {
    const key = new PublicKey(address);
    const balance = await connection.getBalance(key);
    return balance / 1_000_000_000; // De lamports a SOL
};