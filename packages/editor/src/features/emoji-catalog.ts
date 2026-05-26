export interface EmojiEntry {
  shortcode: string;
  emoji: string;
}

const CATALOG: EmojiEntry[] = [
  { shortcode: "smile", emoji: "😄" },
  { shortcode: "grinning", emoji: "😀" },
  { shortcode: "laughing", emoji: "😆" },
  { shortcode: "wink", emoji: "😉" },
  { shortcode: "heart", emoji: "❤️" },
  { shortcode: "thumbsup", emoji: "👍" },
  { shortcode: "thumbsdown", emoji: "👎" },
  { shortcode: "fire", emoji: "🔥" },
  { shortcode: "star", emoji: "⭐" },
  { shortcode: "sparkles", emoji: "✨" },
  { shortcode: "book", emoji: "📖" },
  { shortcode: "rocket", emoji: "🚀" },
  { shortcode: "tada", emoji: "🎉" },
  { shortcode: "wave", emoji: "👋" },
  { shortcode: "eyes", emoji: "👀" },
  { shortcode: "thinking", emoji: "🤔" },
  { shortcode: "check", emoji: "✅" },
  { shortcode: "x", emoji: "❌" },
  { shortcode: "warning", emoji: "⚠️" },
  { shortcode: "bulb", emoji: "💡" },
  { shortcode: "computer", emoji: "💻" },
  { shortcode: "hammer", emoji: "🔨" },
  { shortcode: "bug", emoji: "🐛" },
  { shortcode: "zap", emoji: "⚡" },
  { shortcode: "lock", emoji: "🔒" },
  { shortcode: "key", emoji: "🔑" },
  { shortcode: "bell", emoji: "🔔" },
  { shortcode: "memo", emoji: "📝" },
  { shortcode: "calendar", emoji: "📅" },
  { shortcode: "clock", emoji: "🕐" },
];

const BY_SHORTCODE = new Map(CATALOG.map((e) => [e.shortcode, e]));

export function lookupShortcode(name: string): EmojiEntry | null {
  return BY_SHORTCODE.get(name) ?? null;
}

export function filterCandidates(query: string): EmojiEntry[] {
  if (!query) return CATALOG.slice(0, 8);
  const lower = query.toLowerCase();
  return CATALOG.filter((e) => e.shortcode.includes(lower));
}
