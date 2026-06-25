const API = "http://localhost:3000";

function onlyDigits(v){ return (v || "").replace(/\D/g, ""); }

async function post(path, data){
  const res = await fetch(API + path, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function get(path){
  const res = await fetch(API + path);
  return res.json();
}

const loginForm = document.getElementById("loginForm");
if (loginForm){
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const cpf = onlyDigits(document.getElementById("cpf").value.trim());
    const msg = document.getElementById("msg");
    msg.textContent = "";
    if(!email || !cpf){ msg.textContent = "Preencha e-mail e CPF."; return; }
    try{
      const data = await post("/auth/login", { nome, email, cpf });
      if(!data.ok){ msg.textContent = data.error || "Erro ao entrar"; return; }
      localStorage.setItem("cliente", JSON.stringify(data.user));
      window.location.href = "dashboard.html";
    }catch(err){
      msg.textContent = "Falha ao conectar com o backend.";
    }
  });
}

async function loadDashboard(){
  const welcome = document.getElementById("welcome");
  const statusBox = document.getElementById("statusBox");
  const ctaArea = document.getElementById("ctaArea");
  if(!statusBox) return;

  const raw = localStorage.getItem("cliente");
  if(!raw){ window.location.href = "login.html"; return; }
  const cliente = JSON.parse(raw);
  welcome.innerHTML = `<p>Olá${cliente.nome ? ", <strong>"+cliente.nome+"</strong>" : ""}.</p>`;

  try{
    const data = await get(`/user/${encodeURIComponent(cliente.cpf)}`);
    if(!data.ok){ statusBox.innerHTML = "Não foi possível carregar sua conta."; return; }

    localStorage.setItem("cliente", JSON.stringify(data.user));

    if(data.user.hasKey){
      statusBox.innerHTML = `<h2>Parabéns! Você comprou a chave do produto.</h2>
      <p>Sua chave é:</p><div class="key-box">${data.user.chave}</div>`;
      ctaArea.innerHTML = "";
    }else{
      statusBox.innerHTML = `<h2>Você não tem a chave!</h2>
      <p>Compre agora a chave do produto.</p>`;
      ctaArea.innerHTML = `<button class="btn btn-secondary" onclick="iniciarCompra()">Comprar chave</button>`;
    }
  }catch(e){
    statusBox.innerHTML = "Erro ao consultar o backend.";
  }
}
loadDashboard();

async function iniciarCompra(){
  const raw = localStorage.getItem("cliente");
  if(!raw){ window.location.href = "login.html"; return; }
  const cliente = JSON.parse(raw);
  const data = await post("/purchase/start", { cpf: cliente.cpf });
  if(data.ok){
    localStorage.setItem("pedidoAtual", JSON.stringify(data.order));
    window.location.href = "aguardando.html";
  } else {
    alert(data.error || "Erro ao iniciar compra.");
  }
}

async function loadWaiting(){
  const orderIdEl = document.getElementById("orderId");
  if(!orderIdEl) return;
  const pedido = JSON.parse(localStorage.getItem("pedidoAtual") || "null");
  const cliente = JSON.parse(localStorage.getItem("cliente") || "null");
  if(!pedido || !cliente){ window.location.href = "dashboard.html"; return; }
  orderIdEl.textContent = pedido.id;

  const timer = setInterval(async () => {
    try{
      const ext = await fetch(`https://backend-g123.onrender.com/order-status/${encodeURIComponent(pedido.id)}`, { method:"POST" });
      const extData = await ext.json().catch(() => ({}));
      if(extData.status === "concluded"){
        const approved = await post("/purchase/approve", { cpf: cliente.cpf, orderId: pedido.id });
        if(approved.ok){
          localStorage.setItem("cliente", JSON.stringify(approved.user));
          localStorage.setItem("approvedKey", approved.user.chave);
          clearInterval(timer);
          window.location.href = "aprovado.html";
        }
      }
    } catch(e){}
  }, 2000);
}
loadWaiting();

if(document.getElementById("approvedKey")){
  document.getElementById("approvedKey").textContent = localStorage.getItem("approvedKey") || "XXXXXX-XXXXXX-XXXXXX-XXXXXX";
  startConfetti();
}
