-- Migration: Seed required PVC calculator settings
-- Purpose: Prevent runtime 400 errors when pvc_calculator_settings is empty

-- Create a minimal key/value settings table only if it does not already exist.
-- If your project already has pvc_calculator_settings with a different schema,
-- this CREATE TABLE IF NOT EXISTS statement is ignored.
CREATE TABLE IF NOT EXISTS public.pvc_calculator_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
DECLARE
    settings_table_exists BOOLEAN;
    key_col TEXT;
    value_col TEXT;
    setting_record RECORD;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pvc_calculator_settings'
    )
    INTO settings_table_exists;

    IF NOT settings_table_exists THEN
        RAISE EXCEPTION 'Table public.pvc_calculator_settings does not exist.';
    END IF;

    -- Detect key column from common variants
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

    -- Detect value column from common variants
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
        RAISE NOTICE 'Could not detect key/value columns in public.pvc_calculator_settings. Please seed settings manually for your schema.';
        RETURN;
    END IF;

    FOR setting_record IN
        SELECT * FROM (
            VALUES
                ('strip_loading_waste_percent', '5'),
                ('labour_minutes_per_strip', '2'),
                ('ribbed_minutes_per_strip', '1'),
                ('minutes_per_headrail', '12.5'),
                ('labour_rate_per_hour', '30'),
                ('markup_percent', '130'),
                ('markup_multiplier', '2.14'),
                ('roll_length_m', '50'),
                ('door_cover_mm', '50'),
                ('height_adjust_mm', '40'),
                ('headrail_allowance_mm', '50'),
                ('margin_percent', '30'),
                ('waste_percent', '5'),
                ('strip_allowance_mm', '100'),
                ('brackets_per_strip', '1'),
                ('packaging_quantity', '1'),
                ('rivets_per_strip_100', '2'),
                ('rivets_per_strip_150', '3'),
                ('rivets_per_strip_200', '4'),
                ('rivets_per_strip_300', '5'),
                ('labour_factor', '1')
        ) AS v(setting_key, setting_value)
    LOOP
        BEGIN
            EXECUTE format(
                'INSERT INTO public.pvc_calculator_settings (%I, %I) VALUES ($1, $2)',
                key_col,
                value_col
            )
            USING setting_record.setting_key, setting_record.setting_value;
        EXCEPTION
            WHEN unique_violation THEN
                EXECUTE format(
                    'UPDATE public.pvc_calculator_settings SET %I = $2 WHERE %I = $1',
                    value_col,
                    key_col
                )
                USING setting_record.setting_key, setting_record.setting_value;
            WHEN undefined_column THEN
                RAISE NOTICE 'Detected columns changed during migration execution. Please run migration again.';
                RETURN;
        END;
    END LOOP;

    RAISE NOTICE 'PVC calculator settings seeded successfully.';
END $$;
