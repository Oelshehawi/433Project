# 🗼 Gesture Tower — Multiplayer Gesture-Controlled Game

**Gesture Tower** is a multiplayer game where players use **real-time hand gestures**—captured through a webcam connected to a BeagleBoard—to control the game. Players join virtual rooms via a web interface and compete using gestures that are recognized, processed, and sent to the game server.

---

## 🎯 Project Overview

**Gesture Tower** blends embedded systems, computer vision, and web technologies to create a seamless, interactive multiplayer experience using hand gestures instead of traditional controllers.

---

## 🧩 System Components

### 🎥 BeagleBoard (C++)
- Interfaces with a USB webcam
- Performs real-time hand gesture recognition (e.g., fist, open hand, swipe)
- Sends gesture events to the central game server via WebSockets

### 🌐 Web App (Next.js)
- Frontend for players to:
  - Create or join game rooms
  - View gesture instructions
  - Watch real-time feedback
- Deployed and accessible via browser

### 🖥️ Game Server (JavaScript)
- Hosted on **Render**
- Handles:
  - Room management and matchmaking
  - Game logic (scoring, timing, events)
  - Real-time player communication using WebSockets

---

## ✋ Gesture Recognition
- Powered by OpenCV and custom logic on the BeagleBoard
- Recognizes a set of predefined hand gestures
- Gestures mapped to game-specific actions (e.g., tower building, blocking, or attacking)

---

## 🧪 Technologies Used

- **C++ (BeagleBoard)**: Embedded gesture detection
- **OpenCV**: Image processing and hand tracking
- **WebSockets**: Real-time client-server communication
- **Next.js**: Modern web interface
- **JavaScript (Node.js)**: Game server logic and WebSocket handling
- **Render**: Server deployment
