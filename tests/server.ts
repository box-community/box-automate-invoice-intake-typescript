// tests/server.ts
import { ChildProcess, spawn } from 'node:child_process';

export const BASE_URL = 'http://127.0.0.1:5000';

/**
 * Start app.ts in a child process and wait until GET /health responds.
 * app.ts listens on import, so the tests run it as a separate process
 * exactly as `npm start` does.
 */
export async function startServer(env: NodeJS.ProcessEnv = process.env): Promise<ChildProcess> {
  const server = spawn(process.execPath, ['--import', 'tsx', 'app.ts'], {
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Server exited early with code ${server.exitCode}`);
    }
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  server.kill();
  throw new Error('Server did not become healthy within 30 seconds');
}

export function stopServer(server: ChildProcess | undefined) {
  if (server && server.exitCode === null) server.kill();
}

export async function postWebhook(body: unknown, timeoutMs = 10_000) {
  const res = await fetch(`${BASE_URL}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}
