/* ===== Camada de dados (pacote "api") — Fetch API + JSON Server ===== */
const API = 'http://localhost:3000';
const Api = {
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

/* ===== Modelo (pacote "model") ===== */
const STATUS = { ANALISE: 'Em análise', APROVADO: 'Aprovado', REPROVADO: 'Reprovado', CONTRATADO: 'Contratado', CANCELADO: 'Cancelado' };
const BADGE = { 'Em análise': 'warning', Aprovado: 'info', Reprovado: 'danger', Contratado: 'success', Cancelado: 'secondary' };
const isAgente = u => u.tipo === 'empresa' || u.tipo === 'banco';

/* ===== Sessão ===== */
let user = JSON.parse(sessionStorage.getItem('user') || 'null');
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const alertBox = (msg, t = 'danger') => `<div class="alert alert-${t} py-2">${esc(msg)}</div>`;
const formData = f => Object.fromEntries(new FormData(f));
function cpfValido(c) {
  const n = c.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  const dv = t => { let s = 0; for (let i = 0; i < t; i++) s += n[i] * (t + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) == n[9] && dv(10) == n[10];
}
const fmtCpf = c => c.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
const placaValida = p => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p); // ABC1234 ou ABC1D23 (Mercosul)

/* Pedidos com o Automóvel (coleção própria) associado via automovelId */
async function loadPedidos() {
  const [ps, autos] = await Promise.all([Api.get('/pedidos'), Api.get('/automoveis').catch(() => [])]);
  return ps.map(p => ({ ...p, automovel: autos.find(a => a.id == p.automovelId) || p.automovel || {} }))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

/* ===== Modal genérico ===== */
function modal(title, body, onSubmit, size = '') {
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

/* ===== Autenticação / Cadastro ===== */
function renderAuth(msg = '') {
  $('#nav-user').innerHTML = '';
  $('#app').innerHTML = `
  <div class="row justify-content-center"><div class="col-md-5"><div class="card p-4">
    <h4 class="mb-3">Entrar</h4>${msg}
    <form id="login">
      <input class="form-control mb-2" name="email" type="email" placeholder="E-mail" required>
      <input class="form-control mb-3" name="senha" type="password" placeholder="Senha" required>
      <button class="btn btn-dark w-100">Entrar</button>
    </form>
    <hr><button id="btn-cad" class="btn btn-outline-primary w-100">Cadastrar-se</button>
    <p class="text-muted small mt-3 mb-0">Demo: cliente@teste.com / banco@teste.com / empresa@teste.com — senha 123</p>
  </div></div></div>`;
  $('#login').onsubmit = async e => {
    e.preventDefault();
    const { email, senha } = formData(e.target);
    try {
      const [u] = await Api.get(`/usuarios?email=${encodeURIComponent(email)}&senha=${encodeURIComponent(senha)}`);
      if (!u) return renderAuth(alertBox('Credenciais inválidas.'));
      user = u; sessionStorage.setItem('user', JSON.stringify(u)); render();
    } catch { renderAuth(alertBox('API indisponível. Execute "npm run api".')); }
  };
  $('#btn-cad').onclick = () => modalUsuario();
}

function rendRow(r = {}) {
  return `<div class="row g-2 mb-2 rend"><div class="col-7"><input class="form-control" name="emp" placeholder="Entidade empregadora" value="${esc(r.empregador)}"></div>
  <div class="col-5"><input class="form-control" name="val" type="number" min="0" step="0.01" placeholder="Rendimento" value="${esc(r.valor)}"></div></div>`;
}

/* Cadastro / edição de usuário (CRUD de cliente e de agentes) */
function modalUsuario(u = null) {
  const novo = !u, c = u || { tipo: 'cliente', rendimentos: [] };
  const campoTipo = novo ? `<select name="tipo" class="form-select mb-2" id="tipo">
      <option value="cliente">Cliente</option><option value="empresa">Agente - Empresa</option><option value="banco">Agente - Banco</option></select>` : '';
  const rends = (c.rendimentos || []).length ? c.rendimentos : [{}];
  modal(novo ? 'Cadastro' : 'Meu perfil', `
    ${campoTipo}
    <input class="form-control mb-2" name="nome" placeholder="Nome" value="${esc(c.nome)}" required>
    <input class="form-control mb-2" name="email" type="email" placeholder="E-mail" value="${esc(c.email)}" required>
    <input class="form-control mb-2" name="senha" type="password" placeholder="Senha" value="${esc(c.senha)}" required>
    <div id="dados-cliente" ${c.tipo !== 'cliente' ? 'class="d-none"' : ''}>
      <div class="row g-2 mb-2"><div class="col"><input class="form-control" name="rg" placeholder="RG *" value="${esc(c.rg)}"></div>
      <div class="col"><input class="form-control" name="cpf" placeholder="CPF *" value="${esc(c.cpf)}"></div></div>
      <input class="form-control mb-2" name="endereco" placeholder="Endereço *" value="${esc(c.endereco)}">
      <input class="form-control mb-3" name="profissao" placeholder="Profissão *" value="${esc(c.profissao)}">
      <label class="form-label fw-semibold">Rendimentos * (de 1 a 3)</label>
      <div id="rends">${rends.map(rendRow).join('')}</div>
      <button type="button" class="btn btn-sm btn-outline-secondary" id="add-r">+ Adicionar</button>
    </div>
    ${novo ? '' : '<hr><button type="button" class="btn btn-sm btn-outline-danger" id="del-conta">Excluir minha conta</button>'}`,
  async (d, f) => {
    const tipo = novo ? d.tipo : u.tipo;
    const obj = { tipo, nome: d.nome, email: d.email, senha: d.senha };
    if (tipo === 'cliente') {
      const dados = { rg: d.rg.trim(), cpf: d.cpf.trim(), endereco: d.endereco.trim(), profissao: d.profissao.trim() };
      if (Object.values(dados).some(v => !v)) throw new Error('Preencha RG, CPF, endereço e profissão.');
      if (!cpfValido(dados.cpf)) throw new Error('CPF inválido.');
      dados.cpf = fmtCpf(dados.cpf);
      Object.assign(obj, dados);
      const emps = [...f.querySelectorAll('[name=emp]')], vals = [...f.querySelectorAll('[name=val]')];
      obj.rendimentos = emps.map((e, i) => ({ empregador: e.value.trim(), valor: Number(vals[i].value) }))
        .filter(r => r.empregador && r.valor > 0).slice(0, 3);
      if (!obj.rendimentos.length) throw new Error('Informe ao menos um rendimento (entidade empregadora e valor).');
    }
    if (novo) {
      const ex = await Api.get(`/usuarios?email=${encodeURIComponent(d.email)}`);
      if (ex.length) throw new Error('E-mail já cadastrado.');
      await Api.post('/usuarios', obj); renderAuth(alertBox('Cadastro realizado! Faça login.', 'success'));
    } else {
      user = await Api.put(`/usuarios/${u.id}`, obj); sessionStorage.setItem('user', JSON.stringify(user)); render();
    }
  }, 'modal-lg');
  const m = $('#m');
  if (novo) m.querySelector('#tipo').onchange = e => $('#dados-cliente').classList.toggle('d-none', e.target.value !== 'cliente');
  m.querySelector('#add-r').onclick = () => { if (m.querySelectorAll('.rend').length < 3) m.querySelector('#rends').insertAdjacentHTML('beforeend', rendRow()); };
  const del = m.querySelector('#del-conta');
  if (del) del.onclick = async () => {
    if (!confirm('Excluir conta e todos os seus pedidos?')) return;
    const ps = (await loadPedidos()).filter(p => p.clienteId == u.id);
    await Promise.all(ps.map(p => Api.del(`/pedidos/${p.id}`)));
    await Promise.all(ps.filter(p => p.automovelId).map(p => Api.del(`/automoveis/${p.automovelId}`)));
    await Api.del(`/usuarios/${u.id}`); logout();
  };
}

function logout() { sessionStorage.clear(); user = null; renderAuth(); }

/* ===== Cliente: pedidos ===== */
async function renderCliente() {
  const ps = (await loadPedidos()).filter(p => p.clienteId == user.id);
  $('#app').innerHTML = `
  <div class="d-flex justify-content-between align-items-center mb-3"><h4>Meus pedidos de aluguel</h4>
    <button class="btn btn-primary" id="novo">+ Novo pedido</button></div>
  <div class="card"><div class="table-responsive"><table class="table align-middle mb-0">
    <thead><tr><th>#</th><th>Automóvel</th><th>Proprietário</th><th>Crédito</th><th>Valor</th><th>Status</th><th></th></tr></thead>
    <tbody>${ps.map(p => `<tr><td>${p.id}</td><td>${esc(p.automovel.marca)} ${esc(p.automovel.modelo)} (${esc(p.automovel.ano)})<br><small class="text-muted">${esc(p.automovel.placa)}</small></td>
      <td>${esc(p.automovel.proprietarioNome)}<br><small class="text-muted text-capitalize">${esc(p.automovel.proprietarioTipo)}</small></td><td>${p.bancoId ? esc(p.bancoNome) : '—'}</td><td>${money(p.valor)}</td>
      <td><span class="badge text-bg-${BADGE[p.status]}">${p.status}</span>${p.parecer ? `<br><small class="text-muted">${esc(p.parecer)}</small>` : ''}</td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-secondary" data-ver="${p.id}">Ver</button>
        ${[STATUS.ANALISE].includes(p.status) ? `<button class="btn btn-sm btn-outline-primary" data-edit="${p.id}">Editar</button>` : ''}
        ${[STATUS.ANALISE, STATUS.APROVADO].includes(p.status) ? `<button class="btn btn-sm btn-outline-danger" data-cancel="${p.id}">Cancelar</button>` : ''}
      </td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted py-4">Nenhum pedido ainda.</td></tr>'}</tbody></table></div></div>`;
  $('#novo').onclick = () => modalPedido();
  document.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => verPedido(ps.find(p => p.id == b.dataset.ver)));
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => modalPedido(ps.find(p => p.id == b.dataset.edit)));
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
    if (confirm('Cancelar este pedido?')) { await Api.patch(`/pedidos/${b.dataset.cancel}`, { status: STATUS.CANCELADO }); render(); }
  });
}

