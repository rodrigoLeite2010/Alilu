/**
 * Categorias editoriais do Carrossel Inteligente automático. Funções e dados
 * PUROS (sem banco, sem IA). "Criação de conteúdo" é UMA categoria entre 19 —
 * nunca o assunto padrão da marca. Os pesos aqui são só o PADRÃO: o que vale é
 * o que o usuário configura (SmartCarouselConfig.categoryWeights).
 */
export const CAROUSEL_CATEGORY_IDS = [
  "PSICOLOGIA",
  "DINHEIRO",
  "MOTIVACAO",
  "COMPORTAMENTO",
  "FAMILIA",
  "RELACIONAMENTOS",
  "AMIZADE",
  "PERDAO",
  "SUPERACAO",
  "TRABALHO",
  "DISCIPLINA",
  "AUTOESTIMA",
  "FE",
  "EMPATIA",
  "VIDA",
  "CURIOSIDADES",
  "HISTORIAS",
  "TECNOLOGIA",
  "CRIACAO_CONTEUDO",
] as const;

export type CarouselCategoryId = (typeof CAROUSEL_CATEGORY_IDS)[number];

/** Quanto o carrossel se apoia em foto: emocional = mais fotos; conceitual = mais tipografia. */
export type ImageDensity = "HIGH" | "MID" | "LOW";

export interface CarouselCategoryDef {
  id: CarouselCategoryId;
  label: string;
  /** Peso padrão (0–100). */
  weight: number;
  imageDensity: ImageDensity;
  /** Como o texto deve soar nesta categoria. */
  tone: string;
  /** Banco de temas (ângulos concretos, nunca instruções de "criar carrossel"). */
  themes: readonly string[];
  /** Cenas de banco de fotos (inglês, 2–4 palavras) coerentes com a categoria. */
  scenes: readonly string[];
  /** Modelos visuais que combinam (ids de CAROUSEL_TEMPLATES; o primeiro livre ganha). */
  templates: readonly string[];
  /** Pede pesquisa web/fatos (curiosidades, dados). */
  factual: boolean;
}

