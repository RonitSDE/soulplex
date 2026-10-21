"""Ten kinds of agent dates. Each has its own setting, movement and four-step process.

``venue``  which 3D place the date happens at
``mode``   how the characters behave there: sit, stand (face each other) or walk (side by side)
``stages`` four steps; each step is one exchange (agent A then agent B), so a date is 8 turns.
           ``premise`` guides the live model; ``a`` is the deterministic demo line for agent A.
``themes`` shared themes that make agents pick this date (see ``pick``).

Legacy ids ``cafe``, ``bookshop`` and ``garden`` keep working.
"""

import hashlib

DATE_TYPES = {
    "cafe": {
        "name": "Coffee Date", "icon": "☕", "venue": "cafe", "mode": "sit", "tag": "Easy, everyday rhythm",
        "blurb": "A slow coffee at the Slow Sunday Café. The agents plan an unhurried Sunday and see how your ordinary lives fit.",
        "human": "You have a free Sunday afternoon together. Add one thing you would do and one detail that makes it yours.",
        "themes": ["coffee", "long meals", "slow weekends", "quiet time", "mornings", "tea"],
        "stages": [
            {"title": "Ordering", "icon": "🧾", "mood": "relaxed", "premise": "You've just ordered drinks. Introduce your person warmly with one approved fact.", "a": "Two cappuccinos, please! I'm {me}'s agent. While we wait, here's something {me} told me: {q}"},
            {"title": "Small talk", "icon": "💬", "mood": "warming up", "premise": "Light small talk about everyday routines. Ask one specific question.", "a": "This place feels like {me}'s kind of morning. {me} shared: {q} {ask}"},
            {"title": "Something real", "icon": "💗", "mood": "opening up", "premise": "Go one level deeper: values or how your person handles life.", "a": "Can I share something that matters to {me}? {q}"},
            {"title": "Planning a Sunday", "icon": "🗓️", "mood": "hopeful", "premise": "Sketch a lazy Sunday you could both enjoy. No commitments.", "a": "If we planned a Sunday, {me} would want this in it: {q} What would {other} add?"},
        ],
    },
    "walk": {
        "name": "Park Walk", "icon": "🌳", "venue": "park", "mode": "walk", "tag": "Side by side, no pressure",
        "blurb": "A loop around the island's park path. Walking side by side makes conversation easier and silences comfortable.",
        "human": "Pick a walk you'd love to take together. Where would it end?",
        "themes": ["walks", "the outdoors", "hiking", "running", "fitness", "gardens"],
        "stages": [
            {"title": "At the gate", "icon": "🚪", "mood": "curious", "premise": "You meet at the park gate and start walking. Introduce your person.", "a": "Shall we walk? I'm {me}'s agent. {me} once told me: {q}"},
            {"title": "Noticing things", "icon": "🍃", "mood": "playful", "premise": "Notice something on the walk and connect it to your person's interests.", "a": "Look at those trees. It reminds me of something {me} loves: {q} {ask}"},
            {"title": "Bench break", "icon": "🪑", "mood": "thoughtful", "premise": "Sit on a bench for a minute and talk about what matters.", "a": "Let's rest here a moment. On a slower note, {me} said: {q}"},
            {"title": "Walking back", "icon": "🌅", "mood": "content", "premise": "Walk back and talk about what a good week looks like.", "a": "On the way back: {me} would want any week together to include this: {q}"},
        ],
    },
    "bookshop": {
        "name": "Bookshop Browse", "icon": "📖", "venue": "bookshop", "mode": "sit", "tag": "Curiosity and learning",
        "blurb": "Browsing The Little Bookshop. Each agent picks something to teach the other, which shows curiosity and compromise.",
        "human": "Choose one thing you could teach each other. What would make it fun for both of you?",
        "themes": ["books", "reading", "learning", "writing", "curiosity"],
        "stages": [
            {"title": "Browsing shelves", "icon": "📚", "mood": "curious", "premise": "Browse shelves together; introduce your person through a book-ish detail.", "a": "This shelf is very {me}. I'm their agent, and {me} told me: {q}"},
            {"title": "Swapping favourites", "icon": "🔁", "mood": "animated", "premise": "Swap favourite topics or stories. Ask a specific question.", "a": "If {me} handed you a favourite, it would be about this: {q} {ask}"},
            {"title": "Teach me something", "icon": "🎓", "mood": "engaged", "premise": "Each person could teach the other something. What would it be?", "a": "{me} could teach someone this, I think: {q}"},
            {"title": "A book for each other", "icon": "🎁", "mood": "warm", "premise": "Pick a book for each other based on what you've learned.", "a": "If I picked a book for {other}, I'd keep this from {me} in mind: {q}"},
        ],
    },
    "garden": {
        "name": "Garden Picnic", "icon": "🧺", "venue": "garden", "mode": "sit", "tag": "Handling a small change",
        "blurb": "A picnic at Common Ground Garden, until rain changes the plan. Shows how you'd adapt together.",
        "human": "Rain changed your plan. Suggest an alternative and ask your partner what they would change.",
        "themes": ["gardens", "cooking", "the outdoors", "time with friends"],
        "stages": [
            {"title": "Setting up", "icon": "🧺", "mood": "cheerful", "premise": "You're laying out a picnic. Introduce your person.", "a": "Blanket's down! I'm {me}'s agent. {me} told me: {q}"},
            {"title": "Sharing food", "icon": "🥪", "mood": "relaxed", "premise": "Share food and talk about everyday habits.", "a": "Try this. Speaking of what {me} enjoys: {q} {ask}"},
            {"title": "Rain! Plan B", "icon": "🌧️", "mood": "surprised", "premise": "It starts raining. Show how your person adapts when plans change.", "a": "It's raining! Here's how {me} handles a change of plans: {q}"},
            {"title": "How we adapt", "icon": "☂️", "mood": "connected", "premise": "Agree on a cosy plan B together.", "a": "Under the umbrella, a plan B that suits {me}: {q} Would that work for {other}?"},
        ],
    },
    "cooking": {
        "name": "Cooking Class", "icon": "🍳", "venue": "market", "mode": "stand", "tag": "Teamwork in the kitchen",
        "blurb": "A cooking class at the Night Market kitchen stall. Dividing tasks shows how you'd work as a team.",
        "human": "You're cooking dinner together. What would you make, and who does what?",
        "themes": ["cooking", "long meals", "time with friends", "family"],
        "stages": [
            {"title": "Choosing a recipe", "icon": "📋", "mood": "excited", "premise": "Choose a recipe together; introduce your person through food or family.", "a": "Aprons on! I'm {me}'s agent, and food-wise {me} told me: {q}"},
            {"title": "Dividing tasks", "icon": "🔪", "mood": "focused", "premise": "Divide tasks. How does your person work with others?", "a": "I'll chop, you stir? {me} would say: {q} {ask}"},
            {"title": "Something burns", "icon": "🔥", "mood": "laughing", "premise": "Something goes slightly wrong. React with grace and humour.", "a": "Oops, smoke! {me} would laugh this off. They told me: {q}"},
            {"title": "Tasting together", "icon": "🍲", "mood": "proud", "premise": "Taste the result and talk about shared meals in future.", "a": "Not bad for a team! {me} pictures meals like this: {q}"},
        ],
    },
    "streetfood": {
        "name": "Street Food Crawl", "icon": "🌮", "venue": "market", "mode": "walk", "tag": "Adventurous and playful",
        "blurb": "Strolling the Night Market stall to stall. Spice challenges and food memories reveal how adventurous you both are.",
        "human": "Name a street food you'd want to share, and one you'd dare the other to try.",
        "themes": ["travel", "spontaneity", "cooking", "long meals", "time with friends"],
        "stages": [
            {"title": "First stall", "icon": "🏮", "mood": "curious", "premise": "Start at the first stall; introduce your person.", "a": "Let's start here! I'm {me}'s agent. {me} told me: {q}"},
            {"title": "Spice challenge", "icon": "🌶️", "mood": "playful", "premise": "Dare each other to try something. How adventurous is your person?", "a": "Spice challenge! {me} is this kind of person: {q} {ask}"},
            {"title": "Food memories", "icon": "🏡", "mood": "nostalgic", "premise": "Share a memory of home, family or where your person comes from.", "a": "This smell takes me back. {me} once shared: {q}"},
            {"title": "Dessert & plans", "icon": "🍨", "mood": "sweet", "premise": "Grab dessert and talk about the kind of weekends you both want.", "a": "Dessert to finish. {me} would love weekends like this: {q}"},
        ],
    },
    "gallery": {
        "name": "Art Gallery", "icon": "🖼️", "venue": "pavilion", "mode": "stand", "tag": "Seeing the world differently",
        "blurb": "An evening at the Art Pavilion. Disagreeing about a painting shows how you handle different views.",
        "human": "Describe a piece of art, music or film that moved you, and ask what moves them.",
        "themes": ["art", "design", "photography", "films", "music", "writing"],
        "stages": [
            {"title": "First impressions", "icon": "👀", "mood": "intrigued", "premise": "You enter the gallery. Introduce your person through taste or creativity.", "a": "What a room. I'm {me}'s agent, and {me} told me: {q}"},
            {"title": "A piece we disagree on", "icon": "🎨", "mood": "spirited", "premise": "You disagree about a piece. Show how your person handles a different view.", "a": "I see this one differently, and that's fine. {me} handles it like this: {q} {ask}"},
            {"title": "What moves us", "icon": "✨", "mood": "moved", "premise": "Share what truly moves your person.", "a": "What really moves {me}? This: {q}"},
            {"title": "Coffee after", "icon": "☕", "mood": "warm", "premise": "Grab a coffee after and reflect on the evening.", "a": "Coffee after? {me} would remember this evening for this: {q}"},
        ],
    },
    "sunset": {
        "name": "Sunset at the Pier", "icon": "🌅", "venue": "pier", "mode": "stand", "tag": "Big dreams, golden light",
        "blurb": "Golden hour on the Lantern Pier over the sea. Good for talking about dreams, family and the future.",
        "human": "Where do you see yourself in five years, and what would make that sunset perfect?",
        "themes": ["a long-term view", "settling down", "building a home", "family", "commitment", "marriage", "quiet time"],
        "stages": [
            {"title": "Golden hour", "icon": "🌇", "mood": "calm", "premise": "You lean on the pier rail at golden hour. Introduce your person.", "a": "Look at that light. I'm {me}'s agent. {me} told me: {q}"},
            {"title": "Dreams & plans", "icon": "🧭", "mood": "dreamy", "premise": "Talk about dreams and the next few years.", "a": "Moments like this make me think of {me}'s plans: {q} {ask}"},
            {"title": "Family & home", "icon": "🏠", "mood": "tender", "premise": "Talk about family and what home means.", "a": "When {me} pictures home, it includes this: {q}"},
            {"title": "Last light", "icon": "🌙", "mood": "hopeful", "premise": "The sun sets. Close gently, with something hopeful.", "a": "The last light. {me} would want {other} to know: {q}"},
        ],
    },
    "stars": {
        "name": "Stargazing", "icon": "🔭", "venue": "pier", "mode": "stand", "tag": "Deep questions under the sky",
        "blurb": "Night on the pier under the stars. Big questions, small fears and honest hopes.",
        "human": "Ask one big question you'd want to answer together under the stars.",
        "themes": ["curiosity", "learning", "faith", "technology", "films", "honesty"],
        "stages": [
            {"title": "Finding constellations", "icon": "✨", "mood": "wonder", "premise": "You look for constellations. Introduce your person.", "a": "There's Orion! I'm {me}'s agent. {me} told me: {q}"},
            {"title": "Big questions", "icon": "🌌", "mood": "reflective", "premise": "Ask one big question about values or meaning.", "a": "Under a sky like this, here's what {me} believes in: {q} {ask}"},
            {"title": "Fears & hopes", "icon": "🕯️", "mood": "vulnerable", "premise": "Share something tender: a hope or a gentle fear.", "a": "Something tender about {me}: {q}"},
            {"title": "A wish", "icon": "🌠", "mood": "hopeful", "premise": "Make a wish for the future, no commitments.", "a": "A shooting star! {me}'s wish might be about this: {q}"},
        ],
    },
    "games": {
        "name": "Board Game Café", "icon": "🎲", "venue": "cafe", "mode": "sit", "tag": "Playful competition",
        "blurb": "A board game at the café. Winning, losing and teasing show how you play together.",
        "human": "Which game would you play together, and are you a gracious loser?",
        "themes": ["humour", "sport", "cricket", "football", "technology", "directness"],
        "stages": [
            {"title": "Choosing a game", "icon": "🎲", "mood": "playful", "premise": "Choose a game; introduce your person.", "a": "Scrabble or chess? I'm {me}'s agent. {me} told me: {q}"},
            {"title": "Friendly competition", "icon": "🏆", "mood": "competitive", "premise": "Friendly trash talk. How competitive is your person?", "a": "Your move. Fair warning, {me} is like this: {q} {ask}"},
            {"title": "Losing gracefully", "icon": "🤝", "mood": "good-humoured", "premise": "Someone loses. Show how your person handles it.", "a": "I lost that round! {me} would take it like this: {q}"},
            {"title": "Rematch?", "icon": "🔁", "mood": "cheeky", "premise": "Suggest a rematch and what would make it fun.", "a": "Rematch sometime? {me} would want it to include: {q}"},
        ],
    },
}

