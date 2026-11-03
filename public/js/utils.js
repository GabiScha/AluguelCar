export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const alertBox = (msg, t = 'danger') => `<div class="alert alert-${t} py-2">${esc(msg)}</div>`;
export const formData = f => Object.fromEntries(new FormData(f));

export function cpfValido(c) {
  const n = c.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  const dv = t => { let s = 0; for (let i = 0; i < t; i++) s += n[i] * (t + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) == n[9] && dv(10) == n[10];
}

export const fmtCpf = c => c.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
export const placaValida = p => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p);

export const STATUS = { ANALISE: 'Em análise', APROVADO: 'Aprovado', REPROVADO: 'Reprovado', CONTRATADO: 'Contratado', CANCELADO: 'Cancelado' };
export const BADGE = { 'Em análise': 'warning', Aprovado: 'info', Reprovado: 'danger', Contratado: 'success', Cancelado: 'secondary' };

export function modal(title, body, onSubmit, size = '') {
  $('#modal-root').innerHTML = `
  <div class="modal fade" id="m" tabindex="-1"><div class="modal-dialog ${size}"><form class="modal-content">
    <div class="modal-header"><h5 class="modal-title">${title}</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Fechar</button>
    ${onSubmit ? '<button class="btn btn-primary">Salvar</button>' : ''}</div></form></div></div>`;
  const el = $('#m'), m = new bootstrap.Modal(el);
  if (onSubmit) el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    try { await onSubmit(formData(e.target), e.target); m.hide(); } catch (err) { alert(err.message); }
  };
  el.addEventListener('hidden.bs.modal', () => el.remove());
  m.show();
}

export function getUser() {
  return JSON.parse(sessionStorage.getItem('user') || 'null');
}

export function renderNav(user, perfilCallback) {
  const nav = $('#nav-user');
  if (nav && user) {
    nav.innerHTML = `${esc(user.nome)} <span class="badge text-bg-light text-capitalize">${user.tipo}</span>
      <button class="btn btn-sm btn-outline-light ms-2" id="nav-perfil">Perfil</button>
      <button class="btn btn-sm btn-light ms-1" id="nav-sair">Sair</button>`;
    $('#nav-sair').onclick = () => { sessionStorage.clear(); window.location.href = 'index.html'; };
    $('#nav-perfil').onclick = () => perfilCallback(user);
  }
}

export async function loadPedidos(Api) {
  const [ps, autos] = await Promise.all([Api.get('/pedidos'), Api.get('/automoveis').catch(() => [])]);
  return ps.map(p => ({ ...p, automovel: autos.find(a => a.id == p.automovelId) || p.automovel || {} }))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}
