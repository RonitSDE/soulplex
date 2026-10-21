/* Generated from backend/app/date_types.py by scripts/gen_date_types.py: do not edit by hand. */
export type DateStage = { title: string; icon: string; mood: string };
export type DateType = { name: string; icon: string; venue: string; mode: "sit" | "stand" | "walk"; tag: string; blurb: string; human: string; island: string; color: string; spots: string[]; stages: DateStage[] };
export const DATE_TYPES: Record<string, DateType> = {
 "cafe": {
  "name": "Coffee Date",
  "icon": "☕",
  "venue": "cafe",
  "mode": "sit",
  "tag": "Easy, everyday rhythm",
  "blurb": "A slow coffee at the Slow Sunday Café. The agents plan an unhurried Sunday and see how your ordinary lives fit.",
  "human": "You have a free Sunday afternoon together. Add one thing you would do and one detail that makes it yours.",
  "stages": [
   {
    "title": "Ordering",
    "icon": "🧾",
    "mood": "relaxed"
   },
   {
    "title": "Small talk",
    "icon": "💬",
    "mood": "warming up"
   },
   {
    "title": "Something real",
    "icon": "💗",
    "mood": "opening up"
   },
   {
    "title": "Planning a Sunday",
    "icon": "🗓️",
    "mood": "hopeful"
   }
  ],
  "island": "Coffee Cove",
  "color": "#e0576b",
  "spots": [
   "Window table",
   "Terrace table",
   "Corner table"
  ]
 },
 "walk": {
  "name": "Park Walk",
  "icon": "🌳",
  "venue": "park",
  "mode": "walk",
  "tag": "Side by side, no pressure",
  "blurb": "A loop around the island's park path. Walking side by side makes conversation easier and silences comfortable.",
  "human": "Pick a walk you'd love to take together. Where would it end?",
  "stages": [
   {
    "title": "At the gate",
    "icon": "🚪",
    "mood": "curious"
   },
   {
    "title": "Noticing things",
    "icon": "🍃",
    "mood": "playful"
   },
   {
    "title": "Bench break",
    "icon": "🪑",
    "mood": "thoughtful"
   },
   {
    "title": "Walking back",
    "icon": "🌅",
    "mood": "content"
   }
  ],
  "island": "Willow Park",
  "color": "#5fbf7a",
  "spots": [
   "Willow loop",
   "Pond loop"
  ]
 },
 "bookshop": {
  "name": "Bookshop Browse",
  "icon": "📖",
  "venue": "bookshop",
  "mode": "sit",
  "tag": "Curiosity and learning",
  "blurb": "Browsing The Little Bookshop. Each agent picks something to teach the other, which shows curiosity and compromise.",
  "human": "Choose one thing you could teach each other. What would make it fun for both of you?",
  "stages": [
   {
    "title": "Browsing shelves",
    "icon": "📚",
    "mood": "curious"
   },
   {
    "title": "Swapping favourites",
    "icon": "🔁",
    "mood": "animated"
   },
   {
    "title": "Teach me something",
    "icon": "🎓",
    "mood": "engaged"
   },
   {
    "title": "A book for each other",
    "icon": "🎁",
    "mood": "warm"
   }
  ],
  "island": "Paper Isle",
  "color": "#5f7f8f",
  "spots": [
   "Reading bench",
   "Poetry nook",
   "Window seat"
  ]
 },
 "garden": {
  "name": "Garden Picnic",
  "icon": "🧺",
  "venue": "garden",
  "mode": "sit",
  "tag": "Handling a small change",
  "blurb": "A picnic at Common Ground Garden, until rain changes the plan. Shows how you'd adapt together.",
  "human": "Rain changed your plan. Suggest an alternative and ask your partner what they would change.",
  "stages": [
   {
    "title": "Setting up",
    "icon": "🧺",
    "mood": "cheerful"
   },
   {
    "title": "Sharing food",
    "icon": "🥪",
    "mood": "relaxed"
   },
   {
    "title": "Rain! Plan B",
    "icon": "🌧️",
    "mood": "surprised"
   },
   {
    "title": "How we adapt",
    "icon": "☂️",
    "mood": "connected"
   }
  ],
  "island": "Bloom Garden",
  "color": "#ff8fb1",
  "spots": [
   "Rose blanket",
   "Pond blanket",
   "Arch blanket"
  ]
 },
 "cooking": {
  "name": "Cooking Class",
  "icon": "🍳",
  "venue": "market",
  "mode": "stand",
  "tag": "Teamwork in the kitchen",
  "blurb": "A cooking class at the Night Market kitchen stall. Dividing tasks shows how you'd work as a team.",
  "human": "You're cooking dinner together. What would you make, and who does what?",
  "stages": [
   {
    "title": "Choosing a recipe",
    "icon": "📋",
    "mood": "excited"
   },
   {
    "title": "Dividing tasks",
    "icon": "🔪",
    "mood": "focused"
   },
   {
    "title": "Something burns",
    "icon": "🔥",
    "mood": "laughing"
   },
   {
    "title": "Tasting together",
    "icon": "🍲",
    "mood": "proud"
   }
  ],
  "island": "Kitchen Quay",
  "color": "#f4a261",
  "spots": [
   "Pasta station",
   "Dumpling station"
  ]
 },
 "streetfood": {
  "name": "Street Food Crawl",
  "icon": "🌮",
  "venue": "market",
  "mode": "walk",
  "tag": "Adventurous and playful",
  "blurb": "Strolling the Night Market stall to stall. Spice challenges and food memories reveal how adventurous you both are.",
  "human": "Name a street food you'd want to share, and one you'd dare the other to try.",
  "stages": [
   {
    "title": "First stall",
    "icon": "🏮",
    "mood": "curious"
   },
   {
    "title": "Spice challenge",
    "icon": "🌶️",
    "mood": "playful"
   },
   {
    "title": "Food memories",
    "icon": "🏡",
    "mood": "nostalgic"
   },
   {
    "title": "Dessert & plans",
    "icon": "🍨",
    "mood": "sweet"
   }
  ],
  "island": "Lantern Market",
  "color": "#ffb347",
  "spots": [
   "Spice lane",
   "Sweet lane"
  ]
 },
 "gallery": {
  "name": "Art Gallery",
  "icon": "🖼️",
  "venue": "pavilion",
  "mode": "stand",
  "tag": "Seeing the world differently",
  "blurb": "An evening at the Art Pavilion. Disagreeing about a painting shows how you handle different views.",
  "human": "Describe a piece of art, music or film that moved you, and ask what moves them.",
  "stages": [
   {
    "title": "First impressions",
    "icon": "👀",
    "mood": "intrigued"
   },
   {
    "title": "A piece we disagree on",
    "icon": "🎨",
    "mood": "spirited"
   },
   {
    "title": "What moves us",
    "icon": "✨",
    "mood": "moved"
   },
   {
    "title": "Coffee after",
    "icon": "☕",
    "mood": "warm"
   }
  ],
  "island": "Gallery Isle",
  "color": "#8f7bd8",
  "spots": [
   "Colour wall",
   "Portrait wall",
   "Sculpture corner"
  ]
 },
 "sunset": {
  "name": "Sunset at the Pier",
  "icon": "🌅",
  "venue": "pier",
  "mode": "stand",
  "tag": "Big dreams, golden light",
  "blurb": "Golden hour on the Lantern Pier over the sea. Good for talking about dreams, family and the future.",
  "human": "Where do you see yourself in five years, and what would make that sunset perfect?",
  "stages": [
   {
    "title": "Golden hour",
    "icon": "🌇",
    "mood": "calm"
   },
   {
    "title": "Dreams & plans",
    "icon": "🧭",
    "mood": "dreamy"
   },
   {
    "title": "Family & home",
    "icon": "🏠",
    "mood": "tender"
   },
   {
    "title": "Last light",
    "icon": "🌙",
    "mood": "hopeful"
   }
  ],
  "island": "Sunset Pier",
  "color": "#ff7a59",
  "spots": [
   "North pier",
   "South pier"
  ]
 },
 "stars": {
  "name": "Stargazing",
  "icon": "🔭",
  "venue": "pier",
  "mode": "stand",
  "tag": "Deep questions under the sky",
  "blurb": "Night on the pier under the stars. Big questions, small fears and honest hopes.",
  "human": "Ask one big question you'd want to answer together under the stars.",
  "stages": [
   {
    "title": "Finding constellations",
    "icon": "✨",
    "mood": "wonder"
   },
   {
    "title": "Big questions",
    "icon": "🌌",
    "mood": "reflective"
   },
   {
    "title": "Fears & hopes",
    "icon": "🕯️",
    "mood": "vulnerable"
   },
   {
    "title": "A wish",
    "icon": "🌠",
    "mood": "hopeful"
   }
  ],
  "island": "Star Hill",
  "color": "#6c8cff",
  "spots": [
   "Brass telescope",
   "Silver telescope",
   "Meteor blanket"
  ]
 },
 "games": {
  "name": "Board Game Café",
  "icon": "🎲",
  "venue": "cafe",
  "mode": "sit",
  "tag": "Playful competition",
  "blurb": "A board game at the café. Winning, losing and teasing show how you play together.",
  "human": "Which game would you play together, and are you a gracious loser?",
  "stages": [
   {
    "title": "Choosing a game",
    "icon": "🎲",
    "mood": "playful"
   },
   {
    "title": "Friendly competition",
    "icon": "🏆",
    "mood": "competitive"
   },
   {
    "title": "Losing gracefully",
    "icon": "🤝",
    "mood": "good-humoured"
   },
   {
    "title": "Rematch?",
    "icon": "🔁",
    "mood": "cheeky"
   }
  ],
  "island": "Dice Isle",
  "color": "#2a9d8f",
  "spots": [
   "Chess table",
   "Card table",
   "Puzzle table"
  ]
 }
} as any;