export const CAROUSEL_CATEGORIES: readonly CarouselCategoryDef[] = [
  {
    id: "PSICOLOGIA",
    label: "Psicologia",
    weight: 10,
    imageDensity: "MID",
    tone: "curioso e revelador, como quem explica por que agimos como agimos, sem diagnosticar ninguém",
    themes: [
      "Por que algumas pessoas somem quando começam a gostar de alguém",
      "O que o silêncio de alguém diz sobre você (e sobre ele)",
      "Por que lembramos mais do que deu errado do que do que deu certo",
      "O efeito de adiar o que importa: a mente trata o futuro como outra pessoa",
      "Por que dizer sim para tudo cansa mais do que trabalhar muito",
      "Pessoas que ajudam demais: o que existe por trás do cuidado excessivo",
      "O cérebro prefere o conhecido, mesmo quando o conhecido machuca",
      "Por que a pressa de ser aprovado nos faz abrir mão de quem somos",
      "A diferença entre estar sozinho e se sentir sozinho",
      "Como as primeiras impressões se formam em segundos e demoram anos para mudar",
    ],
    scenes: ["person window thoughtful", "silhouette sunset alone", "rain window reflection", "hands holding coffee", "city crowd walking"],
    templates: ["alilu-noite", "alilu-editorial", "alilu-petroleo"],
    factual: true,
  },
  {
    id: "DINHEIRO",
    label: "Dinheiro e educação financeira",
    weight: 10,
    imageDensity: "LOW",
    tone: "claro e prático, sem culpar ninguém e sem promessa de enriquecimento",
    themes: [
      "O erro de parcelar tudo e só olhar o valor da parcela",
      "Por que quem ganha mais nem sempre sobra mais no fim do mês",
      "O gasto pequeno e diário que pesa mais que a compra grande",
      "Reserva de emergência: o dinheiro que compra tranquilidade",
      "O que ninguém conta sobre o cartão de crédito rotativo",
      "Como a pressa de comprar vira dívida: o gatilho da promoção",
      "Falar de dinheiro em casa: o que as crianças aprendem sem a gente perceber",
      "Juros compostos: por que o tempo vale mais que o valor",
      "Dívida não é vergonha: o primeiro passo é olhar o número real",
      "O dinheiro que some sem você perceber: as assinaturas esquecidas",
    ],
    scenes: ["coins jar savings", "calculator desk notebook", "wallet empty hands", "family kitchen table bills", "piggy bank"],
    templates: ["alilu-petroleo", "alilu-areia", "alilu-editorial"],
    factual: true,
  },
  {
    id: "MOTIVACAO",
    label: "Motivação",
    weight: 10,
    imageDensity: "MID",
    tone: "firme e humano, inspirador sem frases prontas nem promessa de milagre",
    themes: [
      "Recomeçar depois de um fracasso sem fingir que ele não doeu",
      "Você não precisa de motivação, precisa de um próximo passo pequeno",
      "O dia em que desistir parecia a opção mais sensata",
      "Quem já recomeçou sabe: o difícil é o primeiro passo, não o caminho",
      "Resultados lentos também são resultados",
      "A coragem silenciosa de quem tenta de novo",
      "Cansado não é fraco: a diferença entre pausar e desistir",
      "O que a gente aprende no ano em que nada deu certo",
    ],
    scenes: ["sunrise mountain path", "runner morning road", "person climbing steps", "open door light", "road horizon walking"],
    templates: ["alilu-solar", "alilu-noite", "alilu-petroleo"],
    factual: false,
  },
  {
    id: "COMPORTAMENTO",
    label: "Comportamento",
    weight: 10,
    imageDensity: "MID",
    tone: "observador e inteligente, mostrando padrões do dia a dia que ninguém nomeia",
    themes: [
      "Por que prometemos mudar na segunda-feira e raramente começamos",
      "Quem responde rápido demais e quem demora: o que isso revela",
      "O hábito de pedir desculpas por tudo e o que ele esconde",
      "Por que discutimos mais com quem mais amamos",
      "A gente imita quem convive: o poder de quem está ao nosso redor",
      "O costume de comparar a vida real com a vitrine dos outros",
      "Por que adiamos conversas difíceis até elas virarem problema",
      "Pessoas que nunca estão satisfeitas: o que costuma estar por trás",
    ],
    scenes: ["people cafe conversation", "man looking phone", "friends laughing table", "hands typing message", "crowd street"],
    templates: ["alilu-editorial", "alilu-noite", "alilu-menta"],
    factual: false,
  },
  {
    id: "FAMILIA",
    label: "Família",
    weight: 10,
    imageDensity: "HIGH",
    tone: "afetuoso e sensível, com detalhes concretos que despertam identificação",
    themes: [
      "O último colo que você não percebeu que seria o último",
      "O pai que não sabia dizer eu te amo, mas acordava de madrugada para te buscar",
      "A mesa de domingo que já foi cheia e hoje tem cadeiras vazias",
      "Mãe: a pessoa que sempre disse que estava sem fome",
      "O que os avós ensinam sem dar aula",
      "Crescer é perceber que os pais também tinham medo",
      "A casa da infância continua igual, só a gente que mudou",
      "Filhos não lembram do presente caro, lembram da atenção",
      "Irmãos: quem brigou a vida toda e hoje se entende com um olhar",
    ],
    scenes: ["father son walking", "grandmother hands cooking", "family dinner table", "mother child hug", "old house door", "kids playing backyard"],
    templates: ["alilu-solar", "alilu-areia", "alilu-menta"],
    factual: false,
  },
  {
    id: "RELACIONAMENTOS",
    label: "Relacionamentos",
    weight: 7,
    imageDensity: "HIGH",
    tone: "maduro e acolhedor, sem romantizar sofrimento nem dar ordens",
    themes: [
      "Amar não é suficiente quando falta conversa",
      "Os pequenos gestos que seguram um casal nos dias comuns",
      "Quando o cansaço fala mais alto que o carinho",
      "A diferença entre sentir falta e sentir carência",
      "Relacionamento não é ter alguém para preencher vazios",
      "O que mudou quando paramos de ouvir e começamos a esperar a vez de falar",
      "Terminar com respeito também é uma forma de amor",
      "O silêncio confortável: sinal de que dois já se conhecem",
    ],
    scenes: ["couple walking sunset", "two coffee cups table", "hands holding", "couple back view beach", "window light couple"],
    templates: ["alilu-noite", "alilu-areia", "alilu-editorial"],
    factual: false,
  },
  {
    id: "AMIZADE",
    label: "Amizade",
    weight: 7,
    imageDensity: "HIGH",
    tone: "caloroso e nostálgico, valorizando presença em vez de quantidade",
    themes: [
      "O amigo que aparece pouco, mas aparece quando importa",
      "Amizades que acabam sem briga e o que dizem sobre as fases da vida",
      "Quem está ao seu lado quando você não tem nada a oferecer",
      "Mandar mensagem primeiro também é um ato de carinho",
      "Poucos amigos, mas daqueles que a vida inteira não tira",
      "A amizade de infância que sobrevive à distância",
      "Rir juntos de coisas que ninguém mais entende",
    ],
    scenes: ["friends sunset laughing", "friends hug", "two friends bench", "group friends beach", "friends road trip"],
    templates: ["alilu-solar", "alilu-menta", "alilu-areia"],
    factual: false,
  },
  {
    id: "PERDAO",
    label: "Perdão",
    weight: 6,
    imageDensity: "HIGH",
    tone: "sereno e profundo, sem exigir que ninguém perdoe",
    themes: [
      "Perdoar não é esquecer: é parar de carregar o peso sozinho",
      "A mágoa que a gente guarda e o preço que ela cobra",
      "Pedir perdão é difícil porque exige abrir mão do orgulho",
      "Perdoar a si mesmo pelo que não sabia na época",
      "A conversa que nunca aconteceu e que ainda dói",
      "Perdão sem reconciliação: é possível seguir sem voltar",
      "O alívio que vem quando a gente larga a raiva",
    ],
    scenes: ["calm lake morning", "person looking horizon", "open hands light", "bridge fog", "empty road dawn"],
    templates: ["alilu-noite", "alilu-areia", "alilu-menta"],
    factual: false,
  },
  {
    id: "SUPERACAO",
    label: "Superação",
    weight: 8,
    imageDensity: "HIGH",
    tone: "emocionante e realista, honrando a dor sem transformá-la em espetáculo",
    themes: [
      "Ela perdeu tudo aos 40 e recomeçou do zero",
      "O que aprendi no dia em que ninguém acreditava em mim",
      "Superar não é não sentir mais: é seguir mesmo sentindo",
      "O que os anos difíceis ensinam e a gente só entende depois",
      "Voltar a estudar, trabalhar ou sonhar depois dos 50",
      "O dia em que a vida mudou de rota e foi a melhor coisa",
      "Pequenas vitórias que ninguém aplaude, mas que sustentam",
    ],
    scenes: ["woman stairs sunrise", "hiker summit", "person rain umbrella walking", "hands rising light", "runner finish line"],
    templates: ["alilu-solar", "alilu-petroleo", "alilu-noite"],
    factual: false,
  },
  {
    id: "TRABALHO",
    label: "Trabalho e carreira",
    weight: 6,
    imageDensity: "MID",
    tone: "realista e respeitoso com quem trabalha, sem glorificar excesso nem culpar o cansaço",
    themes: [
      "Cansaço de domingo à noite: o que a gente evita olhar",
      "Trabalhar muito não é o mesmo que trabalhar bem",
      "O chefe que lembra do nome e muda o dia de toda a equipe",
      "Pedir ajuda no trabalho não é fraqueza, é estratégia",
      "O profissional que ninguém vê e que sustenta o time",
      "Saber dizer não sem perder a relação",
      "Quando o trabalho vira identidade: e se ele acabar?",
    ],
    scenes: ["office window evening", "team meeting table", "man commuting train", "laptop desk night", "hands notebook coffee"],
    templates: ["alilu-petroleo", "alilu-editorial", "alilu-areia"],
    factual: false,
  },
  {
    id: "DISCIPLINA",
    label: "Disciplina",
    weight: 6,
    imageDensity: "LOW",
    tone: "direto e sóbrio, com ênfase em constância e sem moralismo",
    themes: [
      "Disciplina é fazer mesmo sem vontade, mas de um jeito possível",
      "O que separa quem começa de quem continua",
      "Rotina que cabe na vida real vence rotina perfeita",
      "A força dos 10 minutos diários",
      "Por que falhar um dia não apaga o progresso",
      "O ambiente decide mais do que a força de vontade",
      "Pequenas renúncias de hoje, liberdade de amanhã",
    ],
    scenes: ["alarm clock morning", "running shoes", "empty gym early", "notebook pen desk", "sunrise window"],
    templates: ["alilu-petroleo", "alilu-editorial", "alilu-noite"],
    factual: false,
  },
  {
    id: "AUTOESTIMA",
    label: "Autoestima",
    weight: 6,
    imageDensity: "MID",
    tone: "gentil e firme, valorizando quem a pessoa é sem frases de efeito",
    themes: [
      "Você não é o que disseram de você quando era criança",
      "Gostar de si mesmo é uma prática, não um sentimento que chega",
      "A voz que te critica não é a sua: de onde ela veio?",
      "Receber um elogio sem diminuir e sem se justificar",
      "Comparar-se com os outros é medir sua vida com a régua de outra",
      "Você já superou coisas que antes achava impossíveis",
      "Descansar sem culpa também é cuidar de si",
    ],
    scenes: ["woman mirror morning", "person smiling window", "hands heart chest", "woman field wind", "man looking sky"],
    templates: ["alilu-areia", "alilu-menta", "alilu-solar"],
    factual: false,
  },
  {
    id: "FE",
    label: "Fé",
    weight: 6,
    imageDensity: "HIGH",
    tone: "acolhedor e inclusivo, em tom de esperança, sem doutrina nem vínculo com religião específica",
    themes: [
      "Esperar quando não há sinais: a fé dos dias em silêncio",
      "Gratidão pelo que a gente quase não percebe",
      "Confiar no processo quando o caminho parece fechado",
      "A paz que não depende de entender tudo",
      "Orar, meditar ou silenciar: o valor de parar um minuto",
      "Quando a gente olha para trás e vê que foi sustentado",
      "A esperança é uma escolha que se renova de manhã",
    ],
    scenes: ["sunrise rays clouds", "hands prayer light", "candle dark", "field sunrise silhouette", "calm sea dawn"],
    templates: ["alilu-solar", "alilu-noite", "alilu-areia"],
    factual: false,
  },
  {
    id: "EMPATIA",
    label: "Empatia",
    weight: 6,
    imageDensity: "HIGH",
    tone: "sensível e atento, convidando a olhar o outro antes de julgar",
    themes: [
      "Ninguém sabe a batalha que o outro está vivendo hoje",
      "Escutar sem querer consertar: o maior presente",
      "O porteiro, a faxineira, o motorista: quem a gente não olha",
      "Gentileza custa pouco e muda o dia de alguém",
      "Julgar é fácil quando a gente não viveu a história inteira",
      "O sorriso de quem está desabando por dentro",
      "Perguntar de verdade como o outro está",
    ],
    scenes: ["hand on shoulder", "elderly person smile", "stranger helping", "child offering flower", "hands together"],
    templates: ["alilu-menta", "alilu-areia", "alilu-solar"],
    factual: false,
  },
  {
    id: "VIDA",
    label: "Vida",
    weight: 8,
    imageDensity: "HIGH",
    tone: "reflexivo e poético sem pretensão, com observações simples sobre o tempo e as escolhas",
    themes: [
      "O tempo que a gente jura ter e que passa sem pedir licença",
      "As coisas simples que um dia vamos olhar com saudade",
      "O dia comum que você não sabia que era o melhor",
      "Quem a gente vai ser daqui a dez anos agradece o que fazemos hoje",
      "Nem tudo precisa de resposta: algumas coisas pedem presença",
      "Envelhecer é acumular histórias, não perder tempo",
      "A vida não avisa quando uma fase termina",
      "Pequenos rituais que fazem os dias valerem a pena",
    ],
    scenes: ["sunset road car", "old clock", "autumn leaves path", "morning coffee window", "kids sunset field"],
    templates: ["alilu-noite", "alilu-solar", "alilu-areia"],
    factual: false,
  },
  {
    id: "CURIOSIDADES",
    label: "Curiosidades",
    weight: 10,
    imageDensity: "MID",
    tone: "surpreendente e preciso, com um fato forte logo no início e explicação clara",
    themes: [
      "Por que o cérebro cria memórias falsas sem perceber",
      "O que o cheiro de café tem a ver com a sua memória",
      "Fatos históricos que parecem mentira, mas aconteceram",
      "Por que sentimos o tempo passar mais rápido com a idade",
      "O experimento que mostrou o poder da influência do grupo",
      "A origem de hábitos e palavras que usamos sem pensar",
      "Coisas que seu corpo faz sozinho enquanto você dorme",
      "O curioso caso das invenções que surgiram por acidente",
      "Por que bocejar é contagioso",
    ],
    scenes: ["old library books", "microscope lab", "vintage map", "night sky stars", "old photograph desk"],
    templates: ["alilu-editorial", "alilu-noite", "alilu-menta"],
    factual: true,
  },
  {
    id: "HISTORIAS",
    label: "Histórias emocionantes",
    weight: 8,
    imageDensity: "HIGH",
    tone: "narrativo, em cena, com personagem, conflito e desfecho que emociona sem exagero",
    themes: [
      "O menino que guardava o troco da padaria para comprar um presente de pai",
      "A carta que chegou quarenta anos depois",
      "O velho que pagava a conta de um desconhecido todo sábado",
      "A professora que acreditou no aluno que todos tinham abandonado",
      "O reencontro de dois irmãos separados na infância",
      "A vizinha que deixava a luz acesa para quem voltava tarde",
      "O pai que aprendeu a trançar cabelo para a filha",
      "O último bilhete dentro da marmita",
    ],
    scenes: ["old letter hands", "boy bakery street", "elderly man bench", "classroom empty light", "train station farewell", "father daughter hair"],
    templates: ["alilu-noite", "alilu-solar", "alilu-areia"],
    factual: false,
  },
  {
    id: "TECNOLOGIA",
    label: "Tecnologia",
    weight: 4,
    imageDensity: "LOW",
    tone: "claro e humano, falando do impacto da tecnologia na vida das pessoas",
    themes: [
      "Por que o celular parece saber o que você pensa (e o que realmente acontece)",
      "O que perdemos quando tudo vira notificação",
      "Golpes digitais: os sinais que quase sempre aparecem",
      "Como a tecnologia mudou a forma de a gente se lembrar das coisas",
      "A senha fraca que abre portas que você nem imagina",
      "Inteligência artificial no dia a dia: onde ajuda e onde exige cuidado",
      "Desconectar uma hora por dia: o que muda",
    ],
    scenes: ["phone hand night", "laptop desk dark", "circuit board", "person headphones street", "smartphone notifications"],
    templates: ["alilu-menta", "alilu-petroleo", "alilu-editorial"],
    factual: true,
  },
  {
    id: "CRIACAO_CONTEUDO",
    label: "Criação de conteúdo",
    weight: 5,
    imageDensity: "LOW",
    tone: "prático e sem pressão, para quem cria conteúdo; sem promessa de viralização",
    themes: [
      "Roteiro simples: como organizar uma ideia em poucos slides",
      "Consistência vale mais que postar todo dia",
      "Organizar ideias antes de criar: um método leve",
      "Ferramentas que simplificam a rotina de quem cria",
      "Como transformar um assunto em vários conteúdos",
      "Publicar sem perfeccionismo: terminado vale mais que perfeito",
      "Como escolher o que NÃO postar",
    ],
    scenes: ["desk notebook ideas", "camera tripod", "laptop coffee creative", "sticky notes wall", "hands planning calendar"],
    templates: ["alilu-menta", "alilu-editorial", "alilu-petroleo"],
    factual: false,
  },
];

