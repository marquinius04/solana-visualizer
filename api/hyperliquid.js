/**
 * api/hyperliquid.js
 * Serverless proxy for Hyperliquid "clearinghouseState" endpoint.
 * Compatible with Vercel (and Netlify with minor path change).
 *
 * SECURITY:
 *  - HL_WALLET_ADDRESS is read from server-side env vars — never exposed to the browser.
 *  - CORS is restricted to ALLOWED_ORIGIN (prod) and localhost (dev).
 *  - This function is strictly read-only (no signing, no private keys).
 */

const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.ALLOWED_ORIGIN, // e.g. https://millogangster.vercel.app
].filter(Boolean);

const HL_API_URL = 'https://api.hyperliquid.xyz/info';

function setCorsHeaders(req, res) {
    const origin = req.headers['origin'];
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

async function fetchClearinghouseState(userAddress, dex = undefined) {
    const body = { type: 'clearinghouseState', user: userAddress.toLowerCase() };
    if (dex) body.dex = dex;

    const response = await fetch(HL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Hyperliquid responded with ${response.status}`);
    }
    return response.json();
}

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const walletAddress = process.env.HL_WALLET_ADDRESS;
    if (!walletAddress) {
        console.error('[api/hyperliquid] HL_WALLET_ADDRESS is not set');
        return res.status(500).json({ error: 'Server misconfiguration: HL_WALLET_ADDRESS not set' });
    }

    try {
        // Fetch both standard DEX and xyz DEX in parallel — read-only calls
        const [estadoNormal, estadoXyz] = await Promise.all([
            fetchClearinghouseState(walletAddress),
            fetchClearinghouseState(walletAddress, 'xyz'),
        ]);

        // Merge all positions from both DEXes
        const todasLasPosiciones = [
            ...(estadoNormal.assetPositions ?? []),
            ...(estadoXyz.assetPositions ?? []),
        ];

        // Filter closed positions (size === 0) and shape the response
        const posiciones = todasLasPosiciones
            .filter((p) => parseFloat(p.position.szi) !== 0)
            .map((p) => {
                const size = parseFloat(p.position.szi);
                const assetName = p.position.coin;
                return {
                    asset: assetName,
                    side: size > 0 ? 'LONG' : 'SHORT',
                    investedMoney: parseFloat(p.position.marginUsed),
                    totalValue: parseFloat(p.position.positionValue),
                    entry: parseFloat(p.position.entryPx),
                    pnl: parseFloat(p.position.unrealizedPnl),
                    leverage: p.position.leverage.value,
                    imageUrl: `https://app.hyperliquid.xyz/coins/${assetName}.svg`,
                };
            });

        return res.status(200).json({ positions: posiciones });
    } catch (err) {
        console.error('[api/hyperliquid] Error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch Hyperliquid data' });
    }
}
