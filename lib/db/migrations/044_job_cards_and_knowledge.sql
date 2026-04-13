-- Job cards (field execution + GPS) and internal knowledge base.
-- Apply in Supabase SQL editor in order after 043.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.job_card_status AS ENUM ('pending', 'in_progress', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- job_cards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.calendar_events (id) ON DELETE SET NULL,
  technician_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.client_locations (id) ON DELETE SET NULL,
  job_title TEXT NOT NULL,
  job_description TEXT,
  work_type TEXT,
  status public.job_card_status NOT NULL DEFAULT 'pending',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  gps_start JSONB,
  gps_end JSONB,
  gps_start_address TEXT,
  gps_end_address TEXT,
  notes TEXT,
  signature_url TEXT,
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_cards_manual_requires_no_event CHECK (
    is_manual = false OR event_id IS NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_cards_one_per_event
  ON public.job_cards (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_cards_technician ON public.job_cards (technician_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON public.job_cards (status);
CREATE INDEX IF NOT EXISTS idx_job_cards_updated ON public.job_cards (updated_at DESC);

COMMENT ON TABLE public.job_cards IS 'Technician job execution record; links to calendar event when dispatched from schedule.';
COMMENT ON COLUMN public.job_cards.is_manual IS 'True when created outside calendar (client/location editable).';
COMMENT ON COLUMN public.job_cards.work_type IS 'Optional label for knowledge-base matching.';

CREATE OR REPLACE FUNCTION public.touch_job_cards_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_cards_updated_at ON public.job_cards;
CREATE TRIGGER trg_job_cards_updated_at
  BEFORE UPDATE ON public.job_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_job_cards_updated_at();

-- ---------------------------------------------------------------------------
-- job_card_images
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_card_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id UUID NOT NULL REFERENCES public.job_cards (id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_card_images_job ON public.job_card_images (job_card_id);

-- ---------------------------------------------------------------------------
-- knowledge_articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General',
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(content, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON public.knowledge_articles (category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tags ON public.knowledge_articles USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_search ON public.knowledge_articles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_updated ON public.knowledge_articles (updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_knowledge_articles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_knowledge_articles_updated_at ON public.knowledge_articles;
CREATE TRIGGER trg_knowledge_articles_updated_at
  BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_knowledge_articles_updated_at();

-- ---------------------------------------------------------------------------
-- knowledge_media
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.knowledge_articles (id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'image',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT knowledge_media_type_check CHECK (type IN ('image', 'video', 'pdf', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_knowledge_media_article ON public.knowledge_media (article_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_media ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.job_cards FROM PUBLIC;
REVOKE ALL ON public.job_card_images FROM PUBLIC;
REVOKE ALL ON public.knowledge_articles FROM PUBLIC;
REVOKE ALL ON public.knowledge_media FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_card_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_articles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_media TO authenticated;

-- job_cards
DROP POLICY IF EXISTS "job_cards_select" ON public.job_cards;
CREATE POLICY "job_cards_select"
  ON public.job_cards FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "job_cards_insert" ON public.job_cards;
CREATE POLICY "job_cards_insert"
  ON public.job_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    technician_id = auth.uid()
    OR public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "job_cards_update" ON public.job_cards;
CREATE POLICY "job_cards_update"
  ON public.job_cards FOR UPDATE
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR public.is_manager_or_admin()
  )
  WITH CHECK (
    technician_id = auth.uid()
    OR public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "job_cards_delete" ON public.job_cards;
CREATE POLICY "job_cards_delete"
  ON public.job_cards FOR DELETE
  TO authenticated
  USING (public.is_manager_or_admin());

-- job_card_images (via parent job_cards row access)
DROP POLICY IF EXISTS "job_card_images_select" ON public.job_card_images;
CREATE POLICY "job_card_images_select"
  ON public.job_card_images FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_images.job_card_id
        AND (j.technician_id = auth.uid() OR public.is_manager_or_admin())
    )
  );

DROP POLICY IF EXISTS "job_card_images_insert" ON public.job_card_images;
CREATE POLICY "job_card_images_insert"
  ON public.job_card_images FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_images.job_card_id
        AND (j.technician_id = auth.uid() OR public.is_manager_or_admin())
    )
  );

DROP POLICY IF EXISTS "job_card_images_delete" ON public.job_card_images;
CREATE POLICY "job_card_images_delete"
  ON public.job_card_images FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.job_cards j
      WHERE j.id = job_card_images.job_card_id
        AND (j.technician_id = auth.uid() OR public.is_manager_or_admin())
    )
  );

-- knowledge (internal technicians)
DROP POLICY IF EXISTS "knowledge_articles_select" ON public.knowledge_articles;
CREATE POLICY "knowledge_articles_select"
  ON public.knowledge_articles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "knowledge_articles_insert" ON public.knowledge_articles;
CREATE POLICY "knowledge_articles_insert"
  ON public.knowledge_articles FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "knowledge_articles_update" ON public.knowledge_articles;
CREATE POLICY "knowledge_articles_update"
  ON public.knowledge_articles FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_manager_or_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_manager_or_admin());

DROP POLICY IF EXISTS "knowledge_articles_delete" ON public.knowledge_articles;
CREATE POLICY "knowledge_articles_delete"
  ON public.knowledge_articles FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.is_manager_or_admin());

DROP POLICY IF EXISTS "knowledge_media_all" ON public.knowledge_media;

DROP POLICY IF EXISTS "knowledge_media_select" ON public.knowledge_media;
CREATE POLICY "knowledge_media_select"
  ON public.knowledge_media FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "knowledge_media_insert" ON public.knowledge_media;
CREATE POLICY "knowledge_media_insert"
  ON public.knowledge_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.knowledge_articles a
      WHERE a.id = knowledge_media.article_id
        AND (a.created_by = auth.uid() OR public.is_manager_or_admin())
    )
  );

DROP POLICY IF EXISTS "knowledge_media_update" ON public.knowledge_media;
CREATE POLICY "knowledge_media_update"
  ON public.knowledge_media FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_articles a
      WHERE a.id = knowledge_media.article_id
        AND (a.created_by = auth.uid() OR public.is_manager_or_admin())
    )
  );

DROP POLICY IF EXISTS "knowledge_media_delete" ON public.knowledge_media;
CREATE POLICY "knowledge_media_delete"
  ON public.knowledge_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_articles a
      WHERE a.id = knowledge_media.article_id
        AND (a.created_by = auth.uid() OR public.is_manager_or_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- Storage bucket (private; uploads via API + service role)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-card-images',
  'job-card-images',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-media',
  'knowledge-media',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
