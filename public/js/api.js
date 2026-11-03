export const API = 'http://localhost:3000';

export const Api = {
  async req(method, path, body) {
    const r = await fetch(API + path, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error('Erro na API: ' + r.status);
    return r.status === 204 ? null : r.json();
  },
  get: p => Api.req('GET', p),
  post: (p, b) => Api.req('POST', p, b),
  put: (p, b) => Api.req('PUT', p, b),
  patch: (p, b) => Api.req('PATCH', p, b),
  del: p => Api.req('DELETE', p)
};
