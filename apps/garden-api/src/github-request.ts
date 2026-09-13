// Retry transport failures only. OAuth rejections must return immediately so a
// consumed/invalid authorization code is never repeatedly submitted.
export async function githubRequest(url: string, init: RequestInit, request: typeof fetch = fetch): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request(url, { ...init, signal: AbortSignal.timeout(8000) });
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}
