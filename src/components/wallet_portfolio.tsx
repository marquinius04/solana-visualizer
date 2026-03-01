import { useState, useEffect } from 'react';
import '../App.css';

// ============================================================================
// SECURITY NOTES:
//  - This component NEVER calls Helius or Hyperliquid directly.
//  - All external API calls go through serverless proxies in /api/*.
//  - The HELIUS_API_KEY and HL_WALLET_ADDRESS only exist on the server side.
//  - Phantom is used strictly for read-only wallet connection (publicKey only).
//    No private keys, secret keys, or mnemonics are ever accessed here.
// ============================================================================

// ============================================================================
// 1. DATA FETCHING (via secure backend proxies)
// ============================================================================

/**
 * Fetches the Solana token balances for the given wallet address.
 * Calls /api/tokens (proxy) so the Helius API key is never exposed to the browser.
 */
const cargarMisTokens = async (walletAddress: string) => {
  try {
    const response = await fetch('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    });

    if (!response.ok) {
      throw new Error(`Proxy error: ${response.status}`);
    }

    const { result } = await response.json();
    const listaFinal: any[] = [];

    // 1. Native SOL balance
    if (result.nativeBalance && result.nativeBalance.lamports > 0) {
      listaFinal.push({
        symbol: 'SOL',
        balance: result.nativeBalance.lamports / 10 ** 9,
        mint: 'native',
        imageUrl:
          'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      });
    }

    // 2. SPL tokens with a positive balance
    const tokens = (result.items || [])
      .filter((asset: any) => asset.token_info?.balance > 0)
      .map((asset: any) => ({
        symbol: asset.content.metadata?.symbol || 'N/A',
        balance:
          asset.token_info.balance /
          Math.pow(10, asset.token_info.decimals || 0),
        mint: asset.id,
        imageUrl:
          asset.content?.links?.image ||
          asset.content?.files?.[0]?.uri ||
          null,
      }));

    listaFinal.push(...tokens);

    // 3. Dust filter — show SOL always, hide SPL tokens below 0.01
    const tokensLimpios = listaFinal.filter((t) => {
      if (t.symbol === 'SOL') return true;
      return t.balance >= 0.01;
    });

    if (tokensLimpios.length === 0) {
      return [{ symbol: 'Vacío', balance: 0, mint: 'none', imageUrl: null }];
    }

    return tokensLimpios;
  } catch (error) {
    console.error('Error cargando Solana:', error);
    return [{ symbol: 'Error', balance: 0, mint: 'error', imageUrl: null }];
  }
};

/**
 * Fetches open Hyperliquid perp positions.
 * The wallet address is read from HL_WALLET_ADDRESS env var on the server.
 */
const cargarTodoHyperliquid = async () => {
  try {
    const response = await fetch('/api/hyperliquid', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      if (response.status === 500) {
        console.warn('[Hyperliquid] Server not configured:', body.error);
        return [];
      }
      throw new Error(`Proxy error: ${response.status}`);
    }

    const { positions } = await response.json();
    return positions ?? [];
  } catch (error) {
    console.error('Error en Hyperliquid:', error);
    return [];
  }
};

/**
 * Fetches Kamino Finance lending deposits.
 * SOL_WALLET_ADDRESS is read from server-side env — not sent from the browser.
 * Nothing identifying appears in the Network tab.
 */
const cargarKamino = async () => {
  try {
    const response = await fetch('/api/kamino', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      console.warn('[Kamino] Proxy error:', response.status);
      return [];
    }

    const { positions } = await response.json();
    return positions ?? [];
  } catch (error) {
    console.error('Error en Kamino:', error);
    return [];
  }
};

// ============================================================================
// 2. UI COMPONENT
// ============================================================================

export function WalletPortfolio() {
  const [address, setAddress] = useState<string | null>(null);
  const [tokens, setTokens] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [kaminoPositions, setKaminoPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(true);

  /**
   * Shared helper — loads all data for a given publicKey.
   */
  const cargarDatos = async (publicKey: string) => {
    setLoading(true);
    const [solTokens, hlTrades, kamino] = await Promise.all([
      cargarMisTokens(publicKey),
      cargarTodoHyperliquid(),
      cargarKamino(),
    ]);
    setTokens(solTokens);
    setTrades(hlTrades);
    setKaminoPositions(kamino);
    setLoading(false);
  };

  /**
   * SILENT AUTO-RECONNECT on mount.
   *
   * Uses onlyIfTrusted: true — Phantom reconnects automatically ONLY if the
   * user previously approved this site. No popup, no interaction needed.
   *
   * SECURITY: The wallet address is NEVER stored in localStorage, sessionStorage,
   * or cookies. The trust state lives inside the Phantom extension, not in the app.
   * This eliminates any XSS risk of a stored address being stolen.
   */
  useEffect(() => {
    const intentarReconexion = async () => {
      const provider = (window as any).solana;
      if (!provider?.isPhantom) {
        setConnecting(false);
        return;
      }
      try {
        // This resolves instantly if trusted, throws if not — no popup ever shown.
        const response = await provider.connect({ onlyIfTrusted: true });
        const publicKey: string = response.publicKey.toString();
        setAddress(publicKey);
        await cargarDatos(publicKey);
      } catch {
        // Not previously trusted or Phantom not available — show connect button.
      } finally {
        setConnecting(false);
      }
    };
    intentarReconexion();
  }, []);

  /**
   * Manual connect — called when the user clicks "Connect Wallet".
   * Uses onlyIfTrusted: false so Phantom shows the approval popup if needed.
   * READ-ONLY: only publicKey is accessed. No private keys or signing.
   */
  const conectarYBuscar = async () => {
    const provider = (window as any).solana;

    if (!provider?.isPhantom) {
      alert('Instala Phantom Wallet.');
      return;
    }

    setLoading(true);
    try {
      const response = await provider.connect({ onlyIfTrusted: false });
      const publicKey: string = response.publicKey.toString();
      setAddress(publicKey);
      await cargarDatos(publicKey);
    } catch (error) {
      console.error('Error al conectar wallet:', error);
      alert('No se pudo conectar. Revisa la consola para más detalles.');
    } finally {
      setLoading(false);
    }
  };

  // While the silent reconnect attempt is in progress, render nothing to avoid
  // a flash of the connect button before Phantom responds.
  if (connecting) {
    return (
      <div className="dashboard">
        <h1 className="title">Millogangster Club</h1>
        <p style={{ color: 'var(--text-dim, #aaa)', marginTop: '2rem' }}>Conectando...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h1 className="title">Millogangster Club</h1>

      {!address ? (
        <button className="connect-btn" onClick={conectarYBuscar} disabled={loading}>
          {loading ? 'Conectando...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="sections-container">

          {/* SOLANA — Token balances */}
          <div className="section">
            <h3 className="section-title">Solana Wallet</h3>
            <div className="bubble-grid">
              {tokens.length > 0 ? (
                tokens.map((t, i) => (
                  <div
                    key={`token-${i}`}
                    className="bubble token"
                    style={t.imageUrl ? { backgroundImage: `url(${t.imageUrl})` } : {}}
                  >
                    <div className="bubble-asset">{t.symbol}</div>
                    <div className="bubble-size">{t.balance.toFixed(4)}</div>
                  </div>
                ))
              ) : (
                <p>Buscando activos...</p>
              )}
            </div>
          </div>

          {/* HYPERLIQUID — Open perpetual positions */}
          {trades.length > 0 && (
            <div className="section">
              <h3 className="section-title">Open Positions (Perps)</h3>
              <div className="bubble-grid">
                {trades.map((s, i) => (
                  <div
                    key={`trade-${i}`}
                    className={`bubble perp ${s.pnl >= 0 ? 'profit' : 'loss'}`}
                    style={{ backgroundImage: `url(${s.imageUrl})` }}
                  >
                    {/* Default state */}
                    <div className="perp-ticker">{s.asset.replace('xyz:', '')}</div>
                    <div className={`perp-direction ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {s.side === 'LONG' ? '▲' : '▼'} {s.side} {s.leverage}x
                    </div>
                    <div className={`perp-pnl ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}$
                    </div>

                    {/* Hover state — slides up */}
                    <div className="perp-details">
                      <span>{s.investedMoney.toFixed(2)}$</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* KAMINO FINANCE — Lending deposits (e.g. JitoSOL) */}
          {kaminoPositions.length > 0 && (
            <div className="section">
              <h3 className="section-title">Kamino Lending</h3>
              <div className="bubble-grid">
                {kaminoPositions.map((p, i) => (
                  <div
                    key={`kamino-${i}`}
                    className="bubble token"
                    style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : {}}
                  >
                    <div className="bubble-asset">{p.symbol}</div>
                    <div className="bubble-size">{p.amount.toFixed(4)}</div>
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