async function modalPedido(p = null) {
  const us = await Api.get('/usuarios');
  const bancos = us.filter(u => u.tipo === 'banco'), empresas = us.filter(u => u.tipo === 'empresa');
  const a = p?.automovel || {};
  modal(p ? `Editar pedido #${p.id}` : 'Novo pedido de aluguel', `
    <h6>Automóvel</h6>
    <div class="row g-2 mb-3">
      <div class="col-md-4"><input class="form-control" name="matricula" placeholder="Matrícula" value="${esc(a.matricula)}" required></div>
      <div class="col-md-4"><input class="form-control" name="placa" placeholder="Placa (ABC1D23)" maxlength="8" value="${esc(a.placa)}" required></div>
      <div class="col-md-4"><input class="form-control" name="ano" type="number" min="1980" max="2030" placeholder="Ano" value="${esc(a.ano)}" required></div>
      <div class="col-md-6"><input class="form-control" name="marca" placeholder="Marca" value="${esc(a.marca)}" required></div>
      <div class="col-md-6"><input class="form-control" name="modelo" placeholder="Modelo" value="${esc(a.modelo)}" required></div>
      <div class="col-md-4"><label class="form-label small">Propriedade do automóvel</label>
        <select name="proprietarioTipo" id="ptipo" class="form-select"><option value="cliente">Cliente</option><option value="empresa">Empresa</option><option value="banco">Banco</option></select></div>
      <div class="col-md-8 d-none" id="dono-box"><label class="form-label small">Proprietário</label><select name="proprietarioId" id="pdono" class="form-select"></select></div>
    </div>
    <h6>Contrato</h6>
    <div class="row g-2">
      <div class="col-md-4"><label class="form-label small">Valor mensal (R$)</label><input class="form-control" name="valor" type="number" min="1" step="0.01" value="${esc(p?.valor)}" required></div>
      <div class="col-md-4"><label class="form-label small">Duração (meses)</label><input class="form-control" name="meses" type="number" min="1" value="${esc(p?.meses || 12)}" required></div>
      <div class="col-md-4"><label class="form-label small">Contrato de crédito (opcional)</label>
        <select name="bancoId" class="form-select"><option value="">Sem crédito</option>${bancos.map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></div>
    </div>`,
  async d => {
    const placa = d.placa.toUpperCase().replace('-', '').trim(), ano = Number(d.ano);
    if (!placaValida(placa)) throw new Error('Placa inválida (use ABC1234 ou ABC1D23).');
    if (ano < 1980 || ano > new Date().getFullYear() + 1) throw new Error('Ano inválido.');
    const dono = d.proprietarioTipo === 'cliente' ? user : us.find(u => u.id == d.proprietarioId && u.tipo === d.proprietarioTipo);
    if (!dono) throw new Error('Selecione o proprietário do automóvel.');
    const auto = { matricula: d.matricula.trim(), placa, ano, marca: d.marca.trim(), modelo: d.modelo.trim(),
      proprietarioTipo: d.proprietarioTipo, proprietarioId: dono.id, proprietarioNome: dono.nome };
    const salvo = p?.automovelId ? await Api.put(`/automoveis/${p.automovelId}`, auto) : await Api.post('/automoveis', auto);
    const banco = bancos.find(b => b.id == d.bancoId);
    const obj = {
      clienteId: user.id, clienteNome: user.nome, automovelId: salvo.id,
      valor: Number(d.valor), meses: Number(d.meses),
      bancoId: banco ? banco.id : null, bancoNome: banco ? banco.nome : null,
      status: STATUS.ANALISE, parecer: '', agenteId: null, data: new Date().toISOString()
    };
    p ? await Api.patch(`/pedidos/${p.id}`, obj) : await Api.post('/pedidos', obj);
    render();
  }, 'modal-lg');
  const tipoEl = $('#ptipo'), donoEl = $('#pdono');
  const popular = () => {
    const t = tipoEl.value, lista = t === 'banco' ? bancos : t === 'empresa' ? empresas : [];
    $('#dono-box').classList.toggle('d-none', t === 'cliente');
    donoEl.innerHTML = lista.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('') || '<option value="">Nenhum cadastrado</option>';
  };
  tipoEl.onchange = popular;
  if (p) { tipoEl.value = a.proprietarioTipo || 'cliente'; $('[name=bancoId]').value = p.bancoId || ''; }
  popular();
  if (p && a.proprietarioId) donoEl.value = a.proprietarioId;
}

