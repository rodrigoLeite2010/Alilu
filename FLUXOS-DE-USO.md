# ALILU — Fluxos de uso (morador, profissional, admin) e o que falta

> Este documento descreve como a aplicação **deve** funcionar de ponta a ponta, com base no que já está implementado no backend e nos frontends (mobile + admin-web). Serve como referência para testar o sistema e para decidir os próximos passos. Não é um novo Etapa/PROMPT — é só explicação do que já existe.

## Modelo geral: papéis e aprovações

A ALILU tem 4 papéis (`UserRole`): **Resident** (morador), **Professional** (profissional), **CondominiumAdmin** (síndico/administradora de um condomínio) e **SuperAdmin** (equipe ALILU, todos os condomínios).

Só `Resident` e `Professional` podem se **auto-cadastrar** pelo app (`POST /api/auth/register`). Isso é uma regra de domínio, não uma falta de tela: `User.Register()` recusa explicitamente qualquer outro papel com a mensagem "Este papel não pode ser escolhido no cadastro". `CondominiumAdmin` e `SuperAdmin` só existem porque um SuperAdmin já existente os promoveu (ou, para o primeiro SuperAdmin de todos, porque o bootstrap automático da aplicação o criou — ver "O que foi resolvido agora").

Depois do cadastro, tanto o morador quanto o profissional ainda não têm nada liberado: cada um precisa de um **vínculo aprovado** com pelo menos um condomínio antes de poder usar a área principal do app. É esse vínculo — não o cadastro em si — que o admin aprova.

---

## Fluxo 1 — Morador (Resident)

**1. Cadastro.** O morador baixa o app, informa nome/e-mail/telefone/senha e escolhe o papel "Morador" — `POST /api/auth/register` com `role: "Resident"`. Cadastro só cria o usuário; ainda não tem acesso a nenhum condomínio.

**2. Entrar em um condomínio — duas formas possíveis:**
   - **Fluxo do convite** (o caminho normal): o síndico/admin já cadastrou a unidade e gerou um código de convite para ela (módulo Condominium, `CondominiumInvitation`). O morador digita esse código no app. Como o convite em si já é a validação — alguém com poder de admin o gerou —, o vínculo nasce **direto como `Active`**, sem esperar aprovação alguma. É o caminho pensado para ser o mais comum.
   - **Fluxo "Não encontrei minha unidade"** (solicitação manual): o morador não tem um código de convite, então escolhe o condomínio e a unidade num diretório público e manda uma solicitação. Esse vínculo nasce como `Pending` e só é liberado quando um admin aprova (tela **Moradores** no admin-web).

   Em ambos os casos, o vínculo é entre usuário + condomínio + unidade específicos (`CondominiumMembership`). Um morador pode, em tese, ter vínculos com mais de um condomínio/unidade.

**3. Área do morador liberada.** Só com pelo menos um vínculo `Active` o app libera a área principal (isso é o "morador Active pode..." mencionado em várias regras do backend).

**4. Contratar um serviço.** O morador navega o diretório de profissionais associados ao seu condomínio e cria uma solicitação de atendimento (`Booking`) — nasce como `Requested`.

**5. Acompanhar o atendimento.** O status muda conforme o profissional interage (ver Fluxo 2): pode virar `Confirmed` (aceito), `Rejected` (recusado), `InProgress`, `Completed`, `NoShow`, ou ser cancelado pelo próprio morador (`CancelledByResident`) enquanto isso for permitido.

**6. Avaliar.** Depois que o booking chega a `Completed`, o morador pode avaliar o profissional diretamente (`Review` — nota + comentário opcional). **Não existe moderação nessa etapa**: a avaliação é publicada assim que criada, sem passar por aprovação de admin (é proposital — ver Fluxo 3, item 8).

**7. Indicar um profissional (opcional, fora do fluxo de contratação).** O morador também pode recomendar um profissional para a vizinhança, mesmo um que nunca usou pelo app — `Recommendation`, exatamente um entre "profissional já cadastrado na ALILU" ou "nome/telefone externos". Toda recomendação nasce `Pending` e só aparece para os outros moradores depois que um admin aprova (tela **Recomendações**).

**8. Notificações.** Ao longo desse fluxo o morador recebe notificações internas + push (quando configurado) automaticamente — profissional aceitou/recusou, atendimento concluído, recomendação aprovada, etc. Não existe uma tela para o morador "criar" notificações; elas são sempre disparadas pelo sistema em resposta a uma ação de outro módulo.

---

## Fluxo 2 — Profissional (Professional)

**1. Cadastro.** Mesmo endpoint de auto-cadastro, com `role: "Professional"`.

**2. Vincular-se a um condomínio.** O profissional solicita atendimento em um ou mais condomínios pelo app (`ProfessionalCondominium`, origem `ProfessionalRequested`) — nasce `Pending`. Só depois que um admin aprova (tela **Profissionais**) o vínculo vira `Active` e o profissional passa a aparecer no diretório daquele condomínio para os moradores.
   - Existe também um segundo caminho, iniciado pelo admin: na tela **Profissionais** o admin pode associar diretamente um profissional já cadastrado na ALILU a um condomínio ("Associar profissional diretamente"). Nesse caso o vínculo já nasce **`Active`** de uma vez (origem `AdminApproved`) — não passa por um segundo passo de aprovação, porque foi o próprio admin quem o criou.

**3. Receber solicitações.** Com vínculo ativo em pelo menos um condomínio, o profissional passa a receber as solicitações (`Booking`) feitas pelos moradores daquele condomínio, e pode **aceitar** (`Confirmed`) ou **recusar** (`Rejected`).

