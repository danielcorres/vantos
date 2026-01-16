begin;

-- Si hay nombres duplicados, esto fallará.
-- Primero revisa/limpia duplicados (abajo te dejo query).
alter table public.pipeline_stages
  add constraint pipeline_stages_name_key unique (name);

commit;