function verPedido(p) {
  modal(`Pedido #${p.id}`, `
    <dl class="row mb-0">
      <dt class="col-4">Status</dt><dd class="col-8"><span class="badge text-bg-${BADGE[p.status]}">${p.status}</span></dd>
      <dt class="col-4">Cliente</dt><dd class="col-8">${esc(p.clienteNome)}</dd>
      <dt class="col-4">Automóvel</dt><dd class="col-8">${esc(p.automovel.marca)} ${esc(p.automovel.modelo)} / ${esc(p.automovel.ano)}<br>Placa ${esc(p.automovel.placa)} · Matrícula ${esc(p.automovel.matricula)}</dd>
      <dt class="col-4">Propriedade</dt><dd class="col-8">${esc(p.automovel.proprietarioNome)} <small class="text-muted text-capitalize">(${esc(p.automovel.proprietarioTipo)})</small></dd>
      <dt class="col-4">Valor</dt><dd class="col-8">${money(p.valor)} × ${p.meses} meses</dd>
      <dt class="col-4">Crédito</dt><dd class="col-8">${p.bancoNome ? esc(p.bancoNome) : 'Sem crédito'}</dd>
      <dt class="col-4">Parecer</dt><dd class="col-8">${esc(p.parecer) || '—'}</dd>
    </dl>`);
}

