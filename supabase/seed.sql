-- ============================================================
-- Seed data for development
-- Run after migration on a development Supabase project.
-- ============================================================

-- NOTE: Replace 'your-dev-user-id' with an actual user UUID
-- that you've signed up with in your development Supabase project.
-- You can find it in Authentication > Users in the Supabase dashboard.

do $$
declare
  dev_user_id uuid := '00000000-0000-0000-0000-000000000001'; -- replace with real user ID
  ex_bench uuid;
  ex_incline uuid;
  ex_lat uuid;
  ex_squat uuid;
  ex_deadlift uuid;
  plan_id uuid;
  wpe_bench uuid;
  wpe_incline uuid;
  wpe_lat uuid;
begin

  -- Only run if user exists (development guard)
  if not exists (select 1 from auth.users where id = dev_user_id) then
    raise notice 'Dev user not found. Skipping seed. Create a user first and update dev_user_id.';
    return;
  end if;

  -- Ensure profile and settings
  insert into profiles (id, user_id, email, display_name)
  values (dev_user_id, dev_user_id, 'dev@example.com', '開発ユーザー')
  on conflict (id) do nothing;

  insert into user_settings (user_id)
  values (dev_user_id)
  on conflict (user_id) do nothing;

  -- ---- Exercises ----
  insert into exercises (id, user_id, name, target_muscles, exercise_type, weight_type,
    small_weight_step, large_weight_step, default_rest_seconds)
  values
    (gen_random_uuid(), dev_user_id, 'ベンチプレス', array['胸','三角筋前部','上腕三頭筋'], 'barbell', 'total', 2.5, 5.0, 150),
    (gen_random_uuid(), dev_user_id, 'インクラインダンベルプレス', array['胸上部','三角筋前部'], 'dumbbell', 'per_hand', 2.0, 4.0, 120),
    (gen_random_uuid(), dev_user_id, 'ラットプルダウン', array['広背筋','上腕二頭筋'], 'machine', 'machine_display', 5.0, 10.0, 90),
    (gen_random_uuid(), dev_user_id, 'スクワット', array['大腿四頭筋','ハムストリングス','臀部'], 'barbell', 'total', 2.5, 5.0, 180),
    (gen_random_uuid(), dev_user_id, 'デッドリフト', array['広背筋','ハムストリングス','臀部'], 'barbell', 'total', 2.5, 5.0, 180)
  returning id into ex_bench;

  -- Re-select IDs
  select id into ex_bench from exercises where user_id = dev_user_id and name = 'ベンチプレス';
  select id into ex_incline from exercises where user_id = dev_user_id and name = 'インクラインダンベルプレス';
  select id into ex_lat from exercises where user_id = dev_user_id and name = 'ラットプルダウン';
  select id into ex_squat from exercises where user_id = dev_user_id and name = 'スクワット';

  -- ---- Aliases ----
  insert into exercise_aliases (user_id, exercise_id, alias) values
    (dev_user_id, ex_bench, 'ベンチ'),
    (dev_user_id, ex_bench, 'BP'),
    (dev_user_id, ex_incline, 'インクラインプレス'),
    (dev_user_id, ex_incline, 'DBプレス'),
    (dev_user_id, ex_lat, 'ラットプル'),
    (dev_user_id, ex_lat, 'ラットプルダウン'),
    (dev_user_id, ex_squat, 'スクワット'),
    (dev_user_id, ex_squat, 'SQ')
  on conflict do nothing;

  -- ---- Sample Workout Plan ----
  insert into workout_plans (id, user_id, date, title, raw_text)
  values (
    gen_random_uuid(),
    dev_user_id,
    current_date,
    '胸・背中',
    '[WORKOUT]
date: ' || to_char(current_date, 'YYYY-MM-DD') || '
title: 胸・背中
exercise: ベンチプレス | sets: 4 | reps: 6-8 | rest: 150 | note: 肩甲骨を寄せる
exercise: インクラインダンベルプレス | sets: 3 | reps: 8-10 | rest: 120
exercise: ラットプルダウン | sets: 3 | reps: 10-12 | rest: 90 | note: 腕で引かない
[/WORKOUT]'
  ) returning id into plan_id;

  -- ---- Plan Exercises ----
  insert into workout_plan_exercises (id, user_id, plan_id, exercise_id, exercise_name, sets, reps_min, reps_max, rest_seconds, sort_order, notes)
  values
    (gen_random_uuid(), dev_user_id, plan_id, ex_bench, 'ベンチプレス', 4, 6, 8, 150, 0, '肩甲骨を寄せる'),
    (gen_random_uuid(), dev_user_id, plan_id, ex_incline, 'インクラインダンベルプレス', 3, 8, 10, 120, 1, null),
    (gen_random_uuid(), dev_user_id, plan_id, ex_lat, 'ラットプルダウン', 3, 10, 12, 90, 2, '腕で引かない')
  returning id into wpe_bench;

  raise notice 'Seed data inserted successfully for plan_id: %', plan_id;
end $$;
