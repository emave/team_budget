const RESERVED = /[_*[\]()~`>#+\-=|{}.!\\]/g;

export function escapeMarkdownV2(input: string): string {
  return input.replace(RESERVED, (m) => `\\${m}`);
}
