import { Connection, PublicKey } from "@solana/web3.js";
import type { GetProgramAccountsFilter } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { connection } from "./api/solana.ts";
import 'dotenv/config';

// Intenta leer de Vite y, si falla, lee de Node.js
const RPC_URL = import.meta.env?.VITE_HELIUS_RPC || process.env.VITE_HELIUS_RPC;

// Conexión red de testeo
const testConnection = new Connection(
  "https://api.devnet.solana.com",
  "confirmed"
);

// Conexión privada a Mainnet
const devConnection = new Connection(
  RPC_URL,
  "confirmed"
);

// Dirección de cartera personal
const myWalletAddress = new PublicKey(
  "ATQ5CKLYGVLGSzaKxW3pR3n1vsH2Xa3dP3abgFBqLmZ5"
);

const getTokensOwned = async (): Promise<any> => {
  const optionsAssets = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'busqueda_total',
      method: 'getAssetsByOwner',
      params: {
        ownerAddress: myWalletAddress.toString(),
        options: {
          showFungible: true,
          showNativeBalance: true
        }
      }
    })
  };

  const response = await fetch(RPC_URL, optionsAssets);
  const { result } = await response.json();

  const tokenData = result.items
    .filter((asset: any) => asset.token_info?.balance > 0)
    .map((asset: any) => {
      // Calculamos balance real con decimales
      const balance = asset.token_info.balance / Math.pow(10, asset.token_info.decimals || 0);
      // Precio por unidad
      const price = asset.token_info.price_info?.price_per_token || 0;

      return {
        name: asset.content.metadata?.name || 'N/A',
        symbol: asset.content.metadata?.symbol || 'N/A',
        balance: balance,
        price_usd: price.toFixed(6),
        total_value_usd: (balance * price).toFixed(2),
        mint: asset.id
      };
    });

  console.table(tokenData);
  
  return tokenData;
};

getTokensOwned();