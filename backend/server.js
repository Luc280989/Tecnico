const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(path.join(__dirname, "fiados.db"));
const CHAVE_PADRAO = "XXXXXX-XXXXXX-XXXXXX-XXXXXX";
const chaveReal = fs.readFileSync(path.join(__dirname, "chave.txt"), "utf8").trim();

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    email TEXT NOT NULL,
    cpf TEXT NOT NULL UNIQUE,
    chave TEXT NOT NULL DEFAULT '${CHAVE_PADRAO}'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    cpf TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
});

function hasPurchased(chave){
  return chave && chave !== CHAVE_PADRAO;
}

app.post("/auth/login", (req, res) => {
  const { nome, email, cpf } = req.body;
  if(!email || !cpf) return res.json({ ok:false, error:"E-mail e CPF são obrigatórios." });

  db.get("SELECT * FROM clientes WHERE cpf = ?", [cpf], (err, row) => {
    if(err) return res.json({ ok:false, error:"Erro no banco." });
    if(row){
      db.run("UPDATE clientes SET nome = COALESCE(?, nome), email = ? WHERE cpf = ?", [nome || row.nome, email, cpf], function(err2){
        if(err2) return res.json({ ok:false, error:"Erro ao atualizar cadastro." });
        db.get("SELECT * FROM clientes WHERE cpf = ?", [cpf], (_, user) => {
          res.json({ ok:true, user:{...user, hasKey: hasPurchased(user.chave)} });
        });
      });
    }else{
      db.run("INSERT INTO clientes (nome, email, cpf, chave) VALUES (?, ?, ?, ?)", [nome || null, email, cpf, CHAVE_PADRAO], function(err3){
        if(err3) return res.json({ ok:false, error:"Erro ao criar cadastro." });
        db.get("SELECT * FROM clientes WHERE cpf = ?", [cpf], (_, user) => {
          res.json({ ok:true, user:{...user, hasKey: hasPurchased(user.chave)} });
        });
      });
    }
  });
});

app.get("/user/:cpf", (req,res)=>{
  db.get("SELECT * FROM clientes WHERE cpf = ?", [req.params.cpf], (err,row)=>{
    if(err || !row) return res.json({ok:false, error:"Usuário não encontrado."});
    res.json({ok:true, user:{...row, hasKey: hasPurchased(row.chave)}});
  });
});

app.post("/purchase/start", (req,res)=>{
  const { cpf } = req.body;
  if(!cpf) return res.json({ok:false, error:"CPF obrigatório."});
  const orderId = `${Math.floor(Date.now()/1000)}${cpf}`;
  db.run("INSERT OR REPLACE INTO pedidos (id, cpf, status) VALUES (?, ?, 'pending')", [orderId, cpf], err=>{
    if(err) return res.json({ok:false, error:"Erro ao iniciar pedido."});
    res.json({ok:true, order:{ id: orderId, cpf, status:"pending" }});
  });
});

app.post("/purchase/approve", (req,res)=>{
  const { cpf, orderId } = req.body;
  if(!cpf || !orderId) return res.json({ok:false, error:"Dados inválidos."});
  db.run("UPDATE pedidos SET status = 'concluded' WHERE id = ?", [orderId], err=>{
    if(err) return res.json({ok:false, error:"Erro ao atualizar pedido."});
    db.run("UPDATE clientes SET chave = ? WHERE cpf = ?", [chaveReal, cpf], err2=>{
      if(err2) return res.json({ok:false, error:"Erro ao liberar chave."});
      db.get("SELECT * FROM clientes WHERE cpf = ?", [cpf], (_, user)=>{
        res.json({ok:true, user:{...user, hasKey:true}});
      });
    });
  });
});

app.listen(3000, ()=> console.log("Backend rodando em http://localhost:3000"));
