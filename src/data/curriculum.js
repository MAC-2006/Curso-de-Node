// Currículo do curso de Node-RED baseado na apostila fornecida pela equipe.

const curriculum = [
  {
    id: "introducao-node-red",
    title: "Introdução ao Node-RED",
    lessons: [
      {
        id: "o-que-e-node-red",
        title: "O que é Node-RED?",
        content: [
          "Node-RED é uma ferramenta low-code para criar automações e integrações orientadas a eventos. Em vez de escrever toda a lógica linha por linha, você conecta blocos visuais chamados nodes para formar fluxos.",
          "Um fluxo funciona como uma linha de montagem: um node recebe uma informação, outro transforma essa informação e outro envia ou exibe o resultado. Essa abordagem facilita protótipos, integrações e soluções de IoT.",
        ],
        example: `// Um fluxo Node-RED normalmente representa:
// Inject → Function → Debug
// Cada node recebe e envia uma mensagem.`,
        quiz: {
          question: "Qual é a principal característica do Node-RED?",
          options: ["Criar fluxos conectando nodes visuais", "Servir apenas para HTML", "Substituir o sistema operacional"],
          correctIndex: 0,
        },
      },
      {
        id: "mensagens-msg-payload",
        title: "Mensagens e msg.payload",
        content: [
          "Os nodes se comunicam por mensagens JavaScript. A propriedade mais utilizada é msg.payload, que pode conter texto, números, valores booleanos ou objetos JSON.",
          "Ao conectar nodes, o fluxo transporta essa mensagem de um ponto para outro. Entender o conteúdo de msg.payload é essencial para acompanhar e transformar os dados.",
        ],
        example: `msg.payload = { temperatura: 24, unidade: "°C" };
return msg;`,
        quiz: {
          question: "Qual propriedade da mensagem é mais utilizada para transportar os dados?",
          options: ["msg.payload", "msg.nodeName", "msg.screen"],
          correctIndex: 0,
        },
      },
      {
        id: "instalacao-primeiro-acesso",
        title: "Instalação e primeiro acesso",
        content: [
          "Instale o Node.js na versão LTS, depois instale o Node-RED globalmente pelo npm e inicie o serviço pelo terminal.",
          "Com o serviço em execução, abra http://127.0.0.1:1880/ no navegador. Esse endereço apresenta o editor visual onde os fluxos são criados e implantados.",
        ],
        example: `node --version
npm --version
npm install -g node-red
node-red

// Editor local:
http://127.0.0.1:1880/`,
        video: {
          titulo: "Primeiro acesso e tour pelo Node-RED",
          duracaoSugerida: "5 minutos",
          videoUrl: "/videos/01-tour.mp4",
          roteiro: [
            "0:00–1:30 | Abrir o terminal, executar node-red e mostrar o carregamento até aparecer o link do servidor local.",
            "1:30–3:00 | Abrir o navegador em localhost:1880 e recomendar zoom de 110%.",
            "3:00–5:00 | Apresentar a paleta de nodes, o canvas e a barra lateral com as abas Informação e Debug.",
          ],
        },
        quiz: {
          question: "Qual endereço normalmente abre o editor local do Node-RED?",
          options: ["http://127.0.0.1:1880/", "http://localhost:3000/node-red", "http://localhost:8080/editor"],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: "fundamentos-fluxos",
    title: "Fundamentos e Criação de Fluxos",
    lessons: [
      {
        id: "editor-primeiro-fluxo",
        title: "O editor e o primeiro fluxo",
        content: [
          "O editor possui uma paleta de nodes, uma área de trabalho e uma aba lateral de informações e debug. Para criar um fluxo, arraste os nodes e conecte suas portas.",
          "O fluxo inicial recomendado é Inject → Function → Debug. O Inject dispara uma mensagem, o Function pode processá-la e o Debug permite observar o resultado.",
        ],
        example: `// No node Function
msg.payload = "Meu primeiro fluxo";
return msg;

// Depois de conectar, clique em Deploy.`,
        video: {
          titulo: "Arrastando, conectando e fazendo Deploy",
          duracaoSugerida: "6–7 minutos",
          videoUrl: "/videos/02-primeiro-fluxo.mp4",
          roteiro: [
            "0:00–2:00 | Arrastar um node Inject e um node Debug e conectar o fio entre eles.",
            "2:00–4:00 | Destacar o botão Deploy, implantar o fluxo e acionar o Inject para mostrar o timestamp no Debug.",
            "4:00–7:00 | Inserir um node Change, alterar msg.payload para ‘Bem vindo ao curso’, fazer Deploy e mostrar o resultado.",
          ],
        },
        quiz: {
          question: "Qual sequência representa um primeiro fluxo comum?",
          options: ["Inject → Function → Debug", "Debug → Inject → HTML", "Function → Deploy → Inject"],
          correctIndex: 0,
        },
      },
      {
        id: "inject-debug-change",
        title: "Inject, Debug e Change",
        content: [
          "O Inject inicia um fluxo manualmente ou em horários programados. O Debug mostra mensagens na aba lateral e é indispensável para descobrir o que está acontecendo.",
          "O Change altera propriedades da mensagem sem exigir código JavaScript. Ele pode definir, mover, excluir ou substituir valores de msg.payload.",
        ],
        example: `// Valor enviado por um Inject
{ "payload": "início do processo" }

// Um Change pode definir msg.payload como:
// "processo iniciado"`,
        quiz: {
          question: "Qual node é usado principalmente para observar mensagens durante os testes?",
          options: ["Debug", "Change", "Switch"],
          correctIndex: 0,
        },
      },
      {
        id: "switch-template-function",
        title: "Switch, Template e Function",
        content: [
          "O Switch cria caminhos condicionais no fluxo. Ele encaminha a mensagem para saídas diferentes conforme valores como temperatura, status ou outra propriedade.",
          "O Template monta textos dinâmicos e o Function permite escrever JavaScript customizado. Juntos, esses nodes criam regras, relatórios e transformações.",
        ],
        example: `const temperatura = Number(msg.payload);
msg.payload = temperatura >= 30
  ? "Temperatura alta"
  : "Temperatura normal";
return msg;`,
        quiz: {
          question: "Qual node direciona mensagens para caminhos diferentes com base em condições?",
          options: ["Switch", "Debug", "Inject"],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: "manipulacao-dados",
    title: "Manipulação de Dados",
    lessons: [
      {
        id: "payload-texto-numero-json",
        title: "Texto, números, booleanos e JSON",
        content: [
          "msg.payload pode carregar textos, números, booleanos e objetos JSON. Um texto pode ser uma mensagem, um número pode representar uma medição e um booleano pode representar um estado.",
          "Objetos JSON organizam várias informações em uma única mensagem. Em integrações, é comum receber um objeto e extrair apenas os campos necessários.",
        ],
        example: `msg.payload = {
  nome: "Carlos",
  idade: 20,
  ativo: true
};
return msg;`,
        quiz: {
          question: "Por que objetos JSON são úteis nos fluxos?",
          options: ["Organizam várias propriedades em uma mensagem", "Só armazenam números", "Impedem a alteração dos dados"],
          correctIndex: 0,
        },
      },
      {
        id: "transformando-json-function",
        title: "Transformando JSON com Function",
        content: [
          "O node Function pode ler propriedades de msg.payload, validar informações e gerar um novo resultado. Verifique se os campos esperados existem antes de utilizá-los.",
          "Depois da transformação, retorne msg para que o próximo node receba a mensagem. A alteração pode substituir o payload ou adicionar propriedades auxiliares.",
        ],
        example: `const nome = msg.payload.nome;
const idade = Number(msg.payload.idade);
msg.payload = idade >= 18
  ? nome + " é maior de idade"
  : nome + " é menor de idade";
return msg;`,
        video: {
          titulo: "JSON, Switch e Function na prática",
          duracaoSugerida: "8–10 minutos",
          videoUrl: "/videos/03-json-switch-function.mp4",
          roteiro: [
            "0:00–3:00 | Configurar o Inject para enviar { nome: ‘Carlos’, idade: 20 } e mostrar o objeto no Debug.",
            "3:00–6:00 | Adicionar um Switch avaliando msg.payload.idade, com saídas para maior ou igual a 18 e menor que 18.",
            "6:00–10:00 | Inserir um Function, explicar o JavaScript e concatenar o nome com a frase ‘está aprovado’.",
          ],
        },
        quiz: {
          question: "O que uma Function precisa fazer para enviar a mensagem ao próximo node?",
          options: ["Retornar msg", "Chamar Deploy no código", "Apagar msg.payload"],
          correctIndex: 0,
        },
      },
      {
        id: "validacao-preparacao-dados",
        title: "Validação e preparação dos dados",
        content: [
          "Antes de enviar dados para uma API, banco ou equipamento, valide o formato e a existência das informações. Fluxos confiáveis tratam valores ausentes e tipos incorretos.",
          "Change, Switch e Function podem ser combinados para validar, normalizar e encaminhar os dados. O Debug confirma o formato final em cada etapa.",
        ],
        example: `const leitura = Number(msg.payload.temperatura);
if (Number.isNaN(leitura)) {
  node.error("Temperatura inválida", msg);
  return null;
}
msg.payload = { temperatura: leitura, valido: true };
return msg;`,
        quiz: {
          question: "Qual é uma boa prática antes de enviar dados para outro sistema?",
          options: ["Validar o formato e os campos recebidos", "Remover todas as propriedades", "Enviar qualquer valor sem verificar"],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: "integracao-apis",
    title: "Integração com APIs",
    lessons: [
      {
        id: "http-request-get",
        title: "Buscando dados com HTTP Request",
        content: [
          "O node HTTP Request consome serviços web por meio de requisições HTTP. O fluxo mais simples usa Inject para iniciar, HTTP Request para buscar e Debug para visualizar a resposta.",
          "Ao configurar o retorno como objeto JSON analisado, a resposta fica disponível em msg.payload para Function, Switch, Template e outros nodes.",
        ],
        example: `// Fluxo: Inject → HTTP Request → Debug
// Método: GET
https://jsonplaceholder.typicode.com/todos/1`,
        video: {
          titulo: "Consumindo uma API com HTTP Request",
          duracaoSugerida: "8 minutos",
          videoUrl: "/videos/04-http-request.mp4",
          roteiro: [
            "0:00–2:00 | Abrir jsonplaceholder.typicode.com/users e explicar o retorno da API.",
            "2:00–5:00 | Configurar HTTP Request com GET, colar a URL, selecionar retorno como objeto JSON e conectar Inject e Debug.",
            "5:00–8:00 | Fazer Deploy, executar e mostrar a lista no Debug, destacando o caminho payload[0].email.",
          ],
        },
        quiz: {
          question: "Qual node é usado para fazer uma chamada HTTP a uma API?",
          options: ["HTTP Request", "Template", "Catch"],
          correctIndex: 0,
        },
      },
      {
        id: "enviando-dados-api",
        title: "Enviando dados para uma API",
        content: [
          "Além de buscar informações com GET, o HTTP Request pode enviar dados usando POST, PUT e PATCH. O payload deve estar no formato esperado pelo serviço.",
          "Cabeçalhos, autenticação e códigos de status fazem parte da integração. Um fluxo profissional verifica a resposta da API e trata falhas.",
        ],
        example: `msg.headers = { "Content-Type": "application/json" };
msg.payload = { title: "Leitura do sensor", completed: false };
return msg;`,
        quiz: {
          question: "Qual método HTTP é normalmente usado para criar ou enviar um novo recurso?",
          options: ["POST", "GET", "TRACE"],
          correctIndex: 0,
        },
      },
      {
        id: "tratando-respostas-api",
        title: "Tratando respostas e erros de API",
        content: [
          "Uma integração deve considerar respostas bem-sucedidas e falhas de rede ou do serviço. Use Switch ou Function para verificar status, campos obrigatórios e mensagens de erro.",
          "O Debug é útil durante o desenvolvimento, mas em produção também é importante registrar o contexto do erro e encaminhar uma resposta compreensível.",
        ],
        example: `const status = msg.statusCode;
msg.payload = status >= 200 && status < 300
  ? { ok: true, dados: msg.payload }
  : { ok: false, erro: "API indisponível" };
return msg;`,
        quiz: {
          question: "O que um fluxo deve fazer quando uma API retorna erro?",
          options: ["Verificar a falha e fazer um tratamento adequado", "Considerar sempre que funcionou", "Apagar o erro e continuar"],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: "automacao-controle-fluxo",
    title: "Automação e Controle de Fluxo",
    lessons: [
      {
        id: "inject-agendamentos-cron",
        title: "Agendamentos com Inject",
        content: [
          "O Inject pode iniciar fluxos manualmente ou em intervalos e horários definidos. Isso permite consultar uma API a cada cinco minutos ou acionar uma rotina diariamente às seis horas.",
          "Agendamentos são úteis para automações que não dependem de uma ação humana. Considere fuso horário, frequência e o impacto da execução repetida.",
        ],
        example: `// Configure o Inject como repetição:
// a cada 5 segundos; ou todos os dias às 06:00.
// Depois conecte-o à rotina que deve ser executada.`,
        video: {
          titulo: "Agendamentos, Delay e Trigger",
          duracaoSugerida: "7–9 minutos",
          videoUrl: "/videos/05-agendamento.mp4",
          roteiro: [
            "0:00–3:00 | Configurar o Inject para repetição a cada 3 segundos e mostrar o Debug recebendo mensagens.",
            "3:00–6:00 | Inserir um Delay de 5 segundos e mostrar a mensagem aguardando antes de seguir.",
            "6:00–9:00 | Substituir pelo Trigger e simular ligar uma bomba, aguardar 10 segundos e desligá-la.",
          ],
        },
        quiz: {
          question: "Qual node pode iniciar um fluxo em horários ou intervalos programados?",
          options: ["Inject", "Debug", "Link Call"],
          correctIndex: 0,
        },
      },
      {
        id: "delay-trigger",
        title: "Delay e Trigger",
        content: [
          "O Delay atrasa mensagens ou limita a taxa de envio. Ele pode evitar sobrecarga em uma API ou controlar o ritmo de acionamento de um equipamento.",
          "O Trigger é útil para temporizadores e timeout. Ele pode enviar uma mensagem imediatamente e outra depois de um período caso não receba novo estímulo.",
        ],
        example: `// Trigger conceitual:
// Entrada: "Porta aberta"
// Saída imediata: "Porta aberta"
// Sem novo evento por 30 segundos:
// "Alarme: porta deixada aberta"`,
        quiz: {
          question: "Qual node é apropriado para atrasar mensagens ou limitar sua taxa?",
          options: ["Delay", "Template", "Inject"],
          correctIndex: 0,
        },
      },
      {
        id: "context-flow-global",
        title: "Memória com Context, Flow e Global",
        content: [
          "msg.payload representa a informação atual da mensagem. Para guardar estado entre mensagens, o Node-RED oferece contextos: node, flow e global, com diferentes alcances.",
          "O contexto é útil para armazenar o último valor de um sensor, o status de uma bomba ou uma configuração compartilhada por vários nodes.",
        ],
        example: `flow.set("bombaStatus", true);
const ligada = flow.get("bombaStatus");
msg.payload = ligada ? "Bomba ligada" : "Bomba desligada";
return msg;`,
        quiz: {
          question: "Qual recurso deve ser usado para guardar um estado entre mensagens?",
          options: ["Contexto, como flow.set e flow.get", "Somente o Debug", "A porta visual do node"],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: "dashboard-monitoramento",
    title: "Dashboard e Monitoramento",
    lessons: [
      {
        id: "instalando-dashboard",
        title: "Instalando o Node-RED Dashboard",
        content: [
          "O node-red-dashboard adiciona componentes visuais para acompanhar e controlar fluxos. A instalação pode ser feita pelo menu Manage palette do editor, na aba Install.",
          "Depois da instalação, o dashboard fica disponível para criar telas de operação e monitoramento conectadas aos dados dos fluxos.",
        ],
        example: `// Menu → Manage palette → Install
// Pesquise por: node-red-dashboard

// Dashboard:
http://127.0.0.1:1880/ui`,
        video: {
          titulo: "Criando um dashboard no Node-RED",
          duracaoSugerida: "10 minutos",
          videoUrl: "/videos/06-dashboard.mp4",
          roteiro: [
            "0:00–3:00 | Instalar node-red-dashboard pelo menu Manage palette e criar uma Tab e um Group.",
            "3:00–7:00 | Arrastar um Slider, conectar a um Gauge e a um Chart e configurar os componentes.",
            "7:00–10:00 | Dividir a tela entre o editor e localhost:1880/ui e demonstrar os componentes reagindo em tempo real.",
          ],
        },
        quiz: {
          question: "Qual pacote adiciona os componentes tradicionais de dashboard?",
          options: ["node-red-dashboard", "node-red-console", "node-red-browser-only"],
          correctIndex: 0,
        },
      },
      {
        id: "tabs-groups-dashboard",
        title: "Tabs, Groups e organização",
        content: [
          "A interface do dashboard é organizada em Tabs e Groups. Tabs representam páginas completas, enquanto Groups reúnem visualmente os controles de uma área.",
          "Uma boa organização facilita a operação: coloque controles relacionados no mesmo grupo, use nomes claros e separe monitoramento de comandos.",
        ],
        example: `// Organização conceitual:
// Tab: Controle da Fábrica
//   Group: Painel Térmico
//   Group: Atuadores
// Tab: Histórico`,
        quiz: {
          question: "No dashboard, o que é um Group?",
          options: ["Um agrupamento visual dentro de uma Tab", "Um servidor MQTT", "Uma mensagem do Inject"],
          correctIndex: 0,
        },
      },
      {
        id: "gauge-chart-switch-button",
        title: "Gauge, Chart, Switch e Button",
        content: [
          "Gauge e Chart exibem valores e séries históricas, sendo úteis para temperaturas, níveis e velocidades. Eles transformam dados do fluxo em informações visuais.",
          "Switch e Button permitem interação humana. Um botão inicia uma ação e um switch representa um estado ligado ou desligado que será encaminhado ao fluxo.",
        ],
        example: `// Mensagem para um Gauge
msg.payload = 28.5;
return msg;

// Mensagem de um Button
msg.payload = "ligar_ventilador";
return msg;`,
        quiz: {
          question: "Qual componente é indicado para exibir o valor atual de uma medição?",
          options: ["Gauge", "Inject", "Function"],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: "projeto-final-iot-mqtt",
    title: "Projeto Final IoT: Node-RED + MQTT",
    lessons: [
      {
        id: "mqtt-broker-topics",
        title: "MQTT, broker e tópicos",
        content: [
          "MQTT é um protocolo leve de comunicação entre máquinas, muito usado em IoT. Ele utiliza publish/subscribe para conectar sensores, aplicações e atuadores com baixo consumo de banda.",
          "O broker centraliza a comunicação. Dispositivos publicam mensagens em tópicos, que funcionam como salas de conversa, e os clientes assinam os tópicos de que precisam.",
        ],
        example: `// Tópicos MQTT
fabrica/forno/temperatura
estufa/sensorDHT
fabrica/ventilador/comando`,
        quiz: {
          question: "Qual é a função do broker no MQTT?",
          options: ["Centralizar mensagens entre publicadores e assinantes", "Renderizar o dashboard", "Substituir o Function"],
          correctIndex: 0,
        },
      },
      {
        id: "mqtt-in-json-function",
        title: "Recebendo sensores com MQTT In",
        content: [
          "O node MQTT In assina um tópico e recebe mensagens de sensores, ESP32, Arduino ou outros dispositivos. A mensagem pode chegar como texto e precisar ser convertida para JSON.",
          "Depois da entrada, nodes JSON e Function podem transformar o conteúdo e extrair campos como temperatura, umidade e estado do equipamento.",
        ],
        example: `// Depois do node JSON, em um Function
const temperatura = msg.payload.temperatura;
msg.payload = temperatura;
return msg;`,
        video: {
          titulo: "Node-RED e MQTT: recebendo dados de um sensor",
          duracaoSugerida: "10 minutos",
          videoUrl: "/videos/07-mqtt.mp4",
          roteiro: [
            "0:00–3:00 | Explicar MQTT, configurar MQTT In com o broker test.mosquitto.org e assinar fatec/jundiai/sensor/umidade.",
            "3:00–6:00 | Publicar uma mensagem pelo MQTT Explorer, simulando um ESP32, e mostrar a leitura chegando ao Node-RED.",
            "6:00–10:00 | Adicionar MQTT Out e Inject, publicar um comando e confirmar no MQTT Explorer que a comunicação é bidirecional.",
          ],
        },
        quiz: {
          question: "Qual node recebe mensagens de um tópico MQTT assinado pelo fluxo?",
          options: ["MQTT In", "MQTT Out", "Dashboard Text"],
          correctIndex: 0,
        },
      },
      {
        id: "mqtt-out-atuacao",
        title: "Controlando atuadores com MQTT Out",
        content: [
          "Depois de processar a leitura, o fluxo pode tomar decisões com Switch e enviar comandos pelo MQTT Out. Assim, o Node-RED deixa de apenas monitorar e passa a controlar equipamentos.",
          "Um exemplo é detectar temperatura acima de 35 graus e publicar ligar_ventilador no tópico do relé. A mesma arquitetura controla iluminação, bombas e outros atuadores.",
        ],
        example: `const temperatura = Number(msg.payload.temperatura);
if (temperatura > 35) {
  msg.topic = "fabrica/ventilador/comando";
  msg.payload = "ligar_ventilador";
  return msg;
}
return null;`,
        quiz: {
          question: "Qual node publica um comando para um tópico MQTT?",
          options: ["MQTT Out", "MQTT In", "Debug"],
          correctIndex: 0,
        },
      },
      {
        id: "projeto-final-estufa",
        title: "Projeto final: estufa automatizada",
        content: [
          "Um sensor envia dados de temperatura por MQTT. O Node-RED recebe a leitura, converte o JSON, extrai a temperatura e envia o valor para um Gauge do dashboard.",
          "Quando a temperatura ultrapassa o limite, o fluxo publica um comando pelo MQTT Out para um relé ligar o ventilador. Os dados nascem no hardware, são processados, exibidos e retornam como ação física.",
        ],
        example: `// Arquitetura do projeto
MQTT In → JSON → Function → Gauge
                         ↓
                       Switch → MQTT Out → Relé

// estufa/sensorDHT
// estufa/ventilador/comando`,
        quiz: {
          question: "Qual sequência representa o projeto final de automação da estufa?",
          options: ["MQTT In → processamento → Dashboard e MQTT Out", "Debug → HTML sem sensores", "Inject → CSS sem MQTT"],
          correctIndex: 0,
        },
      },
    ],
  },
];

module.exports = curriculum;
