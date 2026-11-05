const FILTERED_NAME_WORDS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "nigger",
  "faggot",
  "retard",
];

export function filterDisplayName(value: string): string {
  return FILTERED_NAME_WORDS.reduce((filtered, word) => {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    return filtered.replace(pattern, (match) => "*".repeat(match.length));
  }, value);
}
