-- ============================================================
-- Workout Tracker - Initial Schema
-- ============================================================

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Profiles
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_user_id_idx on profiles(user_id);

-- ============================================================
-- Exercises (種目マスター)
-- ============================================================
create table if not exists exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_muscles text[] not null default '{}',
  exercise_type text not null default 'other'
    check (exercise_type in ('barbell','dumbbell','machine','cable','bodyweight','other')),
  weight_type text not null default 'total'
    check (weight_type in ('total','per_hand','machine_display','bodyweight')),
  small_weight_step numeric(6,2) not null default 2.5,
  large_weight_step numeric(6,2) not null default 5.0,
  default_rest_seconds integer not null default 90,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercises_user_id_idx on exercises(user_id);
create unique index if not exists exercises_user_name_idx on exercises(user_id, name) where deleted_at is null;

-- ============================================================
-- Exercise Aliases
-- ============================================================
create table if not exists exercise_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exercise_aliases_exercise_id_idx on exercise_aliases(exercise_id);
create index if not exists exercise_aliases_user_id_idx on exercise_aliases(user_id);
create unique index if not exists exercise_aliases_user_alias_idx on exercise_aliases(user_id, lower(alias));

-- ============================================================
-- Workout Plans (取り込んだメニュー)
-- ============================================================
create table if not exists workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text not null,
  raw_text text not null default '',
  status text not null default 'active'
    check (status in ('active','archived','deleted')),
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_plans_user_id_date_idx on workout_plans(user_id, date desc);

