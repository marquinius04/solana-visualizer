/**
 * src/fetch_account.ts
 *
 * DEV-ONLY utility script — NOT imported anywhere in the app bundle.
 * Run manually with: npx ts-node src/fetch_account.ts <walletAddress>
 *
 * SECURITY: API key is read from the HELIUS_API_KEY env var (server-side).
 * No wallet address is hardcoded — pass it as a CLI argument.
 */
import { Connection } from "@solana/web3.js";
import 'dotenv/config';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
if (!HELIUS_API_KEY) {
  console.error("Error: HELIUS_API_KEY not found in environment variables.");
  process.exit(1);
}

const RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Connection to devnet for testing (no API key needed)
const testConnection = new Connection("https://api.devnet.solana.com", "confirmed");
void testConnection; // used for manual devnet testing

// Wallet address comes from CLI argument — never hardcoded
const walletAddress = process.argv[2];
if (!walletAddress) {
  console.error("Usage: npx ts-node src/fetch_account.ts <walletAddress>");
  process.exit(1);
}

const getTokensOwned = async (): Promise<any> => {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'dev-query',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: walletAddress,
        options: {
          showFungible: true,
          showNativeBalance: true,
        },
      },
    }),
  });

  const { result } = await response.json();

  const tokenData = result.items
    .filter((asset: any) => asset.token_info?.balance > 0)
    .map((asset: any) => {
      const balance = asset.token_info.balance / Math.pow(10, asset.token_info.decimals || 0);
      const price = asset.token_info.price_info?.price_per_token || 0;
      return {
        name: asset.content.metadata?.name || 'N/A',
        symbol: asset.content.metadata?.symbol || 'N/A',
        balance,
        price_usd: price.toFixed(6),
        total_value_usd: (balance * price).toFixed(2),
        mint: asset.id,
      };
    });

  console.table(tokenData);
  return tokenData;
};

getTokensOwned();