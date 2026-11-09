export interface Faction {
  id: string;
  name: string;
  color: string;
  seats: number;
  ideology: string;
  mood: number; // 0-100, отношение к игроку
}

export interface Bill {
  id: string;
  title: string;
  description: string;
  category: 'economy' | 'social' | 'security' | 'education' | 'environment';
  effects: {
    popularity: number;
    budget: number;
    factionEffects: { factionId: string; moodChange: number }[];
  };
  icon: string;
}

export interface GameState {
  round: number;
  popularity: number;
  budget: number;
  factions: Faction[];
  currentBill: Bill | null;
  passedBills: string[];
  rejectedBills: string[];
  gameOver: boolean;
  message: string;
}