**4. Executar o atendimento.** O profissional atualiza o status conforme o atendimento acontece: `InProgress` → `Completed`, ou registra `NoShow` se o morador não estava presente. Também pode cancelar antes da conclusão (`CancelledByProfessional`), respeitando as regras de quando isso é permitido.
   - Um detalhe técnico relevante para quem estiver testando concorrência: a checagem de conflito de horário usa transação com isolamento `Serializable` — duas solicitações simultâneas para o mesmo horário não conseguem as duas "vencer".

**5. Ser avaliado e indicado.** Depois de um `Completed`, o profissional acumula as avaliações (`Review`) que os moradores fizerem, e pode aparecer em recomendações aprovadas. O profissional também pode editar o próprio perfil (nome de exibição, descrição, telefone, foto) e as especialidades oferecidas a qualquer momento — tela própria no app.

**6. Notificações.** Mesma lógica do morador: recebe automaticamente (nova solicitação, vínculo aprovado/rejeitado, etc.), não cria notificações manualmente.

---

## Fluxo 3 — Admin (CondominiumAdmin / SuperAdmin)

Os dois papéis usam o mesmo admin-web; a diferença é o escopo (`AdminScope`): um `CondominiumAdmin` só enxerga e opera sobre **um** condomínio (o dele); um `SuperAdmin` não tem restrição — enxerga todos.

**1. Login.** `POST /api/auth/login` no mesmo backend; o admin-web bloqueia no frontend qualquer papel que não seja `CondominiumAdmin`/`SuperAdmin` (`NotAnAdminError`).

**2. Escolher o condomínio (se for SuperAdmin).** Um `CondominiumAdmin` já cai direto no condomínio dele; um `SuperAdmin` escolhe em qual condomínio quer operar (`CondominiumPicker`). Cadastrar um condomínio novo é feito na tela **Condomínios** (visível só para SuperAdmin) — depois de criado, ele já aparece no seletor.

**3. Dashboard.** Visão geral com números do condomínio selecionado.

**4. Moradores.** Aprovar ou rejeitar as solicitações `Pending` do "Fluxo 2" de vínculo do morador (quem entrou por convite já chega `Active` e nem aparece aqui pendente), e bloquear vínculos já ativos se for o caso.

**5. Unidades.** Criar novas unidades do condomínio, editar código/tipo, bloquear, e ver qual morador está vinculado a cada uma — é aqui, indiretamente, que nasce a possibilidade de gerar um convite para uma unidade (o convite em si é do módulo Condominium).

**6. Profissionais.** Aprovar/rejeitar solicitações `Pending` de profissionais que pediram para atender aquele condomínio, bloquear vínculos ativos, ou associar diretamente um profissional já cadastrado na ALILU (ativa na hora, sem esperar pedido dele).

**7. Recomendações.** Aprovar, rejeitar ou bloquear (depois de aprovada) as indicações que os moradores fizerem.

**8. Papel de "moderador de avaliações" — não existe.** Diferente de Recomendação, a `Review` não tem hoje nenhuma etapa de moderação nem tela de admin — é publicada direto pelo morador. Não é uma tela faltando por engano; é assim que a Etapa 09 foi desenhada.

---

## O que foi resolvido agora (Etapa 16)

Você pediu para resolver as lacunas listadas abaixo. Depois de investigar cada uma, 3 já estavam resolvidas (2 pelo próprio backend, que eu tinha descrito errado; 1 por você mesmo, testando) e 2 pediam código novo — que já foi feito e entregue junto com este documento atualizado:

- **Tela de condomínios no admin-web** — nova página **Condomínios** (menu só aparece para SuperAdmin), com formulário completo (nome, CNPJ, endereço, número, bairro, cidade, UF, CEP) e lista dos já cadastrados. Usa o mesmo endpoint que já existia (`POST /api/admin/condominiums`).
- **Bootstrap do primeiro SuperAdmin** — a aplicação agora cria o primeiro SuperAdmin sozinha ao subir, se `Bootstrap:SuperAdminEmail`/`Bootstrap:SuperAdminPassword` estiverem configurados (vazio por padrão, mesma lógica do `Jwt:Secret`). Em desenvolvimento local já vem pronto: suba a Api (`dotnet run`) e faça login com `superadmin@alilu.dev` / `SuperAdmin123!` — não precisa mais do `UPDATE` manual no banco. Em Staging/Production, defina as variáveis de ambiente `Bootstrap__SuperAdminEmail`/`Bootstrap__SuperAdminPassword` só na primeira subida.
- **Migrações do banco** — na verdade já estavam todas geradas na sua máquina (você rodou os comandos que passei durante a troubleshooting) — nada a fazer aqui, só confirmei olhando o `C:\Alilu` real.
- **Edição de perfil/portfólio do profissional** — eu tinha descrito isso como lacuna por engano no documento original: essa tela já existe no app (nome de exibição, descrição, telefone, foto e especialidades) desde etapas bem anteriores.

## O que ainda está fora do alcance daqui

**Build EAS de verdade e configuração do Android Studio/emulador** continuam de fora — dependem da sua conta Expo e da sua máquina, não de algo que eu resolva por código. Quando quiser gerar um APK/AAB real, o comando é `eas build --platform android --profile preview` (ou `production`) a partir da pasta `mobile` (`eas.json` já está pronto desde a Etapa 15). Para o Android Studio/emulador, me avise se travar em algum passo específico que eu ajudo a debugar — mas a instalação em si roda no seu computador.

**Notificações push** continuam opcionais (por design, não é uma lacuna): sem as credenciais do Expo Push no `appsettings`, moradores/profissionais recebem só a notificação interna, sem push de verdade no celular — preencha `PushNotification:ExpoAccessToken` (ou a variável de ambiente equivalente) quando quiser habilitar.
