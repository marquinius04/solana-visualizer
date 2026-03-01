// api/kamino.js — Serverless proxy for Kamino Finance lending positions
// ============================================================================
// SECURITY:
//  - SOL_WALLET_ADDRESS is read from server-side env vars only — never sent
//    from the frontend. The network tab shows no wallet address.
//  - CORS restricted to ALLOWED_ORIGIN.
// ============================================================================

import 'dotenv/config';

// ── Known Kamino Lend Markets ───────────────────────────────────────────────
const MARKETS = [
    '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF', // Main Market
    'H6rHXmXoCQvq8Ue81MqNh7ow5ysPa1dSozwW3PU1dDH6', // Jito Market (JitoSOL)
    'ByYiZxp8QrdN9qbdtaAiePN8AAr3qvTPppNJDpf5DVJ5', // Altcoins Market
];

// ── CORS helper ──────────────────────────────────────────────────────────────
function setCorsHeaders(res, origin) {
    const allowed = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
    const dev = /^https?:\/\/localhost(:\d+)?$/.test(origin);
    if (dev || origin === allowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowed);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Ensure wallet is read from backend environment ONLY
    const walletAddress = process.env.SOL_WALLET_ADDRESS?.trim();

    if (!walletAddress) {
        console.warn('[api/kamino] SOL_WALLET_ADDRESS is not set');
        return res.status(500).json({ error: 'SOL_WALLET_ADDRESS not configured', positions: [] });
    }

    try {
        const positions = [];

        // Query obligations across all known markets simultaneously
        const marketPromises = MARKETS.map(async (market) => {
            const url = `https://api.kamino.finance/kamino-market/${market}/users/${walletAddress}/obligations`;
            try {
                const response = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!response.ok) return; // 404 means no obligations in this market

                const data = await response.json();

                // The user's provided Kamino API response structure is:
                // [ { state: { deposits: [ { depositReserve, depositedAmount } ] } } ]
                const obligations = Array.isArray(data) ? data : (data?.obligations ?? [data]);

                console.log(JSON.stringify(obligations, null, 2));

                // Common Kamino lending reserves -> Symbol and Logo
                const RESERVE_MAP = {
                    'EVbyPKrHG6WBfm4dLxLMJpUDY43cCAcHSpV3KYjKsktW': { symbol: 'JitoSOL', decimals: 9, imageUrl: 'https://raw.githubusercontent.com/neonlabsorg/token-list/master/assets/jitosol-token-logo.svg' },
                    '81rHHg2Z6oH14R58bE1YVem62m7CrrkQc6oK72Q9c3U6': { symbol: 'SOL', decimals: 9, imageUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
                    'BgVDxsXzN5ySChm1pA2R7iDB3Vz24aU7tovt63nLh1gC': { symbol: 'USDC', decimals: 6, imageUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
                };

                for (const ob of obligations) {
                    if (!ob || !ob.state || !ob.state.deposits) continue;

                    const depositsArray = Array.isArray(ob.state.deposits) ? ob.state.deposits : Object.values(ob.state.deposits);
                    for (const dep of depositsArray) {
                        const rawAmount = parseFloat(dep.depositedAmount || '0');
                        if (rawAmount > 0) {
                            const reserveInfo = RESERVE_MAP[dep.depositReserve] || { symbol: `Token ${dep.depositReserve.slice(0, 4)}`, decimals: 9 };
                            const amount = rawAmount / Math.pow(10, reserveInfo.decimals);

                            positions.push({
                                symbol: reserveInfo.symbol,
                                amount: amount,
                                imageUrl: reserveInfo.imageUrl || null,
                                reservePubkey: dep.depositReserve,
                                market,
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(`[api/kamino] Error fetching market ${market}:`, err.message);
            }
        });

        await Promise.all(marketPromises);

        return res.status(200).json({ positions });

    } catch (err) {
        console.error('[api/kamino] Unexpected error:', err);
        return res.status(500).json({ error: 'Internal server error', positions: [] });
    }
}
