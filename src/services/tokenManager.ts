let tokens: { tokenKey: string; tokenValue: string }[] = [];
let sessionId: string | null = null;

export const setTokens = (newTokens: any[], newSessionId: string) => {
  tokens = [...newTokens];
  sessionId = newSessionId;
};

export const getToken = () => {
  return tokens.shift(); 
};

export const hasValidTokens = () => {
  return tokens.length > 0;
};

export const clearTokens = () => {
  tokens = [];
  sessionId = null;
};

export const getSessionId = () => sessionId;