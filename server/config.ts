// Server-only configuration. Read lazily so dev (Vite) and prod (Node) can
// both populate process.env before first use. Nothing here reaches the browser
// except what /api/config deliberately exposes.

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export const config = {
  get aiEnabled(): boolean {
    return env('AI_PROVIDER') !== 'offline' && Boolean(env('MUSE_API_KEY'));
  },
  get museKey(): string { return env('MUSE_API_KEY') ?? ''; },
  get museBaseUrl(): string { return env('MUSE_BASE_URL') ?? 'https://api.meta.ai/v1'; },
  get museModel(): string { return env('MUSE_MODEL') ?? 'muse-spark-1.3'; },
  get aiTimeoutMs(): number {
    const n = Number(env('AI_TIMEOUT_MS'));
    return Number.isFinite(n) && n > 0 ? Math.min(n,5000) : 5000;
  },
  get demoEmail(): string {
    return env('DEMO_EMAIL') ?? 'demo@partnerup.test';
  },
  get demoPassword(): string | undefined {
    return env('DEMO_PASSWORD');
  },
};