-- ============================================================
-- Workout Plan Exercises
-- ============================================================
create table if not exists workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references workout_plans(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name text not null,
  sets integer not null default 1,
  reps_min integer not null default 1,
  reps_max integer not null default 1,
  rest_seconds integer not null default 90,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wpe_plan_id_idx on workout_plan_exercises(plan_id);
create index if not exists wpe_user_id_idx on workout_plan_exercises(user_id);

-- ============================================================
-- Workout Sessions (実施したトレーニング)
-- ============================================================
create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references workout_plans(id) on delete set null,
  date date not null,
  title text not null,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','completed','abandoned')),
  started_at timestamptz,
  completed_at timestamptz,
  body_condition smallint check (body_condition between 1 and 5),
  fatigue_level smallint check (fatigue_level between 1 and 5),
  pain text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_sessions_user_id_date_idx on workout_sessions(user_id, date desc);
create index if not exists workout_sessions_user_id_status_idx on workout_sessions(user_id, status);

-- ============================================================
-- Workout Session Exercises
-- ============================================================
create table if not exists workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references workout_sessions(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name text not null,
  planned_sets integer not null default 1,
  planned_reps_min integer not null default 1,
  planned_reps_max integer not null default 1,
  rest_seconds integer not null default 90,
  sort_order integer not null default 0,
  skipped boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wse_session_id_idx on workout_session_exercises(session_id);
create index if not exists wse_user_id_idx on workout_session_exercises(user_id);
create index if not exists wse_exercise_id_idx on workout_session_exercises(exercise_id);

-- ============================================================
-- Workout Sets
-- ============================================================
create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_exercise_id uuid not null references workout_session_exercises(id) on delete cascade,
  session_id uuid not null references workout_sessions(id) on delete cascade,
  set_number integer not null,
  weight numeric(8,2) not null default 0,
  reps integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending','completed','skipped')),
  completed_at timestamptz,
  notes text,
  -- Idempotency key to prevent duplicate saves
  client_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ws_session_exercise_id_idx on workout_sets(session_exercise_id);
create index if not exists ws_session_id_idx on workout_sets(session_id);
create index if not exists ws_user_id_idx on workout_sets(user_id);
-- Prevent duplicate sets for same exercise + set_number
create unique index if not exists ws_session_exercise_set_number_idx
  on workout_sets(session_exercise_id, set_number);
-- Prevent duplicate client IDs (idempotency)
create unique index if not exists ws_client_id_idx on workout_sets(client_id);

-- ============================================================
-- Rest Timers
-- ============================================================
create table if not exists rest_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references workout_sessions(id) on delete cascade,
  session_exercise_id uuid not null references workout_session_exercises(id) on delete cascade,
  trigger_set_id uuid not null references workout_sets(id) on delete cascade,
  next_set_number integer not null,
  duration_seconds integer not null,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'running'
    check (status in ('running','paused','finished','cancelled')),
  adjustment_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rt_session_id_idx on rest_timers(session_id);
create index if not exists rt_user_id_idx on rest_timers(user_id);
-- Only one running timer per session
create unique index if not exists rt_session_running_idx
  on rest_timers(session_id) where status = 'running';

-- ============================================================
-- User Settings
-- ============================================================
create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sound_enabled boolean not null default true,
  vibration_enabled boolean not null default true,
  browser_notification_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_settings_user_id_idx on user_settings(user_id);

-- ============================================================
-- Updated at trigger
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger profiles_updated_at
  before update on profiles for each row execute function update_updated_at();
create or replace trigger exercises_updated_at
  before update on exercises for each row execute function update_updated_at();
create or replace trigger exercise_aliases_updated_at
  before update on exercise_aliases for each row execute function update_updated_at();
create or replace trigger workout_plans_updated_at
  before update on workout_plans for each row execute function update_updated_at();
create or replace trigger workout_plan_exercises_updated_at
  before update on workout_plan_exercises for each row execute function update_updated_at();
create or replace trigger workout_sessions_updated_at
  before update on workout_sessions for each row execute function update_updated_at();
create or replace trigger workout_session_exercises_updated_at
  before update on workout_session_exercises for each row execute function update_updated_at();
create or replace trigger workout_sets_updated_at
  before update on workout_sets for each row execute function update_updated_at();
create or replace trigger rest_timers_updated_at
  before update on rest_timers for each row execute function update_updated_at();
create or replace trigger user_settings_updated_at
  before update on user_settings for each row execute function update_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table exercises enable row level security;
alter table exercise_aliases enable row level security;
alter table workout_plans enable row level security;
alter table workout_plan_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_session_exercises enable row level security;
alter table workout_sets enable row level security;
alter table rest_timers enable row level security;
alter table user_settings enable row level security;

-- Profiles
create policy "profiles_select_own" on profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = user_id);

-- Exercises
create policy "exercises_select_own" on exercises for select using (auth.uid() = user_id);
create policy "exercises_insert_own" on exercises for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on exercises for update using (auth.uid() = user_id);
create policy "exercises_delete_own" on exercises for delete using (auth.uid() = user_id);

-- Exercise Aliases
create policy "aliases_select_own" on exercise_aliases for select using (auth.uid() = user_id);
create policy "aliases_insert_own" on exercise_aliases for insert with check (auth.uid() = user_id);
create policy "aliases_update_own" on exercise_aliases for update using (auth.uid() = user_id);
create policy "aliases_delete_own" on exercise_aliases for delete using (auth.uid() = user_id);

-- Workout Plans
create policy "plans_select_own" on workout_plans for select using (auth.uid() = user_id);
create policy "plans_insert_own" on workout_plans for insert with check (auth.uid() = user_id);
create policy "plans_update_own" on workout_plans for update using (auth.uid() = user_id);
create policy "plans_delete_own" on workout_plans for delete using (auth.uid() = user_id);

-- Workout Plan Exercises
create policy "plan_exercises_select_own" on workout_plan_exercises for select using (auth.uid() = user_id);
create policy "plan_exercises_insert_own" on workout_plan_exercises for insert with check (auth.uid() = user_id);
create policy "plan_exercises_update_own" on workout_plan_exercises for update using (auth.uid() = user_id);
create policy "plan_exercises_delete_own" on workout_plan_exercises for delete using (auth.uid() = user_id);

-- Workout Sessions
create policy "sessions_select_own" on workout_sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own" on workout_sessions for insert with check (auth.uid() = user_id);
create policy "sessions_update_own" on workout_sessions for update using (auth.uid() = user_id);
create policy "sessions_delete_own" on workout_sessions for delete using (auth.uid() = user_id);

-- Workout Session Exercises
create policy "session_exercises_select_own" on workout_session_exercises for select using (auth.uid() = user_id);
create policy "session_exercises_insert_own" on workout_session_exercises for insert with check (auth.uid() = user_id);
create policy "session_exercises_update_own" on workout_session_exercises for update using (auth.uid() = user_id);
create policy "session_exercises_delete_own" on workout_session_exercises for delete using (auth.uid() = user_id);

-- Workout Sets
create policy "sets_select_own" on workout_sets for select using (auth.uid() = user_id);
create policy "sets_insert_own" on workout_sets for insert with check (auth.uid() = user_id);
create policy "sets_update_own" on workout_sets for update using (auth.uid() = user_id);
create policy "sets_delete_own" on workout_sets for delete using (auth.uid() = user_id);

-- Rest Timers
create policy "timers_select_own" on rest_timers for select using (auth.uid() = user_id);
create policy "timers_insert_own" on rest_timers for insert with check (auth.uid() = user_id);
create policy "timers_update_own" on rest_timers for update using (auth.uid() = user_id);
create policy "timers_delete_own" on rest_timers for delete using (auth.uid() = user_id);

-- User Settings
create policy "settings_select_own" on user_settings for select using (auth.uid() = user_id);
create policy "settings_insert_own" on user_settings for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on user_settings for update using (auth.uid() = user_id);

-- ============================================================
-- Auto-create profile & settings on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, user_id, email)
  values (new.id, new.id, new.email)
  on conflict (id) do nothing;

  insert into user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();
