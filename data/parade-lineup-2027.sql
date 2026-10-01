-- Ordem oficial publicada para o Carnaval 2027.
-- Série Ouro: https://www.ligarj.com.br/carnaval/2027
-- Grupo Especial: https://liesa.org.br/carnaval/horario-dos-desfiles.html
-- Creates missing rows only. Existing editorial changes are never overwritten.
begin;
create temporary table official_lineup (
  event_date date not null,
  parade_order integer not null,
  school_name text not null,
  source_url text not null
) on commit drop;
insert into official_lineup values
  ('2027-02-05',1,'São Clemente','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-05',2,'Unidos do Jacarezinho','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-05',3,'Porto da Pedra','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-05',4,'Acadêmicos de Vigário Geral','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-05',5,'Acadêmicos de Niterói','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-05',6,'União da Ilha do Governador','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-05',7,'Unidos da Ponte','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-05',8,'Unidos de Bangu','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',1,'Acadêmicos de Santa Cruz','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',2,'Inocentes de Belford Roxo','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',3,'Estácio de Sá','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',4,'Unidos de Padre Miguel','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',5,'Arranco','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',6,'Império Serrano','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',7,'Em Cima da Hora','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',8,'Botafogo Samba Clube','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-06',9,'União do Parque Acari','https://www.ligarj.com.br/carnaval/2027'),
  ('2027-02-07',1,'União de Maricá','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-07',2,'Beija-Flor','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-07',3,'Paraíso do Tuiuti','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-07',4,'Vila Isabel','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-08',1,'Mocidade','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-08',2,'Unidos da Tijuca','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-08',3,'Salgueiro','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-08',4,'Imperatriz Leopoldinense','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-09',1,'Portela','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-09',2,'Viradouro','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-09',3,'Grande Rio','https://liesa.org.br/carnaval/horario-dos-desfiles.html'),
  ('2027-02-09',4,'Mangueira','https://liesa.org.br/carnaval/horario-dos-desfiles.html');
insert into public.parade_schools(name)
select distinct school_name from official_lineup
on conflict (name) do nothing;
insert into public.parade_lineup(event_date_id,school_id,parade_order,notes,status)
select d.id,s.id,o.parade_order,'Fonte oficial: ' || o.source_url,'published'
from official_lineup o
join public.event_dates d on d.event_date=o.event_date and d.status='published'
join public.parade_schools s on s.name=o.school_name
where not exists (
  select 1 from public.parade_lineup l
  where l.event_date_id=d.id and l.parade_order=o.parade_order
)
on conflict (event_date_id,parade_order) do nothing;
commit;
select d.event_date, count(l.id) filter (where l.status='published') as published_schools
from public.event_dates d left join public.parade_lineup l on l.event_date_id=d.id
where d.event_date between '2027-02-05' and '2027-02-13'
group by d.event_date order by d.event_date;
