// Powered by OnSpace.AI
import { useContext } from 'react';
import { BotContext } from '@/contexts/BotContext';

export function useBot() {
  const context = useContext(BotContext);
  if (!context) throw new Error('useBot must be used within BotProvider');
  return context;
}
