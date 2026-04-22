type Token = {
  tokenKey: string;
  tokenValue: string;
};

let tokens: Token[] = [];

export const setTokens = (newTokens: Token[]) => {
  tokens = [...newTokens];
};

export const getToken = (): Token => {
  if (tokens.length === 0) {
    throw new Error("No tokens available. Regenerate session.");
  }

  const token = tokens.shift(); // remove first token

  if (!token) {
    throw new Error("Token fetch failed");
  }

  return token;
};