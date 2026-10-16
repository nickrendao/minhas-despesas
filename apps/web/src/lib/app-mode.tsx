'use client';
import { createContext, useContext } from 'react';

/** "local" = app instalado no celular, sem servidor: dados guardados no próprio aparelho (sem login, backup/restauração, apagar tudo). */
export interface AppMode { local: boolean; importBackup?: (json: unknown) => Promise<void>; resetAll?: () => Promise<void> }
const Ctx = createContext<AppMode>({ local: false });
export const AppModeProvider = Ctx.Provider;
export const useAppMode = () => useContext(Ctx);
