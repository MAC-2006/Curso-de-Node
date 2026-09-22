# Curso de Node — Plataforma com login e banco de dados

Plataforma de curso online (login/cadastro reais, banco de dados e
progresso por aluno). Stack:

- **Backend:** Node.js + Express
- **Banco de dados:** PostgreSQL, hospedado no **Supabase**, acessado via `pg`
- **Arquivos (vídeos das aulas):** **Supabase Storage**
- **Hospedagem:** **Vercel** (funções serverless)
- **Autenticação:** senha com hash `bcrypt` + sessão via JWT em cookie `httpOnly`
- **Frontend:** HTML/CSS/JS puro (sem build step), consumindo a API

> Este projeto originalmente usava SQLite local. Como o objetivo é publicar
> na Vercel (que roda o backend como funções serverless, sem disco
> persistente), o banco foi migrado para PostgreSQL no Supabase e os
> uploads de vídeo passaram a ir para o Supabase Storage em vez do disco.

## Estrutura

```
curso-node/
  app.js                   monta o app Express (sem .listen) — usado local e na Vercel
  server.js                entrada local: chama app.listen() (npm start / npm run dev)
  api/index.js             entrada da Vercel: exporta o app Express como função serverless
  vercel.json               roteamento da Vercel (API + arquivos estáticos)
  supabase/schema.sql       schema de referência (opcional, a app cria as tabelas sozinha)
  src/
    db.js                   conexão com o Postgres (pg) + criação das tabelas + seed do admin
    storage.js               upload/remoção de vídeos no Supabase Storage
    middleware/auth.js       geração/validação do token de login + exigirAdmin
    routes/auth.js           /api/auth (registro, login, logout, me)
    routes/curso.js          /api/curriculo (conteúdo das aulas)
    routes/progresso.js      /api/progresso (progresso geral, por módulo e quiz)
    routes/admin.js          /api/admin (lista de alunos, detalhe, checklist de vídeos)
    data/curriculum.js       conteúdo do curso (edite aqui os módulos/aulas/vídeos)
    data/video-store.js      URLs dos vídeos enviados via upload (tabela video_overrides)
  public/                   frontend (servido como arquivos estáticos)
```

O curso hoje tem **11 módulos e 51 aulas**, do "o que é o Node.js" até um
projeto final guiado — cobrindo JavaScript básico, assincronismo, Express,
autenticação/segurança, bancos SQL e NoSQL, testes automatizados,
WebSockets, Docker/CI-CD e deploy.

## Conta de administração

Uma conta de administrador é criada **automaticamente** na primeira
requisição que toca o banco (veja `garantirContaAdmin()` em `src/db.js`):

- **E-mail:** `admin@gmail.com`
- **Senha:** `@dministrador`

Com essa conta, o menu lateral mostra um item extra **"Administração"**,
com duas abas:

- **Alunos** — todos os alunos cadastrados, progresso geral, progresso
  por módulo, acerto em quizzes e data da última atividade.
- **Vídeos a gravar** — checklist de produção (veja a seção abaixo).

> Recomendado: depois de colocar o projeto no ar, entre com essa conta e
> troque a senha por uma sua (ainda não existe uma tela de "trocar senha"
> no painel — pode ser feito direto no banco pelo SQL Editor do Supabase,
> ou peça que eu adicione essa tela).

A conta admin **nunca aparece** na lista de alunos, e o cadastro público
(`/api/auth/register`) nunca cria administradores — mesmo se alguém tentar
se cadastrar com `admin@gmail.com`, a validação de e-mail único bloqueia.

## Vídeos das aulas

Algumas aulas foram marcadas no currículo com um campo `video`, nos
pontos que fazem mais sentido ter uma aula em vídeo (assuntos mais
visuais ou práticos, como Streams, Docker, WebSockets, etc.). Hoje são
**8 pontos**, espalhados pelos módulos.

Para cada um desses pontos existe um **roteiro** (tutorial interno) com o
passo a passo do que gravar — só visível para a administração, na aba
"Vídeos a gravar" do painel (`/api/admin/videos`). O aluno nunca vê esse
roteiro: ele só recebe o título do vídeo, a duração sugerida, e um
espaço reservado ("Vídeo em produção") até o link do vídeo existir.

Você tem duas formas de colocar o vídeo no ar:

1. **Fazer upload pelo painel de administração** — o arquivo vai direto
   para o bucket `videos` no Supabase Storage e a URL pública fica salva
   na tabela `video_overrides`.
2. **Editar `src/data/curriculum.js`** e preencher `video.videoUrl` com um
   link já pronto (ex: um vídeo hospedado em outro serviço). O upload pelo
   painel tem prioridade sobre esse valor, se os dois existirem.

> ⚠️ **Limite de tamanho no upload pela Vercel:** funções serverless da
> Vercel têm um limite de corpo de requisição bem menor que os 2GB que o
> código aceita (na prática, poucos MB no plano gratuito). Isso funciona
> normalmente para vídeos curtos/comprimidos, mas para arquivos grandes o
> upload pelo painel pode falhar em produção. Se isso acontecer, use a
> opção 2 acima (edite `videoUrl` com um link já hospedado) ou peça que eu
> implemente upload direto do navegador para o Supabase Storage (contorna
> esse limite, mas exige expor uma URL assinada e mexer no front-end).

## Rodando localmente

