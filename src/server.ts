import express from "express";
import dotenv from "dotenv";
dotenv.config();
import { config } from "./config/env";
import { encryptToken } from "./utils/encryption";
import { setTokens, getToken } from "./services/tokenManager";
import { generatePartnerToken } from "./services/careApi";
import routes from "./routes";
import { httpLogger } from "./middleware/logger";

const app = express();

app.use(express.json())

routes(app);

app.use(httpLogger);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});