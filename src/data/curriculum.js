// src/data/curriculum.js
// Conteúdo completo do curso, do zero ao avançado. Cada aula tem um id
// único (usado para salvar progresso no banco), conteúdo em texto, um
// exemplo de código e uma pergunta de fixação (quiz).
//
// Algumas aulas também têm um campo "video": são os pontos do curso onde
// vamos encaixar uma videoaula gravada pela equipe. Cada um desses pontos
// tem um "roteiro" (tutorial interno) descrevendo o que gravar. Esse
// roteiro só aparece no painel de administração (/api/admin/videos) — o
// aluno só recebe o título, a duração sugerida e o link do vídeo quando
// ele existir.

const curriculum = [
  // =====================================================================
  // MÓDULO 0 — Fundamentos de JavaScript (pré-requisito para quem nunca programou)
  // =====================================================================
  {
    id: "fundamentos-js",
    title: "Fundamentos de JavaScript",
    lessons: [
      {
        id: "como-programas-rodam",
        title: "Como um programa roda: o motor V8",
        content: [
          "Todo código JavaScript precisa de um motor (engine) para ser interpretado e executado. O V8, criado pelo Google e usado no Chrome, é o motor que também roda por trás do Node.js — é ele quem transforma o texto do seu arquivo .js em instruções que o processador entende.",
          "Antes do Node existir, JavaScript só rodava dentro de navegadores. O Node.js pegou o motor V8 e adicionou a ele acesso ao sistema operacional (arquivos, rede, processos), permitindo escrever programas de servidor, scripts e ferramentas de linha de comando com a mesma linguagem usada no front-end.",
        ],
        example: `// Isso é só JavaScript "puro", sem nada de navegador
const mensagem = "Rodando fora do navegador";
console.log(mensagem);

// No terminal:
// node arquivo.js`,
        quiz: {
          question: "Qual motor (engine) o Node.js utiliza para executar JavaScript?",
          options: ["O V8, o mesmo motor do Google Chrome", "Um motor próprio chamado NodeEngine", "O mesmo motor do Python"],
          correctIndex: 0,
        },
      },
      {
        id: "variaveis-tipos",
        title: "Variáveis, tipos e operadores",
        content: [
          "JavaScript tem três formas de declarar variáveis: let (pode mudar de valor), const (não pode ser reatribuída) e var (forma antiga, evitada em código moderno por causa do seu comportamento de escopo confuso). O padrão em projetos novos é usar const sempre que possível e let quando o valor precisa mudar.",
          "Os tipos primitivos mais usados são string (texto), number (números), boolean (verdadeiro/falso), undefined, null e o tipo especial object (que inclui arrays, funções e objetos comuns). JavaScript é uma linguagem de tipagem dinâmica: o tipo da variável é decidido em tempo de execução, não precisa ser declarado.",
        ],
        example: `const nome = "Ana";       // string
let idade = 28;          // number
const ativo = true;      // boolean
let usuario;              // undefined até receber um valor

idade = idade + 1;        // let pode ser reatribuído
// nome = "Outro";        // ERRO: const não pode ser reatribuído

console.log(typeof nome, typeof idade, typeof ativo);`,
        quiz: {
          question: "Qual a diferença principal entre let e const?",
          options: [
            "const não pode ser reatribuída depois de declarada, let pode",
            "let só aceita números e const só aceita texto",
            "Não existe diferença, são sinônimos",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "funcoes-e-escopo",
        title: "Funções, arrow functions e escopo",
        content: [
          "Funções são blocos de código reutilizáveis. Podem ser declaradas com a palavra function, como expressões, ou na forma mais moderna de arrow function (=>), que além de mais curta, não cria seu próprio this — ela usa o this do contexto onde foi definida, o que evita uma classe inteira de bugs comuns.",
          "Escopo é a região do código onde uma variável existe. Variáveis declaradas com let/const dentro de um bloco { } só existem dentro dele (escopo de bloco). Isso é diferente de var, que ignora blocos e só respeita o escopo da função — mais um motivo para preferir let/const.",
        ],
        example: `function somar(a, b) {
  return a + b;
}

const multiplicar = (a, b) => a * b;

function exemploEscopo() {
  if (true) {
    const valor = 10;
    console.log(valor); // 10, existe aqui dentro
  }
  // console.log(valor); // ERRO: valor não existe fora do bloco
}

console.log(somar(2, 3), multiplicar(2, 3));`,
        quiz: {
          question: "Por que arrow functions são preferidas em muitos casos no JavaScript moderno?",
          options: [
            "Elas são mais curtas e não criam seu próprio this",
            "Elas rodam mais rápido que qualquer outra função",
            "Elas são a única forma de declarar funções no Node.js",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "objetos-arrays-destructuring",
        title: "Objetos, arrays, spread e destructuring",
        content: [
          "Objetos guardam dados como pares chave-valor ({ nome: 'Ana' }) e arrays guardam listas ordenadas ([1, 2, 3]). Ambos têm métodos poderosos: arrays têm map, filter, reduce e find para transformar e buscar dados sem escrever loops manuais.",
          "Destructuring permite extrair valores de objetos e arrays em variáveis separadas de forma direta. O operador spread (...) faz o caminho inverso: espalha os itens de um array/objeto dentro de outro, muito usado para copiar ou combinar dados sem alterar o original.",
        ],
        example: `const usuario = { nome: "Ana", idade: 28, cidade: "SP" };
const { nome, idade } = usuario; // destructuring

const numeros = [1, 2, 3, 4, 5];
const dobrados = numeros.map((n) => n * 2);
const pares = numeros.filter((n) => n % 2 === 0);

const usuarioAtualizado = { ...usuario, idade: 29 }; // spread: copia e sobrescreve

console.log(nome, idade, dobrados, pares, usuarioAtualizado);`,
        quiz: {
          question: "O que o operador spread (...) faz ao ser usado em { ...usuario, idade: 29 }?",
          options: [
            "Copia todas as propriedades de usuario para um novo objeto e sobrescreve idade",
            "Apaga o objeto usuario original",
            "Transforma o objeto em uma string",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "classes-poo",
        title: "Classes e orientação a objetos em JavaScript",
        content: [
          "Classes são um jeito organizado de criar objetos que compartilham a mesma estrutura e comportamento. Uma classe define um construtor (que roda ao criar uma instância com new) e métodos, que são funções acessíveis por todas as instâncias daquela classe.",
          "JavaScript também suporta herança (extends), permitindo que uma classe reaproveite e especialize o comportamento de outra. Isso é bastante usado em bibliotecas e frameworks Node.js, como em classes de erro personalizadas ou modelos de dados.",
        ],
        example: `class Usuario {
  constructor(nome, email) {
    this.nome = nome;
    this.email = email;
  }

  saudacao() {
    return \`Olá, \${this.nome}!\`;
  }
}

class UsuarioAdmin extends Usuario {
  constructor(nome, email) {
    super(nome, email);
    this.isAdmin = true;
  }
}

const admin = new UsuarioAdmin("Ana", "ana@exemplo.com");
console.log(admin.saudacao(), admin.isAdmin);`,
        quiz: {
          question: "Para que serve a palavra-chave extends em uma classe JavaScript?",
          options: [
            "Para uma classe herdar propriedades e métodos de outra classe",
            "Para deletar uma classe existente",
            "Para transformar a classe em uma função assíncrona",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 1 — Introdução ao Node.js
  // =====================================================================
  {
    id: "introducao",
    title: "Introdução ao Node.js",
    lessons: [
      {
        id: "o-que-e-node",
        title: "O que é o Node.js",
        content: [
          "Node.js é um ambiente de execução JavaScript fora do navegador, construído sobre o motor V8 do Chrome. Ele permite rodar JavaScript no servidor, em scripts de linha de comando e em ferramentas de automação.",
          "A principal característica do Node é o modelo assíncrono e não bloqueante: em vez de esperar uma operação terminar para seguir em frente, ele registra um retorno (callback, promise ou async/await) e continua executando outras tarefas enquanto aguarda.",
        ],
        example: `console.log("Início");

setTimeout(() => {
  console.log("Isso roda depois, sem travar o resto");
}, 1000);

console.log("Fim");
// Saída: Início, Fim, e só depois "Isso roda depois..."`,
        quiz: {
          question: "O que torna o Node.js diferente de rodar JavaScript apenas no navegador?",
          options: [
            "Ele executa JavaScript fora do navegador, com acesso a sistema de arquivos e rede",
            "Ele é uma linguagem de programação diferente do JavaScript",
            "Ele só funciona para páginas HTML estáticas",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "instalando-node",
        title: "Instalando e configurando o ambiente",
        content: [
          "O Node.js pode ser instalado diretamente do site oficial (nodejs.org) ou, de forma mais flexível, usando um gerenciador de versões como o nvm, que permite alternar entre versões do Node por projeto.",
          "Junto com o Node vem o npm (Node Package Manager), usado para instalar bibliotecas e gerenciar as dependências do projeto através do arquivo package.json.",
        ],
        example: `# Verificar a versão instalada
node -v
npm -v

# Iniciar um novo projeto
npm init -y

# Instalar uma dependência
npm install express`,
        quiz: {
          question: "Qual arquivo guarda a lista de dependências de um projeto Node?",
          options: ["package.json", "node.config", "index.html"],
          correctIndex: 0,
        },
      },
      {
        id: "npm-e-package-json",
        title: "npm, package.json e versionamento semântico",
        content: [
          "O package.json descreve o projeto: nome, versão, scripts (comandos como start e test) e dependências. Existem dois tipos de dependência: as normais (dependencies), necessárias em produção, e as de desenvolvimento (devDependencies), usadas só durante o desenvolvimento, como ferramentas de teste.",
          "As versões seguem o padrão semver (versionamento semântico): MAIOR.MENOR.PATCH. O símbolo ^ antes de uma versão (ex: ^4.19.2) permite atualizações de MENOR e PATCH automaticamente, mas nunca de MAIOR — mudanças de versão MAIOR podem quebrar compatibilidade.",
        ],
        example: `{
  "name": "meu-projeto",
  "version": "1.2.3",
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.19.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}`,
        quiz: {
          question: "Na versão 1.2.3 do padrão semver, o que representa cada número (MAIOR.MENOR.PATCH)?",
          options: [
            "Mudanças que quebram compatibilidade, novas funcionalidades e correções de bugs, respectivamente",
            "Ano, mês e dia do lançamento",
            "Os três números não têm nenhum significado, é só uma etiqueta",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "modulos-commonjs",
        title: "Módulos: require e module.exports",
        content: [
          "Node.js organiza código em módulos. Cada arquivo .js é um módulo independente, com seu próprio escopo. Para compartilhar código entre arquivos, usamos module.exports para expor algo e require() para importá-lo — esse é o sistema CommonJS, o modelo de módulos original do Node.",
          "O require() é executado de forma síncrona e o resultado de um módulo é armazenado em cache: se dois arquivos diferentes derem require no mesmo módulo, ambos recebem a mesma instância (o código do módulo só roda uma vez).",
        ],
        example: `// arquivo: matematica.js
function somar(a, b) {
  return a + b;
}
module.exports = { somar };

// arquivo: app.js
const { somar } = require("./matematica");
console.log(somar(2, 3)); // 5`,
        quiz: {
          question: "O que a função require() faz no Node.js?",
          options: [
            "Importa um módulo para ser usado no arquivo atual",
            "Cria um novo servidor HTTP",
            "Instala uma dependência do npm automaticamente",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "modulos-esm",
        title: "Módulos ES (import/export) no Node",
        content: [
          "Além do CommonJS, o Node também suporta o padrão de módulos ES (ECMAScript Modules), o mesmo usado no navegador, com as palavras-chave import e export. Para ativá-lo, basta adicionar \"type\": \"module\" no package.json, ou usar a extensão .mjs nos arquivos.",
          "Uma diferença importante: ao contrário do require (síncrono), o import é processado de forma estática e assíncrona, o que permite otimizações como tree-shaking (remover código não usado) em ferramentas de build. Hoje é comum encontrar projetos usando qualquer um dos dois padrões — o importante é não misturar os dois no mesmo arquivo.",
        ],
        example: `// arquivo: matematica.js  ("type": "module" no package.json)
export function somar(a, b) {
  return a + b;
}

// arquivo: app.js
import { somar } from "./matematica.js";
console.log(somar(2, 3)); // 5`,
        quiz: {
          question: "O que é preciso configurar no package.json para usar import/export nativamente no Node?",
          options: [
            '"type": "module"',
            '"type": "esm-ativo"',
            "Nada, o Node nunca suporta import/export",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "node-repl-cli",
        title: "Node REPL e scripts de linha de comando",
        content: [
          "Digitar node no terminal, sem indicar um arquivo, abre o REPL (Read-Eval-Print Loop): um ambiente interativo para testar trechos de JavaScript rapidamente, ótimo para experimentar uma ideia sem precisar criar um arquivo.",
          "O Node também é usado para criar ferramentas de linha de comando (CLIs). O objeto global process dá acesso aos argumentos passados na chamada (process.argv) e permite encerrar o programa com um código de saída (process.exit).",
        ],
        example: `// arquivo: cli.js
// Uso: node cli.js Ana 28
const [, , nome, idade] = process.argv;

if (!nome) {
  console.error("Uso: node cli.js <nome> <idade>");
  process.exit(1);
}

console.log(\`Olá, \${nome}! Você tem \${idade} anos.\`);`,
        quiz: {
          question: "O que acontece quando você digita apenas 'node' no terminal, sem indicar um arquivo?",
          options: [
            "Abre o REPL, um console interativo para rodar JavaScript linha a linha",
            "O terminal trava e precisa ser reiniciado",
            "Ele instala o Node.js novamente",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 2 — Assincronismo e Event Loop
  // =====================================================================
  {
    id: "assincronismo",
    title: "Assincronismo e Event Loop",
    lessons: [
      {
        id: "event-loop",
        title: "Entendendo o Event Loop",
        content: [
          "O Event Loop é o mecanismo que permite ao Node.js executar operações de I/O (arquivos, rede, banco de dados) sem bloquear a thread principal. Enquanto uma operação demorada acontece em segundo plano, o Node continua processando outras tarefas.",
          "Quando a operação termina, sua função de retorno (callback) é colocada na fila e executada assim que a pilha de chamadas atual estiver livre.",
        ],
        example: `console.log("1 - início");

setTimeout(() => console.log("3 - callback do timer"), 0);

Promise.resolve().then(() => console.log("2 - microtask"));

console.log("1.5 - síncrono continua rodando");`,
        quiz: {
          question: "Por que o Node.js consegue lidar com muitas conexões simultâneas usando uma única thread principal?",
          options: [
            "Porque operações de I/O são não bloqueantes e o Event Loop distribui o trabalho",
            "Porque cada requisição cria uma nova thread automaticamente",
            "Porque o Node ignora requisições até terminar a atual",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "callbacks-promises-async",
        title: "Callbacks, Promises e async/await",
        content: [
          "Callbacks foram a primeira forma de lidar com assincronismo no JavaScript, mas podem gerar código difícil de ler (o chamado \"callback hell\"). Promises trouxeram uma forma mais organizada de encadear operações assíncronas com .then() e .catch().",
          "async/await é a evolução mais legível: permite escrever código assíncrono com aparência de código síncrono, usando try/catch para tratar erros.",
        ],
        example: `async function buscarUsuario(id) {
  try {
    const resposta = await fetch(\`/api/users/\${id}\`);
    const usuario = await resposta.json();
    return usuario;
  } catch (erro) {
    console.error("Falha ao buscar usuário:", erro);
  }
}`,
        quiz: {
          question: "Qual a vantagem principal do async/await em relação a callbacks encadeados?",
          options: [
            "Deixa o código assíncrono mais legível, parecido com código síncrono",
            "Torna o código mais rápido de executar",
            "Elimina a necessidade de tratar erros",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "tratamento-erros-assincronos",
        title: "Tratamento de erros em código assíncrono",
        content: [
          "Um erro dentro de uma Promise que não é tratado com .catch() (ou try/catch, no caso de async/await) pode passar despercebido ou até derrubar o processo Node, dependendo da situação. É essencial sempre prever o caminho de falha, não só o de sucesso.",
          "Uma boa prática é criar funções assíncronas que tratam seus próprios erros e retornam algo previsível (como { sucesso, dado, erro }), em vez de deixar o erro se propagar sem controle por várias camadas da aplicação.",
        ],
        example: `async function buscarPedido(id) {
  try {
    const pedido = await buscarNoBanco(id);
    if (!pedido) {
      throw new Error("Pedido não encontrado");
    }
    return { sucesso: true, pedido };
  } catch (erro) {
    return { sucesso: false, erro: erro.message };
  }
}

// Promise.all falha inteira se QUALQUER promise falhar:
// use Promise.allSettled quando quiser o resultado de todas,
// mesmo que algumas falhem.`,
        quiz: {
          question: "O que acontece se um erro dentro de uma função async não for tratado com try/catch?",
          options: [
            "A Promise é rejeitada e o erro pode se propagar sem controle pela aplicação",
            "O Node.js corrige o erro automaticamente",
            "O código simplesmente ignora o erro e segue normalmente sempre",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "timers-microtasks",
        title: "Timers, process.nextTick e setImmediate",
        content: [
          "Além do setTimeout, o Node tem duas formas especiais de agendar código: process.nextTick(), que roda antes de qualquer outra fase do Event Loop (até antes das Promises), e setImmediate(), que roda depois da fase de I/O do loop atual.",
          "Promises (.then) são chamadas de \"microtasks\" e sempre são executadas antes de timers e setImmediate, mesmo que o timer tenha 0ms — por isso a ordem de execução costuma surpreender quem está começando com assincronismo.",
        ],
        example: `console.log("A - síncrono");

setTimeout(() => console.log("D - setTimeout"), 0);
setImmediate(() => console.log("E - setImmediate"));

Promise.resolve().then(() => console.log("C - microtask (Promise)"));

process.nextTick(() => console.log("B - nextTick"));

// Ordem provável: A, B, C, D, E`,
        quiz: {
          question: "Qual desses roda primeiro, considerando a ordem de prioridade do Node.js?",
          options: ["process.nextTick()", "setTimeout(fn, 0)", "setImmediate()"],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 3 — Módulos core do Node.js
  // =====================================================================
  {
    id: "modulos-core",
    title: "Módulos core do Node.js",
    lessons: [
      {
        id: "sistema-arquivos-fs",
        title: "Sistema de arquivos com o módulo fs",
        content: [
          "O módulo fs (file system) permite ler, escrever, criar e apagar arquivos e pastas. Ele tem três versões de API: síncrona (fs.readFileSync, trava o programa até terminar), baseada em callback (fs.readFile) e baseada em Promises (fs.promises ou node:fs/promises), que combina bem com async/await.",
          "Em um servidor que atende várias pessoas ao mesmo tempo, usar a versão síncrona é perigoso: ela bloqueia o Event Loop inteiro, travando todas as outras requisições enquanto o arquivo é lido. Por isso, em código de servidor, sempre prefira as versões assíncronas.",
        ],
        example: `const fs = require("node:fs/promises");

async function lerConfiguracao() {
  const conteudo = await fs.readFile("config.json", "utf-8");
  return JSON.parse(conteudo);
}

async function salvarLog(mensagem) {
  await fs.appendFile("app.log", mensagem + "\\n");
}`,
        quiz: {
          question: "Por que fs.readFileSync deve ser evitado dentro de um servidor que atende várias requisições?",
          options: [
            "Porque ele bloqueia o Event Loop, travando todas as outras requisições enquanto lê",
            "Porque ele não consegue ler arquivos grandes",
            "Porque ele não existe no Node.js, só no navegador",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "path-e-os",
        title: "Os módulos path e os",
        content: [
          "O módulo path ajuda a montar e resolver caminhos de arquivos de forma segura entre diferentes sistemas operacionais (Windows usa barra invertida, Linux/macOS usa barra normal). Funções como path.join() e path.resolve() evitam bugs de concatenar strings manualmente.",
          "Já o módulo os fornece informações sobre o sistema operacional onde o Node está rodando: quantidade de memória, número de núcleos do processador, tipo de sistema, entre outros — útil, por exemplo, para decidir quantos processos rodar em paralelo.",
        ],
        example: `const path = require("node:path");
const os = require("node:os");

const caminhoCompleto = path.join(__dirname, "data", "curso.sqlite");
console.log(caminhoCompleto);

console.log("Núcleos de CPU disponíveis:", os.cpus().length);
console.log("Sistema operacional:", os.platform());`,
        quiz: {
          question: "Qual a vantagem de usar path.join() em vez de concatenar strings manualmente para montar caminhos?",
          options: [
            "Ele monta o caminho corretamente em qualquer sistema operacional",
            "Ele é a única forma de ler arquivos no Node.js",
            "Ele criptografa o caminho do arquivo",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "streams-e-buffers",
        title: "Streams e Buffers",
        video: {
          titulo: "Streams e Buffers na prática",
          duracaoSugerida: "8-12 min",
          videoUrl: null,
          roteiro: [
            "Abrir explicando o problema que streams resolvem: por que carregar um arquivo de 2GB inteiro na memória com readFile é uma péssima ideia.",
            "Mostrar ao vivo, no terminal, a diferença de uso de memória entre ler um arquivo grande com readFile vs createReadStream (pode usar o Gerenciador de Tarefas/Monitor de Atividade na tela).",
            "Explicar o que é um Buffer: um pedaço de dados binários na memória, e por que ele existe (dados não são sempre texto).",
            "Codar ao vivo um exemplo simples: ler um arquivo de texto grande com createReadStream e escrever em outro arquivo com createWriteStream, usando .pipe().",
            "Mostrar os eventos de uma stream: 'data', 'end' e 'error', com um console.log em cada um para o aluno visualizar a ordem de execução.",
            "Fechar com um exemplo do mundo real: como o Express usa streams para servir arquivos estáticos e como um upload de vídeo é, na prática, uma stream chegando aos poucos.",
          ],
        },
        content: [
          "Streams são a forma do Node.js lidar com dados que chegam aos poucos (em pedaços, chamados chunks), em vez de esperar tudo estar disponível de uma vez. Isso é essencial para arquivos grandes, uploads, downloads e comunicação em rede — a memória usada fica pequena e constante, independente do tamanho total dos dados.",
          "Buffer é a estrutura de dados usada pelo Node para representar dados binários brutos (bytes), como o conteúdo de uma imagem ou um pedaço de um arquivo sendo lido. Streams de arquivo, por padrão, trabalham entregando Buffers, a não ser que você configure uma codificação de texto (como 'utf-8').",
        ],
        example: `const fs = require("node:fs");

const leitura = fs.createReadStream("arquivo-grande.txt");
const escrita = fs.createWriteStream("copia.txt");

leitura.on("data", (chunk) => {
  console.log(\`Recebido um pedaço de \${chunk.length} bytes\`);
});

leitura.on("end", () => console.log("Leitura concluída"));
leitura.on("error", (erro) => console.error("Erro na leitura:", erro));

// .pipe() conecta a saída de uma stream diretamente à entrada de outra
leitura.pipe(escrita);`,
        quiz: {
          question: "Qual é a principal vantagem de usar streams para processar um arquivo muito grande?",
          options: [
            "O arquivo é processado em pedaços, usando pouca memória o tempo todo",
            "O arquivo é lido mais rápido porque pula partes dele",
            "Streams só funcionam com arquivos pequenos",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "event-emitter",
        title: "Eventos com EventEmitter",
        content: [
          "Muitos objetos do Node.js (streams, servidores HTTP, etc.) são construídos sobre o padrão de eventos: um objeto emite eventos nomeados e outras partes do código escutam (on) esses eventos para reagir a eles. Isso desacopla quem gera o evento de quem reage a ele.",
          "Você também pode criar seus próprios emissores de eventos estendendo a classe EventEmitter, útil para organizar lógica de negócio orientada a eventos, como notificar várias partes do sistema quando algo importante acontece (ex: 'pedido-criado').",
        ],
        example: `const { EventEmitter } = require("node:events");

class Pedidos extends EventEmitter {
  criar(pedido) {
    // ...lógica de salvar o pedido...
    this.emit("pedido-criado", pedido);
  }
}

const pedidos = new Pedidos();

pedidos.on("pedido-criado", (pedido) => {
  console.log("Enviar e-mail de confirmação para:", pedido.email);
});

pedidos.on("pedido-criado", (pedido) => {
  console.log("Registrar no log de auditoria:", pedido.id);
});

pedidos.criar({ id: 1, email: "cliente@exemplo.com" });`,
        quiz: {
          question: "Qual a vantagem de usar EventEmitter para reagir a um acontecimento como 'pedido-criado'?",
          options: [
            "Várias partes do código podem reagir ao mesmo evento de forma desacoplada",
            "É a única forma de salvar dados no banco",
            "Ele substitui completamente o uso de funções no JavaScript",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "process-e-env",
        title: "O objeto process e variáveis de ambiente",
        content: [
          "process é um objeto global disponível em qualquer lugar do código Node, que representa o processo atual em execução. Por ele é possível ler argumentos de linha de comando (process.argv), variáveis de ambiente (process.env) e reagir a eventos do próprio processo, como 'uncaughtException'.",
          "Variáveis de ambiente são a forma recomendada de configurar uma aplicação sem alterar o código: porta do servidor, chaves secretas, URLs de banco de dados. Em desenvolvimento, costumam vir de um arquivo .env (carregado por bibliotecas como dotenv); em produção, são configuradas diretamente na plataforma de hospedagem.",
        ],
        example: `require("dotenv").config(); // carrega o .env para process.env

const porta = process.env.PORT || 3000;
const ambiente = process.env.NODE_ENV || "development";

console.log(\`Rodando em \${ambiente}, na porta \${porta}\`);

process.on("uncaughtException", (erro) => {
  console.error("Erro não tratado, encerrando processo:", erro);
  process.exit(1);
});`,
        quiz: {
          question: "Qual a vantagem de guardar configurações (como a porta do servidor) em variáveis de ambiente?",
          options: [
            "A aplicação pode ser configurada de forma diferente em cada ambiente, sem alterar o código",
            "Isso faz o servidor rodar mais rápido",
            "É a única forma de o Node.js funcionar",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 4 — Construindo APIs com Express
  // =====================================================================
  {
    id: "servidor-http",
    title: "Criando um servidor com Express",
    lessons: [
      {
        id: "http-basico",
        title: "Servidor HTTP nativo",
        content: [
          "O próprio Node.js já traz o módulo http, capaz de criar um servidor web sem nenhuma biblioteca externa. Na prática, para aplicações maiores, costuma-se usar um framework como o Express, que simplifica bastante o trabalho.",
        ],
        example: `const http = require("http");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Olá, mundo!");
});

server.listen(3000, () => console.log("Rodando na porta 3000"));`,
        quiz: {
          question: "É possível criar um servidor web em Node.js sem instalar nenhuma biblioteca externa?",
          options: ["Sim, usando o módulo nativo http", "Não, é obrigatório usar o Express", "Não, é preciso usar Python"],
          correctIndex: 0,
        },
      },
      {
        id: "express-rotas",
        title: "Rotas e middlewares no Express",
        content: [
          "O Express organiza um servidor em rotas (endpoints), associando um método HTTP e um caminho a uma função que trata a requisição. Middlewares são funções que rodam antes das rotas, úteis para autenticação, logs, validação, entre outros.",
        ],
        example: `const express = require("express");
const app = express();

app.use(express.json()); // middleware: interpreta corpo JSON

app.get("/api/status", (req, res) => {
  res.json({ status: "online" });
});

app.post("/api/mensagens", (req, res) => {
  const { texto } = req.body;
  res.status(201).json({ recebido: texto });
});

app.listen(3000);`,
        quiz: {
          question: "Para que serve um middleware no Express?",
          options: [
            "Executar lógica compartilhada (como autenticação) antes das rotas",
            "Substituir o banco de dados",
            "Compilar o código JavaScript",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "validacao-dados",
        title: "Validação de dados de entrada",
        content: [
          "Nunca confie nos dados que chegam do cliente: o front-end pode ter bugs, ou a requisição pode nem vir de um navegador (pode ser um script malicioso). Validar significa checar tipo, formato, tamanho e obrigatoriedade de cada campo antes de usá-lo — como já fazemos manualmente nas rotas de cadastro deste curso.",
          "Em projetos maiores, é comum usar bibliotecas de validação (como zod ou joi) para declarar as regras de um objeto de forma central, em vez de escrever vários 'if' espalhados. Isso deixa o código mais legível e reduz a chance de esquecer de validar algum campo.",
        ],
        example: `function validarProduto({ nome, preco }) {
  if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
    return "Informe um nome válido para o produto.";
  }
  if (typeof preco !== "number" || preco <= 0) {
    return "O preço precisa ser um número maior que zero.";
  }
  return null; // sem erros
}

app.post("/api/produtos", (req, res) => {
  const erro = validarProduto(req.body);
  if (erro) return res.status(400).json({ erro });
  // ...segue com a criação do produto...
});`,
        quiz: {
          question: "Por que validar os dados recebidos do cliente é importante, mesmo que o front-end já valide?",
          options: [
            "Porque a requisição pode não vir do front-end esperado, então o servidor precisa se proteger também",
            "Porque validar no back-end deixa o site mais bonito",
            "Não é importante, validar só no front-end já é suficiente",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "tratamento-erros-centralizado",
        title: "Tratamento de erros centralizado",
        video: {
          titulo: "Middleware de erro no Express",
          duracaoSugerida: "6-9 min",
          videoUrl: null,
          roteiro: [
            "Mostrar um exemplo de código SEM tratamento centralizado: cada rota com seu próprio try/catch repetitivo, para o aluno sentir a dor do problema.",
            "Explicar a assinatura especial do middleware de erro no Express: (err, req, res, next) — os quatro parâmetros são obrigatórios para o Express reconhecer que é um error handler.",
            "Codar ao vivo uma classe de erro personalizada (ex: ErroDeNegocio) com um campo statusCode.",
            "Mostrar como usar next(erro) dentro de uma rota async para jogar o erro para o middleware central, em vez de responder diretamente.",
            "Demonstrar o resultado final: uma resposta de erro padronizada em JSON, igual para toda a aplicação, com o código de status correto.",
            "Reforçar a boa prática de nunca vazar detalhes internos (stack trace, mensagens de banco de dados) para quem está usando a API em produção.",
          ],
        },
        content: [
          "Em vez de espalhar try/catch e respostas de erro repetidas por todas as rotas, o Express permite criar um middleware especial de tratamento de erros, reconhecido por ter 4 parâmetros: (err, req, res, next). Ele deve ser registrado por último, depois de todas as rotas.",
          "Uma boa prática é criar classes de erro personalizadas (ex: ErroDeValidacao, ErroNaoEncontrado) com um código de status HTTP associado, e um wrapper para rotas assíncronas que captura qualquer erro e chama next(erro) automaticamente, evitando repetição de código.",
        ],
        example: `class ErroDeNegocio extends Error {
  constructor(mensagem, statusCode = 400) {
    super(mensagem);
    this.statusCode = statusCode;
  }
}

// Envolve uma rota async para capturar erros automaticamente
const assincrona = (fn) => (req, res, next) => fn(req, res, next).catch(next);

app.get("/api/produtos/:id", assincrona(async (req, res) => {
  const produto = await buscarProduto(req.params.id);
  if (!produto) throw new ErroDeNegocio("Produto não encontrado", 404);
  res.json(produto);
}));

// Middleware de erro: sempre por último, com 4 parâmetros
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ erro: err.message || "Erro interno" });
});`,
        quiz: {
          question: "Como o Express reconhece que uma função é um middleware de tratamento de erros?",
          options: [
            "Pela função ter exatamente 4 parâmetros: (err, req, res, next)",
            "Pelo nome da função ser 'erro'",
            "Ele não reconhece, é preciso configurar em um arquivo separado",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "upload-arquivos",
        title: "Upload de arquivos (multipart/form-data)",
        content: [
          "Formulários com arquivos (como foto de perfil) enviam dados no formato multipart/form-data, diferente do JSON comum. O Express, sozinho, não interpreta esse formato — por isso se usa um middleware especializado, como o multer, que separa os campos de texto dos arquivos enviados.",
          "É fundamental validar arquivos recebidos: tipo (extensão/mimetype), tamanho máximo e, se possível, nunca confiar no nome original do arquivo enviado pelo cliente, para evitar problemas de segurança como sobrescrever arquivos do sistema.",
        ],
        example: `const multer = require("multer");
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    const permitido = ["image/png", "image/jpeg"].includes(file.mimetype);
    cb(permitido ? null : new Error("Formato não permitido"), permitido);
  },
});

app.post("/api/perfil/foto", upload.single("foto"), (req, res) => {
  res.json({ arquivo: req.file.filename, tamanho: req.file.size });
});`,
        quiz: {
          question: "Por que um servidor Express precisa de um middleware como o multer para receber upload de arquivos?",
          options: [
            "Porque uploads usam o formato multipart/form-data, diferente do JSON que o Express já entende nativamente",
            "Porque arquivos não podem ser enviados pela internet sem essa biblioteca",
            "Porque o multer substitui completamente o Express",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "estrutura-projeto",
        title: "Organizando o projeto em camadas",
        content: [
          "Conforme uma API cresce, colocar tudo dentro dos arquivos de rota vira um problema. Uma organização comum divide o código em camadas: rotas (definem os endpoints), controllers (recebem a requisição e chamam a lógica), services (regra de negócio) e repositórios/models (acesso ao banco de dados).",
          "Essa separação torna o código mais fácil de testar (cada camada pode ser testada isoladamente) e de entender: quem lê uma rota vê só 'o que' acontece, sem precisar entender 'como' cada passo é implementado.",
        ],
        example: `// src/routes/produtos.js
router.post("/", produtosController.criar);

// src/controllers/produtosController.js
async function criar(req, res, next) {
  try {
    const produto = await produtosService.criar(req.body);
    res.status(201).json(produto);
  } catch (erro) {
    next(erro);
  }
}

// src/services/produtosService.js
async function criar(dados) {
  validarProduto(dados);
  return produtosRepository.inserir(dados);
}`,
        quiz: {
          question: "Qual a principal vantagem de separar rotas, controllers, services e repositórios em camadas?",
          options: [
            "O código fica mais organizado, fácil de testar e de entender à medida que o projeto cresce",
            "O servidor fica mais rápido automaticamente",
            "É obrigatório pelo Express, senão o projeto não roda",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 5 — Autenticação e Segurança
  // =====================================================================
  {
    id: "autenticacao-seguranca",
    title: "Autenticação e Segurança",
    lessons: [
      {
        id: "autenticacao",
        title: "Autenticação: senhas e tokens",
        content: [
          "Senhas nunca devem ser guardadas em texto puro no banco de dados. Usa-se uma função de hash com \"salt\" (como bcrypt) para transformar a senha em algo irreversível, e comparar o hash no login.",
          "Depois do login, é comum gerar um token assinado (JWT) que identifica o usuário nas próximas requisições, geralmente guardado em um cookie httpOnly para reduzir riscos de roubo via JavaScript malicioso (XSS).",
        ],
        example: `const bcrypt = require("bcryptjs");

// No cadastro:
const hash = await bcrypt.hash(senhaDigitada, 10);

// No login:
const senhaCorreta = await bcrypt.compare(senhaDigitada, hash);`,
        quiz: {
          question: "Por que senhas são guardadas como hash e não em texto puro?",
          options: [
            "Para que, mesmo se o banco vazar, a senha original não seja exposta diretamente",
            "Para a senha ocupar menos espaço no banco",
            "Porque o navegador exige isso",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "sessoes-vs-jwt",
        title: "Sessões, JWT e OAuth: quando usar cada um",
        content: [
          "Sessões tradicionais guardam o estado do usuário no servidor (geralmente em memória, Redis ou banco), e o cliente só recebe um identificador. JWT, por outro lado, guarda os dados do usuário dentro do próprio token, assinado digitalmente — o servidor não precisa consultar nada para validar, só verificar a assinatura.",
          "OAuth é um protocolo diferente: permite que o usuário faça login usando uma conta de terceiros (Google, GitHub), sem a aplicação nunca ver a senha original. É comum combinar OAuth (para autenticação) com JWT ou sessão (para manter o usuário logado depois).",
        ],
        example: `// Sessão: o servidor guarda o estado
// req.session.usuarioId = usuario.id;

// JWT: o próprio token carrega os dados, assinados
const token = jwt.sign(
  { sub: usuario.id, email: usuario.email },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);
// O servidor só verifica a assinatura, não guarda estado`,
        quiz: {
          question: "Qual a principal diferença entre autenticação por sessão e por JWT?",
          options: [
            "Sessão guarda o estado no servidor; JWT carrega os dados assinados dentro do próprio token",
            "JWT só funciona em aplicações móveis",
            "Sessão é mais moderna e substituiu completamente o JWT",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "autorizacao-roles",
        title: "Autorização e controle de acesso por papéis (roles)",
        video: {
          titulo: "Construindo um middleware de administrador",
          duracaoSugerida: "7-10 min",
          videoUrl: null,
          roteiro: [
            "Explicar a diferença entre autenticação ('quem é você') e autorização ('o que você pode fazer'), com um exemplo do dia a dia (crachá de entrada vs permissão de sala).",
            "Mostrar a tabela users do projeto e o campo is_admin, explicando por que ele fica no banco e não é algo que o cliente pode enviar.",
            "Codar ao vivo o middleware exigirAdmin do projeto, explicando cada linha.",
            "Mostrar como aplicar esse middleware só nas rotas de administração, deixando claro que ele deve vir depois do middleware de autenticação.",
            "Testar ao vivo no navegador ou no Postman/Insomnia: acessar uma rota de admin logado como aluno comum (deve dar 403) e depois logado como admin (deve funcionar).",
            "Fechar com um alerta de segurança: nunca decidir permissões no front-end sozinho — o back-end sempre precisa validar de novo.",
          ],
        },
        content: [
          "Autenticação responde 'quem é você'; autorização responde 'o que você pode fazer'. Depois de identificar o usuário (autenticação), a aplicação ainda precisa checar se ele tem permissão para aquela ação específica — como acessar um painel de administração.",
          "Uma forma simples e comum de implementar isso é com papéis (roles): cada usuário tem um papel (ex: aluno, admin), guardado no banco de dados, e cada rota sensível usa um middleware que verifica se o papel do usuário logado é permitido antes de deixá-lo continuar.",
        ],
        example: `function exigirAdmin(req, res, next) {
  if (!req.usuario || !req.usuario.isAdmin) {
    return res.status(403).json({ erro: "Acesso restrito à administração." });
  }
  next();
}

// Uso: primeiro autentica, depois checa o papel
router.get("/admin/alunos", exigirAutenticacao, exigirAdmin, (req, res) => {
  res.json({ alunos: [] });
});`,
        quiz: {
          question: "Qual a diferença entre autenticação e autorização?",
          options: [
            "Autenticação identifica quem é o usuário; autorização decide o que ele pode fazer",
            "São a mesma coisa, apenas nomes diferentes",
            "Autorização acontece antes da autenticação sempre",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "seguranca-web",
        title: "Segurança: CORS, Helmet e ataques comuns",
        content: [
          "CORS (Cross-Origin Resource Sharing) é a política do navegador que bloqueia, por padrão, que um site faça requisições para outro domínio diferente do seu. Um servidor Express precisa declarar explicitamente quais origens confia, usando o middleware cors.",
          "Alguns ataques comuns que todo desenvolvedor back-end deve conhecer: XSS (injetar scripts maliciosos que rodam no navegador de outros usuários), CSRF (fazer o navegador da vítima executar uma ação sem ela perceber) e SQL Injection (manipular consultas ao banco através de dados de entrada). Bibliotecas como helmet configuram cabeçalhos HTTP de segurança automaticamente para reduzir esses riscos.",
        ],
        example: `const cors = require("cors");
const helmet = require("helmet");

app.use(helmet()); // cabeçalhos de segurança sensatos por padrão

app.use(
  cors({
    origin: "https://meusite.com", // só esse domínio pode chamar a API
    credentials: true,
  })
);`,
        quiz: {
          question: "Para que serve a política de CORS em um navegador?",
          options: [
            "Bloquear, por padrão, requisições de um site para um domínio diferente do seu",
            "Deixar o site mais rápido",
            "Substituir a necessidade de autenticação",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 6 — Node.js e Banco de Dados
  // =====================================================================
  {
    id: "banco-de-dados",
    title: "Node.js e Banco de Dados",
    lessons: [
      {
        id: "bancos-relacionais",
        title: "Bancos relacionais (SQL)",
        content: [
          "Bancos relacionais como PostgreSQL, MySQL e SQLite organizam dados em tabelas com colunas bem definidas e relações entre elas (chaves estrangeiras). São indicados quando os dados têm estrutura clara e consistente.",
          "Em Node.js, bibliotecas como better-sqlite3, pg (PostgreSQL) ou ORMs como Prisma e Sequelize facilitam a comunicação com o banco.",
        ],
        example: `const db = require("better-sqlite3")("dados.sqlite");

db.exec(\`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE
)\`);

const inserir = db.prepare("INSERT INTO users (email) VALUES (?)");
inserir.run("teste@exemplo.com");`,
        quiz: {
          question: "Quando um banco de dados relacional (SQL) costuma ser a escolha mais indicada?",
          options: [
            "Quando os dados têm estrutura bem definida e relações entre entidades",
            "Somente para armazenar imagens",
            "Apenas em aplicações sem usuários",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "consultas-seguras",
        title: "Consultas seguras (evitando SQL Injection)",
        content: [
          "Nunca se deve concatenar valores de entrada do usuário diretamente em uma consulta SQL — isso abre brecha para o ataque conhecido como SQL Injection. A prática correta é usar consultas parametrizadas (prepared statements), onde os valores são passados separadamente da estrutura da consulta.",
        ],
        example: `// ERRADO - vulnerável a SQL Injection
db.exec(\`SELECT * FROM users WHERE email = '\${emailDigitado}'\`);

// CORRETO - consulta parametrizada
const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
const usuario = stmt.get(emailDigitado);`,
        quiz: {
          question: "Qual é a forma segura de usar dados vindos do usuário em uma consulta SQL?",
          options: [
            "Usando consultas parametrizadas (prepared statements)",
            "Concatenando o valor diretamente na string SQL",
            "Removendo o banco de dados e usando apenas arquivos de texto",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "orms",
        title: "ORMs: Prisma e Sequelize",
        video: {
          titulo: "Modelando dados com Prisma",
          duracaoSugerida: "10-14 min",
          videoUrl: null,
          roteiro: [
            "Explicar o que é um ORM (Object-Relational Mapping): escrever/consultar dados usando objetos e funções JavaScript em vez de SQL puro.",
            "Mostrar o arquivo schema.prisma ao vivo: como se define um model (ex: User) com seus campos e tipos.",
            "Rodar 'npx prisma migrate dev' na tela, explicando o que uma migration faz e por que ela fica versionada no projeto.",
            "Codar uma consulta simples com o Prisma Client (ex: prisma.user.findMany) e comparar lado a lado com a versão em SQL puro equivalente.",
            "Comentar rapidamente sobre o Sequelize como alternativa mais antiga e madura, sem precisar detalhar toda a API dele.",
            "Fechar com uma reflexão honesta: quando vale a pena usar um ORM e quando SQL puro ainda é a melhor escolha (consultas muito complexas, relatórios pesados).",
          ],
        },
        content: [
          "Um ORM (Object-Relational Mapping) permite trabalhar com o banco de dados através de objetos e métodos JavaScript, em vez de escrever SQL manualmente. Ele também cuida da conexão, do escape de valores (proteção contra SQL Injection) e, em muitos casos, das migrations.",
          "O Prisma é um dos ORMs mais populares no ecossistema Node atual: você descreve as tabelas em um arquivo schema.prisma e ele gera automaticamente um cliente TypeScript/JavaScript totalmente tipado para consultar o banco. O Sequelize é uma alternativa mais antiga e madura, com uma API baseada em classes de modelo.",
        ],
        example: `// schema.prisma
// model Usuario {
//   id    Int    @id @default(autoincrement())
//   email String @unique
//   nome  String
// }

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function criarUsuario(nome, email) {
  return prisma.usuario.create({ data: { nome, email } });
}

async function listarUsuarios() {
  return prisma.usuario.findMany({ orderBy: { id: "desc" } });
}`,
        quiz: {
          question: "Qual a principal vantagem de usar um ORM como o Prisma?",
          options: [
            "Permite consultar e manipular o banco usando objetos e métodos JavaScript, em vez de SQL manual",
            "Ele torna o banco de dados desnecessário",
            "Ele só funciona com bancos NoSQL",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "bancos-nosql",
        title: "Bancos NoSQL: MongoDB e Mongoose",
        content: [
          "Bancos NoSQL, como o MongoDB, guardam dados em documentos flexíveis (parecidos com objetos JSON) em vez de tabelas fixas. São indicados quando a estrutura dos dados varia bastante entre registros, ou quando o projeto precisa de flexibilidade para evoluir rapidamente sem migrations rígidas.",
          "O Mongoose é a biblioteca mais usada para conectar Node.js ao MongoDB. Ele permite definir 'schemas' (mesmo em um banco sem esquema fixo) para validar a estrutura dos documentos antes de salvar, trazendo parte da segurança de um banco relacional para o mundo NoSQL.",
        ],
        example: `const mongoose = require("mongoose");

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  criadoEm: { type: Date, default: Date.now },
});

const Usuario = mongoose.model("Usuario", usuarioSchema);

async function criarUsuario(nome, email) {
  return Usuario.create({ nome, email });
}`,
        quiz: {
          question: "Em que situação um banco NoSQL como o MongoDB costuma ser uma boa escolha?",
          options: [
            "Quando a estrutura dos dados varia bastante ou precisa evoluir com flexibilidade",
            "Somente quando o projeto não terá nenhum usuário",
            "NoSQL substitui completamente a necessidade de qualquer validação de dados",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "migrations-modelagem",
        title: "Migrations e modelagem de dados",
        content: [
          "Migrations são arquivos versionados que descrevem mudanças na estrutura do banco de dados (criar uma tabela, adicionar uma coluna, etc.), aplicadas em ordem. Elas permitem que toda a equipe — e o ambiente de produção — tenham exatamente a mesma estrutura de banco, de forma rastreável e reversível.",
          "Modelar bem os dados envolve pensar nas entidades principais (ex: usuário, pedido, produto), seus relacionamentos (um usuário tem vários pedidos) e as regras de integridade (um pedido não pode existir sem um usuário válido) — geralmente garantidas com chaves estrangeiras.",
        ],
        example: `-- migration: 001_criar_tabela_pedidos.sql
CREATE TABLE pedidos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  total      REAL NOT NULL,
  criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- migration: 002_adicionar_status_pedido.sql
ALTER TABLE pedidos ADD COLUMN status TEXT NOT NULL DEFAULT 'pendente';`,
        quiz: {
          question: "Qual o principal benefício de usar migrations para alterar a estrutura do banco de dados?",
          options: [
            "Toda a equipe e os ambientes de produção mantêm a mesma estrutura, de forma rastreável",
            "As migrations tornam o banco de dados mais rápido automaticamente",
            "Elas eliminam a necessidade de backups do banco",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 7 — Testes Automatizados
  // =====================================================================
  {
    id: "testes",
    title: "Testes Automatizados",
    lessons: [
      {
        id: "por-que-testar",
        title: "Por que e o que testar",
        content: [
          "Testes automatizados são código que verifica se outro código se comporta como esperado, sem precisar de um humano clicando manualmente na aplicação a cada mudança. Eles dão confiança para alterar e refatorar o sistema sabendo rapidamente se algo quebrou.",
          "Nem tudo precisa (ou vale a pena) ser testado da mesma forma: regras de negócio críticas merecem testes detalhados; código simples e de baixo risco pode ter cobertura mais leve. O objetivo não é 100% de cobertura, e sim confiança nas partes que realmente importam.",
        ],
        example: `// Pseudocódigo do "porquê": sem testes, cada mudança exige
// testar manualmente tudo de novo. Com testes:

// 1. Você muda uma função
// 2. Roda "npm test"
// 3. Em segundos, sabe se quebrou algo em qualquer parte do sistema
//    que dependia daquela função — mesmo partes que você esqueceu
//    que existiam.`,
        quiz: {
          question: "Qual é o principal objetivo de ter testes automatizados em um projeto?",
          options: [
            "Ter confiança rápida de que uma mudança não quebrou o comportamento esperado do sistema",
            "Fazer o código rodar mais rápido em produção",
            "Substituir completamente a necessidade de revisão de código",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "testes-unitarios",
        title: "Testes unitários com node:test",
        video: {
          titulo: "Escrevendo seu primeiro teste unitário",
          duracaoSugerida: "7-10 min",
          videoUrl: null,
          roteiro: [
            "Escolher uma função pura simples do projeto (ex: uma função de validação) para testar ao vivo.",
            "Mostrar a estrutura básica de um teste com node:test: describe, it/test e assert.",
            "Escrever, na tela, um teste que verifica o caminho de sucesso (dado válido) e outro que verifica o caminho de erro (dado inválido).",
            "Rodar 'node --test' no terminal e mostrar a saída, tanto passando quanto propositalmente falhando um teste para o aluno reconhecer a diferença visual.",
            "Explicar o padrão AAA (Arrange, Act, Assert) como forma de organizar qualquer teste, não só nesse exemplo.",
            "Fechar reforçando que um bom teste unitário testa uma unidade isolada, sem depender de banco de dados ou rede.",
          ],
        },
        content: [
          "Testes unitários verificam uma única 'unidade' de código isoladamente — geralmente uma função — sem depender de banco de dados, rede ou sistema de arquivos reais. O Node.js já vem com um executor de testes nativo, o módulo node:test, sem precisar instalar nada extra (embora bibliotecas como Jest também sejam muito populares).",
          "Um bom teste segue o padrão AAA: Arrange (prepara os dados de entrada), Act (executa a função sendo testada) e Assert (verifica se o resultado é o esperado, usando o módulo assert).",
        ],
        example: `// arquivo: matematica.test.js
const { test } = require("node:test");
const assert = require("node:assert");
const { somar } = require("./matematica");

test("somar deve retornar a soma de dois números", () => {
  // Arrange
  const a = 2, b = 3;
  // Act
  const resultado = somar(a, b);
  // Assert
  assert.strictEqual(resultado, 5);
});

// Rodar no terminal: node --test`,
        quiz: {
          question: "O que caracteriza um teste unitário?",
          options: [
            "Ele testa uma unidade de código isolada, sem depender de banco de dados ou rede reais",
            "Ele só pode ser escrito usando o Jest",
            "Ele precisa sempre rodar contra o banco de dados de produção",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "testes-integracao-api",
        title: "Testes de integração de API com Supertest",
        content: [
          "Testes de integração verificam se várias partes do sistema funcionam corretamente juntas — por exemplo, se uma requisição HTTP real chega até a rota certa, passa pelos middlewares, consulta o banco e devolve a resposta esperada. A biblioteca supertest facilita simular requisições HTTP contra uma aplicação Express nos testes.",
          "É comum usar um banco de dados separado (ou em memória) só para os testes, garantindo que rodar a suíte de testes não afete os dados reais da aplicação, e que cada teste comece de um estado conhecido e previsível.",
        ],
        example: `const request = require("supertest");
const app = require("../app"); // instância do Express, sem dar app.listen

test("POST /api/auth/login com senha errada retorna 401", async () => {
  const resposta = await request(app)
    .post("/api/auth/login")
    .send({ email: "teste@exemplo.com", password: "errada" });

  expect(resposta.status).toBe(401);
  expect(resposta.body.erro).toBeDefined();
});`,
        quiz: {
          question: "Qual a diferença principal entre um teste unitário e um teste de integração de API?",
          options: [
            "O teste de integração verifica várias partes do sistema funcionando juntas, como uma requisição HTTP real",
            "Não existe diferença, são o mesmo tipo de teste",
            "Testes de integração nunca podem usar bibliotecas externas",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "mocks-test-doubles",
        title: "Mocks, stubs e test doubles",
        content: [
          "Ao testar uma função que depende de algo externo (uma API de terceiros, um envio de e-mail, o relógio do sistema), não é prático nem confiável depender do serviço real durante os testes. 'Test doubles' são substitutos controlados: um mock simula o comportamento e verifica se foi chamado corretamente; um stub apenas retorna um valor fixo, sem verificar chamadas.",
          "Usar test doubles com moderação é importante: testes com mocks demais acabam testando a implementação em vez do comportamento, e podem passar mesmo quando o sistema real está quebrado. A regra geral é: faça mock apenas do que é externo ou lento (rede, tempo, serviços de terceiros).",
        ],
        example: `// Exemplo conceitual: substituindo o envio real de e-mail por um mock
const enviarEmailMock = jest.fn().mockResolvedValue({ enviado: true });

async function notificarCadastro(usuario, enviarEmail = enviarEmailMock) {
  await enviarEmail(usuario.email, "Bem-vindo!");
}

test("notificarCadastro chama o envio de e-mail com os dados corretos", async () => {
  const usuario = { email: "novo@exemplo.com" };
  await notificarCadastro(usuario);
  expect(enviarEmailMock).toHaveBeenCalledWith("novo@exemplo.com", "Bem-vindo!");
});`,
        quiz: {
          question: "Quando faz sentido usar um mock em um teste?",
          options: [
            "Quando a função depende de algo externo ou lento, como uma API de terceiros ou envio de e-mail",
            "Sempre, em qualquer teste, mesmo funções puras simples",
            "Mocks substituem completamente a necessidade de testes de integração",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 8 — Tempo real e integrações
  // =====================================================================
  {
    id: "tempo-real",
    title: "Tempo Real e Integrações",
    lessons: [
      {
        id: "rest-vs-graphql",
        title: "REST vs GraphQL: visão geral",
        content: [
          "REST é o estilo de API mais comum: cada recurso tem uma URL própria (/api/usuarios/1) e o cliente recebe exatamente os campos que aquele endpoint retorna, nem mais nem menos. GraphQL é uma alternativa onde existe um único endpoint e o próprio cliente descreve, em cada requisição, exatamente quais campos quer receber.",
          "Não existe um 'melhor' entre os dois: REST costuma ser mais simples de implementar, testar e colocar em cache; GraphQL brilha quando telas diferentes precisam de combinações muito diferentes de dados, evitando tanto sub quanto sobre-carregamento de informação (under-fetching e over-fetching).",
        ],
        example: `// REST: cada recurso tem sua rota, resposta fixa
// GET /api/usuarios/1
// { "id": 1, "nome": "Ana", "email": "ana@exemplo.com" }

// GraphQL: um único endpoint, cliente escolhe os campos
// POST /graphql
// query {
//   usuario(id: 1) {
//     nome
//   }
// }
// Resposta: { "data": { "usuario": { "nome": "Ana" } } }`,
        quiz: {
          question: "Qual a principal diferença entre REST e GraphQL?",
          options: [
            "Em GraphQL o cliente escolhe exatamente quais campos quer receber; em REST a resposta de cada endpoint é fixa",
            "GraphQL não usa HTTP e REST sim",
            "REST só funciona com bancos NoSQL",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "websockets-socketio",
        title: "WebSockets e Socket.IO",
        video: {
          titulo: "Chat em tempo real com Socket.IO",
          duracaoSugerida: "10-15 min",
          videoUrl: null,
          roteiro: [
            "Explicar a diferença entre o modelo pergunta-resposta do HTTP e a conexão contínua de um WebSocket, com um desenho simples na tela.",
            "Mostrar a instalação do socket.io no servidor e do socket.io-client no front-end.",
            "Codar ao vivo um servidor mínimo que escuta a conexão de um cliente (io.on('connection')).",
            "Implementar um evento customizado simples, tipo 'mensagem-enviada', e mostrar o servidor reemitindo para todos os clientes conectados (io.emit).",
            "Testar ao vivo abrindo duas abas do navegador lado a lado e mostrando a mensagem chegando em tempo real nas duas.",
            "Fechar com um comentário sobre escalabilidade: o que muda quando existe mais de um servidor rodando ao mesmo tempo (adaptador Redis), sem precisar implementar isso no vídeo.",
          ],
        },
        content: [
          "HTTP tradicional segue o modelo pergunta-resposta: o cliente pede, o servidor responde, a conexão fecha. WebSockets mantêm uma conexão aberta e bidirecional entre cliente e servidor, permitindo que qualquer um dos dois envie dados a qualquer momento — essencial para chats, notificações em tempo real e dashboards ao vivo.",
          "O Socket.IO é a biblioteca mais usada para WebSockets em Node.js. Ele simplifica bastante o trabalho, oferecendo reconexão automática, e um sistema de 'salas' e eventos nomeados customizados, além de funcionar mesmo em ambientes onde WebSocket puro não está disponível (usando outras técnicas como fallback).",
        ],
        example: `// server.js
const { Server } = require("socket.io");
const io = new Server(httpServer);

io.on("connection", (socket) => {
  console.log("Cliente conectado:", socket.id);

  socket.on("mensagem-enviada", (texto) => {
    io.emit("nova-mensagem", { texto, quando: new Date() });
  });
});

// no navegador (cliente)
// const socket = io();
// socket.emit("mensagem-enviada", "Olá pessoal!");
// socket.on("nova-mensagem", (msg) => console.log(msg));`,
        quiz: {
          question: "Qual a principal diferença entre uma requisição HTTP comum e uma conexão WebSocket?",
          options: [
            "WebSocket mantém uma conexão aberta e bidirecional; HTTP tradicional fecha a conexão após cada resposta",
            "WebSocket só funciona para enviar imagens",
            "HTTP e WebSocket são exatamente a mesma tecnologia",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "filas-mensageria",
        title: "Filas e processamento assíncrono (mensageria)",
        content: [
          "Nem toda tarefa precisa ser feita imediatamente dentro da requisição HTTP. Tarefas demoradas (enviar um e-mail, processar uma imagem, gerar um relatório) podem ser colocadas em uma fila e processadas em segundo plano por um 'worker' separado, deixando a resposta ao usuário rápida.",
          "Sistemas de mensageria como RabbitMQ, ou soluções mais simples baseadas em Redis (como BullMQ), permitem essa comunicação assíncrona entre partes da aplicação: um serviço publica uma mensagem na fila, e outro (ou vários, em paralelo) a consome quando estiver livre.",
        ],
        example: `// Conceito simplificado com uma fila (ex: BullMQ)
const fila = new Queue("envio-de-email");

// Na rota da API: só adiciona na fila e responde rápido
app.post("/api/pedidos", async (req, res) => {
  const pedido = await criarPedido(req.body);
  await fila.add("confirmar-pedido", { pedidoId: pedido.id });
  res.status(201).json(pedido);
});

// Em um processo separado (worker), processa a fila
new Worker("envio-de-email", async (job) => {
  await enviarEmailDeConfirmacao(job.data.pedidoId);
});`,
        quiz: {
          question: "Qual a vantagem de colocar uma tarefa demorada (como enviar um e-mail) em uma fila, em vez de executá-la direto na requisição?",
          options: [
            "A resposta ao usuário fica rápida, e a tarefa é processada em segundo plano",
            "A tarefa é executada duas vezes mais rápido automaticamente",
            "Filas eliminam a necessidade de tratar erros",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 9 — Publicando em Produção
  // =====================================================================
  {
    id: "producao",
    title: "Publicando em Produção",
    lessons: [
      {
        id: "variaveis-ambiente",
        title: "Variáveis de ambiente e segredos",
        content: [
          "Informações sensíveis (senhas de banco, chaves de API, segredos de token) nunca devem ficar escritas diretamente no código-fonte. Elas devem vir de variáveis de ambiente, geralmente carregadas de um arquivo .env em desenvolvimento — arquivo que nunca deve ser enviado ao repositório (Git).",
        ],
        example: `// .env (nunca commitado)
JWT_SECRET=um-valor-longo-e-aleatorio

// server.js
require("dotenv").config();
const segredo = process.env.JWT_SECRET;`,
        quiz: {
          question: "Onde uma chave secreta de produção deve ficar armazenada?",
          options: [
            "Em uma variável de ambiente, fora do código-fonte versionado",
            "Escrita diretamente no arquivo server.js",
            "Em um comentário no código, para lembrar depois",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "deploy",
        title: "Colocando a aplicação no ar",
        content: [
          "Para publicar uma aplicação Node.js, é preciso um servidor que mantenha o processo rodando continuamente. Plataformas como Render, Railway ou Fly.io automatizam esse processo: você conecta o repositório e elas cuidam de instalar dependências e iniciar o servidor.",
          "É importante configurar as variáveis de ambiente de produção na própria plataforma de hospedagem (nunca no código) e garantir que o processo reinicie automaticamente em caso de falha.",
        ],
        example: `# Exemplo de comando de start em produção
npm install
npm start

# A plataforma de hospedagem define a porta via variável de ambiente
const porta = process.env.PORT || 3000;`,
        quiz: {
          question: "Por que plataformas como Render ou Railway são úteis para publicar um app Node.js?",
          options: [
            "Elas automatizam a instalação de dependências e a execução contínua do servidor",
            "Elas eliminam a necessidade de escrever backend",
            "Elas só funcionam com aplicações sem banco de dados",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "logging-monitoramento",
        title: "Logging e monitoramento",
        content: [
          "console.log resolve durante o desenvolvimento, mas em produção não é suficiente: é preciso registrar logs estruturados (com nível de severidade, data e contexto) e conseguir buscá-los depois, geralmente enviados para uma ferramenta externa. Bibliotecas como pino ou winston ajudam a gerar logs consistentes.",
          "Monitoramento vai além dos logs: envolve acompanhar métricas (tempo de resposta, uso de memória, taxa de erros) e configurar alertas para ser avisado automaticamente quando algo sair do esperado, antes mesmo que um usuário reclame.",
        ],
        example: `const pino = require("pino")();

app.use((req, res, next) => {
  pino.info({ metodo: req.method, caminho: req.path }, "requisição recebida");
  next();
});

app.use((err, req, res, next) => {
  pino.error({ erro: err.message, caminho: req.path }, "erro na requisição");
  res.status(500).json({ erro: "Erro interno" });
});`,
        quiz: {
          question: "Por que apenas usar console.log costuma não ser suficiente em produção?",
          options: [
            "Faltam nível de severidade, estrutura e a capacidade de buscar/alertar sobre esses logs depois",
            "console.log não funciona no Node.js em produção",
            "console.log é mais lento que qualquer outra forma de logging",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "docker-containers",
        title: "Docker e containers",
        video: {
          titulo: "Criando um Dockerfile para o projeto",
          duracaoSugerida: "9-13 min",
          videoUrl: null,
          roteiro: [
            "Explicar o problema que o Docker resolve com uma frase simples: 'funciona na minha máquina' deixa de ser um problema porque o container carrega o ambiente inteiro junto.",
            "Mostrar, linha por linha, um Dockerfile básico para uma aplicação Node.js (FROM, WORKDIR, COPY, RUN npm install, CMD).",
            "Rodar 'docker build' e 'docker run' ao vivo no terminal, mostrando a aplicação respondendo dentro do container.",
            "Explicar a diferença entre a imagem (o molde) e o container (a instância rodando).",
            "Mostrar rapidamente um docker-compose.yml simples, combinando o serviço Node com um banco de dados, para o aluno entender o caso de uso mais comum.",
            "Fechar com uma dica prática: usar um .dockerignore para não copiar node_modules e arquivos desnecessários para dentro da imagem.",
          ],
        },
        content: [
          "Docker permite empacotar uma aplicação junto com tudo que ela precisa para rodar (versão do Node, dependências, configurações do sistema) em uma unidade isolada chamada container. Isso resolve o clássico problema de 'funciona na minha máquina, mas não no servidor'.",
          "Um Dockerfile descreve o passo a passo para montar a imagem da aplicação. Já o docker-compose é usado para descrever e orquestrar vários containers juntos (por exemplo, a API e o banco de dados), facilitando rodar o ambiente completo com um único comando.",
        ],
        example: `# Dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]

# Construir e rodar:
# docker build -t curso-node .
# docker run -p 3000:3000 --env-file .env curso-node`,
        quiz: {
          question: "Qual problema o Docker ajuda a resolver?",
          options: [
            "Garantir que a aplicação rode da mesma forma em qualquer máquina, empacotando tudo que ela precisa",
            "Docker substitui completamente a necessidade de um banco de dados",
            "Docker só serve para aplicações escritas em Python",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "ci-cd",
        title: "Integração e entrega contínua (CI/CD)",
        content: [
          "CI (Integração Contínua) significa rodar automaticamente testes e verificações toda vez que um código é enviado ao repositório, pegando problemas cedo, antes de chegarem à produção. CD (Entrega/Implantação Contínua) automatiza o passo seguinte: publicar a nova versão automaticamente depois que ela passa em todas as checagens.",
          "Ferramentas como GitHub Actions permitem descrever esse pipeline em um arquivo de configuração versionado junto com o projeto: instalar dependências, rodar testes e lint, e só então fazer o deploy — tudo sem intervenção manual.",
        ],
        example: `# .github/workflows/ci.yml
name: CI
on: [push]

jobs:
  testar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install
      - run: npm test`,
        quiz: {
          question: "O que a Integração Contínua (CI) faz automaticamente a cada código enviado ao repositório?",
          options: [
            "Roda testes e verificações automaticamente, encontrando problemas cedo",
            "Apaga o código anterior automaticamente",
            "Substitui a necessidade de qualquer revisão de código",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "performance-cluster",
        title: "Performance, cluster e escalabilidade",
        content: [
          "O Node.js roda em uma única thread principal por padrão, então uma única instância não aproveita todos os núcleos de um processador moderno sozinha. O módulo cluster permite iniciar vários processos Node (um por núcleo de CPU), todos escutando a mesma porta, distribuindo a carga entre eles.",
          "Escalar horizontalmente (rodar várias instâncias da aplicação, em vez de uma só maior) costuma ser mais eficaz do que só aumentar os recursos de uma única máquina. Nesse cenário, é importante que a aplicação seja 'stateless': não guardar dados importantes só na memória de um processo específico, para que qualquer instância possa atender qualquer requisição.",
        ],
        example: `const cluster = require("node:cluster");
const os = require("node:os");

if (cluster.isPrimary) {
  const nucleos = os.cpus().length;
  for (let i = 0; i < nucleos; i++) {
    cluster.fork(); // cria um processo worker por núcleo
  }
} else {
  // cada worker roda sua própria instância do servidor Express
  require("./server");
}`,
        quiz: {
          question: "Por que o módulo cluster é útil em uma aplicação Node.js de produção?",
          options: [
            "Permite aproveitar todos os núcleos de CPU rodando vários processos Node em paralelo",
            "Ele torna o código automaticamente livre de bugs",
            "Ele substitui a necessidade de um banco de dados",
          ],
          correctIndex: 0,
        },
      },
    ],
  },

  // =====================================================================
  // MÓDULO 10 — Projeto Final
  // =====================================================================
  {
    id: "projeto-final",
    title: "Projeto Final",
    lessons: [
      {
        id: "planejamento-projeto-final",
        title: "Planejando o projeto final",
        content: [
          "Antes de escrever a primeira linha de código, vale desenhar o projeto: quais entidades existem (usuário, produto, pedido...), como elas se relacionam, quais são as rotas da API e quais regras de negócio cada uma precisa respeitar. Esse planejamento evita retrabalho no meio do caminho.",
          "Uma boa prática é começar pequeno: definir um 'MVP' (produto mínimo viável) com as funcionalidades essenciais funcionando de ponta a ponta, e só depois ir adicionando recursos extras — em vez de tentar construir tudo de uma vez.",
        ],
        example: `// Exemplo de planejamento em texto simples, antes de codar:
//
// Entidades: Usuario, Produto, Pedido, ItemDoPedido
// Relações: um Pedido pertence a um Usuario e tem vários ItemDoPedido
//
// Rotas do MVP:
// POST   /api/auth/register
// POST   /api/auth/login
// GET    /api/produtos
// POST   /api/pedidos          (usuário autenticado)
// GET    /api/pedidos/:id      (só o dono do pedido ou um admin)`,
        quiz: {
          question: "Por que definir um MVP (produto mínimo viável) antes de codar o projeto inteiro é uma boa prática?",
          options: [
            "Permite ter algo funcionando de ponta a ponta antes de adicionar recursos extras, evitando retrabalho",
            "MVP significa que o projeto não precisa de testes",
            "Um MVP elimina a necessidade de planejamento",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "construindo-api-do-zero",
        title: "Construindo a API do zero",
        video: {
          titulo: "Do zero ao primeiro endpoint funcionando",
          duracaoSugerida: "15-20 min",
          videoUrl: null,
          roteiro: [
            "Começar com uma pasta totalmente vazia e rodar 'npm init -y' ao vivo, narrando cada decisão.",
            "Instalar o Express e criar o primeiro servidor 'Hello World', confirmando que está no ar com uma requisição no navegador.",
            "Aplicar a estrutura em camadas ensinada no módulo de Express: pastas routes, controllers, services.",
            "Construir, do início ao fim, um único endpoint completo do MVP planejado na aula anterior (ex: POST /api/produtos), incluindo validação básica.",
            "Testar esse endpoint ao vivo com uma ferramenta como Insomnia, Postman ou até curl no terminal.",
            "Fechar convidando o aluno a continuar sozinho a partir dali, implementando os próximos endpoints do seu próprio MVP como exercício.",
          ],
        },
        content: [
          "Com o planejamento em mãos, a construção segue os mesmos passos vistos ao longo do curso: configurar o projeto e as variáveis de ambiente, criar o servidor Express, estruturar em camadas, conectar ao banco de dados, implementar autenticação e, então, construir as rotas específicas do domínio do projeto.",
          "Vale a pena versionar o código desde o primeiro commit (usando Git), com mensagens de commit claras — isso não só documenta a evolução do projeto, como facilita muito identificar em qual ponto um bug foi introduzido.",
        ],
        example: `# Passo a passo resumido de um novo projeto
npm init -y
npm install express dotenv cookie-parser bcryptjs jsonwebtoken
git init
echo "node_modules/\\n.env" > .gitignore
git add .
git commit -m "Estrutura inicial do projeto"

# Em seguida: server.js, rotas, camadas, banco de dados...`,
        quiz: {
          question: "Qual a vantagem de fazer commits pequenos e com mensagens claras desde o início do projeto?",
          options: [
            "Documenta a evolução do projeto e facilita encontrar em qual ponto um bug foi introduzido",
            "Commits pequenos fazem o código rodar mais rápido",
            "O Git exige um único commit gigante no final do projeto",
          ],
          correctIndex: 0,
        },
      },
      {
        id: "checklist-boas-praticas",
        title: "Checklist final de boas práticas antes de publicar",
        content: [
          "Antes de colocar um projeto no ar, vale revisar alguns pontos: segredos fora do código (variáveis de ambiente), senhas com hash, consultas ao banco parametrizadas, validação de entrada em todas as rotas, tratamento de erro centralizado e HTTPS configurado na hospedagem.",
          "Também vale conferir: logs suficientes para investigar um problema em produção, um plano de backup do banco de dados, e ao menos os testes automatizados cobrindo os fluxos mais críticos (login, pagamento, cadastro) — tudo que vimos ao longo deste curso, agora aplicado junto, de ponta a ponta.",
        ],
        example: `// Checklist rápido antes do deploy final
// [ ] JWT_SECRET forte, fora do código-fonte
// [ ] Senhas salvas com bcrypt (nunca texto puro)
// [ ] Todas as consultas SQL usam prepared statements
// [ ] Toda rota que recebe dados do cliente valida a entrada
// [ ] Middleware central de tratamento de erros configurado
// [ ] CORS configurado apenas para as origens confiáveis
// [ ] Variáveis de ambiente de produção configuradas na hospedagem
// [ ] Testes automatizados cobrindo os fluxos críticos
// [ ] Logs estruturados e algum tipo de monitoramento ativo`,
        quiz: {
          question: "Por que revisar um checklist de segurança e boas práticas antes de publicar um projeto é importante?",
          options: [
            "Ajuda a garantir que pontos essenciais (segredos, validação, erros, testes) não foram esquecidos antes de expor o projeto ao público",
            "O checklist substitui a necessidade de testar o projeto",
            "Isso só é necessário para projetos com mais de um desenvolvedor",
          ],
          correctIndex: 0,
        },
      },
    ],
  },
];

module.exports = curriculum;
