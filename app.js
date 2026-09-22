// app.js
// Monta o app Express e o exporta (sem chamar .listen()). Isso permite
// reaproveitar exatamente a mesma aplicação em dois lugares:
//   - server.js    -> roda localmente com app.listen()
//   - api/index.js -> exporta o app para a Vercel rodar como função serverless
require("dotenv").config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("troque-este-valor")) {
  console.error(
    "\n[ERRO] Configure a variável de ambiente JWT_SECRET (veja .env.example) antes de iniciar o servidor.\n"
  );
}

const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");

const authRoutes = require("./src/routes/auth");
const cursoRoutes = require("./src/routes/curso");
const progressoRoutes = require("./src/routes/progresso");
const adminRoutes = require("./src/routes/admin");

const app = express();

app.disable("x-powered-by");
app.use(express.json());
app.use(cookieParser());

// API
app.use("/api/auth", authRoutes);
app.use("/api/curriculo", cursoRoutes);
app.use("/api/progresso", progressoRoutes);
app.use("/api/admin", adminRoutes);

// Front-end estático (usado apenas no modo local; na Vercel os arquivos de
// public/ são servidos diretamente pela CDN estática, veja vercel.json)
app.use(express.static(path.join(__dirname, "public")));

// Qualquer rota não-API cai na SPA (index.html cuida do roteamento no cliente)
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Tratamento de erro genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno no servidor." });
});

module.exports = app;
