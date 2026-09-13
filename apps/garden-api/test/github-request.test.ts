import {describe,it,expect,vi} from 'vitest';
import {githubRequest} from '../src/github-request.js';

describe('GitHub network requests',()=>{
  it('recovers from a transient transport failure',async()=>{
    const request=vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue(new Response('{}'));
    const response=await githubRequest('https://github.com/login/oauth/access_token',{method:'POST'},request);
    expect(response.status).toBe(200);expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('does not retry rejected authorization codes',async()=>{
    const request=vi.fn().mockResolvedValue(new Response('{"error":"bad_verification_code"}',{status:400}));
    expect((await githubRequest('https://github.com/login/oauth/access_token',{},request)).status).toBe(400);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('stops after three transport failures',async()=>{
    const request=vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(githubRequest('https://github.com',{},request)).rejects.toThrow('fetch failed');
    expect(request).toHaveBeenCalledTimes(3);
  });
});
