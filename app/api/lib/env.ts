import "dotenv/config";

function getEnv(name: string, required = false): string {
  const value = process.env[name];
  if (!value && required && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: getEnv("APP_ID"),
  appSecret: getEnv("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: getEnv("DATABASE_URL", true),
  kimiAuthUrl: getEnv("KIMI_AUTH_URL"),
  kimiOpenUrl: getEnv("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
};
