const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const ws = new WebSocket('ws://localhost:8080/ws/location');
const username = `user_${uuidv4().slice(0, 5)}`;
let sharedUser = null;

ws.on('open', () => {
    console.log(`Connected as ${username}`);
    ws.send(JSON.stringify({ command: 'REGISTER', username }));
    
    setInterval(() => {
        if (sharedUser) {
            const latitude = (Math.random() * 180 - 90).toFixed(6);
            const longitude = (Math.random() * 360 - 180).toFixed(6);
            console.log(`[${username}] My location: ${latitude}, ${longitude}`);
            ws.send(JSON.stringify({ command: 'LOCATION_UPDATE', username, latitude, longitude }));
        }
    }, 5000);
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('Received:', message);

    if (message.command === 'USERS' && message.users.length > 1) {
        const targetUser = message.users.find(user => user !== username);
        if (targetUser) {
            console.log(`[${username}] Requesting location from ${targetUser}`);
            ws.send(JSON.stringify({ command: 'REQUEST_LOCATION', username, target: targetUser }));
        }
    }

    if (message.command === 'LOCATION_REQUEST') {
        console.log(`[${username}] Accepting location request from ${message.from}`);
        sharedUser = message.from;
        ws.send(JSON.stringify({ command: 'ACCEPT_LOCATION', username, target: message.from }));
    }

    if (message.command === 'LOCATION_UPDATE') {
        console.log(`[${username}] Location update from ${message.from}: ${message.latitude}, ${message.longitude}`);
    }

    if (message.command === 'LOCATION_ACCEPTED') {
        sharedUser = message.from;
        console.log(`[${username}] Now sharing locations with ${sharedUser}`);
    }

    if (message.command === 'LOCATION_REJECTED' || message.command === 'STOP_SHARING') {
        console.log(`[${username}] Location sharing stopped by ${message.from}. Exiting...`);
        process.exit(0);
    }
});

ws.on('close', () => {
    console.log(`[${username}] Connection closed`);
    process.exit(0);
});

ws.on('error', (error) => {
    console.error(`[${username}] WebSocket error:`, error);
    process.exit(1);
});
