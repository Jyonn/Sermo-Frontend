export const POCKLO_ORIGIN = "https://pocklo.jyonn.space";

export function pockloShareToken(value: string) {
  const match = /^https:\/\/pocklo\.jyonn\.space\/share\/([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(value);
  return match?.[0] === value ? match[1].toLowerCase() : undefined;
}

