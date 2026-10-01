export type Sleep = (milliseconds: number) => Promise<void>;
export const defaultSleep: Sleep = (milliseconds) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
