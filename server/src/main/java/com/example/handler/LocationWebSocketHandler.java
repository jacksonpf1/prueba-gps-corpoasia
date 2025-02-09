package com.example.handler;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.*;
import java.util.*;

@Component
public class LocationWebSocketHandler extends TextWebSocketHandler {
    private static final Map<String, WebSocketSession> connectedUsers = new ConcurrentHashMap<>();
    private static final Map<String, String> sessionToUser = new ConcurrentHashMap<>();
    private static final Map<String, String> userToSession = new ConcurrentHashMap<>();
    private static final Map<String, String> locationRequests = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Espera a recibir el username antes de agregar al usuario
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = session.getId();
        String username = sessionToUser.remove(sessionId);
        if (username != null) {
            userToSession.remove(username);
            connectedUsers.remove(username);
            locationRequests.values().removeIf(value -> value.equals(username));
            locationRequests.remove(username);
            broadcastConnectedUsers();
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, String> payload = objectMapper.readValue(message.getPayload(), Map.class);
        String command = payload.get("command");
        String username = payload.get("username");

        switch (command) {
            case "REGISTER":
                registerUser(username, session);
                break;
            case "REQUEST_LOCATION":
                requestLocation(username, payload.get("target"));
                break;
            case "ACCEPT_LOCATION":
                acceptLocation(username, payload.get("target"));
                break;
            case "REJECT_LOCATION":
                notifyRejection(payload.get("target"));
                break;
            case "STOP_SHARING":
                stopSharingLocation(username);
                break;
            case "LOCATION_UPDATE":
                updateLocation(username, payload.get("latitude"), payload.get("longitude"));
                break;
        }
    }

    private void registerUser(String username, WebSocketSession session) {
        sessionToUser.put(session.getId(), username);
        userToSession.put(username, session.getId());
        connectedUsers.put(username, session);
        broadcastConnectedUsers();
    }

    private void broadcastConnectedUsers() {
        List<String> userList = new ArrayList<>(connectedUsers.keySet());
        broadcastMessage(Map.of("command", "USERS", "users", userList));
    }

    private void requestLocation(String sender, String receiver) throws Exception {
        WebSocketSession receiverSession = connectedUsers.get(receiver);
        if (receiverSession != null) {
            receiverSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of("command", "LOCATION_REQUEST", "from", sender))));
            locationRequests.put(receiver, sender);
        }
    }

    private void acceptLocation(String sender, String receiver) throws Exception {
        if (locationRequests.get(sender) == null || !locationRequests.get(sender).equals(receiver)) return;
        locationRequests.remove(sender);

        WebSocketSession receiverSession = connectedUsers.get(receiver);
        WebSocketSession senderSession = connectedUsers.get(sender);

        if (receiverSession != null && senderSession != null) {
            receiverSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of("command", "LOCATION_ACCEPTED", "from", sender))));
            senderSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of("command", "LOCATION_ACCEPTED", "from", receiver))));
        }
    }

    private void updateLocation(String sender, String latitude, String longitude) throws Exception {
        for (Map.Entry<String, String> entry : locationRequests.entrySet()) {
            if (entry.getValue().equals(sender) || entry.getKey().equals(sender)) {
                String receiver = entry.getKey().equals(sender) ? entry.getValue() : entry.getKey();
                WebSocketSession receiverSession = connectedUsers.get(receiver);
                if (receiverSession != null) {
                    receiverSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(
                        Map.of("command", "LOCATION_UPDATE", "from", sender, "latitude", latitude, "longitude", longitude))));
                }
            }
        }
    }

    private void notifyRejection(String receiver) throws Exception {
        String sender = locationRequests.remove(receiver);
        if (sender == null) return;

        WebSocketSession senderSession = connectedUsers.get(sender);
        if (senderSession != null) {
            senderSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(Map.of("command", "LOCATION_REJECTED", "from", receiver))));
        }
    }

    private void stopSharingLocation(String sender) {
        locationRequests.values().removeIf(value -> value.equals(sender));
        locationRequests.remove(sender);
    }

    private void broadcastMessage(Map<String, Object> message) {
        try {
            String jsonMessage = objectMapper.writeValueAsString(message);
            for (WebSocketSession session : connectedUsers.values()) {
                session.sendMessage(new TextMessage(jsonMessage));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
