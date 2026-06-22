import { createContext, ReactNode, useContext } from "react";

export interface IAppReadyContext {
  ready: boolean;
  children: ReactNode;
}
export const AppReadyContext = createContext(false);

export const useAppReady = () => {
  const ctx = useContext(AppReadyContext);
  if (!ctx) {
    return null;
  }
  return ctx;
};

export const AppReadyProvider = ({ ready, children }: IAppReadyContext) => {
  return (
    <AppReadyContext.Provider value={ready}>
      {children}
    </AppReadyContext.Provider>
  );
};
