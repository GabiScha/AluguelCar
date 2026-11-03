import { Api } from './api.js';
import { $, esc, money, BADGE, STATUS, getUser, renderNav, modal, loadPedidos } from './utils.js';
import { modalUsuario } from './perfil.js';

const user = getUser();
if (!user || user.tipo === 'cliente') window.location.href = 'index.html';
renderNav(user, modalUsuario);

async function renderTabela() {
  const ps = await loadPedidos(Api);
  const visiveis = ps.filter(p => p.status !== STATUS.CANCELADO);
  
  $('#tbody-pedidos').innerHTML = visiveis.map(p => `<tr><td>${p.id}</td><td>${esc(p.clienteNome)}</td>
    <td>${esc(p.automovel.marca)} ${esc(p.automovel.modelo)}<br><small class="text-muted">${esc(p.automovel.placa)}</small></td>
    <td>${money(p.valor)}×${p.meses}</td><td>${p.bancoNome ? esc(p.bancoNome) : '—'}</td>
    <td><span class="badge text-bg-${BADGE[p.status]}">${p.status}</span></td>
    <td class="text-end text-nowrap">
      <button class="btn btn-sm btn-outline-secondary" data-cli="${p.clienteId}">Cliente</button>
      ${p.status !== STATUS.CONTRATADO ? `<button class="btn btn-sm btn-outline-primary" data-aval="${p.id}">Avaliar</button>` : ''}
      ${p.status === STATUS.APROVADO ? `<button class="btn btn-sm btn-success" data-exec="${p.id}">Executar contrato</button>` : ''}
    </td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted py-4">Sem pedidos.</td></tr>';

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
    async d => { 
      await Api.patch(`/pedidos/${p.id}`, { status: d.decisao, parecer: d.parecer, valor: Number(d.valor), agenteId: user.id }); 
      renderTabela(); 
    });
    $('[name=decisao]').value = p.status === STATUS.CONTRATADO ? STATUS.APROVADO : p.status;
  });

  document.querySelectorAll('[data-exec]').forEach(b => b.onclick = async () => {
    const p = ps.find(x => x.id == b.dataset.exec);
    if (!confirm(`Executar contrato do pedido #${p.id}?`)) return;
    await Api.post('/contratos', { pedidoId: p.id, clienteId: p.clienteId, agenteId: user.id, valor: p.valor, meses: p.meses, bancoCreditoId: p.bancoId, data: new Date().toISOString() });
    await Api.patch(`/pedidos/${p.id}`, { status: STATUS.CONTRATADO }); 
    renderTabela();
  });
}

renderTabela();
