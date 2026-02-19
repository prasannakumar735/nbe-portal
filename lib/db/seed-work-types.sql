-- Seed Data for Work Types
-- Exact structure from NBE Australia Application screenshot

-- ============================================
-- FABRICATION (FAB) - All Billable
-- ============================================
INSERT INTO work_types (level1_id, level1_description, level2_id, level2_description, billable_flag, is_leave_type) VALUES
('FAB', 'Fabrication', 'FRM', 'Frame', TRUE, FALSE),
('FAB', 'Fabrication', 'CUR', 'Curtain', TRUE, FALSE),
('FAB', 'Fabrication', 'PVC', 'PVC Strip', TRUE, FALSE),
('FAB', 'Fabrication', 'ELC', 'Electrical / Control Box', TRUE, FALSE),
('FAB', 'Fabrication', 'RPR', 'Repair Preparation', TRUE, FALSE),
('FAB', 'Fabrication', 'DRF', 'Drafting & Modelling', TRUE, FALSE);

-- ============================================
-- SITE OPERATIONS (OPS) - Mixed Billable
-- ============================================
INSERT INTO work_types (level1_id, level1_description, level2_id, level2_description, billable_flag, is_leave_type) VALUES
('OPS', 'Site Operations', 'INS', 'Installation', TRUE, FALSE),
('OPS', 'Site Operations', 'SRV', 'Service / Maintenance', TRUE, FALSE),
('OPS', 'Site Operations', 'SRW', 'Warranty Service', FALSE, FALSE),
('OPS', 'Site Operations', 'REP', 'Repair', TRUE, FALSE),
('OPS', 'Site Operations', 'DEL', 'Delivery', TRUE, FALSE),
('OPS', 'Site Operations', 'IND', 'Site Induction', TRUE, FALSE),
('OPS', 'Site Operations', 'TRV', 'Travelling', TRUE, FALSE);

-- ============================================
-- BUSINESS DEVELOPMENT (BDV) - Mostly Non-Billable
-- ============================================
INSERT INTO work_types (level1_id, level1_description, level2_id, level2_description, billable_flag, is_leave_type) VALUES
('BDV', 'Business Development', 'QTE', 'Quoting / Estimating', FALSE, FALSE),
('BDV', 'Business Development', 'CLM', 'Client Meeting', FALSE, FALSE),
('BDV', 'Business Development', 'RFP', 'Proposal / Tender', FALSE, FALSE),
('BDV', 'Business Development', 'TRV', 'Travelling', FALSE, FALSE);

-- ============================================
-- ADMINISTRATION (ADM) - All Non-Billable
-- ============================================
INSERT INTO work_types (level1_id, level1_description, level2_id, level2_description, billable_flag, is_leave_type) VALUES
('ADM', 'Administration', 'GEN', 'Emails, filing, internal coordination', FALSE, FALSE),
('ADM', 'Administration', 'ACC', 'Finance, process, payroll support', FALSE, FALSE),
('ADM', 'Administration', 'HR', 'Hiring, onboarding, reviews', FALSE, FALSE),
('ADM', 'Administration', 'INT', 'Internal Meetings, Coordination', FALSE, FALSE),
('ADM', 'Administration', 'CMP', 'Compliance / QA', FALSE, FALSE),
('ADM', 'Administration', 'PRC', 'Procurement', FALSE, FALSE),
('ADM', 'Administration', 'ITS', 'IT / Systems', FALSE, FALSE),
('ADM', 'Administration', 'TRN', 'Training', FALSE, FALSE);

-- ============================================
-- RESEARCH & DEVELOPMENT (RND) - All Non-Billable
-- ============================================
INSERT INTO work_types (level1_id, level1_description, level2_id, level2_description, billable_flag, is_leave_type) VALUES
('RND', 'Research & Development', 'DIG', 'Digital (Web / App Development)', FALSE, FALSE),
('RND', 'Research & Development', 'PDT', 'Product Development', FALSE, FALSE),
('RND', 'Research & Development', 'INN', 'Innovation & Concepts', FALSE, FALSE);

-- ============================================
-- LEAVE & HOLIDAYS (LVH) - All Non-Billable Leave Types
-- ============================================
INSERT INTO work_types (level1_id, level1_description, level2_id, level2_description, billable_flag, is_leave_type) VALUES
('LVH', 'Leave & Holidays', 'PHL', 'Public Holiday', FALSE, TRUE),
('LVH', 'Leave & Holidays', 'ALV', 'Annual Leave', FALSE, TRUE),
('LVH', 'Leave & Holidays', 'SLV', 'Sick Leave', FALSE, TRUE),
('LVH', 'Leave & Holidays', 'PLV', 'Personal Leave', FALSE, TRUE);
