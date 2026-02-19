-- Sample Project/Client Data for Testing
-- Run after schema setup

-- ============================================
-- SAMPLE PROJECTS
-- ============================================

-- Client: ABC Manufacturing
INSERT INTO projects (project_code, project_name, client_name, door_id, status, budget_hours, start_date, end_date) VALUES
('ABC-001', 'Warehouse Door Installation', 'ABC Manufacturing', 'DR-2024-001', 'active', 120.00, '2026-01-15', '2026-03-30'),
('ABC-002', 'Loading Dock Upgrade', 'ABC Manufacturing', 'DR-2024-002', 'active', 80.00, '2026-02-01', '2026-04-15');

-- Client: XYZ Logistics
INSERT INTO projects (project_code, project_name, client_name, door_id, status, budget_hours, start_date, end_date) VALUES
('XYZ-001', 'Distribution Center - Phase 1', 'XYZ Logistics', 'DR-2024-003', 'active', 200.00, '2026-01-20', '2026-05-30'),
('XYZ-002', 'Maintenance Service Contract', 'XYZ Logistics', NULL, 'active', 50.00, '2026-01-01', '2026-12-31');

-- Client: Premier Retail Group
INSERT INTO projects (project_code, project_name, client_name, door_id, status, budget_hours, start_date, end_date) VALUES
('PRG-001', 'Store Front High-Speed Doors', 'Premier Retail Group', 'DR-2024-004', 'active', 60.00, '2026-02-10', '2026-03-15'),
('PRG-002', 'Cold Storage Door Replacement', 'Premier Retail Group', 'DR-2024-005', 'active', 90.00, '2026-02-15', '2026-04-30');

-- Client: Global Foods Inc
INSERT INTO projects (project_code, project_name, client_name, door_id, status, budget_hours, start_date, end_date) VALUES
('GFI-001', 'Freezer Room Doors - Sydney', 'Global Foods Inc', 'DR-2024-006', 'active', 150.00, '2026-01-25', '2026-04-20'),
('GFI-002', 'Hygiene Door System', 'Global Foods Inc', 'DR-2024-007', 'active', 75.00, '2026-02-20', '2026-03-31');

-- Client: Metro Hospital
INSERT INTO projects (project_code, project_name, client_name, door_id, status, budget_hours, start_date, end_date) VALUES
('MH-001', 'Emergency Room Automatic Doors', 'Metro Hospital', 'DR-2024-008', 'active', 100.00, '2026-02-05', '2026-04-10'),
('MH-002', 'Operating Theater Clean Room Doors', 'Metro Hospital', 'DR-2024-009', 'active', 180.00, '2026-03-01', '2026-06-15');

-- Client: Industrial Park Ltd
INSERT INTO projects (project_code, project_name, client_name, door_id, status, budget_hours, start_date, end_date) VALUES
('IPL-001', 'Factory Entry Gates', 'Industrial Park Ltd', 'DR-2024-010', 'active', 110.00, '2026-01-30', '2026-03-25');

-- Completed projects (for historical data)
INSERT INTO projects (project_code, project_name, client_name, door_id, status, budget_hours, start_date, end_date) VALUES
('ABC-2023', 'Office Door Replacement', 'ABC Manufacturing', 'DR-2023-050', 'completed', 40.00, '2025-11-01', '2025-12-15'),
('XYZ-2023', 'Security Door Installation', 'XYZ Logistics', 'DR-2023-051', 'completed', 65.00, '2025-10-15', '2025-11-30');

-- ============================================
-- SAMPLE USER ROLES (Update with actual user IDs after authentication)
-- ============================================

-- Example: Assign roles (replace UUIDs with actual Supabase auth.users IDs)
-- INSERT INTO user_roles (user_id, role) VALUES
-- ('uuid-of-admin-user', 'admin'),
-- ('uuid-of-manager-user', 'manager'),
-- ('uuid-of-staff-user-1', 'staff'),
-- ('uuid-of-staff-user-2', 'staff'),
-- ('uuid-of-accountant-user', 'accountant');

-- ============================================
-- SAMPLE MANAGER ASSIGNMENTS
-- ============================================

-- Example: Assign staff to managers (replace UUIDs)
-- INSERT INTO manager_assignments (manager_id, employee_id) VALUES
-- ('uuid-of-manager', 'uuid-of-staff-1'),
-- ('uuid-of-manager', 'uuid-of-staff-2'),
-- ('uuid-of-manager', 'uuid-of-staff-3');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Count projects by status
SELECT status, COUNT(*) as count 
FROM projects 
GROUP BY status;

-- List all clients with project count
SELECT client_name, COUNT(*) as project_count, SUM(budget_hours) as total_budget_hours
FROM projects 
GROUP BY client_name 
ORDER BY project_count DESC;

-- Active projects summary
SELECT 
    project_code,
    project_name,
    client_name,
    budget_hours,
    start_date,
    end_date
FROM projects 
WHERE status = 'active'
ORDER BY start_date;
