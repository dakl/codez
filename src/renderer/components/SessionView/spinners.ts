export interface Spinner {
  name: string;
  frames: string[];
  intervalMs: number;
}

export const SPINNERS: Spinner[] = [
  {
    name: "braille",
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    intervalMs: 80,
  },
  {
    name: "dots",
    frames: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
    intervalMs: 80,
  },
  {
    name: "line",
    frames: ["-", "\\", "|", "/"],
    intervalMs: 130,
  },
  {
    name: "arc",
    frames: ["◜", "◠", "◝", "◞", "◡", "◟"],
    intervalMs: 100,
  },
  {
    name: "circle",
    frames: ["◐", "◓", "◑", "◒"],
    intervalMs: 120,
  },
  {
    name: "boxBounce",
    frames: ["▖", "▘", "▝", "▗"],
    intervalMs: 120,
  },
  {
    name: "moon",
    frames: ["🌑", "🌒", "🌓", "🌔", "🌕", "🌖", "🌗", "🌘"],
    intervalMs: 100,
  },
  {
    name: "clock",
    frames: ["🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛"],
    intervalMs: 100,
  },
  {
    name: "arrows",
    frames: ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
    intervalMs: 100,
  },
  {
    name: "bounce",
    frames: ["⠁", "⠂", "⠄", "⠂"],
    intervalMs: 120,
  },
  {
    name: "pulse",
    frames: ["█", "▓", "▒", "░", "▒", "▓"],
    intervalMs: 100,
  },
];

export function getRandomSpinner(): Spinner {
  const index = Math.floor(Math.random() * SPINNERS.length);
  return SPINNERS[index];
}
