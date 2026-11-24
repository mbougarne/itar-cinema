import { createContext } from 'react';

export type DevelopmentAction = {
  key: string;
  title: string;
  label: string;
  value: string;
  press: () => void;
};

export const DevelopmentSettings = createContext<{
  actions: DevelopmentAction[];
  refresh: () => void;
} | null>(null);
