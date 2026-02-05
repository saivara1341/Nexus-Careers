import React, { createContext, useContext, ReactNode } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

// Define the shape of the context
interface SupabaseContextType {
  supabase: SupabaseClient;
}

// Create the context
const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

// Define the Provider component
interface SupabaseProviderProps {
  children: ReactNode;
  supabaseClient: SupabaseClient;
}

export const SupabaseProvider: React.FC<SupabaseProviderProps> = ({ children, supabaseClient }) => {
  return (
    <SupabaseContext.Provider value={{ supabase: supabaseClient }}>
      {children}
    </SupabaseContext.Provider>
  );
};

// Custom hook to consume the context
export const useSupabase = (): SupabaseClient => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context.supabase;
};