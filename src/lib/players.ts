// Player pool for the draft. Kept as plain data so it can later be swapped
// for a remote source (API / database) without touching game logic.

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD'
export type Era = 'current' | 'retired' | 'women'

export interface Player {
  id: string
  name: string
  country: string
  position: Position
  ovr: number
  pace: number
  shooting: number
  passing: number
  defending: number
  era: Era
  /** Baseline market value in $M, used to seed AI valuations. */
  value: number
}

// A compact but varied pool: current stars + retired legends + women's icons.
export const PLAYERS: Player[] = [
  // --- Current men's stars ---
  { id: 'mbappe', name: 'Kylian Mbappé', country: 'France', position: 'FWD', ovr: 91, pace: 97, shooting: 90, passing: 80, defending: 36, era: 'current', value: 78 },
  { id: 'haaland', name: 'Erling Haaland', country: 'Norway', position: 'FWD', ovr: 91, pace: 89, shooting: 93, passing: 66, defending: 45, era: 'current', value: 76 },
  { id: 'bellingham', name: 'Jude Bellingham', country: 'England', position: 'MID', ovr: 90, pace: 82, shooting: 84, passing: 86, defending: 78, era: 'current', value: 74 },
  { id: 'vinicius', name: 'Vinícius Júnior', country: 'Brazil', position: 'FWD', ovr: 90, pace: 95, shooting: 84, passing: 81, defending: 29, era: 'current', value: 72 },
  { id: 'yamal', name: 'Lamine Yamal', country: 'Spain', position: 'FWD', ovr: 88, pace: 91, shooting: 82, passing: 85, defending: 35, era: 'current', value: 62 },
  { id: 'rodri', name: 'Rodri', country: 'Spain', position: 'MID', ovr: 90, pace: 66, shooting: 78, passing: 87, defending: 87, era: 'current', value: 70 },
  { id: 'debruyne', name: 'Kevin De Bruyne', country: 'Belgium', position: 'MID', ovr: 90, pace: 72, shooting: 86, passing: 93, defending: 64, era: 'current', value: 60 },
  { id: 'kane', name: 'Harry Kane', country: 'England', position: 'FWD', ovr: 90, pace: 68, shooting: 92, passing: 84, defending: 47, era: 'current', value: 62 },
  { id: 'salah', name: 'Mohamed Salah', country: 'Egypt', position: 'FWD', ovr: 89, pace: 89, shooting: 87, passing: 81, defending: 45, era: 'current', value: 58 },
  { id: 'vandijk', name: 'Virgil van Dijk', country: 'Netherlands', position: 'DEF', ovr: 89, pace: 78, shooting: 60, passing: 71, defending: 90, era: 'current', value: 50 },
  { id: 'martinez', name: 'Lautaro Martínez', country: 'Argentina', position: 'FWD', ovr: 89, pace: 85, shooting: 88, passing: 76, defending: 46, era: 'current', value: 56 },
  { id: 'foden', name: 'Phil Foden', country: 'England', position: 'MID', ovr: 88, pace: 82, shooting: 83, passing: 85, defending: 60, era: 'current', value: 54 },
  { id: 'saka', name: 'Bukayo Saka', country: 'England', position: 'FWD', ovr: 87, pace: 86, shooting: 82, passing: 82, defending: 52, era: 'current', value: 52 },
  { id: 'wirtz', name: 'Florian Wirtz', country: 'Germany', position: 'MID', ovr: 87, pace: 82, shooting: 80, passing: 87, defending: 55, era: 'current', value: 50 },
  { id: 'musiala', name: 'Jamal Musiala', country: 'Germany', position: 'MID', ovr: 88, pace: 84, shooting: 82, passing: 88, defending: 55, era: 'current', value: 56 },
  { id: 'pedri', name: 'Pedri', country: 'Spain', position: 'MID', ovr: 87, pace: 76, shooting: 74, passing: 88, defending: 63, era: 'current', value: 48 },
  { id: 'palmer', name: 'Cole Palmer', country: 'England', position: 'MID', ovr: 86, pace: 76, shooting: 85, passing: 86, defending: 50, era: 'current', value: 48 },
  { id: 'kimmich', name: 'Joshua Kimmich', country: 'Germany', position: 'MID', ovr: 88, pace: 68, shooting: 72, passing: 89, defending: 80, era: 'current', value: 50 },
  { id: 'brunof', name: 'Bruno Fernandes', country: 'Portugal', position: 'MID', ovr: 87, pace: 76, shooting: 85, passing: 88, defending: 62, era: 'current', value: 48 },
  { id: 'odegaard', name: 'Martin Ødegaard', country: 'Norway', position: 'MID', ovr: 87, pace: 74, shooting: 80, passing: 89, defending: 58, era: 'current', value: 46 },
  { id: 'rice', name: 'Declan Rice', country: 'England', position: 'MID', ovr: 88, pace: 74, shooting: 75, passing: 82, defending: 89, era: 'current', value: 50 },
  { id: 'valverde', name: 'Federico Valverde', country: 'Uruguay', position: 'MID', ovr: 88, pace: 88, shooting: 82, passing: 84, defending: 78, era: 'current', value: 52 },
  { id: 'bsilva', name: 'Bernardo Silva', country: 'Portugal', position: 'MID', ovr: 87, pace: 78, shooting: 80, passing: 87, defending: 62, era: 'current', value: 46 },
  { id: 'bfernan', name: 'Enzo Fernández', country: 'Argentina', position: 'MID', ovr: 85, pace: 72, shooting: 76, passing: 85, defending: 74, era: 'current', value: 42 },
  { id: 'alisson', name: 'Alisson', country: 'Brazil', position: 'GK', ovr: 89, pace: 55, shooting: 22, passing: 75, defending: 90, era: 'current', value: 42 },
  { id: 'courtois', name: 'Thibaut Courtois', country: 'Belgium', position: 'GK', ovr: 89, pace: 50, shooting: 20, passing: 70, defending: 90, era: 'current', value: 40 },
  { id: 'terstegen', name: 'Marc-André ter Stegen', country: 'Germany', position: 'GK', ovr: 89, pace: 52, shooting: 20, passing: 74, defending: 90, era: 'current', value: 42 },
  { id: 'donnarumma', name: 'Gianluigi Donnarumma', country: 'Italy', position: 'GK', ovr: 88, pace: 50, shooting: 20, passing: 68, defending: 89, era: 'current', value: 40 },
  { id: 'hakimi', name: 'Achraf Hakimi', country: 'Morocco', position: 'DEF', ovr: 86, pace: 93, shooting: 68, passing: 79, defending: 80, era: 'current', value: 44 },
  { id: 'theo', name: 'Theo Hernández', country: 'France', position: 'DEF', ovr: 85, pace: 92, shooting: 72, passing: 77, defending: 79, era: 'current', value: 40 },
  { id: 'trent', name: 'Trent Alexander-Arnold', country: 'England', position: 'DEF', ovr: 87, pace: 78, shooting: 66, passing: 90, defending: 76, era: 'current', value: 46 },
  { id: 'saliba', name: 'William Saliba', country: 'France', position: 'DEF', ovr: 88, pace: 82, shooting: 40, passing: 72, defending: 90, era: 'current', value: 48 },
  { id: 'rdias', name: 'Rúben Dias', country: 'Portugal', position: 'DEF', ovr: 88, pace: 72, shooting: 42, passing: 74, defending: 90, era: 'current', value: 46 },
  { id: 'gvardiol', name: 'Joško Gvardiol', country: 'Croatia', position: 'DEF', ovr: 86, pace: 84, shooting: 62, passing: 75, defending: 85, era: 'current', value: 42 },
  { id: 'kmj', name: 'Kim Min-jae', country: 'South Korea', position: 'DEF', ovr: 86, pace: 80, shooting: 40, passing: 70, defending: 88, era: 'current', value: 36 },
  { id: 'leao', name: 'Rafael Leão', country: 'Portugal', position: 'FWD', ovr: 87, pace: 92, shooting: 82, passing: 78, defending: 40, era: 'current', value: 46 },
  { id: 'osimhen', name: 'Victor Osimhen', country: 'Nigeria', position: 'FWD', ovr: 88, pace: 90, shooting: 86, passing: 70, defending: 42, era: 'current', value: 55 },
  { id: 'son', name: 'Heung-min Son', country: 'South Korea', position: 'FWD', ovr: 87, pace: 87, shooting: 86, passing: 80, defending: 42, era: 'current', value: 45 },
  { id: 'kvara', name: 'Khvicha Kvaratskhelia', country: 'Georgia', position: 'FWD', ovr: 86, pace: 87, shooting: 80, passing: 82, defending: 40, era: 'current', value: 48 },
  { id: 'isak', name: 'Alexander Isak', country: 'Sweden', position: 'FWD', ovr: 87, pace: 88, shooting: 84, passing: 76, defending: 44, era: 'current', value: 46 },
  { id: 'gyokeres', name: 'Viktor Gyökeres', country: 'Sweden', position: 'FWD', ovr: 86, pace: 84, shooting: 85, passing: 75, defending: 42, era: 'current', value: 44 },
  { id: 'julian', name: 'Julián Álvarez', country: 'Argentina', position: 'FWD', ovr: 86, pace: 82, shooting: 84, passing: 80, defending: 48, era: 'current', value: 44 },
  { id: 'watkins', name: 'Ollie Watkins', country: 'England', position: 'FWD', ovr: 85, pace: 84, shooting: 83, passing: 76, defending: 44, era: 'current', value: 40 },
  { id: 'doku', name: 'Jérémy Doku', country: 'Belgium', position: 'FWD', ovr: 84, pace: 96, shooting: 78, passing: 80, defending: 38, era: 'current', value: 40 },
  { id: 'olmo', name: 'Dani Olmo', country: 'Spain', position: 'MID', ovr: 85, pace: 80, shooting: 82, passing: 84, defending: 56, era: 'current', value: 42 },
  { id: 'barella', name: 'Nicolò Barella', country: 'Italy', position: 'MID', ovr: 86, pace: 78, shooting: 78, passing: 84, defending: 72, era: 'current', value: 40 },
  { id: 'tchouameni', name: 'Aurélien Tchouaméni', country: 'France', position: 'MID', ovr: 87, pace: 76, shooting: 70, passing: 80, defending: 86, era: 'current', value: 44 },
  { id: 'macallister', name: 'Alexis Mac Allister', country: 'Argentina', position: 'MID', ovr: 86, pace: 74, shooting: 78, passing: 85, defending: 70, era: 'current', value: 40 },
  { id: 'szoboszlai', name: 'Dominik Szoboszlai', country: 'Hungary', position: 'MID', ovr: 86, pace: 80, shooting: 82, passing: 84, defending: 62, era: 'current', value: 42 },
  { id: 'lewandowski', name: 'Robert Lewandowski', country: 'Poland', position: 'FWD', ovr: 88, pace: 72, shooting: 90, passing: 78, defending: 44, era: 'current', value: 40 },
  { id: 'modric', name: 'Luka Modrić', country: 'Croatia', position: 'MID', ovr: 86, pace: 66, shooting: 78, passing: 90, defending: 64, era: 'current', value: 30 },
  { id: 'diasd', name: 'Diogo Costa', country: 'Portugal', position: 'GK', ovr: 87, pace: 58, shooting: 20, passing: 76, defending: 88, era: 'current', value: 36 },

  // --- Retired legends ---
  { id: 'pele', name: 'Pelé', country: 'Brazil', position: 'FWD', ovr: 95, pace: 90, shooting: 94, passing: 90, defending: 36, era: 'retired', value: 88 },
  { id: 'cruyff', name: 'Johan Cruyff', country: 'Netherlands', position: 'FWD', ovr: 94, pace: 89, shooting: 90, passing: 93, defending: 38, era: 'retired', value: 84 },
  { id: 'messi', name: 'Lionel Messi', country: 'Argentina', position: 'FWD', ovr: 93, pace: 85, shooting: 92, passing: 93, defending: 38, era: 'retired', value: 80 },
  { id: 'ronaldo7', name: 'Cristiano Ronaldo', country: 'Portugal', position: 'FWD', ovr: 92, pace: 89, shooting: 93, passing: 82, defending: 40, era: 'retired', value: 78 },
  { id: 'r9', name: 'Ronaldo Nazário', country: 'Brazil', position: 'FWD', ovr: 94, pace: 96, shooting: 93, passing: 80, defending: 30, era: 'retired', value: 82 },
  { id: 'maradona', name: 'Diego Maradona', country: 'Argentina', position: 'FWD', ovr: 94, pace: 88, shooting: 88, passing: 92, defending: 40, era: 'retired', value: 80 },
  { id: 'distefano', name: 'Alfredo Di Stéfano', country: 'Argentina', position: 'FWD', ovr: 92, pace: 86, shooting: 89, passing: 87, defending: 42, era: 'retired', value: 64 },
  { id: 'zidane', name: 'Zinedine Zidane', country: 'France', position: 'MID', ovr: 93, pace: 78, shooting: 84, passing: 93, defending: 62, era: 'retired', value: 74 },
  { id: 'platini', name: 'Michel Platini', country: 'France', position: 'MID', ovr: 92, pace: 74, shooting: 88, passing: 92, defending: 58, era: 'retired', value: 66 },
  { id: 'beckenbauer', name: 'Franz Beckenbauer', country: 'Germany', position: 'DEF', ovr: 93, pace: 80, shooting: 62, passing: 86, defending: 92, era: 'retired', value: 60 },
  { id: 'zico', name: 'Zico', country: 'Brazil', position: 'MID', ovr: 92, pace: 84, shooting: 90, passing: 90, defending: 44, era: 'retired', value: 62 },
  { id: 'puskas', name: 'Ferenc Puskás', country: 'Hungary', position: 'FWD', ovr: 92, pace: 76, shooting: 94, passing: 88, defending: 40, era: 'retired', value: 60 },
  { id: 'vanbasten', name: 'Marco van Basten', country: 'Netherlands', position: 'FWD', ovr: 92, pace: 84, shooting: 92, passing: 82, defending: 40, era: 'retired', value: 64 },
  { id: 'gullit', name: 'Ruud Gullit', country: 'Netherlands', position: 'MID', ovr: 91, pace: 86, shooting: 86, passing: 86, defending: 70, era: 'retired', value: 58 },
  { id: 'rijkaard', name: 'Frank Rijkaard', country: 'Netherlands', position: 'DEF', ovr: 90, pace: 78, shooting: 56, passing: 80, defending: 90, era: 'retired', value: 46 },
  { id: 'matthaus', name: 'Lothar Matthäus', country: 'Germany', position: 'MID', ovr: 91, pace: 80, shooting: 84, passing: 86, defending: 82, era: 'retired', value: 56 },
  { id: 'ronaldinho', name: 'Ronaldinho', country: 'Brazil', position: 'MID', ovr: 92, pace: 88, shooting: 87, passing: 92, defending: 40, era: 'retired', value: 72 },
  { id: 'xavi', name: 'Xavi Hernández', country: 'Spain', position: 'MID', ovr: 90, pace: 68, shooting: 76, passing: 95, defending: 70, era: 'retired', value: 56 },
  { id: 'iniesta', name: 'Andrés Iniesta', country: 'Spain', position: 'MID', ovr: 90, pace: 74, shooting: 78, passing: 93, defending: 66, era: 'retired', value: 58 },
  { id: 'gerrard', name: 'Steven Gerrard', country: 'England', position: 'MID', ovr: 89, pace: 76, shooting: 87, passing: 88, defending: 76, era: 'retired', value: 52 },
  { id: 'scholes', name: 'Paul Scholes', country: 'England', position: 'MID', ovr: 90, pace: 70, shooting: 86, passing: 92, defending: 68, era: 'retired', value: 50 },
  { id: 'lampard', name: 'Frank Lampard', country: 'England', position: 'MID', ovr: 89, pace: 74, shooting: 88, passing: 85, defending: 66, era: 'retired', value: 48 },
  { id: 'henry', name: 'Thierry Henry', country: 'France', position: 'FWD', ovr: 91, pace: 94, shooting: 90, passing: 82, defending: 36, era: 'retired', value: 66 },
  { id: 'cannavaro', name: 'Fabio Cannavaro', country: 'Italy', position: 'DEF', ovr: 90, pace: 82, shooting: 44, passing: 70, defending: 93, era: 'retired', value: 44 },
  { id: 'maldini', name: 'Paolo Maldini', country: 'Italy', position: 'DEF', ovr: 91, pace: 82, shooting: 48, passing: 76, defending: 94, era: 'retired', value: 48 },
  { id: 'nesta', name: 'Alessandro Nesta', country: 'Italy', position: 'DEF', ovr: 91, pace: 78, shooting: 44, passing: 72, defending: 93, era: 'retired', value: 48 },
  { id: 'ramos', name: 'Sergio Ramos', country: 'Spain', position: 'DEF', ovr: 89, pace: 78, shooting: 66, passing: 74, defending: 89, era: 'retired', value: 42 },
  { id: 'puyol', name: 'Carles Puyol', country: 'Spain', position: 'DEF', ovr: 90, pace: 76, shooting: 42, passing: 68, defending: 92, era: 'retired', value: 42 },
  { id: 'rcalos', name: 'Roberto Carlos', country: 'Brazil', position: 'DEF', ovr: 90, pace: 94, shooting: 70, passing: 78, defending: 84, era: 'retired', value: 48 },
  { id: 'cafu', name: 'Cafu', country: 'Brazil', position: 'DEF', ovr: 90, pace: 88, shooting: 48, passing: 78, defending: 86, era: 'retired', value: 46 },
  { id: 'thuram', name: 'Lilian Thuram', country: 'France', position: 'DEF', ovr: 89, pace: 84, shooting: 40, passing: 66, defending: 90, era: 'retired', value: 42 },
  { id: 'buffon', name: 'Gianluigi Buffon', country: 'Italy', position: 'GK', ovr: 91, pace: 48, shooting: 20, passing: 66, defending: 92, era: 'retired', value: 40 },
  { id: 'casillas', name: 'Iker Casillas', country: 'Spain', position: 'GK', ovr: 90, pace: 52, shooting: 20, passing: 68, defending: 91, era: 'retired', value: 38 },
  { id: 'schmeichel', name: 'Peter Schmeichel', country: 'Denmark', position: 'GK', ovr: 91, pace: 50, shooting: 20, passing: 64, defending: 92, era: 'retired', value: 38 },
  { id: 'kahn', name: 'Oliver Kahn', country: 'Germany', position: 'GK', ovr: 91, pace: 46, shooting: 20, passing: 62, defending: 93, era: 'retired', value: 38 },
  { id: 'kaka', name: 'Kaká', country: 'Brazil', position: 'MID', ovr: 90, pace: 88, shooting: 85, passing: 87, defending: 52, era: 'retired', value: 54 },
  { id: 'drogba', name: 'Didier Drogba', country: 'Ivory Coast', position: 'FWD', ovr: 89, pace: 82, shooting: 89, passing: 74, defending: 44, era: 'retired', value: 48 },
  { id: 'eto', name: "Samuel Eto'o", country: 'Cameroon', position: 'FWD', ovr: 89, pace: 90, shooting: 88, passing: 76, defending: 42, era: 'retired', value: 46 },
  { id: 'pirlo', name: 'Andrea Pirlo', country: 'Italy', position: 'MID', ovr: 89, pace: 62, shooting: 82, passing: 93, defending: 66, era: 'retired', value: 46 },
  { id: 'beckham', name: 'David Beckham', country: 'England', position: 'MID', ovr: 88, pace: 74, shooting: 82, passing: 91, defending: 60, era: 'retired', value: 44 },
  { id: 'nedved', name: 'Pavel Nedvěd', country: 'Czechia', position: 'MID', ovr: 88, pace: 84, shooting: 84, passing: 85, defending: 70, era: 'retired', value: 42 },
  { id: 'figo', name: 'Luís Figo', country: 'Portugal', position: 'MID', ovr: 89, pace: 86, shooting: 82, passing: 88, defending: 50, era: 'retired', value: 46 },
  { id: 'vieira', name: 'Patrick Vieira', country: 'France', position: 'MID', ovr: 89, pace: 80, shooting: 72, passing: 80, defending: 88, era: 'retired', value: 46 },
  { id: 'keane', name: 'Roy Keane', country: 'Ireland', position: 'MID', ovr: 88, pace: 74, shooting: 72, passing: 80, defending: 88, era: 'retired', value: 40 },
  { id: 'cantona', name: 'Eric Cantona', country: 'France', position: 'FWD', ovr: 90, pace: 78, shooting: 87, passing: 82, defending: 44, era: 'retired', value: 54 },
  { id: 'bergkamp', name: 'Dennis Bergkamp', country: 'Netherlands', position: 'FWD', ovr: 90, pace: 80, shooting: 86, passing: 88, defending: 40, era: 'retired', value: 56 },
  { id: 'raul', name: 'Raúl González', country: 'Spain', position: 'FWD', ovr: 90, pace: 80, shooting: 88, passing: 80, defending: 42, era: 'retired', value: 54 },
  { id: 'totti', name: 'Francesco Totti', country: 'Italy', position: 'FWD', ovr: 91, pace: 78, shooting: 87, passing: 89, defending: 40, era: 'retired', value: 58 },
  { id: 'delpiero', name: 'Alessandro Del Piero', country: 'Italy', position: 'FWD', ovr: 90, pace: 80, shooting: 87, passing: 85, defending: 40, era: 'retired', value: 52 },
  { id: 'shevchenko', name: 'Andriy Shevchenko', country: 'Ukraine', position: 'FWD', ovr: 90, pace: 86, shooting: 90, passing: 76, defending: 40, era: 'retired', value: 52 },
  { id: 'rivaldo', name: 'Rivaldo', country: 'Brazil', position: 'MID', ovr: 91, pace: 80, shooting: 89, passing: 87, defending: 44, era: 'retired', value: 58 },
  { id: 'baggio', name: 'Roberto Baggio', country: 'Italy', position: 'FWD', ovr: 91, pace: 82, shooting: 87, passing: 88, defending: 40, era: 'retired', value: 58 },
  { id: 'best', name: 'George Best', country: 'Northern Ireland', position: 'FWD', ovr: 90, pace: 90, shooting: 84, passing: 84, defending: 36, era: 'retired', value: 60 },
  { id: 'mvan', name: 'Ruud van Nistelrooy', country: 'Netherlands', position: 'FWD', ovr: 89, pace: 82, shooting: 90, passing: 72, defending: 36, era: 'retired', value: 46 },
  { id: 'owen', name: 'Michael Owen', country: 'England', position: 'FWD', ovr: 88, pace: 92, shooting: 86, passing: 72, defending: 34, era: 'retired', value: 40 },

  // --- Women's stars ---
  { id: 'bonmati', name: 'Aitana Bonmatí', country: 'Spain', position: 'MID', ovr: 91, pace: 78, shooting: 84, passing: 91, defending: 62, era: 'women', value: 50 },
  { id: 'putellas', name: 'Alexia Putellas', country: 'Spain', position: 'MID', ovr: 91, pace: 80, shooting: 87, passing: 89, defending: 58, era: 'women', value: 48 },
  { id: 'marta', name: 'Marta', country: 'Brazil', position: 'FWD', ovr: 90, pace: 84, shooting: 88, passing: 86, defending: 40, era: 'women', value: 40 },
  { id: 'kerr', name: 'Sam Kerr', country: 'Australia', position: 'FWD', ovr: 90, pace: 88, shooting: 89, passing: 74, defending: 42, era: 'women', value: 42 },
  { id: 'hegerberg', name: 'Ada Hegerberg', country: 'Norway', position: 'FWD', ovr: 89, pace: 82, shooting: 89, passing: 76, defending: 40, era: 'women', value: 38 },
  { id: 'graham', name: 'Caroline Graham Hansen', country: 'Norway', position: 'FWD', ovr: 89, pace: 86, shooting: 85, passing: 86, defending: 40, era: 'women', value: 38 },
  { id: 'miedema', name: 'Vivianne Miedema', country: 'Netherlands', position: 'FWD', ovr: 89, pace: 74, shooting: 88, passing: 84, defending: 38, era: 'women', value: 38 },
  { id: 'harder', name: 'Pernille Harder', country: 'Denmark', position: 'FWD', ovr: 89, pace: 80, shooting: 86, passing: 84, defending: 44, era: 'women', value: 36 },
  { id: 'paralluelo', name: 'Salma Paralluelo', country: 'Spain', position: 'FWD', ovr: 87, pace: 94, shooting: 82, passing: 78, defending: 42, era: 'women', value: 38 },
  { id: 'caicedo', name: 'Linda Caicedo', country: 'Colombia', position: 'FWD', ovr: 86, pace: 92, shooting: 80, passing: 82, defending: 40, era: 'women', value: 36 },
  { id: 'rodman', name: 'Trinity Rodman', country: 'USA', position: 'FWD', ovr: 85, pace: 90, shooting: 82, passing: 80, defending: 42, era: 'women', value: 34 },
  { id: 'bronze', name: 'Lucy Bronze', country: 'England', position: 'DEF', ovr: 88, pace: 82, shooting: 52, passing: 78, defending: 89, era: 'women', value: 32 },
  { id: 'renard', name: 'Wendie Renard', country: 'France', position: 'DEF', ovr: 89, pace: 68, shooting: 60, passing: 70, defending: 91, era: 'women', value: 32 },
  { id: 'batlle', name: 'Ona Batlle', country: 'Spain', position: 'DEF', ovr: 86, pace: 88, shooting: 56, passing: 78, defending: 85, era: 'women', value: 30 },
  { id: 'walsh', name: 'Keira Walsh', country: 'England', position: 'MID', ovr: 88, pace: 70, shooting: 68, passing: 89, defending: 76, era: 'women', value: 32 },
  { id: 'oberdorf', name: 'Lena Oberdorf', country: 'Germany', position: 'MID', ovr: 86, pace: 78, shooting: 70, passing: 80, defending: 84, era: 'women', value: 30 },
  { id: 'earps', name: 'Mary Earps', country: 'England', position: 'GK', ovr: 87, pace: 52, shooting: 20, passing: 70, defending: 89, era: 'women', value: 24 },
  { id: 'endler', name: 'Christiane Endler', country: 'Chile', position: 'GK', ovr: 88, pace: 50, shooting: 20, passing: 68, defending: 90, era: 'women', value: 26 },
  { id: 'morgan', name: 'Alex Morgan', country: 'USA', position: 'FWD', ovr: 88, pace: 82, shooting: 87, passing: 80, defending: 40, era: 'women', value: 34 },
  { id: 'rapinoe', name: 'Megan Rapinoe', country: 'USA', position: 'FWD', ovr: 87, pace: 72, shooting: 84, passing: 86, defending: 38, era: 'women', value: 32 },
]

export interface PoolFilterConfig {
  kind: 'all' | 'country' | 'retired' | 'current' | 'women'
  country?: string
}

/** All distinct countries available in the pool, sorted alphabetically. */
export function availableCountries(): string[] {
  return Array.from(new Set(PLAYERS.map((p) => p.country))).sort()
}

/** Returns the players matching the given pool filter. */
export function filterPool(config: PoolFilterConfig): Player[] {
  switch (config.kind) {
    case 'retired':
      return PLAYERS.filter((p) => p.era === 'retired')
    case 'current':
      return PLAYERS.filter((p) => p.era === 'current')
    case 'women':
      return PLAYERS.filter((p) => p.era === 'women')
    case 'country':
      return PLAYERS.filter((p) => p.country === config.country)
    case 'all':
    default:
      return [...PLAYERS]
  }
}
