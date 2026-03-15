-- Migration: ensure markup_multiplier exists for legacy Excel final quote calculation

DO $$
DECLARE
    key_col TEXT;
    value_col TEXT;
BEGIN
    SELECT c.column_name
    INTO key_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'pvc_calculator_settings'
      AND c.column_name IN ('setting_key', 'key', 'name', 'code')
    ORDER BY CASE c.column_name
        WHEN 'setting_key' THEN 1
        WHEN 'key' THEN 2
        WHEN 'name' THEN 3
        WHEN 'code' THEN 4
        ELSE 99
    END
    LIMIT 1;

    SELECT c.column_name
    INTO value_col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'pvc_calculator_settings'
      AND c.column_name IN ('setting_value', 'value', 'numeric_value', 'number_value', 'text_value')
    ORDER BY CASE c.column_name
        WHEN 'setting_value' THEN 1
        WHEN 'value' THEN 2
        WHEN 'numeric_value' THEN 3
        WHEN 'number_value' THEN 4
        WHEN 'text_value' THEN 5
        ELSE 99
    END
    LIMIT 1;

    IF key_col IS NULL OR value_col IS NULL THEN
        RAISE NOTICE 'Could not detect key/value columns in pvc_calculator_settings; skipping markup_multiplier seed.';
        RETURN;
    END IF;

    EXECUTE format(
        'INSERT INTO public.pvc_calculator_settings (%I, %I)
         VALUES ($1, $2)
         ON CONFLICT (%I)
         DO UPDATE SET %I = EXCLUDED.%I',
        key_col,
        value_col,
        key_col,
        value_col,
        value_col
    )
    USING 'markup_multiplier', '2.14';
END $$;
