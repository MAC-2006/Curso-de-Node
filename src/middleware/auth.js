// src/middleware/auth.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = "curso_token";

function assinarToken(usuario) {
  return jwt.sign(
    {
      sub: usuario.id,
      name: usuario.name,
      email: usuario.email,
      isAdmin: !!usuario.isAdmin,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function definirCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript do navegador não consegue ler esse cookie (protege contra XSS)
    sameSite: "lax", // proteção básica contra CSRF
    secure: process.env.NODE_ENV === "production", // exige HTTPS em produção
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    path: "/",
  });
}

function limparCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// Middleware: exige que o usuário esteja logado
function exigirAutenticacao(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ erro: "Você precisa estar logado." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      isAdmin: !!payload.isAdmin,
    };
    next();
  } catch (err) {
    limparCookie(res);
    return res.status(401).json({ erro: "Sessão inválida ou expirada. Faça login novamente." });
  }
}

// Middleware: exige que o usuário esteja logado E seja administrador.
// Deve ser usado sempre depois de exigirAutenticacao.
function exigirAdmin(req, res, next) {
  if (!req.usuario || !req.usuario.isAdmin) {
    return res.status(403).json({ erro: "Acesso restrito à administração." });
  }
  next();
}

// Middleware: se houver token válido, anexa o usuário, mas não bloqueia
function autenticacaoOpcional(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.usuario = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        isAdmin: !!payload.isAdmin,
      };
    } catch (err) {
      // token inválido: segue sem usuário autenticado
    }
  }
  next();
}

module.exports = {
  assinarToken,
  definirCookie,
  limparCookie,
  exigirAutenticacao,
  exigirAdmin,
  autenticacaoOpcional,
};
