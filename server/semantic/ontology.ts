// Concept ontology used for semantic matching.
//
// Every free-text term (interest, skill, subject, intent) is canonicalised to a
// concept id. Concepts form a small hierarchy (parent) plus lateral links
// (related), which gives us graded semantic similarity that is deterministic,
// explainable and instant. An embedding provider can later replace or augment
// this behind the same `SemanticIndex` interface (see ./similarity.ts).

export type ConceptCategory =
  | 'game'
  | 'sport'
  | 'music'
  | 'creative'
  | 'food'
  | 'outdoors'
  | 'tech'
  | 'math'
  | 'science'
  | 'humanities'
  | 'language'
  | 'explore'
  | 'social'
  | 'learning'
  | 'lifestyle';

export interface ConceptDef {
  id: string;
  label: string;
  emoji: string;
  category: ConceptCategory;
  aliases?: string[];
  parent?: string;
  related?: string[];
}

const C = (
  id: string,
  label: string,
  emoji: string,
  category: ConceptCategory,
  aliases: string[] = [],
  extra: { parent?: string; related?: string[] } = {},
): ConceptDef => ({ id, label, emoji, category, aliases, ...extra });

export const CONCEPTS: ConceptDef[] = [
  // ── Games ────────────────────────────────────────────────────────────────
  C('video-games', 'Gaming', '🎮', 'game', ['gaming', 'video games', 'videogames', 'games', 'gamer', 'playing games']),
  C('fps-games', 'FPS games', '🎯', 'game', ['fps', 'fps games', 'shooters', 'shooter games', 'first person shooters'], { parent: 'video-games' }),
  C('valorant', 'Valorant', '🎯', 'game', ['valorant', 'valo'], { parent: 'fps-games' }),
  C('counter-strike', 'Counter-Strike', '🎯', 'game', ['counter strike', 'counter-strike', 'cs2', 'csgo', 'cs go'], { parent: 'fps-games' }),
  C('overwatch', 'Overwatch', '🎯', 'game', ['overwatch', 'overwatch 2', 'ow2'], { parent: 'fps-games' }),
  C('apex-legends', 'Apex Legends', '🎯', 'game', ['apex legends', 'apex'], { parent: 'fps-games' }),
  C('fortnite', 'Fortnite', '🎯', 'game', ['fortnite'], { parent: 'fps-games' }),
  C('moba', 'MOBAs', '🛡️', 'game', ['moba', 'mobas'], { parent: 'video-games' }),
  C('league-of-legends', 'League of Legends', '🛡️', 'game', ['league of legends', 'league'], { parent: 'moba' }),
  C('dota', 'Dota 2', '🛡️', 'game', ['dota', 'dota 2'], { parent: 'moba' }),
  C('cozy-games', 'Cozy games', '🌿', 'game', ['cozy games', 'cozy gaming', 'animal crossing'], { parent: 'video-games' }),
  C('minecraft', 'Minecraft', '⛏️', 'game', ['minecraft'], { parent: 'cozy-games' }),
  C('stardew-valley', 'Stardew Valley', '🌾', 'game', ['stardew valley', 'stardew'], { parent: 'cozy-games' }),
  C('rocket-league', 'Rocket League', '🚗', 'game', ['rocket league'], { parent: 'video-games' }),
  C('ea-fc', 'EA FC / FIFA', '⚽', 'game', ['fifa', 'ea fc', 'fc 25', 'fc 26'], { parent: 'video-games', related: ['soccer'] }),
  C('chess', 'Chess', '♟️', 'game', ['chess']),
  C('board-games', 'Board games', '🎲', 'game', ['board games', 'boardgames', 'tabletop games', 'tabletop']),
  C('dnd', 'D&D', '🐉', 'game', ['dnd', 'd&d', 'dungeons and dragons', 'ttrpg', 'tabletop rpg'], { parent: 'board-games' }),
  C('ranked', 'Competitive ranked', '🏆', 'game', ['ranked', 'competitive ranked', 'grind ranked', 'climb ranked', 'competitive gaming', 'esports']),

  // ── Sports ───────────────────────────────────────────────────────────────
  C('sports', 'Sports', '🏅', 'sport', ['sports', 'sport', 'athletics']),
  C('soccer', 'Soccer', '⚽', 'sport', ['soccer', 'football', 'futbol', 'fútbol', 'pickup soccer'], { parent: 'sports' }),
  C('basketball', 'Basketball', '🏀', 'sport', ['basketball', 'hoops', 'nba', 'pickup basketball'], { parent: 'sports' }),
  C('american-football', 'American football', '🏈', 'sport', ['american football', 'nfl', 'college football'], { parent: 'sports' }),
  C('tennis', 'Tennis', '🎾', 'sport', ['tennis', 'pickleball'], { parent: 'sports' }),
  C('volleyball', 'Volleyball', '🏐', 'sport', ['volleyball'], { parent: 'sports' }),
  C('cricket', 'Cricket', '🏏', 'sport', ['cricket', 'ipl'], { parent: 'sports' }),
  C('running', 'Running', '🏃', 'sport', ['running', 'jogging', 'marathons', 'marathon', 'run club'], { parent: 'sports' }),
  C('gym', 'Gym', '🏋️', 'sport', ['gym', 'lifting', 'weightlifting', 'working out', 'workouts', 'fitness'], { parent: 'sports' }),
  C('climbing', 'Climbing', '🧗', 'sport', ['climbing', 'bouldering', 'rock climbing'], { parent: 'sports', related: ['hiking'] }),
  C('swimming', 'Swimming', '🏊', 'sport', ['swimming'], { parent: 'sports' }),
  C('motorsport', 'Motorsport', '🏁', 'sport', ['motorsport', 'motorsports', 'racing', 'nascar', 'indycar']),
  C('formula-1', 'F1', '🏎️', 'sport', ['f1', 'formula 1', 'formula one', 'formula1', 'grand prix'], { parent: 'motorsport' }),

  // ── Music ────────────────────────────────────────────────────────────────
  C('music', 'Music', '🎵', 'music', ['music', 'listening to music']),
  C('jazz', 'Jazz', '🎷', 'music', ['jazz'], { parent: 'music' }),
  C('hip-hop', 'Hip-hop', '🎤', 'music', ['hip hop', 'hip-hop', 'rap'], { parent: 'music' }),
  C('k-pop', 'K-pop', '🎤', 'music', ['k-pop', 'kpop'], { parent: 'music' }),
  C('edm', 'Electronic music', '🎧', 'music', ['edm', 'electronic music', 'house music', 'techno'], { parent: 'music' }),
  C('indie-music', 'Indie music', '🎸', 'music', ['indie music', 'indie rock', 'indie'], { parent: 'music' }),
  C('concerts', 'Concerts', '🎟️', 'music', ['concerts', 'concert', 'live music', 'gigs', 'music festivals'], { parent: 'music' }),
  C('guitar', 'Guitar', '🎸', 'music', ['guitar', 'playing guitar'], { parent: 'music' }),
  C('piano', 'Piano', '🎹', 'music', ['piano'], { parent: 'music' }),
  C('singing', 'Singing', '🎙️', 'music', ['singing', 'choir', 'karaoke'], { parent: 'music' }),

  // ── Creative ─────────────────────────────────────────────────────────────
  C('photography', 'Photography', '📸', 'creative', ['photography', 'photos', 'taking photos', 'taking pictures', 'film photography', 'street photography', 'camera'], { related: ['art', 'film'] }),
  C('art', 'Art', '🎨', 'creative', ['art', 'drawing', 'painting', 'sketching', 'street art', 'galleries']),
  C('design', 'Design', '✏️', 'creative', ['design', 'ui design', 'ux design', 'ui/ux', 'graphic design', 'product design'], { related: ['art'] }),
  C('writing', 'Writing', '✍️', 'creative', ['writing', 'creative writing', 'poetry', 'journaling']),
  C('film', 'Movies', '🎬', 'creative', ['movies', 'movie', 'film', 'films', 'cinema', 'filmmaking']),
  C('anime', 'Anime', '🍥', 'creative', ['anime', 'manga']),
  C('fashion', 'Fashion', '👟', 'creative', ['fashion', 'thrifting', 'sneakers']),
  C('dance', 'Dance', '💃', 'creative', ['dance', 'dancing', 'salsa', 'bachata']),

  // ── Food ─────────────────────────────────────────────────────────────────
  C('food', 'Food', '🍜', 'food', ['food', 'foodie', 'trying restaurants', 'restaurants', 'eating out', 'trying new food', 'new restaurants', 'street food', 'good food']),
  C('cooking', 'Cooking', '🍳', 'food', ['cooking', 'baking', 'cook'], { parent: 'food' }),
  C('coffee', 'Coffee', '☕', 'food', ['coffee', 'cafes', 'cafe', 'coffee shops', 'boba', 'bubble tea'], { related: ['food'] }),
  C('markets', 'Markets', '🛍️', 'food', ['markets', 'farmers markets', 'local markets', 'food markets', 'market'], { related: ['food', 'explore-city'] }),

  // ── Outdoors / lifestyle ─────────────────────────────────────────────────
  C('hiking', 'Hiking', '🥾', 'outdoors', ['hiking', 'hikes', 'trails', 'trail running'], { related: ['parks'] }),
  C('camping', 'Camping', '⛺', 'outdoors', ['camping'], { related: ['hiking'] }),
  C('parks', 'Parks', '🌳', 'outdoors', ['parks', 'park', 'beltline', 'the beltline', 'nature', 'piedmont park']),
  C('travel', 'Travel', '✈️', 'outdoors', ['travel', 'traveling', 'travelling', 'backpacking']),
  C('museums', 'Museums', '🏛️', 'explore', ['museums', 'museum', 'history museums', 'aquarium']),
  C('nightlife', 'Nightlife', '🌃', 'explore', ['nightlife', 'going out', 'clubs', 'bars']),
  C('festivals', 'Festivals', '🎉', 'explore', ['festivals', 'festival', 'cultural festivals', 'events around town']),
  C('reading', 'Reading', '📖', 'lifestyle', ['reading', 'books', 'book club']),
  C('volunteering', 'Volunteering', '🤲', 'lifestyle', ['volunteering', 'volunteer', 'community service']),
  C('sustainability', 'Sustainability', '🌱', 'lifestyle', ['sustainability', 'climate', 'climate tech', 'environment', 'sustainable']),
  C('podcasts', 'Podcasts', '🎧', 'lifestyle', ['podcasts', 'podcast']),

  // ── Tech ─────────────────────────────────────────────────────────────────
  C('programming', 'Programming', '💻', 'tech', ['programming', 'coding', 'code', 'software development', 'software engineering', 'computer science', 'cs', 'developer', 'cs 1301', 'intro to programming']),
  C('python', 'Python', '🐍', 'tech', ['python'], { parent: 'programming', related: ['machine-learning'] }),
  C('java', 'Java', '☕', 'tech', ['java'], { parent: 'programming' }),
  C('javascript', 'JavaScript', '🟨', 'tech', ['javascript', 'js', 'typescript', 'react'], { parent: 'programming', related: ['web-dev'] }),
  C('web-dev', 'Web development', '🌐', 'tech', ['web development', 'web dev', 'frontend', 'front end', 'full stack', 'full-stack', 'backend'], { parent: 'programming' }),
  C('cpp', 'C++', '⚙️', 'tech', ['c++', 'cpp'], { parent: 'programming' }),
  C('data-structures', 'Data structures & algorithms', '🧩', 'tech', ['data structures', 'algorithms', 'dsa', 'data structures and algorithms', 'leetcode'], { parent: 'programming' }),
  C('machine-learning', 'AI / ML', '🧠', 'tech', ['machine learning', 'ml', 'ai', 'artificial intelligence', 'deep learning', 'ai/ml', 'neural networks'], { related: ['python', 'statistics', 'robotics'] }),
  C('robotics', 'Robotics', '🤖', 'tech', ['robotics', 'robots', 'first robotics', 'robot'], { related: ['engineering', 'programming', 'machine-learning'] }),
  C('engineering', 'Engineering', '⚙️', 'tech', ['engineering', 'mechanical engineering', 'mechanical', 'cad', 'electrical engineering', 'engineer']),
  C('startups', 'Startups', '🚀', 'tech', ['startups', 'startup', 'entrepreneurship', 'building companies', 'founders', 'founder']),
  C('hackathons', 'Hackathons', '🛠️', 'tech', ['hackathons', 'hackathon', 'hackgt'], { related: ['programming', 'startups'] }),

  // ── Math ─────────────────────────────────────────────────────────────────
  C('mathematics', 'Math', '📐', 'math', ['math', 'maths', 'mathematics']),
  C('calculus', 'Calculus', '📈', 'math', ['calculus', 'calc', 'calc 1', 'calc 2', 'calc 3', 'calc i', 'calc ii', 'multivariable calculus', 'math 1552', 'math 1551', 'integrals', 'derivatives'], { parent: 'mathematics' }),
  C('linear-algebra', 'Linear algebra', '🧮', 'math', ['linear algebra', 'lin alg', 'linalg', 'matrices', 'math 1554'], { parent: 'mathematics' }),
  C('differential-equations', 'Differential equations', '📉', 'math', ['differential equations', 'diff eq', 'diffeq', 'odes'], { parent: 'mathematics' }),
  C('statistics', 'Statistics', '📊', 'math', ['statistics', 'stats', 'probability'], { parent: 'mathematics' }),
  C('discrete-math', 'Discrete math', '🔢', 'math', ['discrete math', 'discrete mathematics', 'proofs'], { parent: 'mathematics' }),

  // ── Science ──────────────────────────────────────────────────────────────
  C('chemistry', 'Chemistry', '🧪', 'science', ['chemistry', 'chem', 'general chemistry', 'gen chem', 'chem 1310', 'chem 1211', 'stoichiometry']),
  C('organic-chemistry', 'Organic chemistry', '⚗️', 'science', ['organic chemistry', 'orgo', 'o chem', 'ochem', 'organic chem'], { parent: 'chemistry' }),
  C('biology', 'Biology', '🧬', 'science', ['biology', 'bio', 'molecular biology', 'genetics']),
  C('physics', 'Physics', '⚛️', 'science', ['physics', 'phys 2211', 'phys 2212', 'mechanics physics', 'electromagnetism']),
  C('economics', 'Economics', '💹', 'humanities', ['economics', 'econ', 'microeconomics', 'macroeconomics']),
  C('psychology', 'Psychology', '🧠', 'humanities', ['psychology', 'psych']),
  C('history', 'History', '📜', 'humanities', ['history']),
  C('philosophy', 'Philosophy', '🤔', 'humanities', ['philosophy']),

  // ── Languages ────────────────────────────────────────────────────────────
  C('english', 'English', '🗣️', 'language', ['english', 'inglés', 'ingles']),
  C('spanish', 'Spanish', '🗣️', 'language', ['spanish', 'español', 'espanol']),
  C('french', 'French', '🗣️', 'language', ['french', 'français', 'francais']),
  C('portuguese', 'Portuguese', '🗣️', 'language', ['portuguese', 'português', 'portugues']),
  C('german', 'German', '🗣️', 'language', ['german', 'deutsch']),
  C('italian', 'Italian', '🗣️', 'language', ['italian']),
  C('hindi', 'Hindi', '🗣️', 'language', ['hindi']),
  C('marathi', 'Marathi', '🗣️', 'language', ['marathi']),
  C('tamil', 'Tamil', '🗣️', 'language', ['tamil']),
  C('telugu', 'Telugu', '🗣️', 'language', ['telugu']),
  C('bengali', 'Bengali', '🗣️', 'language', ['bengali', 'bangla']),
  C('urdu', 'Urdu', '🗣️', 'language', ['urdu']),
  C('japanese', 'Japanese', '🗣️', 'language', ['japanese', 'nihongo']),
  C('korean', 'Korean', '🗣️', 'language', ['korean']),
  C('mandarin', 'Mandarin', '🗣️', 'language', ['mandarin', 'chinese', 'mandarin chinese']),
  C('cantonese', 'Cantonese', '🗣️', 'language', ['cantonese']),
  C('arabic', 'Arabic', '🗣️', 'language', ['arabic']),
  C('vietnamese', 'Vietnamese', '🗣️', 'language', ['vietnamese']),
  C('russian', 'Russian', '🗣️', 'language', ['russian']),
  C('turkish', 'Turkish', '🗣️', 'language', ['turkish']),
  C('swahili', 'Swahili', '🗣️', 'language', ['swahili']),
  C('yoruba', 'Yoruba', '🗣️', 'language', ['yoruba']),
  C('malayalam', 'Malayalam', '🗣️', 'language', ['malayalam']),
  C('gujarati', 'Gujarati', '🗣️', 'language', ['gujarati']),

  // ── Connect intents ──────────────────────────────────────────────────────
  C('gaming-buddy', 'Gaming partners', '🎮', 'social', ['someone to play with', 'people to play with', 'gaming partner', 'gaming partners', 'gaming buddy', 'gaming buddies', 'duo partner', 'duo', 'squad', 'play together', 'gaming group', 'people to game with', 'someone to game with', 'online gaming group', 'play with'], { related: ['video-games', 'discord-community'] }),
  C('make-friends', 'New friends', '👋', 'social', ['make friends', 'new friends', 'make new friends', 'meet new people', 'meet people', 'a new friend', 'friends', 'friend']),
  C('watch-party', 'Watch parties', '📺', 'social', ['watch parties', 'watch party', 'watch races', 'watch the races', 'watch games together', 'watch together', 'race weekends']),
  C('event-buddy', 'Event buddies', '🎟️', 'social', ['someone to go with', 'go to events', 'attend events', 'event buddy', 'concert buddy', 'someone to attend', 'go to concerts with']),
  C('discord-community', 'Discord groups', '💬', 'social', ['discord', 'discord group', 'discord server', 'small discord group', 'discord groups']),

  // ── Learn intents ────────────────────────────────────────────────────────
  C('study-partner', 'Study partners', '📚', 'learning', ['study partner', 'study partners', 'study buddy', 'someone to study with', 'study with', 'study group', 'people to study with']),
  C('language-exchange', 'Language exchange', '💬', 'learning', ['language exchange', 'language partner', 'language practice', 'practice languages', 'conversation partner', 'practice speaking', 'tandem partner'], { related: ['cultural-exchange'] }),
  C('exam-prep', 'Exam prep', '📝', 'learning', ['exam prep', 'exams', 'exam', 'midterms', 'midterm', 'finals', 'test prep']),

  // ── Explore intents & roles ──────────────────────────────────────────────
  C('local-friend', 'A local friend', '🏠', 'explore', ['someone local', 'a local', 'local friend', 'local friends', 'locals', 'local student', 'local person', 'someone who lives here', 'someone from here'], { related: ['show-around', 'local'] }),
  C('local', 'Local', '📍', 'explore', ['local', 'born and raised', 'grew up here', 'lived here for years', 'lived in atlanta for years', 'native atlantan', 'from atlanta']),
  C('show-around', 'Showing people around', '🗺️', 'explore', ['show people around', 'show newcomers around', 'show you around', 'show someone around', 'show visitors around', 'showing people around', 'showing people cool places', 'show people cool places', 'local guide', 'tour guide', 'city guide', 'show them around'], { related: ['explore-city', 'local-friend'] }),
  C('explore-city', 'Exploring the city', '🏙️', 'explore', ['explore the city', 'exploring the city', 'explore atlanta', 'explore tokyo', 'city exploring', 'sightseeing', 'exploring new places', 'explore new places', 'exploring', 'explore', 'hidden gems', 'cool places', 'wandering around'], { related: ['show-around', 'travel'] }),
  C('cultural-exchange', 'Cultural exchange', '🌏', 'explore', ['cultural exchange', 'culture exchange', 'share cultures', 'sharing cultures', 'learn about cultures', 'other cultures', 'different cultures', 'different backgrounds', 'learn about other cultures'], { related: ['meet-internationals', 'international-student', 'language-exchange'] }),
  C('meet-internationals', 'Meeting people from abroad', '🌍', 'explore', ['meet international students', 'meeting international students', 'meet internationals', 'meet travelers', 'meeting travelers', 'meet people from other countries', 'international visitors', 'meet international visitors', 'meeting international visitors', 'meet newcomers', 'meeting newcomers', 'people from abroad', 'people from around the world'], { related: ['international-student', 'traveler', 'newcomer', 'cultural-exchange'] }),
  C('international-student', 'International student', '🎓', 'explore', ['international student', 'foreign student', 'exchange student', 'study abroad student'], { related: ['newcomer', 'cultural-exchange'] }),
  C('newcomer', 'New in town', '🧳', 'explore', ['new in town', 'new to the city', 'just moved', 'recently moved', 'newly moved', 'new here', 'newcomer', "don't know anyone", 'dont know anyone', 'do not know anyone', 'moved here', 'new to atlanta', 'new to campus'], { related: ['meet-internationals'] }),
  C('traveler', 'Traveler', '✈️', 'explore', ['traveler', 'traveller', 'visiting', 'tourist', 'on a trip', 'for a week'], { related: ['meet-internationals', 'travel'] }),
];

export const CONCEPT_BY_ID: ReadonlyMap<string, ConceptDef> = new Map(CONCEPTS.map((c) => [c.id, c]));