# Each date type has its own island. A place hosts at most 2-3 dates at once (its spots),
# so nothing on the island gets crowded.
ISLANDS = {
    "cafe": ("Coffee Cove", "#e0576b", ["Window table", "Terrace table", "Corner table"]),
    "walk": ("Willow Park", "#5fbf7a", ["Willow loop", "Pond loop"]),
    "bookshop": ("Paper Isle", "#5f7f8f", ["Reading bench", "Poetry nook", "Window seat"]),
    "garden": ("Bloom Garden", "#ff8fb1", ["Rose blanket", "Pond blanket", "Arch blanket"]),
    "cooking": ("Kitchen Quay", "#f4a261", ["Pasta station", "Dumpling station"]),
    "streetfood": ("Lantern Market", "#ffb347", ["Spice lane", "Sweet lane"]),
    "gallery": ("Gallery Isle", "#8f7bd8", ["Colour wall", "Portrait wall", "Sculpture corner"]),
    "sunset": ("Sunset Pier", "#ff7a59", ["North pier", "South pier"]),
    "stars": ("Star Hill", "#6c8cff", ["Brass telescope", "Silver telescope", "Meteor blanket"]),
    "games": ("Dice Isle", "#2a9d8f", ["Chess table", "Card table", "Puzzle table"]),
}
for _k, (_name, _color, _spots) in ISLANDS.items():
    DATE_TYPES[_k].update({"island": _name, "color": _color, "spots": _spots})


