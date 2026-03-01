import fetch from 'node-fetch';
async function main() {
    const market = '7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF';
    const wallet = process.env.SOL_WALLET_ADDRESS;
    if (!wallet) return console.log("No wallet");
    const url = `https://api.kamino.finance/kamino-market/${market}/users/${wallet}/obligations`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2).substring(0, 1500));
}
main();
