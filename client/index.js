const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080/ws/location');

let username = `User_${Math.floor(Math.random() * 1000)}`;
let locationInterval;
let sharedUsers = new Set();
let userLocations = new Map();

ws.on('open', () => {
    console.log(`✅ Conectado como ${username}`);
    ws.send(JSON.stringify({ command: "REGISTER", username }));
});

ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log("\n📩 Mensaje recibido:", message);

    switch (message.command) {
        case "USERS":
            console.log("👥 Usuarios conectados:", message.users.join(", "));
            sincronizarUsuarios(message.users);
            break;
        case "LOCATION_REQUEST":
            console.log(`📍 ${message.from} ha solicitado tu ubicación.`);
            aceptarUbicacion(message.from);
            break;
        case "LOCATION_UPDATE":
            userLocations.set(message.from, { latitude: message.latitude, longitude: message.longitude });
            userLocations.set(username, { latitude: message.latitude, longitude: message.longitude });
            mostrarUbicaciones();
            break;
        case "LOCATION_REJECTED":
            console.log(`❌ ${message.from} rechazó compartir ubicación.`);
            break;
        case "STOP_SHARING":
            console.log(`🛑 ${message.from} dejó de compartir ubicación.`);
            sharedUsers.delete(message.from);
            userLocations.delete(message.from);
            mostrarUbicaciones();
            break;
    }
});

function sincronizarUsuarios(users) {
    users.forEach(user => {
        if (user !== username && !sharedUsers.has(user)) {
            console.log(`📨 Solicitando ubicación de ${user}`);
            ws.send(JSON.stringify({ command: "REQUEST_LOCATION", username, target: user }));
        }
    });
}

function aceptarUbicacion(sender) {
    console.log(`✅ Aceptando compartir ubicación con ${sender}`);
    ws.send(JSON.stringify({ command: "ACCEPT_LOCATION", username, target: sender }));
    sharedUsers.add(sender);
    enviarUbicacionPeriodica();
}

function enviarUbicacionPeriodica() {
    let lat = 10.5000, lng = -66.9167;

    locationInterval = setInterval(() => {
        if (sharedUsers.size === 0) {
            clearInterval(locationInterval);
            return;
        }
        lat += (Math.random() - 0.5) * 0.01;
        lng += (Math.random() - 0.5) * 0.01;
        userLocations.set(username, { latitude: lat, longitude: lng });
        mostrarUbicaciones();
        
        ws.send(JSON.stringify({ command: "LOCATION_UPDATE", username, latitude: `${lat}`, longitude: `${lng}` }));
    }, 3000);
}

function mostrarUbicaciones() {
    console.log("\n📌 Ubicaciones actuales:");
    userLocations.forEach((location, user) => {
        console.log(`➡️ ${user}: Lat ${location.latitude}, Lng ${location.longitude}`);
    });
}