const BY_ID: ReadonlyMap<string, CarouselCategoryDef> = new Map(CAROUSEL_CATEGORIES.map((category) => [category.id, category]));

export function isCarouselCategoryId(value: unknown): value is CarouselCategoryId {
  return typeof value === "string" && BY_ID.has(value);
}

export function getCarouselCategory(id: string): CarouselCategoryDef | null {
  return BY_ID.get(id) ?? null;
}

export function defaultCategoryWeights(): Record<CarouselCategoryId, number> {
  return Object.fromEntries(CAROUSEL_CATEGORIES.map((category) => [category.id, category.weight])) as Record<CarouselCategoryId, number>;
}

/** Estruturas narrativas que se alternam (nunca a mesma duas vezes seguidas). */
export const NARRATIVE_STRUCTURES = [
  { id: "REVELACAO", label: "Revelação gradual: começa com um detalhe intrigante e revela o sentido só no meio" },
  { id: "CENA", label: "Cena e personagem: conta uma história curta em cenas e fecha com a lição" },
  { id: "MITO_VERDADE", label: "Mito versus verdade: desmonta o que todo mundo acredita, passo a passo" },
  { id: "SINAIS", label: "Sinais e identificação: uma sequência de situações que o leitor reconhece em si" },
  { id: "PERGUNTA", label: "Pergunta e resposta: uma pergunta forte no início, respondida em camadas" },
  { id: "CARTA", label: "Carta ou diálogo: fala diretamente com alguém, em tom íntimo" },
  { id: "ANTES_DEPOIS", label: "Antes e depois: contraste entre como as coisas eram e como passam a ser vistas" },
] as const;

export type NarrativeStructureId = (typeof NARRATIVE_STRUCTURES)[number]["id"];

/** Convites finais elegantes (nunca pedido desesperado de seguidores). Alternam-se. */
export const CLOSING_INVITES = [
  { id: "ACOMPANHE", text: "Acompanhe a Alilu para mais histórias como esta." },
  { id: "GUARDE", text: "Guarde este texto e volte a ele quando precisar. A Alilu continua por aqui." },
  { id: "COMPARTILHE", text: "Se fez sentido, envie para quem precisa ler isto. E siga a Alilu." },
  { id: "REFLITA", text: "Leve a pergunta com você. E siga a Alilu para continuar a conversa." },
  { id: "CONVITE", text: "Se esta leitura te tocou, a Alilu tem mais. Venha acompanhar." },
  { id: "SILENCIO", text: "Respire. E, se quiser, continue por aqui com a Alilu." },
] as const;

export type ClosingInviteId = (typeof CLOSING_INVITES)[number]["id"];
