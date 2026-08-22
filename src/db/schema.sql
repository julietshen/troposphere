create table if not exists label (
  seq        bigserial primary key,
  src        text not null,
  uri        text not null,
  cid        text,
  val        text not null,
  neg        boolean not null default false,
  cts        text not null,
  exp        text,
  sig        bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists label_uri_idx on label (uri);
create index if not exists label_src_idx on label (src);

create table if not exists report (
  id           bigserial primary key,
  reason_type  text not null,
  reason       text,
  subject_type text not null,
  subject_did  text,
  subject_uri  text,
  subject_cid  text,
  reported_by  text not null,
  created_at   timestamptz not null default now()
);

create index if not exists report_subject_did_idx on report (subject_did);
create index if not exists report_subject_uri_idx on report (subject_uri);
