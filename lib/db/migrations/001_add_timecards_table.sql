-- Migration: Add timecards table for GPS-based clock-in/out feature
-- This table tracks employee clock-in and clock-out times with GPS coordinates

-- ============================================
-- TIMECARDS TABLE (GPS-based Clock In/Out)
-- ============================================
CREATE TABLE IF NOT EXISTS timecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    clock_out_time TIMESTAMP WITH TIME ZONE,
    clock_in_gps_lat DECIMAL(10, 8),
    clock_in_gps_lng DECIMAL(11, 8),
    clock_out_gps_lat DECIMAL(10, 8),
    clock_out_gps_lng DECIMAL(11, 8),
    gps_accuracy DECIMAL(10, 2),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_timecards_user ON timecards(user_id);
CREATE INDEX idx_timecards_clock_in ON timecards(clock_in_time);
CREATE INDEX idx_timecards_status ON timecards(status);
CREATE INDEX idx_timecards_user_date ON timecards(user_id, clock_in_time);

-- Trigger for auto-update timestamp
CREATE TRIGGER update_timecards_updated_at BEFORE UPDATE ON timecards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE timecards ENABLE ROW LEVEL SECURITY;

-- Users can view their own timecards
CREATE POLICY "Users can view own timecards" ON timecards
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own timecards
CREATE POLICY "Users can create own timecards" ON timecards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own timecards
CREATE POLICY "Users can update own timecards" ON timecards
    FOR UPDATE USING (auth.uid() = user_id);

-- Managers can view their team's timecards
CREATE POLICY "Managers can view team timecards" ON timecards
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM manager_assignments 
            WHERE manager_id = auth.uid() 
            AND employee_id = timecards.user_id
        )
    );

-- Admins can view all timecards
CREATE POLICY "Admins can view all timecards" ON timecards
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE timecards IS 'GPS-based clock-in/out tracking for employees';
COMMENT ON COLUMN timecards.clock_in_time IS 'Timestamp when employee clocked in';
COMMENT ON COLUMN timecards.clock_out_time IS 'Timestamp when employee clocked out (NULL if still active)';
COMMENT ON COLUMN timecards.clock_in_gps_lat IS 'GPS latitude coordinate at clock-in';
COMMENT ON COLUMN timecards.clock_in_gps_lng IS 'GPS longitude coordinate at clock-in';
COMMENT ON COLUMN timecards.clock_out_gps_lat IS 'GPS latitude coordinate at clock-out';
COMMENT ON COLUMN timecards.clock_out_gps_lng IS 'GPS longitude coordinate at clock-out';
COMMENT ON COLUMN timecards.gps_accuracy IS 'GPS accuracy in meters';
COMMENT ON COLUMN timecards.status IS 'Status: active (currently clocked in), completed (clocked out), cancelled (invalid entry)';
