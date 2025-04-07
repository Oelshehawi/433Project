import { Card, GameActionType, PlayerCards, Room } from "./types";
import { v4 as uuidv4 } from "uuid";
import { rooms } from "./roomManager";
import { sendToClient } from "./messaging";

// Card templates for each type - simplified to only basic cards
const attackCards: Omit<Card, "id">[] = [
  {
    type: "attack",
    name: "Basic Attack",
    description: "A standard attack that deals damage to the opponent's tower",
  },
];

const defendCards: Omit<Card, "id">[] = [
  {
    type: "defend",
    name: "Basic Shield",
    description: "Blocks the next attack",
  },
];

const buildCards: Omit<Card, "id">[] = [
  {
    type: "build",
    name: "Basic Block",
    description: "Adds one block to your tower",
  },
];

// Generate a card of the specified type
function generateCard(type: GameActionType): Card {
  let cardTemplate: Omit<Card, "id">;

  // Select card template based on type - now only one option per type
  switch (type) {
    case "attack":
      cardTemplate = attackCards[0];
      break;
    case "defend":
      cardTemplate = defendCards[0];
      break;
    case "build":
      cardTemplate = buildCards[0];
      break;
  }

  // Generate a unique id for the card
  return {
    ...cardTemplate,
    id: uuidv4(),
  };
}

// Generate an initial set of cards for a player (3 cards, max 2 of same type)
export function generateInitialCards(): Card[] {
  const cards: Card[] = [];
  const types: GameActionType[] = ["attack", "defend", "build"];
  const typeCounts: Record<GameActionType, number> = {
    attack: 0,
    defend: 0,
    build: 0,
  };

  // Generate 3 cards
  for (let i = 0; i < 3; i++) {
    // Randomly select a type, but ensure no more than 2 of the same type
    let availableTypes = types.filter((type) => typeCounts[type] < 2);

    // If no types available (shouldn't happen), reset and allow any
    if (availableTypes.length === 0) {
      availableTypes = types;
    }

    const randomTypeIndex = Math.floor(Math.random() * availableTypes.length);
    const selectedType = availableTypes[randomTypeIndex];

    // Generate a card of the selected type
    const card = generateCard(selectedType);
    cards.push(card);

    // Update type count
    typeCounts[selectedType]++;
  }

  return cards;
}

// Draw one random card (used when a player uses a card)
export function drawCard(): Card {
  const types: GameActionType[] = ["attack", "defend", "build"];
  const randomTypeIndex = Math.floor(Math.random() * types.length);
  return generateCard(types[randomTypeIndex]);
}

// Initialize cards for a room when game starts
export function initializeCardsForRoom(roomId: string): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  // Only initialize cards if the game is starting
  if (room.status !== "playing") {
    console.error(`Room ${roomId} is not in playing state`);
    return false;
  }

  // Create a map to store player cards
  room.playerCards = new Map();

  // Generate initial cards for each beagleboard player
  const beagleBoardPlayers = room.players.filter(
    (player) => player.playerType === "beagleboard"
  );

  beagleBoardPlayers.forEach((player) => {
    const initialCards = generateInitialCards();

    room.playerCards!.set(player.id, {
      playerId: player.id,
      cards: initialCards,
    });
  });

  return true;
}

// Distribute cards to a player
export function distributeCardsToPlayer(
  roomId: string,
  playerId: string
): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  if (!room.playerCards || !room.playerCards.has(playerId)) {
    console.error(`No cards found for player ${playerId}`);
    return false;
  }

  return true;
}

// Process a card action from a player
export function processCardAction(
  roomId: string,
  playerId: string,
  cardId: string,
  action: GameActionType
): boolean {
  if (!rooms.has(roomId)) {
    console.error(`Room ${roomId} not found`);
    return false;
  }

  const room = rooms.get(roomId)!;

  // Verify player has cards
  if (!room.playerCards || !room.playerCards.has(playerId)) {
    console.error(`No cards found for player ${playerId}`);
    return false;
  }

  const playerCards = room.playerCards.get(playerId)!;

  // Find the card by ID
  const cardIndex = playerCards.cards.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    console.error(`Card ${cardId} not found for player ${playerId}`);
    return false;
  }

  const card = playerCards.cards[cardIndex];

  // Verify the action matches the card type
  if (card.type !== action) {
    console.error(`Card ${cardId} is not of type ${action}`);
    return false;
  }

  // Remove the card from the player's hand
  playerCards.cards.splice(cardIndex, 1);

  // Draw a new card
  const newCard = drawCard();
  playerCards.cards.push(newCard);

  return true;
}
