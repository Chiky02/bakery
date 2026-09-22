-- Varios productos en una sola tanda. Si uno falla (insumo insuficiente, etc.) no se guarda ninguno.

CREATE OR REPLACE FUNCTION public.registrar_produccion_lote(
  p_items JSONB,
  p_notas TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line JSONB;
  v_id TEXT;
  v_qty NUMERIC;
  v_count INTEGER := 0;
  v_seen TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agrega al menos un producto';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Máximo 50 productos por tanda';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_id := v_line->>'producto_id';
    v_qty := (v_line->>'cantidad')::numeric;
    IF v_id IS NULL OR v_id = '' THEN
      RAISE EXCEPTION 'Producto inválido';
    END IF;
    IF v_id = ANY (v_seen) THEN
      RAISE EXCEPTION 'No repitas el mismo producto en la tanda';
    END IF;
    v_seen := v_seen || v_id;
    PERFORM public.registrar_produccion(v_id::uuid, v_qty, p_notas);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_produccion_lote(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_produccion_lote(JSONB, TEXT) TO authenticated;
