import fetch from 'node-fetch';
async function main() {
    const market = 'H6rHXmXoCQvq8Ue81MqNh7ow5ysPa1dSozwW3PU1dDH6'; // Jito Market
    const wallet = 'ATQ5CKLYGVLGSzaKxW3pR3n1vsH2Xa3dP3abgFBqLmZ5';
    // The user suggested https://api.kamino.finance/kamino-market/{JitoSOLPublicKey}/users/{userPublicKey}/obligations
    const url = `https://api.kamino.finance/kamino-market/${market}/users/${wallet}/obligations`;
    console.log("Testing:", url);
    const res = await fetch(url);
    console.log("Status:", res.status);
    const data = await res.text();
    console.log("Data:", data.substring(0, 100));
}
main();
