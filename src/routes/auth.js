// src/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const {
  assinarToken,
  definirCookie,
  limparCookie,
  exigirAutenticacao,
} = require("../middleware/auth");

const router = express.Router();

// Limita tentativas de login/cadastro para dificultar ataques de força bruta
const limiteTentativas = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarCadastro({ name, email, password }) {
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return "Informe seu nome completo.";
  }
  if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return "Informe um e-mail válido.";
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return null;
}

router.post("/register", limiteTentativas, async (req, res, next) => {
  try {
    await db.init();
    const { name, email, password } = req.body || {};

    const erroValidacao = validarCadastro({ name, email, password });
    if (erroValidacao) {
      return res.status(400).json({ erro: erroValidacao });
    }

    const emailNormalizado = email.trim().toLowerCase();

    const { rows: existentes } = await db.query("SELECT id FROM users WHERE email = $1", [
      emailNormalizado,
    ]);
    if (existentes[0]) {
      return res.status(409).json({ erro: "Já existe uma conta com esse e-mail." });
    }

    const hash = await bcrypt.hash(password, 12);

    // Cadastro público nunca cria administrador, mesmo que alguém tente
    // se cadastrar com o e-mail reservado da conta de administração.
    const { rows } = await db.query(
      "INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, FALSE) RETURNING id",
      [name.trim(), emailNormalizado, hash]
    );

    const usuario = {
      id: rows[0].id,
      name: name.trim(),
      email: emailNormalizado,
      isAdmin: false,
    };
    const token = assinarToken(usuario);
    definirCookie(res, token);

    res.status(201).json({ usuario });
  } catch (err) {
    next(err);
  }
});

router.post("/login", limiteTentativas, async (req, res, next) => {
  try {
    await db.init();
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ erro: "Informe e-mail e senha." });
    }

    const emailNormalizado = String(email).trim().toLowerCase();
    const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [emailNormalizado]);
    const registro = rows[0];

    // Mensagem genérica de propósito: não revelar se o e-mail existe ou não
    const credenciaisInvalidas = () =>
      res.status(401).json({ erro: "E-mail ou senha incorretos." });

    if (!registro) return credenciaisInvalidas();

    const senhaConfere = await bcrypt.compare(password, registro.password_hash);
    if (!senhaConfere) return credenciaisInvalidas();

    const usuario = {
      id: registro.id,
      name: registro.name,
      email: registro.email,
      isAdmin: !!registro.is_admin,
    };
    const token = assinarToken(usuario);
    definirCookie(res, token);

    res.json({ usuario });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", (req, res) => {
  limparCookie(res);
  res.json({ ok: true });
});

router.get("/me", exigirAutenticacao, (req, res) => {
  res.json({ usuario: req.usuario });
});

module.exports = router;
