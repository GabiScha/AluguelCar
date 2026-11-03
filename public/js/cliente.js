import { Api } from './api.js';
import { $, esc, money, BADGE, STATUS, getUser, renderNav, modal, placaValida, loadPedidos } from './utils.js';
import { modalUsuario } from './perfil.js';

const user = getUser();
if (!user || user.tipo !== 'cliente') window.location.href = 'index.html';
renderNav(user, modalUsuario);

async function renderTabela() {
  const ps = (await loadPedidos(Api)).filter(p => p.clienteId == user.id);
  const tbody = $('#tbody-pedidos');
  
  tbody.innerHTML = ps.map(p => `<tr><td>${p.id}</td><td>${esc(p.automovel.marca)} ${esc(p.automovel.modelo)} (${esc(p.automovel.ano)})<br><small class="text-muted">${esc(p.automovel.placa)}</small></td>
    <td>${esc(p.automovel.proprietarioNome)}<br><small class="text-muted text-capitalize">${esc(p.automovel.proprietarioTipo)}</small></td><td>${p.bancoId ? esc(p.bancoNome) : '—'}</td><td>${money(p.valor)}</td>
    <td><span class="badge text-bg-${BADGE[p.status]}">${p.status}</span>${p.parecer ? `<br><small class="text-muted">${esc(p.parecer)}</small>` : ''}</td>
    <td class="text-end text-nowrap">
      <button class="btn btn-sm btn-outline-secondary" data-ver="${p.id}">Ver</button>
      ${[STATUS.ANALISE].includes(p.status) ? `<button class="btn btn-sm btn-outline-primary" data-edit="${p.id}">Editar</button>` : ''}
      ${[STATUS.ANALISE, STATUS.APROVADO].includes(p.status) ? `<button class="btn btn-sm btn-outline-danger" data-cancel="${p.id}">Cancelar</button>` : ''}
    </td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted py-4">Nenhum pedido ainda.</td></tr>';

  document.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => verPedido(ps.find(p => p.id == b.dataset.ver)));
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => modalPedido(ps.find(p => p.id == b.dataset.edit)));
  document.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
    if (confirm('Cancelar este pedido?')) { 
      await Api.patch(`/pedidos/${b.dataset.cancel}`, { status: STATUS.CANCELADO }); 
      renderTabela(); 
    }
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
      <div class="col-md-4"><label class="form-label small">Contrato de crédito</label>
        <select name="bancoId" class="form-select"><option value="">Sem crédito</option>${bancos.map(b => `<option value="${b.id}">${esc(b.nome)}</option>`).join('')}</select></div>
    </div>`,
  async d => {
    const placa = d.placa.toUpperCase().replace('-', '').trim(), ano = Number(d.ano);
    if (!placaValida(placa)) throw new Error('Placa inválida (use ABC1234 ou ABC1D23).');
    if (ano < 1980 || ano > new Date().getFullYear() + 1) throw new Error('Ano inválido.');
    
    const dono = d.proprietarioTipo === 'cliente' ? user : us.find(u => u.id == d.proprietarioId && u.tipo === d.proprietarioTipo);
    if (!dono) throw new Error('Selecione o proprietário do automóvel.');
    
    const auto = { matricula: d.matricula.trim(), placa, ano, marca: d.marca.trim(), modelo: d.modelo.trim(), proprietarioTipo: d.proprietarioTipo, proprietarioId: dono.id, proprietarioNome: dono.nome };
    const salvo = p?.automovelId ? await Api.put(`/automoveis/${p.automovelId}`, auto) : await Api.post('/automoveis', auto);
    const banco = bancos.find(b => b.id == d.bancoId);
    
    const obj = { clienteId: user.id, clienteNome: user.nome, automovelId: salvo.id, valor: Number(d.valor), meses: Number(d.meses), bancoId: banco ? banco.id : null, bancoNome: banco ? banco.nome : null, status: STATUS.ANALISE, parecer: '', agenteId: null, data: new Date().toISOString() };
    p ? await Api.patch(`/pedidos/${p.id}`, obj) : await Api.post('/pedidos', obj);
    
    renderTabela();
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

$('#btn-novo').onclick = () => modalPedido();
renderTabela();
