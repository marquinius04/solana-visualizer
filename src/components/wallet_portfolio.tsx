import { useState } from 'react';

export function WalletPortfolio() {
  // Estados para guardar la info y que no se pierda al recargar
  const [address, setAddress] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);

  // Conecta la wallet
  const conectarYBuscar = async () => {
    const provider = (window as any).solana;

    if (provider?.isPhantom) {
        // 1. Conexión manual sin App ID
        const response = await provider.connect();
        const publicKey = response.publicKey.toString();
        setAddress(publicKey); // Guardamos la dirección en el estado

        // 2. Una vez conectado, lanzamos la búsqueda en Helius automáticamente
        await cargarMisTokens(publicKey);

        // Lo nuevo: Posiciones de Jupiter (sin errores de IDL)
        const misShorts = await cargarHyperliquid("0x96CF8b6DCEe734e24009367C51137a574953f354");
        console.log(misShorts);
        setShorts(misShorts);
    } else {
        alert("Instala Phantom.");
    }
  };

  // Adaptada para recibir la dirección dinámica
  const cargarMisTokens = async (walletAddress: string) => {
    const response = await fetch(import.meta.env.VITE_HELIUS_RPC, { //
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'visor-web',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress, // Usamos la dirección que nos dio Phantom
          options: { showFungible: true, showNativeBalance: true, showUnverifiedCollections: true }
        }
      })
    });

    const { result } = await response.json();

    // Mapeo profesional: balance real y símbolos
    const data = result.items
      .filter((asset: any) => asset.token_info?.balance > 0)
      .map((asset: any) => ({
        symbol: asset.content.metadata?.symbol || 'N/A',
        balance: asset.token_info.balance / Math.pow(10, asset.token_info.decimals || 0),
        mint: asset.id
      }));

    setTokens(data);
  };



  return (
    <div style={{ padding: '20px', color: 'white', background: '#111' }}>
    <h1>Solana & Hyperliquid Visualizer</h1>
    
    {!address ? (
        <button onClick={conectarYBuscar}>Connect Wallet</button>
    ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* COLUMNA SOLANA (Aquí saldrá tu kJitoSOL de Kamino) */}
        <div style={{ background: '#222', padding: '15px', borderRadius: '8px', border: '1px solid #fff' }}>
            <h3>Tokens (Solana)</h3>
            {tokens.length > 0 ? tokens.map((t, i) => (
            <div key={i} style={{ borderBottom: '1px solid #333', padding: '5px' }}>
                <strong>{t.symbol}</strong>: {t.balance.toFixed(4)}
            </div>
            )) : <p>Buscando tokens...</p>}
        </div>
        {shorts.length > 0 && (
          <div style={{ background: '#222', padding: '15px', borderRadius: '8px', border: '1px solid #fff' }}>
            <h3 style={{  }}>Shorts (Hyperliquid)</h3>
            {shorts.map((s, i) => (
              <div key={i} style={{ color: Number(s.pnl) >= 0 ? '#4caf50' : '#f44336', marginBottom: '10px' }}>
                <strong>{s.coin}</strong>: {s.size} @ ${Number(s.entry).toFixed(2)}
                <br />
                <small>PnL: ${Number(s.pnl).toFixed(2)}</small>
              </div>
            ))}
          </div>
        )}

        </div>
    )}
    </div>
  );
}

const cargarHyperliquid = async (evmAddress: string) => {
  // Asegúrate de que la dirección empieza por 0x
  if (!evmAddress.startsWith('0x')) {
    console.error("¡Ojo! Hyperliquid necesita una dirección 0x, no la de Solana.");
    return [];
  }

  try {
    const response = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        "type": "clearinghouseState", // Este campo es obligatorio y exacto
        "user": evmAddress.toLowerCase() // Hyperliquid prefiere minúsculas
      })
    });

    const data = await response.json();

    // Si el servidor responde con error de deserialización, saldrá aquí
    if (data.error) {
      console.error("Error de Hyperliquid:", data.error);
      return [];
    }

    // Las posiciones están en este camino específico
    const assetPositions = data.assetPositions || [];
    
    return assetPositions.map((p: any) => ({
      coin: p.position.coin,
      size: p.position.sSize,
      entry: p.position.entryPx,
      pnl: p.position.unrealizedPnl
    }));

  } catch (error) {
    console.error("Error de red en Hyperliquid:", error);
    return [];
  }
};

// const cargarShortsJupiter = async (address: string) => {
//   try {
//     // 1. Petición directa a la API de Júpiter (Sin filtros raros ni RPCs)
//     const response = await fetch(`https://perps-api.jup.ag/v1/positions?walletAddress=${address}`);
//     const data = await response.json();
// 
//     // 2. La API devuelve una lista en 'data.data'
//     const posiciones = data.data || [];
// 
//     // 3. Mapeamos solo lo que queremos ver en la web
//     return posiciones.map((p: any) => ({
//       pair: p.market_symbol, // Ejemplo: SOL-PERP
//       side: p.side,          // long o short
//       size: (p.size / 10**6).toFixed(2), // Pasamos de bytes a dólares
//       pnl: (p.pnl / 10**6).toFixed(2)     // Ganancia o pérdida
//     }));
//   } catch (err) {
//     console.error("Error en la API de Júpiter:", err);
//     return [];
//   }
// };