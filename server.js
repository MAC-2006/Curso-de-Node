// server.js
// Entrada usada apenas para rodar o projeto localmente (npm start / npm run
// dev). Em produção na Vercel, quem serve as requisições é api/index.js —
// os dois usam o mesmo app.js, então o comportamento é idêntico.
const app = require("./app");
const db = require("./src/db");

const PORT = process.env.PORT || 3000;

// Garante as tabelas e a conta de administração antes de aceitar requisições.
db.init()
  .catch((err) => {
    console.error("[db] Falha ao inicializar o banco de dados:", err);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Curso de Node rodando em http://localhost:${PORT}`);
    });
  });