/* ===== Agente: avaliar / modificar pedidos e executar contratos ===== */
async function renderAgente() {
  const ps = await loadPedidos();
  const visiveis = ps.filter(p => p.status !== STATUS.CANCELADO);
  $('#app').innerHTML = `<h4 class="mb-3">Pedidos para análise</h4>
  <div class="card"><div class="table-responsive"><table class="table align-middle mb-0">
    <thead><tr><th>#</th><th>Cliente</th><th>Automóvel</th><th>Valor</th><th>Crédito</th><th>Status</th><th></th></tr></thead>
    <tbody>${visiveis.map(p => `<tr><td>${p.id}</td><td>${esc(p.clienteNome)}</td>
      <td>${esc(p.automovel.marca)} ${esc(p.automovel.modelo)}<br><small class="text-muted">${esc(p.automovel.placa)}</small></td>
      <td>${money(p.valor)}×${p.meses}</td><td>${p.bancoNome ? esc(p.bancoNome) : '—'}</td>
      <td><span class="badge text-bg-${BADGE[p.status]}">${p.status}</span></td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-secondary" data-cli="${p.clienteId}">Cliente</button>
        ${p.status !== STATUS.CONTRATADO ? `<button class="btn btn-sm btn-outline-primary" data-aval="${p.id}">Avaliar</button>` : ''}
        ${p.status === STATUS.APROVADO ? `<button class="btn btn-sm btn-success" data-exec="${p.id}">Executar contrato</button>` : ''}
      </td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted py-4">Sem pedidos.</td></tr>'}</tbody></table></div></div>`;
  document.querySelectorAll('[data-cli]').forEach(b => b.onclick = async () => {
    const c = await Api.get(`/usuarios/${b.dataset.cli}`);
    modal('Dados do contratante', `<dl class="row mb-0"><dt class="col-4">Nome</dt><dd class="col-8">${esc(c.nome)}</dd>
      <dt class="col-4">RG / CPF</dt><dd class="col-8">${esc(c.rg)} / ${esc(c.cpf)}</dd><dt class="col-4">Endereço</dt><dd class="col-8">${esc(c.endereco)}</dd>
      <dt class="col-4">Profissão</dt><dd class="col-8">${esc(c.profissao)}</dd><dt class="col-4">Rendimentos</dt>
      <dd class="col-8">${(c.rendimentos || []).map(r => `${esc(r.empregador)}: ${money(r.valor)}`).join('<br>') || '—'}</dd></dl>`);
  });
  document.querySelectorAll('[data-aval]').forEach(b => b.onclick = () => {
    const p = ps.find(x => x.id == b.dataset.aval);
    modal(`Avaliar pedido #${p.id}`, `
      <div class="mb-2"><label class="form-label small">Parecer financeiro</label>
        <select name="decisao" class="form-select"><option value="${STATUS.APROVADO}">Positivo (aprovar)</option><option value="${STATUS.REPROVADO}">Negativo (reprovar)</option><option value="${STATUS.ANALISE}">Manter em análise</option></select></div>
      <div class="mb-2"><label class="form-label small">Justificativa</label><textarea name="parecer" class="form-control" rows="2">${esc(p.parecer)}</textarea></div>
      <div><label class="form-label small">Ajustar valor mensal (R$)</label><input name="valor" type="number" step="0.01" class="form-control" value="${p.valor}"></div>`,
    async d => { await Api.patch(`/pedidos/${p.id}`, { status: d.decisao, parecer: d.parecer, valor: Number(d.valor), agenteId: user.id }); render(); });
    $('[name=decisao]').value = p.status === STATUS.CONTRATADO ? STATUS.APROVADO : p.status;
  });
  document.querySelectorAll('[data-exec]').forEach(b => b.onclick = async () => {
    const p = ps.find(x => x.id == b.dataset.exec);
    if (!confirm(`Executar contrato do pedido #${p.id}?`)) return;
    await Api.post('/contratos', { pedidoId: p.id, clienteId: p.clienteId, agenteId: user.id, valor: p.valor, meses: p.meses, bancoCreditoId: p.bancoId, data: new Date().toISOString() });
    await Api.patch(`/pedidos/${p.id}`, { status: STATUS.CONTRATADO }); render();
  });
}

/* ===== Roteamento principal ===== */
function render() {
  if (!user) return renderAuth();
  $('#nav-user').innerHTML = `${esc(user.nome)} <span class="badge text-bg-light text-capitalize">${user.tipo}</span>
    <button class="btn btn-sm btn-outline-light ms-2" id="perfil">Perfil</button><button class="btn btn-sm btn-light ms-1" id="sair">Sair</button>`;
  $('#sair').onclick = logout; $('#perfil').onclick = () => modalUsuario(user);
  (isAgente(user) ? renderAgente() : renderCliente()).catch(() => $('#app').innerHTML = alertBox('Falha ao acessar a API. Execute "npm run api".'));
}
render();
