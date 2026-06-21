create table if not exists public.categories (
  key text primary key,
  label text not null,
  source_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.items (
  category_key text not null references public.categories(key) on update cascade on delete cascade,
  item_code text not null,
  name text not null default '',
  source text not null default '',
  size text not null default '',
  weight text not null default '',
  material text not null default '',
  remarks text not null default '',
  image_path text,
  legacy_image_url text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (category_key, item_code)
);

create table if not exists public.stock_records (
  id bigint generated always as identity primary key,
  category_key text not null,
  item_code text not null,
  record_type text not null check (record_type in ('in', 'out')),
  record_index integer not null default 0,
  date_label text not null default '',
  amount integer not null default 0 check (amount >= 0),
  cost numeric(12, 2),
  ref_sell_price numeric(12, 2),
  price numeric(12, 2),
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_key, item_code)
    references public.items(category_key, item_code)
    on update cascade
    on delete cascade,
  unique (category_key, item_code, record_type, record_index)
);

create index if not exists items_category_key_idx
  on public.items(category_key);

create index if not exists stock_records_item_idx
  on public.stock_records(category_key, item_code);

create index if not exists stock_records_type_idx
  on public.stock_records(record_type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
before update on public.items
for each row execute function public.set_updated_at();

drop trigger if exists stock_records_set_updated_at on public.stock_records;
create trigger stock_records_set_updated_at
before update on public.stock_records
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.stock_records enable row level security;

create or replace view public.item_inventory_summary as
select
  i.category_key,
  i.item_code,
  coalesce(sum(sr.amount) filter (where sr.record_type = 'in'), 0)::integer as total_in,
  coalesce(sum(sr.amount) filter (where sr.record_type = 'out'), 0)::integer as total_out,
  (
    coalesce(sum(sr.amount) filter (where sr.record_type = 'in'), 0)
    - coalesce(sum(sr.amount) filter (where sr.record_type = 'out'), 0)
  )::integer as in_stock,
  (
    select latest.ref_sell_price
    from public.stock_records latest
    where latest.category_key = i.category_key
      and latest.item_code = i.item_code
      and latest.record_type = 'in'
      and latest.ref_sell_price is not null
    order by latest.record_index desc
    limit 1
  ) as current_price
from public.items i
left join public.stock_records sr
  on sr.category_key = i.category_key
  and sr.item_code = i.item_code
group by i.category_key, i.item_code;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
