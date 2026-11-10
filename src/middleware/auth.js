const jwt = require("jsonwebtoken");
const db = require("../db");

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
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function limparCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// Exige login e confirma que a conta ainda existe no banco.
async function exigirAutenticacao(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ erro: "Você precisa estar logado." });
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    limparCookie(res);
    return res.status(401).json({ erro: "Sessão inválida ou expirada. Faça login novamente." });
  }

  try {
    await db.init();
    const { rows } = await db.query(
      "SELECT id, name, email, is_admin FROM users WHERE id = $1",
      [payload.sub]
    );
    const registro = rows[0];

    // Invalida automaticamente tokens de contas removidas.
    if (!registro) {
      limparCookie(res);
      return res.status(401).json({ erro: "Sua conta não está mais disponível. Faça login novamente." });
    }

    req.usuario = {
      id: registro.id,
      name: registro.name,
      email: registro.email,
      isAdmin: !!registro.is_admin,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function exigirAdmin(req, res, next) {
  if (!req.usuario || !req.usuario.isAdmin) {
    return res.status(403).json({ erro: "Acesso restrito à administração." });
  }
  next();
}

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
      // Token inválido: segue sem usuário autenticado.
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
