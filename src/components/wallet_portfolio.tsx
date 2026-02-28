import { useState } from 'react';
import '../App.css';

// ============================================================================
// 1. LÓGICA DE DATOS (Intacta)
// ============================================================================

const cargarMisTokens = async (walletAddress: string) => {
  try {
    const response = await fetch(import.meta.env.VITE_HELIUS_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'visor-web',
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: walletAddress,
          options: { showFungible: true, showNativeBalance: true, showUnverifiedCollections: true }
        }
      })
    });

    const { result } = await response.json();
    const listaFinal = [];

    // 1. CAPTURAMOS TU SOL NATIVO y le asignamos su logo oficial
    if (result.nativeBalance && result.nativeBalance.lamports > 0) {
      listaFinal.push({
        symbol: 'SOL',
        balance: result.nativeBalance.lamports / 10 ** 9,
        mint: 'native',
        imageUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
      });
    }

    // 2. CAPTURAMOS LOS TOKENS y extraemos la URL de la imagen (links.image)
    const tokens = (result.items || [])
      .filter((asset: any) => asset.token_info?.balance > 0)
      .map((asset: any) => ({
        symbol: asset.content.metadata?.symbol || 'N/A',
        balance: asset.token_info.balance / Math.pow(10, asset.token_info.decimals || 0),
        mint: asset.id,
        imageUrl: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null
      }));

    listaFinal.push(...tokens);

    // 3. FILTRO DE LIMPIEZA
    const tokensLimpios = listaFinal.filter(t => {
      if (t.symbol === 'SOL') return true; 
      return t.balance >= 0.01; 
    });

    if (tokensLimpios.length === 0) {
      return [{ symbol: 'Vacío', balance: 0, mint: 'none', imageUrl: null }];
    }

    return tokensLimpios;
  } catch (error) {
    console.error("Error cargando Solana:", error);
    return [{ symbol: 'Error', balance: 0, mint: 'error', imageUrl: null }];
  }
};

const cargarTodoHyperliquid = async (userAddress: string) => {
  try {
    // 1. Ejecutamos las dos peticiones en paralelo (DEX estándar y DEX xyz)
    const [estadoNormalResp, estadoXyzResp] = await Promise.all([
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "clearinghouseState", user: userAddress.toLowerCase() })
      }),
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: "clearinghouseState", user: userAddress.toLowerCase(), dex: "xyz" })
      })
    ]);
    
    // 2. Convertimos las respuestas a formato JSON
    const estadoNormal = await estadoNormalResp.json();
    const estadoXyz = await estadoXyzResp.json();

    // 3. Unificamos todas las posiciones en un único array
    const todasLasPosiciones = [
      ...(estadoNormal.assetPositions || []),
      ...(estadoXyz.assetPositions || [])
    ];

    console.log(todasLasPosiciones);

    // 4. Filtramos y estructuramos los datos
    const posicionesProcesadas = todasLasPosiciones
      .filter((p: any) => parseFloat(p.position.szi) !== 0) // Descartamos posiciones cerradas (tamaño 0)
      .map((p: any) => {
        const assetName = p.position.coin; 
        const size = parseFloat(p.position.szi);
        console.log(assetName);

        return {
          asset: assetName, 
          side: size > 0 ? "LONG" : "SHORT",
          investedMoney: parseFloat(p.position.marginUsed),
          totalValue: parseFloat(p.position.positionValue),
          entry: parseFloat(p.position.entryPx),
          pnl: parseFloat(p.position.unrealizedPnl),
          leverage: p.position.leverage.value,
          // Construimos la URL de la imagen concatenando el nombre del activo exacto
          imageUrl: `https://app.hyperliquid.xyz/coins/${assetName}.svg`
        };
      });

    return posicionesProcesadas;
  } catch (error) {
    console.error("Error en Hyperliquid:", error);
    return [];
  }
};

// ============================================================================
// 2. INTERFAZ VISUAL (La Magia CSS)
// ============================================================================

export function WalletPortfolio() {
  const [address, setAddress] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const conectarYBuscar = async () => {
    const provider = (window as any).solana;

    if (provider?.isPhantom) {
      setLoading(true);
      const response = await provider.connect();
      const publicKey = response.publicKey.toString();
      setAddress(publicKey);

      const solTokens = await cargarMisTokens(publicKey);
      setTokens(solTokens);

      const misTrades = await cargarTodoHyperliquid("0x96CF8b6DCEe734e24009367C51137a574953f354");
      setTrades(misTrades);
      setLoading(false);
    } else {
      alert("Instala Phantom Wallet.");
    }
  };

  return (
    <div className="dashboard">
      <h1 className="title">Millogangster Club</h1>
      
      {!address ? (
        <button className="connect-btn" onClick={conectarYBuscar}>
          {loading ? "Conectando..." : "Connect Wallet"}
        </button>
      ) : (
        <div className="sections-container">
          
          {/* SECCIÓN SOLANA (Tokens normales) */}
          <div className="section">
            <h3 className="section-title">Solana Wallet</h3>
            <div className="bubble-grid">
              {tokens.length > 0 ? tokens.map((t, i) => (
                <div 
                  key={`token-${i}`} 
                  className="bubble token"
                  style={t.imageUrl ? {
                    backgroundImage: `linear-gradient(rgba(21, 23, 30, 0.7), rgba(21, 23, 30, 0.9)), url(${t.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  } : {}}
                >
                  <div className="bubble-asset">{t.symbol}</div>
                  <div className="bubble-size">{t.balance.toFixed(4)}</div>
                </div>
              )) : <p>Buscando activos...</p>}
            </div>
          </div>

          {/* SECCIÓN HYPERLIQUID (Tus Perpetuos) */}
          {trades.length > 0 && (
            <div className="section">
              <h3 className="section-title">Open Positions (Perps)</h3>
              <div className="bubble-grid">
                {trades.map((s, i) => (
                  <div 
                    key={i} 
                    className={`bubble ${s.pnl >= 0 ? 'profit' : 'loss'}`}
                    style={{
                      // Añadimos un degradado oscuro encima de la imagen para que el texto siga siendo legible
                      backgroundImage: `linear-gradient(rgba(21, 23, 30, 0.8), rgba(21, 23, 30, 0.95)), url(${s.imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    {/* s.asset.replace('xyz:', '') limpia el prefijo para la interfaz */}
                    <strong>{s.asset.replace('xyz:', '')} ({s.leverage}x)</strong>: {s.investedMoney.toFixed(2)}$
                    <br/>
                    Entry: ${s.entry.toFixed(2)}
                    <br/>
                    <small>PnL: ${s.pnl.toFixed(2)}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}