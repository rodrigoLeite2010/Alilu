/**
 * Palavras FREQUENTES do português com 7+ letras (as curtas nunca são
 * marcadas como complexas). Lista curada, versionada no código e carregada
 * uma vez em memória — sem banco. A comparação é feita por radical
 * (ver complex-words.ts), então basta uma forma de cada palavra
 * ("trabalhar" cobre "trabalhando", "trabalhou", "trabalhos"...).
 * Pode crescer com o uso: inclua palavras do dia a dia, nunca jargão.
 */
export const COMMON_WORDS_PT = `
abertura abraçar abraço absoluto acabar acontecer acontecimento acordar acreditar acompanhar acostumar adiante adolescente aeroporto agradecer agradável alegria alcançar alimento alimentação almoçar almoço alterar alteração altura aluguel amanhã ambiente amizade amoroso andamento animado animal aniversário anterior antigo apaixonado aparecer apartamento apelido aplicativo apoiar aprender aproveitar aquecer arrumar artigo assistir assunto atenção atender atividade atrasado atrás através aumentar automóvel autoestima avaliação avançar aventura avisar avó avô
bagunça banheiro barulho batalha bastante bebida beleza bicicleta biscoito bonito brincadeira brincar brilhante buscar
cabeça cachorro cadeira caderno caminhada caminhar caminho caminhão campanha campeão cansado cantar capacidade capítulo carinho carreira carteira casamento castelo celular cenário certeza chamada chegada chegar chocolate cidadão cidade ciência cinema circunstância claramente cliente coisa colega colocar começar começo comentar comentário comercial comida comigo companhia compartilhar completo comprar compra compromisso computador comunicação comunidade conceito concordar condição conectar confiança confiar conhecer conhecimento conquistar conquista conseguir conselho consumo contato contente contigo continuar contrário controle conversa conversar convidar convite coração coragem corrida corrigir cozinha cozinhar crescer crescimento criança criatividade criativo cuidado cuidar cultura curiosidade curiosidade custoso
dedicação defender definir deixar delicioso demais depender depoimento depressa descansar descanso descobrir desconto desculpa desejar desejo desenho desenvolver desenvolvimento desistir despesa destino detalhe devagar diferença diferente difícil dificuldade digital dinheiro direção direito disciplina disponível distância diversão divertido dividir documento domingo doméstico dúvida
economia economizar educação embora emocionante emoção empresa empresário encontrar encontro energia enfrentar enquanto ensinar entender entrada entrega entregar entrevista enviar equipe escolher escolha escola escrever escritório esforço espaço especial esperança esperar esporte esquecer estabelecer estratégia estudante estudar estudo exatamente exemplo exercício existir experiência explicar exposição
facilidade facilmente família famoso fantástico favorito felicidade feriado ferramenta festival finalmente financeiro firmeza fotografia frequente funcionar funcionário futebol
garantia garantir gastar gelado generoso gerente gostoso governo gratidão gratuito grávida guardar
habilidade história histórico hospital humano humildade
igualdade imagem imaginar importante importância impossível incrível indicar individual informação inglês iniciar início inteiro inteligente inteligência interesse internet inverno investimento investir
janeiro jantar jardim jornada jornal juntos juventude
lanchonete lembrança lembrar levantar liberdade ligação limpeza literatura livraria localização lugares
machucar madrugada maneira manhã manter máquina maravilhoso marcar mercado mensagem mentira mercado metade método milhões ministro mistério momento morador motivação motivo motorista movimento mudança mudar mulheres mundial música
namorado namorada natureza necessidade negócio nervoso ninguém noivado normalmente notícia novidade número
objetivo obrigado obrigada observar ocasião oferecer oferta olhar operação oportunidade opinião organizar orgulho original outubro
paciência paciente padaria pagamento palavra palestra parabéns paralelo parceiro parceria parecer participar passado passageiro passear passeio pensamento pensar pequeno perceber perder perdão perfeito pergunta perguntar período permitir personagem pertinho pessoal pessoa planejar planeta plástico político população porque portanto positivo possível prático precisar preciso preferir preocupar preparar presente presidente pressão principal prioridade problema processo produto professor profissão profissional programa projeto prometer promoção pronto proposta próximo pública público
qualidade qualquer quantidade quarenta quarteirão quintal
rapidamente realidade receber receita recomeçar recomeço recurso reflexão refrigerante região relacionamento relação relógio remédio repetir resolver respeito responder resposta restaurante resultado reunião revista
salário saudade saudável segredo segunda segurança semana semestre sentimento separar setembro silêncio simples simplesmente sistema sociedade sorriso sorrir sozinho sucesso supermercado surpresa
telefone televisão temporada tentativa terminar tranquilo transformar trabalhar trabalho tradição tranquilidade transporte tristeza
último universidade universo urgente usuário utilidade
vantagem vendedor verdade verdadeiro vergonha viagem viajar vitória vizinho vontade
acessível acessório adorável afinal agenda agora algumas alguém aliança ambição anúncio apresentar apresentação aprovação assinatura atendimento atualizar autoridade bancário benefício brasileiro brasileira campeonato candidato capital cartão categoria celebrar centavos certinho chamado cobrança coleção colorido combinado combinar comemorar comportamento comprimento concurso confirmar confusão conjunto consciência construir consulta conteúdo contrato convencer cotidiano crédito cristão cuidadoso curtir dezembro diariamente direitinho diretor disposição divulgar empregado emprego empreender endereço engraçado enorme entretanto entusiasmo escolaridade especialista espetáculo estacionamento estômago evento eventual evidente exclusivo expectativa explicação extremamente fabricar fevereiro fragilidade fronteira geladeira gerenciar grandeza horário humanidade ilustração impressão inspirar inspiração instagram internacional janela legenda liderança limitado líquido mandamento matemática medicamento melhorar memória mensalidade microondas milagre minutos missão moderno mostrar navegador obrigação otimismo ousadia pandemia parcela pastoral percebido perigoso permanecer pesquisa pesquisar piscina plataforma podcast poderoso política portaria postagem presença prestação primeiro primeira problemático procurar produção programação progresso proteção proteger provavelmente publicar publicação qualificado quarentena quinta recado reconhecer reconhecimento registro relaxar religião renovar reportagem representar rotina sabedoria satisfação segunda-feira seguidor seguidores semelhante serviço sexta-feira significado sinceridade sobrinho sozinha superação superar talento tecnologia terça-feira tolerância tratamento treinamento tributo trinta unidade valorizar verificar vestido vídeo voluntário whatsapp youtube
pássaro comparar considerar considerando acabamento acelerar aceitar acesso achamos acidente acordo acertar adorar advogado afastar agricultura ajudante alegre alguma almofada amarelo amigável amizades ansiedade apagar aparelho apelo aplauso apostar aquecimento arroz assustar atacar ataque atrapalhar atualmente avental azulejo
bairro baixinho balança bandeira barriga bateria batalhar bonequinho borboleta brasileiros brigadeiro
cabelo cachoeira calçada camiseta campanha canetinha cantora capricho carregar cartaz casaco catástrofe cebola celebração cerveja chateado chinelo chuveiro ciclista cobertor colchão colher comandar combate comecei combustível compreender comunicar concluir confortável congelar construção contagem contribuir convencido copiar corajoso corredor costurar cotovelo criação cumprimentar
decisão declarar decoração delegado demorar desafio desaparecer descobrir desenhar desespero desligar despedida desperdiçar destruir devolver diferenciar dirigir discutir diversos dolorido dormitório durante
editora elefante elogiar emagrecer empurrar encantador endividado engordar engravidar enquanto ensinamento entusiasmado equilíbrio errado escada esconder espelho espinafre esquerda esquina estação estrela estrada estranho evitar exagerar exército
fábrica faculdade falecer farmácia fazendeiro feijão felizmente ferida festejar figurinha floresta formatura fornecer fortalecer frequentar fruteira fumante funcionamento
galinha garrafa gasolina gaveta generosidade ginástica gravidez guardanapo
homenagem hospedar
idiomas igreja ilimitado imediato importar improviso incentivo incomodar inimigo inocente insistir instante intenção interior inventar irmãozinho
juntinho justiça
laranja lavanderia legumes lençol leitura licença ligeiro limonada linguagem
macarrão madeira madrinha manteiga maquiagem marmita maternidade matrícula medicina melancia mentiroso merecer mochila molhado montanha morango mudanças
nascimento negativo noticiário novembro
obedecer ocupado oficina orçamento ordenar orientar
padrinho palhaço panela papelaria parente parquinho particular passarinho pedreiro penteado perfume pernilongo pescaria pesadelo pijama pimenta pipoca pirulito plantação pobreza poltrona pomada portão praticar prefeito prefeitura prejuízo presidência primavera professora pulseira
quarteto quebrado queimado questão
rascunho reclamar reforma remendo repartir reservar respirar resumir retirar reunir rodoviária roupinha
sabonete salgado sandália sapateiro secretária sentido sentir silencioso sinceramente sobremesa sobrenome sorvete sossego suspirar
tamanho tarefinha teclado telhado temperatura tempestade terremoto tesoura tomate trabalhador travesseiro tremendo trocado
uniforme utensílio
valente vassoura vendedora verdura vestibular vinagre visitante voltinha
`.split(/\s+/).filter(Boolean);
