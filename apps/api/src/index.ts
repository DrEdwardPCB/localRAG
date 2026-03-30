import { getConfig } from "./config.js";
import { connectDeps, createApp } from "./app.js";

async function main() {
  const cfg = getConfig();
  const deps = await connectDeps();
  const app = await createApp(deps);

  const close = async () => {
    await app.close();
    await deps.redis.quit();
    await deps.mongo.close();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ port: cfg.API_PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
