-- Migration: Add read policies for PVC calculator pricing tables
-- Purpose: Ensure authenticated portal users can read pricing/settings rows under RLS

DO $$
DECLARE
    current_table TEXT;
    policy_name TEXT;
    pvc_tables TEXT[] := ARRAY[
        'pvc_calculator_settings',
        'pvc_products',
        'pvc_strip_specs',
        'pvc_labour_rates',
        'pvc_fittings',
        'pvc_headrails',
        'pvc_brackets',
        'pvc_packaging'
    ];
BEGIN
    FOREACH current_table IN ARRAY pvc_tables LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = current_table
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', current_table);
            EXECUTE format('GRANT SELECT ON public.%I TO authenticated', current_table);

            policy_name := format('%s_authenticated_read', current_table);

            IF NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = current_table
                  AND policyname = policy_name
            ) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
                    policy_name,
                    current_table
                );
            END IF;
        END IF;
    END LOOP;
END $$;
