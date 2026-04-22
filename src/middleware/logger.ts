import pinoHttp from "pino-http";

export const httpLogger = pinoHttp({
  redact: ["req.headers.authorization"], 
});                                     