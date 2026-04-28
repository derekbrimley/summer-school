-- WonderPath V1 Schema

create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int not null,
  created_at timestamptz not null default now()
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  parent_topic uuid references topics(id),
  source text not null check (source in ('seed', 'ai_suggested', 'parent_added', 'child_requested')),
  created_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references topics(id),
  profile_id uuid not null references profiles(id),
  status text not null default 'generating' check (status in ('generating', 'ready', 'approved', 'viewed')),
  lesson_json jsonb,
  pdf_url text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  viewed_at timestamptz
);

create table explorations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  lesson_id uuid not null references lessons(id),
  topic_id uuid not null references topics(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table annotations (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id),
  profile_id uuid not null references profiles(id),
  page_number int not null,
  stroke_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table drawings (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  topic_id uuid not null references topics(id),
  lesson_id uuid references lessons(id),
  image_url text not null,
  prompt text not null,
  created_at timestamptz not null default now()
);

create table reflections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  lesson_id uuid not null references lessons(id),
  audio_url text not null,
  duration_sec int,
  created_at timestamptz not null default now()
);

create table photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  topic_id uuid references topics(id),
  image_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id),
  profile_id uuid not null references profiles(id),
  messages jsonb not null default '[]'::jsonb,
  question_count int not null default 0,
  created_at timestamptz not null default now()
);

create table topic_connections (
  id uuid primary key default gen_random_uuid(),
  from_topic uuid not null references topics(id),
  to_topic uuid not null references topics(id),
  label text
);

-- Seed the two child profiles
insert into profiles (name, age) values
  ('Sylvie', 7),
  ('Holland', 4);

-- Seed 10 starter topics
insert into topics (title, description, source) values
  ('Volcanoes', 'Mountains that explode with hot melted rock!', 'seed'),
  ('Dinosaurs', 'Giant creatures that lived millions of years ago.', 'seed'),
  ('The Ocean', 'A whole world of animals and plants lives underwater.', 'seed'),
  ('Outer Space', 'Stars, planets, and everything beyond our sky.', 'seed'),
  ('Bugs and Insects', 'Tiny creatures with superpowers — some can carry 50 times their own weight!', 'seed'),
  ('Weather', 'What makes it rain, snow, and thunder?', 'seed'),
  ('How Buildings Are Made', 'From mud huts to skyscrapers — how do people build things?', 'seed'),
  ('Music', 'What makes sounds into music? How do instruments work?', 'seed'),
  ('Animals of Utah', 'The creatures that live right here in our backyard and mountains.', 'seed'),
  ('The Human Body', 'What''s happening inside you right now?', 'seed');

-- Storage buckets are created via Supabase dashboard or CLI:
-- lessons/, drawings/, reflections/, photos/
