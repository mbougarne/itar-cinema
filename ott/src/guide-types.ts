export type Programme = Readonly<{
  start: number;
  stop: number;
  title: string;
  subtitle: string;
}>;

export type Channel = Readonly<{
  id: string;
  name: string;
  programmes: readonly Programme[];
}>;

export type Guide = Readonly<{ updated: string; channels: readonly Channel[] }>;
