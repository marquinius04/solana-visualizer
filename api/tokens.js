/**
 * api/tokens.js
 * Serverless proxy for Helius "getAssetsByOwner" endpoint.
 * Compatible with Vercel (and Netlify with minor path change).
 *
 * SECURITY:
 *  - HELIUS_API_KEY is read from server-side env vars — never exposed to the browser.
 *  - CORS is restricted to ALLOWED_ORIGIN (prod) and localhost (dev).
 *  - Only POST requests with a valid walletAddress are accepted.
 */

const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.ALLOWED_ORIGIN, // e.g. https://millogangster.vercel.app
].filter(Boolean);

function setCorsHeaders(req, res) {
    const origin = req.headers['origin'];
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
    setCorsHeaders(req, res);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { walletAddress } = req.body ?? {};

    if (!walletAddress || typeof walletAddress !== 'string' || walletAddress.trim() === '') {
        return res.status(400).json({ error: 'Missing or invalid walletAddress' });
    }

    // Validate Solana address format: base58, 32–44 characters (B2)
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress.trim())) {
        return res.status(400).json({ error: 'Invalid Solana address format' });
    }

    const apiKey = process.env.HELIUS_API_KEY;
    if (!apiKey) {
        console.error('[api/tokens] HELIUS_API_KEY is not set');
        return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    try {
        const heliusRes = await fetch(heliusUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'millogangster-proxy',
                method: 'getAssetsByOwner',
                params: {
                    ownerAddress: walletAddress.trim(),
                    options: {
                        showFungible: true,
                        showNativeBalance: true,
                        showUnverifiedCollections: true,
                    },
                },
            }),
        });

        if (!heliusRes.ok) {
            const text = await heliusRes.text();
            console.error('[api/tokens] Helius error:', heliusRes.status, text);
            return res.status(502).json({ error: 'Upstream error from Helius' });
        }

        const data = await heliusRes.json();
        return res.status(200).json(data);
    } catch (err) {
        console.error('[api/tokens] Fetch error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
