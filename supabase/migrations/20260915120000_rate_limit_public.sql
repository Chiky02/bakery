-- Rate limit compartido (anti-abuso endpoints públicos QR / encargos)

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_window
  ON rate_limit_buckets (window_start);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_key IS NULL OR length(p_key) < 3 OR length(p_key) > 200 THEN
    RETURN false;
  END IF;
  IF p_max IS NULL OR p_max < 1 THEN
    RETURN false;
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    p_window_seconds := 60;
  END IF;

  -- Limpieza ocasional de ventanas viejas
  IF random() < 0.02 THEN
    DELETE FROM rate_limit_buckets
    WHERE window_start < v_now - interval '2 hours';
  END IF;

  INSERT INTO rate_limit_buckets AS b (key, count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN b.window_start < v_now - make_interval(secs => p_window_seconds) THEN 1
      ELSE b.count + 1
    END,
    window_start = CASE
      WHEN b.window_start < v_now - make_interval(secs => p_window_seconds) THEN v_now
      ELSE b.window_start
    END
  RETURNING b.count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
-- Sin policies: nadie vía PostgREST; solo la RPC SECURITY DEFINER.
