-- "Imagem para vídeo com IA": quantos vídeos o mesmo usuário pode ter
-- gerando AO MESMO TEMPO. Padrão 1 — protege o usuário leigo de clicar
-- duas vezes em "Gerar vídeo" (ou abrir duas abas) e gastar créditos em
-- dobro sem querer. A tela também trava o botão; isto é a garantia no servidor.
alter table ai_pricing_config add column if not exists max_concurrent_generations_per_user int not null default 1;
