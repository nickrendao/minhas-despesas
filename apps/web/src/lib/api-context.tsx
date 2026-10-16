'use client';
import { createContext, useContext } from 'react';
import type { ApiClient } from '@fin/api-client';

/** A tela recebe a API por contexto: em produção é o cliente real; nos testes, um falso. */
export const ApiContext = createContext<ApiClient | null>(null);
export function useApi(): ApiClient {
  const api = useContext(ApiContext);
  if (!api) throw new Error('useApi fora do ApiContext.Provider');
  return api;
}
