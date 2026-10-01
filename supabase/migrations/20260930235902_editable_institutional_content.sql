insert into public.store_settings(key,value)
values ('institutional','{
  "name":"Ticket Rio Turismo",
  "cnpj":"07.909.071/0001-50",
  "phone":"(21) 2025-5000",
  "whatsapp":"552120255000",
  "email":"atendimento@ticketrio.com.br",
  "address":"Av. das Américas, 700, bloco 8, loja 112 L, Barra da Tijuca, Rio de Janeiro",
  "hours":"Segunda a sexta, 10h às 18h",
  "confirmed":false
}'::jsonb);
grant select on public.store_settings to anon;
grant update on public.store_settings to authenticated;
create policy institutional_public_read on public.store_settings for select to anon,authenticated
  using (key='institutional');
create policy institutional_admin_update on public.store_settings for update to authenticated
  using (key='institutional' and private.has_staff_role(array['administrator']))
  with check (key='institutional' and private.has_staff_role(array['administrator']));
