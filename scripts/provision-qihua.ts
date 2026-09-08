// Run once against the private preview before switching the public ingress.
// Credentials are supplied by the server environment and never logged.
const base = "http://127.0.0.1:8787/api";
const password = Bun.env.QIHUA_INITIAL_PASSWORD || (await Bun.stdin.text()).trim();
if (!password || password.length < 16) throw new Error("QIHUA_INITIAL_PASSWORD must contain at least 16 characters");
let cookie = "";
async function request(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const setCookie = response.headers.getSetCookie();
  if (setCookie.length) cookie = setCookie.map((value) => value.split(";")[0]).join("; ");
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
  return response.json() as Promise<any>;
}
const status = await request("/config/auth/status");
if (!status.setupRequired) throw new Error("Already initialized; refusing to replace existing configuration");
await request("/config/auth/setup", "POST", { password });
await request("/config/auth/login", "POST", { password });
await request("/config/users", "POST", { account: "torchz", username: "Torchz", password, hasConfigAccess: true });
const { providers } = await request("/config/providers");
await request("/config/providers", "PUT", {
  providers: providers.map((provider: any) => ({
    ...provider,
    enabled: provider.channel === "api",
    ...(provider.channel === "api" ? {
      name: "啟画 CPA", baseUrl: "http://cli-proxy-api:8317", apiKeyEnv: "GPT_IMAGE_API_KEY",
      apiKeyValue: "", model: "gpt-image-2", routeMode: "images_api", proxyEnabled: false
    } : {})
  }))
});
await request("/config/auth/logout", "POST");
console.log("Initialized Qihua admin, torchz account and single CPA-compatible provider.");
