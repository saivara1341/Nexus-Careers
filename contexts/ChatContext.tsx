
import React, { createContext, useContext, useState } from 'react';

interface ChatContextType {
  context: string;
  setContext: (ctx: string) => void;
}

const ChatContext = createContext<ChatContextType>({ context: '', setContext: () => {} });

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [context, setContext] = useState('');
  return (
    <ChatContext.Provider value={{ context, setContext }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = () => useContext(ChatContext);
