// api/index.js
// Ponto de entrada da Vercel: toda requisição para /api/* (e, pelas rewrites
// de vercel.json, também as rotas não estáticas do front-end) cai aqui. A
// Vercel sabe rodar um app Express diretamente quando ele é o módulo
// exportado por um arquivo dentro de api/.
module.exports = require("../app");
