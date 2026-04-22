const requiredEnv = [
  "PORT",
  "CARE_BASE_URL",
  "AES_KEY",
  "AES_IV"
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required env variable: ${key}`);
  }
});

export const config = {
  port: process.env.PORT as string,
  baseUrl: process.env.CARE_BASE_URL as string,
  aesKey: process.env.AES_KEY as string,
  aesIv: process.env.AES_IV as string,
};