Pré-requisitos: **Node.js 18+** e uma conta no [Supabase](https://supabase.com) (grátis).

```bash
npm install
cp .env.example .env
```

Preencha o `.env`:

- `JWT_SECRET`: gere um valor aleatório com
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: veja o passo a
  passo completo na seção **"Publicar no Supabase e na Vercel"** abaixo —
  os mesmos valores usados em produção funcionam localmente.

Depois:

```bash
npm start
```

Acesse **http://localhost:3000**, crie uma conta e navegue pelo curso. As
tabelas são criadas automaticamente no Postgres do Supabase na primeira
requisição — nenhum passo manual de banco é obrigatório (mas veja
`supabase/schema.sql` se preferir criar tudo antes, pelo SQL Editor).

## Publicar no Supabase e na Vercel

### 1. Criar o projeto no Supabase

1. Crie uma conta/projeto em [supabase.com](https://supabase.com).
2. Em **Project Settings → Database → Connection string**, copie a URI no
   modo **"Connection pooling" (Transaction, porta 6543)** — é essa que
   funciona bem com as funções serverless da Vercel. Troque `[YOUR-PASSWORD]`
   pela senha do banco que você definiu na criação do projeto. Esse valor
   vai na variável `DATABASE_URL`.
3. Em **Project Settings → API**, copie:
   - **Project URL** → variável `SUPABASE_URL`
   - **service_role key** (não a `anon` key — essa é secreta) → variável
     `SUPABASE_SERVICE_ROLE_KEY`
4. (Opcional) Rode `supabase/schema.sql` no **SQL Editor** do Supabase para
   criar as tabelas antecipadamente. Se pular esse passo, a própria
   aplicação cria tudo sozinha na primeira requisição.

### 2. Criar o bucket de Storage para os vídeos

1. No Supabase, vá em **Storage → New bucket**.
2. Nome: `videos` (ou outro nome — nesse caso ajuste
   `SUPABASE_VIDEOS_BUCKET`).
3. Marque o bucket como **Public** (é o que permite que a URL do vídeo
   funcione diretamente no `<video>` do front-end sem precisar de URL
   assinada).

### 3. Subir o projeto para o GitHub

```bash
git init
git add .
git commit -m "Curso de Node pronto para Vercel + Supabase"
git branch -M main
git remote add origin <url-do-seu-repositorio>
git push -u origin main
```

### 4. Importar o projeto na Vercel

1. Em [vercel.com](https://vercel.com), **Add New → Project**, importe o
   repositório do GitHub.
2. Framework preset: deixe **"Other"** (o `vercel.json` já cuida do
   roteamento).
3. Em **Environment Variables**, adicione (para os três ambientes:
   Production, Preview e Development):
   - `JWT_SECRET` — um valor aleatório forte, **diferente** do de
     desenvolvimento
   - `DATABASE_URL` — a connection string do Supabase (passo 1)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_VIDEOS_BUCKET` = `videos`
   - `NODE_ENV` = `production`
4. Clique em **Deploy**.

Depois do primeiro deploy, acesse a URL gerada pela Vercel, entre com a
conta admin (`admin@gmail.com` / `@dministrador`) e troque a senha.

### Por que essa estrutura?

- `app.js` só monta o Express (sem `app.listen()`), para poder ser
  reaproveitado tanto localmente (`server.js`) quanto pela Vercel
  (`api/index.js`), que espera que o arquivo dentro de `api/` exporte o
  handler da requisição.
- `vercel.json` manda tudo que começa com `/api/` para essa função, serve
  `public/css` e `public/js` como arquivos estáticos, e qualquer outra rota
  cai em `public/index.html` (o front-end é uma página só, sem
  roteamento client-side por enquanto).
- O Postgres substitui o SQLite porque as funções da Vercel não têm disco
  persistente entre execuções. O Supabase Storage substitui a pasta
  `public/uploads/videos` pelo mesmo motivo.

## Editando o conteúdo do curso

Todo o conteúdo (módulos, aulas, exemplos de código, quiz e vídeos)
fica em `src/data/curriculum.js`, em um array simples. Para adicionar
uma aula nova, copie um objeto de aula existente, troque o `id`
(precisa ser único — ele é usado para salvar o progresso no banco) e
ajuste `title`, `content`, `example` e `quiz`.

Para adicionar um ponto de vídeo em uma aula, inclua um campo `video`:

```js
video: {
  titulo: "Nome do vídeo",
  duracaoSugerida: "8-12 min",
  videoUrl: null, // troque pelo link quando o vídeo estiver pronto
  roteiro: [
    "Primeiro tópico a explicar...",
    "Depois mostrar ao vivo...",
    // ...
  ],
},
```

## Segurança já incluída

- Senhas nunca são salvas em texto puro — apenas o hash (`bcrypt`, custo 12).
- Login/cadastro têm limite de tentativas (`express-rate-limit`) contra força bruta.
- Sessão via cookie `httpOnly` + `sameSite=lax` (o token não pode ser lido por JavaScript no navegador).
- Todas as consultas ao banco usam *queries parametrizadas* (`$1, $2, ...`, sem concatenar valores do usuário em SQL).
- Rotas de progresso e quiz exigem estar autenticado; o gabarito do quiz nunca é enviado ao navegador antes da resposta.
- Rotas `/api/admin/*` exigem estar autenticado **e** ter `is_admin = true`; o roteiro dos vídeos nunca é enviado para o aluno.
- O upload de vídeo usa a `service_role key` do Supabase só no backend (nunca é exposta ao navegador) e só depois de já validar que quem pediu é um admin autenticado.
