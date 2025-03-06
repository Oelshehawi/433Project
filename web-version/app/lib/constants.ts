import { BuildingCard, GESTURES } from './types/index';

/**
 * Game-specific constants and data
 */


// Generate a unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Card data
export const CARDS: BuildingCard[] = [
  {
    id: 'card1',
    gesture: GESTURES.RIGHT_HAND_RAISE,
    name: 'Quick Block',
    description: 'A small, quick building block.',
    effect: 'Adds 1 unit of height to your tower.',
    buildTime: 1,
    buildHeight: 1,
    imageSrc: '/assets/cards/quick-block.svg',
  },
  {
    id: 'card2',
    gesture: GESTURES.T_POSE,
    name: 'Medium Block',
    description: 'A medium-sized building block.',
    effect: 'Adds 2 units of height to your tower.',
    buildTime: 1.5,
    buildHeight: 2,
    imageSrc: '/assets/cards/medium-block.svg',
  },
  {
    id: 'card3',
    gesture: GESTURES.HANDS_ABOVE_HEAD,
    name: 'Tall Column',
    description: 'A tall building column.',
    effect: 'Adds 3 units of height to your tower.',
    buildTime: 2,
    buildHeight: 3,
    imageSrc: '/assets/cards/tall-column.svg',
  },
  {
    id: 'card4',
    gesture: GESTURES.DIAGONAL_ARMS,
    name: 'Bridge Block',
    description: 'A horizontal bridge extension.',
    effect: 'Adds horizontal stability to your tower.',
    buildTime: 1.5,
    buildHeight: 1.5,
    imageSrc: '/assets/cards/bridge-block.svg',
  },
  {
    id: 'card5',
    gesture: GESTURES.HAND_WAVE,
    name: 'Jump Boost',
    description: 'Gives your character a jump boost.',
    effect: 'Character jumps 2 additional units during climb phase.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/jump-boost.svg',
  },
  {
    id: 'card6',
    gesture: GESTURES.ARMS_CROSSED,
    name: 'Defensive Shield',
    description: 'Creates a defensive shield.',
    effect: 'Prevents the next attack against your tower.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/defensive-shield.svg',
  },
  {
    id: 'card7',
    gesture: GESTURES.PUSH_MOTION,
    name: 'Stabilize Tower',
    description: 'Stabilizes your tower.',
    effect: 'Prevents tower collapse for 2 turns.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/stabilize-tower.svg',
  },
  {
    id: 'card8',
    gesture: GESTURES.PUNCH_MOTION,
    name: 'Demolish',
    description: "Attacks opponent's tower.",
    effect: "Removes 1 unit from opponent's tower.",
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/demolish.svg',
  },
  {
    id: 'card9',
    gesture: GESTURES.KARATE_CHOP,
    name: 'Weaken',
    description: "Weakens opponent's next block.",
    effect: 'Next block opponent builds is reduced by 1 unit.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/weaken.svg',
  },
  {
    id: 'card10',
    gesture: GESTURES.CIRCULAR_ARM,
    name: 'Wind Gust',
    description: 'Creates a gust of wind.',
    effect: "50% chance to make opponent's character slip down 1 unit.",
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/wind-gust.svg',
  },
  {
    id: 'card11',
    gesture: GESTURES.CLAP_HANDS,
    name: 'Wild Card',
    description: 'Copies your last successful gesture.',
    effect: 'Copies the effect of the last card you played successfully.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/wild-card.svg',
  },
  {
    id: 'card12',
    gesture: GESTURES.SQUAT_MOTION,
    name: 'Foundation Reinforcement',
    description: "Reinforces your tower's foundation.",
    effect: 'Prevents the bottom 2 units from being destroyed.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/foundation-reinforcement.svg',
  },
  {
    id: 'card13',
    gesture: GESTURES.WEATHER_SHIELD,
    name: 'Weather Shield',
    description: 'Protects against environmental events.',
    effect: 'Protects against random environmental events for 2 turns.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/weather-shield.svg',
  },
  {
    id: 'card14',
    gesture: GESTURES.SPIN_AROUND,
    name: 'Lucky Draw',
    description: 'Draw two extra cards.',
    effect: 'Draw 2 extra cards. Can only be used once per match.',
    buildTime: 1,
    buildHeight: 0,
    imageSrc: '/assets/cards/lucky-draw.svg',
  },
];

// Get random cards from the deck
export const getRandomCards = (count: number): BuildingCard[] => {
  const shuffled = [...CARDS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