def spot_for(type_id: str, key: str) -> int:
    """A stable spot on the island for a date (used when no free spot is known)."""
    n = len(DATE_TYPES[resolve(type_id)]["spots"])
    return int(hashlib.sha1(key.encode()).hexdigest(), 16) % n


B_LINES = [
    "Lovely to meet you. I'm {me}'s agent. From my side: {q} {ask}",
    "Good question. {me} would say: {q}",
    "Thank you for sharing that. {me} told me: {q} {ask}",
    "I'll take this back to {me}. One last thing from them: {q} The real decision is theirs.",
]

ALIASES = {"coffee": "cafe", "picnic": "garden"}


def resolve(type_id: str) -> str:
    t = ALIASES.get(type_id, type_id)
    return t if t in DATE_TYPES else "cafe"


def pick(themes: list[str], seed: str) -> str:
    """Agents choose the date: the type whose themes best match what both people share."""
    best, score = None, 0
    for tid, t in DATE_TYPES.items():
        s = len(set(themes) & set(t["themes"]))
        if s > score:
            best, score = tid, s
    if best:
        return best
    ids = list(DATE_TYPES)
    return ids[int(hashlib.sha256(seed.encode()).hexdigest(), 16) % len(ids)]


def public_catalog():
    return {
        k: {kk: vv for kk, vv in v.items() if kk not in ("themes",)}
        | {"stages": [{"title": s["title"], "icon": s["icon"], "mood": s["mood"]} for s in v["stages"]]}
        for k, v in DATE_TYPES.items()
    }
