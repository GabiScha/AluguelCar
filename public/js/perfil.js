import { Api } from './api.js';
import { $, esc, modal, cpfValido, fmtCpf } from './utils.js';

function rendRow(r = {}) {
  return `<div class="row g-2 mb-2 rend"><div class="col-7"><input class="form-control" name="emp" placeholder="Entidade empregadora" value="${esc(r.empregador)}"></div>
  <div class="col-5"><input class="form-control" name="val" type="number" min="0" step="0.01" placeholder="Rendimento" value="${esc(r.valor)}"></div></div>`;
}

export function modalUsuario(u = null, callbackNovo = null) {
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
      if (!obj.rendimentos.length) throw new Error('Informe ao menos um rendimento.');
    }

    if (novo) {
      const ex = await Api.get(`/usuarios?email=${encodeURIComponent(d.email)}`);
      if (ex.length) throw new Error('E-mail já cadastrado.');
      await Api.post('/usuarios', obj);
      if (callbackNovo) callbackNovo();
    } else {
      const updated = await Api.put(`/usuarios/${u.id}`, obj);
      sessionStorage.setItem('user', JSON.stringify(updated));
      location.reload(); 
    }
  }, 'modal-lg');

  const m = $('#m');
  if (novo) m.querySelector('#tipo').onchange = e => $('#dados-cliente').classList.toggle('d-none', e.target.value !== 'cliente');
  m.querySelector('#add-r').onclick = () => { if (m.querySelectorAll('.rend').length < 3) m.querySelector('#rends').insertAdjacentHTML('beforeend', rendRow()); };
  
  const del = m.querySelector('#del-conta');
  if (del) del.onclick = async () => {
    if (!confirm('Excluir conta e todos os seus pedidos?')) return;
    const [ps, autos] = await Promise.all([Api.get('/pedidos'), Api.get('/automoveis')]);
    const meus = ps.filter(p => p.clienteId == u.id);
    await Promise.all(meus.map(p => Api.del(`/pedidos/${p.id}`)));
    await Promise.all(meus.filter(p => p.automovelId).map(p => Api.del(`/automoveis/${p.automovelId}`)));
    await Api.del(`/usuarios/${u.id}`);
    sessionStorage.clear();
    window.location.href = 'index.html';
  };
}
