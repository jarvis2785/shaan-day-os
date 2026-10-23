-- DayOS database schema — idempotent, safe to re-run
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ============================================================
-- 1. profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT '',
  settings   JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_select ON profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_insert' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_insert ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_update ON profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 2. day_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS day_plans (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date  DATE NOT NULL,
  plan       JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, plan_date)
);

ALTER TABLE day_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'day_plans_select' AND tablename = 'day_plans') THEN
    CREATE POLICY day_plans_select ON day_plans FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'day_plans_insert' AND tablename = 'day_plans') THEN
    CREATE POLICY day_plans_insert ON day_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'day_plans_update' AND tablename = 'day_plans') THEN
    CREATE POLICY day_plans_update ON day_plans FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'day_plans_delete' AND tablename = 'day_plans') THEN
    CREATE POLICY day_plans_delete ON day_plans FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 3. task_queues
-- ============================================================
CREATE TABLE IF NOT EXISTS task_queues (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('deferred', 'planned')),
  queue_date DATE NOT NULL,
  tasks      JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, kind, queue_date)
);

ALTER TABLE task_queues ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task_queues_select' AND tablename = 'task_queues') THEN
    CREATE POLICY task_queues_select ON task_queues FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task_queues_insert' AND tablename = 'task_queues') THEN
    CREATE POLICY task_queues_insert ON task_queues FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task_queues_update' AND tablename = 'task_queues') THEN
    CREATE POLICY task_queues_update ON task_queues FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'task_queues_delete' AND tablename = 'task_queues') THEN
    CREATE POLICY task_queues_delete ON task_queues FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 4. ai_usage (per-user daily counters)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date     DATE NOT NULL,
  analyze_count  INT DEFAULT 0,
  estimate_count INT DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_usage_select' AND tablename = 'ai_usage') THEN
    CREATE POLICY ai_usage_select ON ai_usage FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 5. ai_usage_global (daily totals — no client RLS policies)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_usage_global (
  usage_date  DATE PRIMARY KEY,
  total_count INT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_usage_global ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. app_config (limits — no client RLS policies)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

INSERT INTO app_config (key, value)
VALUES
  ('user_daily_limit', '{"analyze": 15, "estimate": 40}'::jsonb),
  ('global_daily_limit', '{"total": 300}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================
-- 7. consume_ai_call — atomic rate-limit check + increment
-- ============================================================
CREATE OR REPLACE FUNCTION consume_ai_call(p_kind TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_today        DATE;
  v_user_count   INT;
  v_user_limit   INT;
  v_global_count INT;
  v_global_limit INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_kind NOT IN ('analyze', 'estimate') THEN
    RAISE EXCEPTION 'Invalid kind: %', p_kind;
  END IF;

  v_today   := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  -- user limit for this kind
  SELECT (value ->> p_kind)::int INTO v_user_limit
    FROM app_config WHERE key = 'user_daily_limit';
  IF v_user_limit IS NULL THEN v_user_limit := 20; END IF;

  -- global limit
  SELECT (value ->> 'total')::int INTO v_global_limit
    FROM app_config WHERE key = 'global_daily_limit';
  IF v_global_limit IS NULL THEN v_global_limit := 500; END IF;

  -- current user count
  IF p_kind = 'analyze' THEN
    SELECT COALESCE(analyze_count, 0) INTO v_user_count
      FROM ai_usage WHERE user_id = v_user_id AND usage_date = v_today;
  ELSE
    SELECT COALESCE(estimate_count, 0) INTO v_user_count
      FROM ai_usage WHERE user_id = v_user_id AND usage_date = v_today;
  END IF;
  IF v_user_count IS NULL THEN v_user_count := 0; END IF;

  IF v_user_count >= v_user_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_limit', 'limit', v_user_limit);
  END IF;

  -- current global count
  SELECT COALESCE(total_count, 0) INTO v_global_count
    FROM ai_usage_global WHERE usage_date = v_today;
  IF v_global_count IS NULL THEN v_global_count := 0; END IF;

  IF v_global_count >= v_global_limit THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'global_limit', 'limit', v_global_limit);
  END IF;

  -- increment user
  INSERT INTO ai_usage (user_id, usage_date, analyze_count, estimate_count)
  VALUES (
    v_user_id, v_today,
    CASE WHEN p_kind = 'analyze' THEN 1 ELSE 0 END,
    CASE WHEN p_kind = 'estimate' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE SET
    analyze_count  = ai_usage.analyze_count  + CASE WHEN p_kind = 'analyze'  THEN 1 ELSE 0 END,
    estimate_count = ai_usage.estimate_count + CASE WHEN p_kind = 'estimate' THEN 1 ELSE 0 END,
    updated_at = now();

  -- increment global
  INSERT INTO ai_usage_global (usage_date, total_count)
  VALUES (v_today, 1)
  ON CONFLICT (usage_date) DO UPDATE SET
    total_count = ai_usage_global.total_count + 1,
    updated_at  = now();

  RETURN jsonb_build_object('allowed', true, 'reason', NULL, 'limit', v_user_limit);
END;
$$;

REVOKE ALL ON FUNCTION consume_ai_call(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_ai_call(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION consume_ai_call(TEXT) TO authenticated;

-- ============================================================
-- 8. Trigger: create profile row on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
