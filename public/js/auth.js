import { Api } from './api.js';
import { $, formData, alertBox, getUser } from './utils.js';
import { modalUsuario } from './perfil.js';

// Redireciona se já estiver logado
const user = getUser();
if (user) window.location.href = user.tipo === 'cliente' ? 'cliente.html' : 'agente.html';

$('#login-form').onsubmit = async e => {
  e.preventDefault();
  const { email, senha } = formData(e.target);
  try {
    const [u] = await Api.get(`/usuarios?email=${encodeURIComponent(email)}&senha=${encodeURIComponent(senha)}`);
    if (!u) {
      $('#msg-login').innerHTML = alertBox('Credenciais inválidas.');
      return;
    }
    sessionStorage.setItem('user', JSON.stringify(u));
    window.location.href = u.tipo === 'cliente' ? 'cliente.html' : 'agente.html';
  } catch { 
    $('#msg-login').innerHTML = alertBox('API indisponível. Execute "npm run api".'); 
  }
};

$('#btn-cad').onclick = () => modalUsuario(null, () => {
  $('#msg-login').innerHTML = alertBox('Cadastro realizado! Faça login.', 'success');
});
