# Gesture Tower: Competitive Edition

A competitive gesture-controlled tower building game where players use physical gestures captured by a camera to build towers and compete against each other in real-time.

## Project Overview

This project consists of two main components:

1. **Web Application (this repository)**: A Next.js web application that provides the user interface, game logic, and visualization for the gesture tower building game.

2. **Beagle Board C Application** (separate repository): A C program running on a Beagle Board that uses a camera to capture and recognize player gestures, sending the data to the web application via UDP and WebSocket.

## Game Rules

### Setup Phase

- Two players face off on opposite sides of the screen
- Each player has their own character and building area
- A finish platform floats at the top (requiring 10-15 units of height to reach)
- Players start with a hand of 4 building cards

### Resource-Based Building System

- Each card shows a specific gesture and its corresponding tower piece
- Players must perform the gesture correctly to activate the card's effect

### Turn Sequence

1. **Planning Phase (5s)**: Players mentally select which gesture/card to use
2. **Action Phase (5s)**: Both players perform their chosen gesture simultaneously
3. **Building Phase (3s)**: Tower pieces appear based on successful gestures
4. **Climbing Phase (2s)**: Characters climb to the top of their current tower
5. **Card Draw Phase**: Players draw one new card (maximum hand size of 5)

### Victory Conditions

- First player to reach the goal platform wins
- If time limit (3 minutes) expires, the player with the tallest tower wins
- Best of three matches for tournament play

## Gesture Library

The game recognizes various gestures that correspond to different game actions:

### Building Gestures

- Quick Right Hand Raise: Small block (1 unit height)
- T-Pose: Medium block (2 units height)
- Hands Above Head: Tall column (3 units height)
- Diagonal Arms: Bridge block (horizontal extension)

### Utility Gestures

- Hand Wave: Jump boost
- Arms Crossed: Defensive shield
- Push Motion: Stabilize tower

### Attack Gestures

- Punch Motion: Removes 1 unit from opponent's tower
- Karate Chop: Weakens opponent's next block
- Circular Arm Motion: Wind gust effect

### Special Gestures

- Clap Hands: Wild card (copies last gesture)
- Squat Motion: Foundation reinforcement
- Both Arms Out: Weather shield
- Spin Around: Lucky draw (get 2 extra cards)

## Development

This project is implemented in milestones:

### Milestone 1

- Create the title screen with animations
- Set up player management
- Implement basic UI/UX elements
- Prepare WebSocket connection for gesture data

### Future Milestones

- Game screen implementation
- Game logic for gesture recognition and tower building
- Full integration with the Beagle Board C application
- Multiplayer functionality

## Technologies Used

- Next.js (React framework)
- TypeScript
- Framer Motion (for animations)
- Socket.io (for WebSocket communication)
- Zustand (for state management)
- TailwindCSS (for styling)

## Getting Started

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
