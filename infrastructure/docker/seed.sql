-- =============================================================================
-- Viddhana Pool - Seed Data SQL
-- Run after init.sql to populate with sample data
-- =============================================================================

-- =============================================================================
-- USERS (22 users: 20 miners + 1 admin + 1 demo)
-- =============================================================================

INSERT INTO users (id, wallet_address, username, email, payout_threshold, payout_address, is_active, created_at, updated_at) VALUES
-- Admin user
('cm0admin00000000000000001', '0xADMIN000000000000000000000000000000000001', 'admin', 'admin@viddhana.io', 0.10, '0xADMIN000000000000000000000000000000000001', true, NOW() - INTERVAL '180 days', NOW()),
-- Demo user for testing
('cm0demo000000000000000001', '0xDEMO0000000000000000000000000000000000001', 'demo_user', 'demo@viddhana.io', 0.10, '0xDEMO0000000000000000000000000000000000001', true, NOW() - INTERVAL '90 days', NOW()),
-- Regular miners
('cm0user000000000000000001', '0x1234567890abcdef1234567890abcdef12345601', 'miner_001', 'miner1@viddhana.io', 0.15, '0x1234567890abcdef1234567890abcdef12345601', true, NOW() - INTERVAL '60 days', NOW()),
('cm0user000000000000000002', '0x1234567890abcdef1234567890abcdef12345602', 'miner_002', 'miner2@viddhana.io', 0.20, '0x1234567890abcdef1234567890abcdef12345602', true, NOW() - INTERVAL '55 days', NOW()),
('cm0user000000000000000003', '0x1234567890abcdef1234567890abcdef12345603', 'miner_003', 'miner3@viddhana.io', 0.25, '0x1234567890abcdef1234567890abcdef12345603', true, NOW() - INTERVAL '50 days', NOW()),
('cm0user000000000000000004', '0x1234567890abcdef1234567890abcdef12345604', 'miner_004', 'miner4@viddhana.io', 0.30, '0x1234567890abcdef1234567890abcdef12345604', true, NOW() - INTERVAL '45 days', NOW()),
('cm0user000000000000000005', '0x1234567890abcdef1234567890abcdef12345605', 'miner_005', 'miner5@viddhana.io', 0.50, '0x1234567890abcdef1234567890abcdef12345605', true, NOW() - INTERVAL '40 days', NOW()),
('cm0user000000000000000006', '0x1234567890abcdef1234567890abcdef12345606', 'miner_006', NULL, 0.10, '0x1234567890abcdef1234567890abcdef12345606', true, NOW() - INTERVAL '35 days', NOW()),
('cm0user000000000000000007', '0x1234567890abcdef1234567890abcdef12345607', 'miner_007', NULL, 0.15, '0x1234567890abcdef1234567890abcdef12345607', true, NOW() - INTERVAL '30 days', NOW()),
('cm0user000000000000000008', '0x1234567890abcdef1234567890abcdef12345608', 'miner_008', NULL, 0.20, '0x1234567890abcdef1234567890abcdef12345608', true, NOW() - INTERVAL '28 days', NOW()),
('cm0user000000000000000009', '0x1234567890abcdef1234567890abcdef12345609', 'miner_009', NULL, 0.25, '0x1234567890abcdef1234567890abcdef12345609', true, NOW() - INTERVAL '25 days', NOW()),
('cm0user000000000000000010', '0x1234567890abcdef1234567890abcdef12345610', 'miner_010', NULL, 0.30, '0x1234567890abcdef1234567890abcdef12345610', true, NOW() - INTERVAL '22 days', NOW()),
('cm0user000000000000000011', '0x1234567890abcdef1234567890abcdef12345611', NULL, NULL, 0.10, '0x1234567890abcdef1234567890abcdef12345611', true, NOW() - INTERVAL '20 days', NOW()),
('cm0user000000000000000012', '0x1234567890abcdef1234567890abcdef12345612', NULL, NULL, 0.15, '0x1234567890abcdef1234567890abcdef12345612', true, NOW() - INTERVAL '18 days', NOW()),
('cm0user000000000000000013', '0x1234567890abcdef1234567890abcdef12345613', NULL, NULL, 0.20, '0x1234567890abcdef1234567890abcdef12345613', true, NOW() - INTERVAL '15 days', NOW()),
('cm0user000000000000000014', '0x1234567890abcdef1234567890abcdef12345614', NULL, NULL, 0.25, '0x1234567890abcdef1234567890abcdef12345614', true, NOW() - INTERVAL '12 days', NOW()),
('cm0user000000000000000015', '0x1234567890abcdef1234567890abcdef12345615', NULL, NULL, 0.30, '0x1234567890abcdef1234567890abcdef12345615', true, NOW() - INTERVAL '10 days', NOW()),
('cm0user000000000000000016', '0x1234567890abcdef1234567890abcdef12345616', NULL, NULL, 0.50, '0x1234567890abcdef1234567890abcdef12345616', true, NOW() - INTERVAL '8 days', NOW()),
('cm0user000000000000000017', '0x1234567890abcdef1234567890abcdef12345617', NULL, NULL, 0.75, '0x1234567890abcdef1234567890abcdef12345617', true, NOW() - INTERVAL '6 days', NOW()),
('cm0user000000000000000018', '0x1234567890abcdef1234567890abcdef12345618', NULL, NULL, 1.00, '0x1234567890abcdef1234567890abcdef12345618', true, NOW() - INTERVAL '4 days', NOW()),
-- Inactive users
('cm0user000000000000000019', '0x1234567890abcdef1234567890abcdef12345619', NULL, NULL, 0.10, '0x1234567890abcdef1234567890abcdef12345619', false, NOW() - INTERVAL '90 days', NOW()),
('cm0user000000000000000020', '0x1234567890abcdef1234567890abcdef12345620', NULL, NULL, 0.10, '0x1234567890abcdef1234567890abcdef12345620', false, NOW() - INTERVAL '85 days', NOW())
ON CONFLICT (wallet_address) DO NOTHING;

-- =============================================================================
-- WORKERS (Multiple workers per user)
-- =============================================================================

INSERT INTO workers (id, user_id, name, hashrate, shares_accepted, shares_rejected, last_share_at, is_online, difficulty, algorithm, version, ip_address, created_at, updated_at) VALUES
-- Admin workers
('cm0worker0000000000000001', 'cm0admin00000000000000001', 'admin-rig-01', 250.50, 50000, 500, NOW() - INTERVAL '1 minute', true, 8.0, 'ethash', 'viddhana-miner/1.2.0', '192.168.1.100', NOW() - INTERVAL '60 days', NOW()),
('cm0worker0000000000000002', 'cm0admin00000000000000001', 'admin-rig-02', 180.25, 35000, 350, NOW() - INTERVAL '2 minutes', true, 4.0, 'ethash', 'viddhana-miner/1.2.0', '192.168.1.101', NOW() - INTERVAL '55 days', NOW()),

-- Demo user workers
('cm0worker0000000000000003', 'cm0demo000000000000000001', 'demo-miner-01', 120.75, 25000, 250, NOW() - INTERVAL '30 seconds', true, 4.0, 'ethash', 'viddhana-miner/1.1.5', '10.0.0.50', NOW() - INTERVAL '30 days', NOW()),
('cm0worker0000000000000004', 'cm0demo000000000000000001', 'demo-miner-02', 95.30, 18000, 180, NOW() - INTERVAL '1 minute', true, 2.0, 'kawpow', 'viddhana-miner/1.1.5', '10.0.0.51', NOW() - INTERVAL '28 days', NOW()),
('cm0worker0000000000000005', 'cm0demo000000000000000001', 'demo-miner-03', 0.00, 12000, 120, NOW() - INTERVAL '2 hours', false, 2.0, 'ethash', 'viddhana-miner/1.1.0', '10.0.0.52', NOW() - INTERVAL '25 days', NOW()),

-- Miner 001 workers (Large farm)
('cm0worker0000000000000006', 'cm0user000000000000000001', 'gpu-farm-01', 450.00, 95000, 950, NOW() - INTERVAL '15 seconds', true, 16.0, 'ethash', 'viddhana-miner/1.2.0', '203.0.113.10', NOW() - INTERVAL '50 days', NOW()),
('cm0worker0000000000000007', 'cm0user000000000000000001', 'gpu-farm-02', 425.50, 88000, 880, NOW() - INTERVAL '20 seconds', true, 16.0, 'ethash', 'viddhana-miner/1.2.0', '203.0.113.11', NOW() - INTERVAL '48 days', NOW()),
('cm0worker0000000000000008', 'cm0user000000000000000001', 'gpu-farm-03', 380.25, 75000, 750, NOW() - INTERVAL '30 seconds', true, 8.0, 'ethash', 'viddhana-miner/1.2.0', '203.0.113.12', NOW() - INTERVAL '45 days', NOW()),
('cm0worker0000000000000009', 'cm0user000000000000000001', 'asic-main', 520.00, 110000, 550, NOW() - INTERVAL '10 seconds', true, 32.0, 'kheavyhash', 'viddhana-miner/1.2.0', '203.0.113.13', NOW() - INTERVAL '40 days', NOW()),

-- Miner 002 workers
('cm0worker0000000000000010', 'cm0user000000000000000002', 'rig-alpha', 285.75, 55000, 550, NOW() - INTERVAL '45 seconds', true, 8.0, 'ethash', 'viddhana-miner/1.1.8', '198.51.100.20', NOW() - INTERVAL '40 days', NOW()),
('cm0worker0000000000000011', 'cm0user000000000000000002', 'rig-beta', 265.30, 48000, 480, NOW() - INTERVAL '1 minute', true, 8.0, 'ethash', 'viddhana-miner/1.1.8', '198.51.100.21', NOW() - INTERVAL '38 days', NOW()),
('cm0worker0000000000000012', 'cm0user000000000000000002', 'rig-gamma', 0.00, 42000, 420, NOW() - INTERVAL '6 hours', false, 4.0, 'ethash', 'viddhana-miner/1.1.5', '198.51.100.22', NOW() - INTERVAL '35 days', NOW()),

-- Miner 003 workers
('cm0worker0000000000000013', 'cm0user000000000000000003', 'home-miner-1', 125.50, 28000, 280, NOW() - INTERVAL '2 minutes', true, 4.0, 'kawpow', 'viddhana-miner/1.1.5', '172.16.0.100', NOW() - INTERVAL '35 days', NOW()),
('cm0worker0000000000000014', 'cm0user000000000000000003', 'home-miner-2', 118.25, 25000, 250, NOW() - INTERVAL '3 minutes', true, 4.0, 'kawpow', 'viddhana-miner/1.1.5', '172.16.0.101', NOW() - INTERVAL '32 days', NOW()),

-- Miner 004 workers
('cm0worker0000000000000015', 'cm0user000000000000000004', 'datacenter-01', 380.00, 78000, 390, NOW() - INTERVAL '25 seconds', true, 16.0, 'ethash', 'viddhana-miner/1.2.0', '45.33.32.10', NOW() - INTERVAL '30 days', NOW()),
('cm0worker0000000000000016', 'cm0user000000000000000004', 'datacenter-02', 365.50, 72000, 360, NOW() - INTERVAL '35 seconds', true, 16.0, 'ethash', 'viddhana-miner/1.2.0', '45.33.32.11', NOW() - INTERVAL '28 days', NOW()),
('cm0worker0000000000000017', 'cm0user000000000000000004', 'datacenter-03', 355.25, 68000, 340, NOW() - INTERVAL '40 seconds', true, 8.0, 'ethash', 'viddhana-miner/1.2.0', '45.33.32.12', NOW() - INTERVAL '25 days', NOW()),

-- Miner 005 workers
('cm0worker0000000000000018', 'cm0user000000000000000005', 'worker-A', 195.75, 42000, 420, NOW() - INTERVAL '50 seconds', true, 8.0, 'blake3', 'viddhana-miner/1.1.8', '91.121.100.50', NOW() - INTERVAL '28 days', NOW()),
('cm0worker0000000000000019', 'cm0user000000000000000005', 'worker-B', 185.30, 38000, 380, NOW() - INTERVAL '55 seconds', true, 8.0, 'blake3', 'viddhana-miner/1.1.8', '91.121.100.51', NOW() - INTERVAL '25 days', NOW()),

-- Miner 006-010 workers (Single worker each)
('cm0worker0000000000000020', 'cm0user000000000000000006', 'miner-main', 155.00, 32000, 320, NOW() - INTERVAL '1 minute', true, 4.0, 'ethash', 'viddhana-miner/1.1.5', '82.94.164.100', NOW() - INTERVAL '25 days', NOW()),
('cm0worker0000000000000021', 'cm0user000000000000000007', 'rig-01', 142.50, 28000, 280, NOW() - INTERVAL '2 minutes', true, 4.0, 'ethash', 'viddhana-miner/1.1.5', '77.88.55.60', NOW() - INTERVAL '22 days', NOW()),
('cm0worker0000000000000022', 'cm0user000000000000000008', 'gpu-rig', 135.25, 26000, 260, NOW() - INTERVAL '3 minutes', true, 4.0, 'kawpow', 'viddhana-miner/1.1.0', '104.156.64.30', NOW() - INTERVAL '20 days', NOW()),
('cm0worker0000000000000023', 'cm0user000000000000000009', 'asic-01', 225.00, 48000, 240, NOW() - INTERVAL '30 seconds', true, 8.0, 'kheavyhash', 'viddhana-miner/1.2.0', '185.199.108.40', NOW() - INTERVAL '18 days', NOW()),
('cm0worker0000000000000024', 'cm0user000000000000000010', 'home-rig', 98.75, 18000, 180, NOW() - INTERVAL '4 minutes', true, 2.0, 'ethash', 'viddhana-miner/1.0.5', '151.101.1.100', NOW() - INTERVAL '15 days', NOW()),

-- Offline workers
('cm0worker0000000000000025', 'cm0user000000000000000011', 'offline-rig-1', 0.00, 15000, 150, NOW() - INTERVAL '3 days', false, 2.0, 'ethash', 'viddhana-miner/1.0.0', '140.82.112.50', NOW() - INTERVAL '30 days', NOW()),
('cm0worker0000000000000026', 'cm0user000000000000000012', 'offline-rig-2', 0.00, 12000, 120, NOW() - INTERVAL '5 days', false, 2.0, 'kawpow', 'viddhana-miner/1.0.0', '192.30.255.100', NOW() - INTERVAL '28 days', NOW())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- BLOCKS (50 blocks found by pool)
-- =============================================================================

INSERT INTO blocks (id, height, hash, difficulty, reward, fees, finder, finder_user_id, confirmations, is_orphan, is_confirmed, found_at, created_at, updated_at) VALUES
('cm0block00000000000000001', 19000001, '0xabc123def456789012345678901234567890123456789012345678901234567801', 15000000000000, 2.50000000, 0.12500000, '0x1234567890abcdef1234567890abcdef12345601', 'cm0user000000000000000001', 1250, false, true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days', NOW()),
('cm0block00000000000000002', 19000015, '0xabc123def456789012345678901234567890123456789012345678901234567802', 15100000000000, 2.48000000, 0.15000000, '0x1234567890abcdef1234567890abcdef12345602', 'cm0user000000000000000002', 1100, false, true, NOW() - INTERVAL '28 days', NOW() - INTERVAL '28 days', NOW()),
('cm0block00000000000000003', 19000030, '0xabc123def456789012345678901234567890123456789012345678901234567803', 15200000000000, 2.52000000, 0.18000000, '0x1234567890abcdef1234567890abcdef12345601', 'cm0user000000000000000001', 980, false, true, NOW() - INTERVAL '26 days', NOW() - INTERVAL '26 days', NOW()),
('cm0block00000000000000004', 19000045, '0xabc123def456789012345678901234567890123456789012345678901234567804', 15300000000000, 2.45000000, 0.22000000, '0x1234567890abcdef1234567890abcdef12345603', 'cm0user000000000000000003', 850, false, true, NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days', NOW()),
('cm0block00000000000000005', 19000060, '0xabc123def456789012345678901234567890123456789012345678901234567805', 15400000000000, 2.55000000, 0.08000000, '0xADMIN000000000000000000000000000000000001', 'cm0admin00000000000000001', 720, false, true, NOW() - INTERVAL '22 days', NOW() - INTERVAL '22 days', NOW()),
('cm0block00000000000000006', 19000075, '0xabc123def456789012345678901234567890123456789012345678901234567806', 15500000000000, 2.47000000, 0.25000000, '0x1234567890abcdef1234567890abcdef12345604', 'cm0user000000000000000004', 600, false, true, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW()),
('cm0block00000000000000007', 19000090, '0xabc123def456789012345678901234567890123456789012345678901234567807', 15600000000000, 2.51000000, 0.19000000, '0x1234567890abcdef1234567890abcdef12345601', 'cm0user000000000000000001', 480, false, true, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', NOW()),
('cm0block00000000000000008', 19000105, '0xabc123def456789012345678901234567890123456789012345678901234567808', 15700000000000, 2.49000000, 0.14000000, '0x1234567890abcdef1234567890abcdef12345605', 'cm0user000000000000000005', 360, false, true, NOW() - INTERVAL '16 days', NOW() - INTERVAL '16 days', NOW()),
('cm0block00000000000000009', 19000120, '0xabc123def456789012345678901234567890123456789012345678901234567809', 15800000000000, 2.53000000, 0.11000000, '0xDEMO0000000000000000000000000000000000001', 'cm0demo000000000000000001', 240, false, true, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', NOW()),
('cm0block00000000000000010', 19000135, '0xabc123def456789012345678901234567890123456789012345678901234567810', 15900000000000, 2.46000000, 0.28000000, '0x1234567890abcdef1234567890abcdef12345601', 'cm0user000000000000000001', 180, false, true, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW()),
('cm0block00000000000000011', 19000150, '0xabc123def456789012345678901234567890123456789012345678901234567811', 16000000000000, 2.54000000, 0.16000000, '0x1234567890abcdef1234567890abcdef12345602', 'cm0user000000000000000002', 120, false, true, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW()),
('cm0block00000000000000012', 19000165, '0xabc123def456789012345678901234567890123456789012345678901234567812', 16100000000000, 2.48000000, 0.21000000, '0x1234567890abcdef1234567890abcdef12345606', 'cm0user000000000000000006', 80, false, true, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', NOW()),
('cm0block00000000000000013', 19000180, '0xabc123def456789012345678901234567890123456789012345678901234567813', 16200000000000, 2.50000000, 0.13000000, '0x1234567890abcdef1234567890abcdef12345601', 'cm0user000000000000000001', 50, false, true, NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', NOW()),
('cm0block00000000000000014', 19000195, '0xabc123def456789012345678901234567890123456789012345678901234567814', 16300000000000, 2.52000000, 0.17000000, '0x1234567890abcdef1234567890abcdef12345607', 'cm0user000000000000000007', 30, false, true, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', NOW()),
('cm0block00000000000000015', 19000210, '0xabc123def456789012345678901234567890123456789012345678901234567815', 16400000000000, 2.47000000, 0.24000000, '0x1234567890abcdef1234567890abcdef12345604', 'cm0user000000000000000004', 15, false, true, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', NOW()),
-- Recent/pending blocks
('cm0block00000000000000016', 19000225, '0xabc123def456789012345678901234567890123456789012345678901234567816', 16500000000000, 2.51000000, 0.10000000, '0x1234567890abcdef1234567890abcdef12345601', 'cm0user000000000000000001', 8, false, false, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours', NOW()),
('cm0block00000000000000017', 19000240, '0xabc123def456789012345678901234567890123456789012345678901234567817', 16600000000000, 2.49000000, 0.15000000, '0xDEMO0000000000000000000000000000000000001', 'cm0demo000000000000000001', 5, false, false, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours', NOW()),
('cm0block00000000000000018', 19000255, '0xabc123def456789012345678901234567890123456789012345678901234567818', 16700000000000, 2.53000000, 0.12000000, '0x1234567890abcdef1234567890abcdef12345602', 'cm0user000000000000000002', 2, false, false, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours', NOW()),
('cm0block00000000000000019', 19000270, '0xabc123def456789012345678901234567890123456789012345678901234567819', 16800000000000, 2.50000000, 0.18000000, '0x1234567890abcdef1234567890abcdef12345601', 'cm0user000000000000000001', 1, false, false, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', NOW()),
-- Orphaned block
('cm0block00000000000000020', 19000142, '0xabc123def456789012345678901234567890123456789012345678901234567820', 16000000000000, 2.50000000, 0.20000000, '0x1234567890abcdef1234567890abcdef12345603', 'cm0user000000000000000003', 0, true, false, NOW() - INTERVAL '11 days', NOW() - INTERVAL '11 days', NOW())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- PAYOUTS (Various statuses)
-- =============================================================================

INSERT INTO payouts (id, user_id, amount, fee, tx_hash, to_address, status, error_message, processed_at, confirmed_at, created_at, updated_at) VALUES
-- Completed payouts
('cm0payout0000000000000001', 'cm0user000000000000000001', 5.25000000, 0.05250000, '0xtx001abc123def456789012345678901234567890123456789012345678901234567', '0x1234567890abcdef1234567890abcdef12345601', 'COMPLETED', NULL, NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days', NOW() - INTERVAL '26 days', NOW()),
('cm0payout0000000000000002', 'cm0user000000000000000001', 4.80000000, 0.04800000, '0xtx002abc123def456789012345678901234567890123456789012345678901234567', '0x1234567890abcdef1234567890abcdef12345601', 'COMPLETED', NULL, NOW() - INTERVAL '18 days', NOW() - INTERVAL '18 days', NOW() - INTERVAL '19 days', NOW()),
('cm0payout0000000000000003', 'cm0user000000000000000002', 3.50000000, 0.03500000, '0xtx003abc123def456789012345678901234567890123456789012345678901234567', '0x1234567890abcdef1234567890abcdef12345602', 'COMPLETED', NULL, NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', NOW() - INTERVAL '21 days', NOW()),
('cm0payout0000000000000004', 'cm0user000000000000000003', 2.75000000, 0.02750000, '0xtx004abc123def456789012345678901234567890123456789012345678901234567', '0x1234567890abcdef1234567890abcdef12345603', 'COMPLETED', NULL, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', NOW() - INTERVAL '16 days', NOW()),
('cm0payout0000000000000005', 'cm0user000000000000000004', 4.20000000, 0.04200000, '0xtx005abc123def456789012345678901234567890123456789012345678901234567', '0x1234567890abcdef1234567890abcdef12345604', 'COMPLETED', NULL, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '13 days', NOW()),
('cm0payout0000000000000006', 'cm0demo000000000000000001', 1.85000000, 0.01850000, '0xtx006abc123def456789012345678901234567890123456789012345678901234567', '0xDEMO0000000000000000000000000000000000001', 'COMPLETED', NULL, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', NOW() - INTERVAL '11 days', NOW()),
('cm0payout0000000000000007', 'cm0user000000000000000005', 2.30000000, 0.02300000, '0xtx007abc123def456789012345678901234567890123456789012345678901234567', '0x1234567890abcdef1234567890abcdef12345605', 'COMPLETED', NULL, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', NOW() - INTERVAL '9 days', NOW()),
('cm0payout0000000000000008', 'cm0user000000000000000001', 3.95000000, 0.03950000, '0xtx008abc123def456789012345678901234567890123456789012345678901234567', '0x1234567890abcdef1234567890abcdef12345601', 'COMPLETED', NULL, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '6 days', NOW()),

-- Processing payouts
('cm0payout0000000000000009', 'cm0user000000000000000002', 2.15000000, 0.02150000, NULL, '0x1234567890abcdef1234567890abcdef12345602', 'PROCESSING', NULL, NOW() - INTERVAL '1 hour', NULL, NOW() - INTERVAL '2 hours', NOW()),
('cm0payout0000000000000010', 'cm0user000000000000000006', 1.50000000, 0.01500000, NULL, '0x1234567890abcdef1234567890abcdef12345606', 'PROCESSING', NULL, NOW() - INTERVAL '30 minutes', NULL, NOW() - INTERVAL '1 hour', NOW()),

-- Pending payouts
('cm0payout0000000000000011', 'cm0user000000000000000001', 2.85000000, 0.02850000, NULL, '0x1234567890abcdef1234567890abcdef12345601', 'PENDING', NULL, NULL, NULL, NOW() - INTERVAL '3 hours', NOW()),
('cm0payout0000000000000012', 'cm0demo000000000000000001', 1.25000000, 0.01250000, NULL, '0xDEMO0000000000000000000000000000000000001', 'PENDING', NULL, NULL, NULL, NOW() - INTERVAL '2 hours', NOW()),
('cm0payout0000000000000013', 'cm0user000000000000000007', 0.95000000, 0.00950000, NULL, '0x1234567890abcdef1234567890abcdef12345607', 'PENDING', NULL, NULL, NULL, NOW() - INTERVAL '1 hour', NOW()),

-- Failed payouts
('cm0payout0000000000000014', 'cm0user000000000000000003', 1.75000000, 0.01750000, NULL, '0x1234567890abcdef1234567890abcdef12345603', 'FAILED', 'Transaction failed: insufficient gas', NOW() - INTERVAL '4 days', NULL, NOW() - INTERVAL '5 days', NOW()),
('cm0payout0000000000000015', 'cm0user000000000000000008', 0.85000000, 0.00850000, NULL, '0x1234567890abcdef1234567890abcdef12345608', 'FAILED', 'Network error: connection timeout', NOW() - INTERVAL '3 days', NULL, NOW() - INTERVAL '4 days', NOW()),

-- Cancelled payouts
('cm0payout0000000000000016', 'cm0user000000000000000004', 1.20000000, 0.01200000, NULL, '0x1234567890abcdef1234567890abcdef12345604', 'CANCELLED', NULL, NULL, NULL, NOW() - INTERVAL '7 days', NOW())
ON CONFLICT DO NOTHING;

-- =============================================================================
-- POOL STATS (Hourly data for 7 days = 168 records)
-- =============================================================================

DO $$
DECLARE
    i INTEGER;
    stat_time TIMESTAMP;
    base_hashrate DECIMAL;
    variance DECIMAL;
BEGIN
    FOR i IN 0..167 LOOP
        stat_time := NOW() - (i || ' hours')::INTERVAL;
        variance := (RANDOM() * 0.4) - 0.2; -- -20% to +20% variance
        base_hashrate := 50000000000 * (1 + variance); -- ~50 GH/s base
        
        INSERT INTO pool_stats (id, hashrate, active_workers, active_miners, blocks_found, total_paid, difficulty, network_hashrate, created_at)
        VALUES (
            'cm0stats' || LPAD(i::TEXT, 13, '0'),
            base_hashrate,
            FLOOR(RANDOM() * 50 + 80)::INTEGER, -- 80-130 workers
            FLOOR(RANDOM() * 10 + 15)::INTEGER, -- 15-25 miners
            FLOOR(RANDOM() * 3)::BIGINT, -- 0-2 blocks
            RANDOM() * 300 + 100, -- 100-400 total paid
            (RANDOM() * 4000000000000 + 12000000000000)::DECIMAL, -- difficulty
            (RANDOM() * 400000000000 + 800000000000), -- 800-1200 GH/s network
            stat_time
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- =============================================================================
-- SHARES (Sample shares for recent activity)
-- =============================================================================

DO $$
DECLARE
    i INTEGER;
    worker_ids TEXT[] := ARRAY['cm0worker0000000000000001', 'cm0worker0000000000000003', 'cm0worker0000000000000006', 'cm0worker0000000000000010', 'cm0worker0000000000000015'];
    user_ids TEXT[] := ARRAY['cm0admin00000000000000001', 'cm0demo000000000000000001', 'cm0user000000000000000001', 'cm0user000000000000000002', 'cm0user000000000000000004'];
    rand_worker INTEGER;
    share_time TIMESTAMP;
    is_valid BOOLEAN;
BEGIN
    FOR i IN 1..500 LOOP
        rand_worker := FLOOR(RANDOM() * 5 + 1)::INTEGER;
        share_time := NOW() - ((RANDOM() * 168) || ' hours')::INTERVAL;
        is_valid := RANDOM() > 0.02; -- 98% valid
        
        INSERT INTO shares (id, user_id, worker_id, block_id, difficulty, is_valid, nonce, hash, created_at)
        VALUES (
            'cm0share' || LPAD(i::TEXT, 14, '0'),
            user_ids[rand_worker],
            worker_ids[rand_worker],
            NULL,
            (RANDOM() * 30 + 1)::DECIMAL,
            is_valid,
            '0x' || LPAD(TO_HEX((RANDOM() * 4294967295)::BIGINT), 8, '0'),
            CASE WHEN is_valid THEN '0x' || ENCODE(gen_random_bytes(32), 'hex') ELSE NULL END,
            share_time
        )
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- =============================================================================
-- SESSIONS (Active sessions)
-- =============================================================================

INSERT INTO sessions (id, user_id, refresh_token, user_agent, ip_address, expires_at, created_at) VALUES
('cm0session000000000000001', 'cm0admin00000000000000001', 'refresh_admin_token_abc123def456789', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', '192.168.1.100', NOW() + INTERVAL '7 days', NOW() - INTERVAL '2 hours'),
('cm0session000000000000002', 'cm0demo000000000000000001', 'refresh_demo_token_xyz789ghi012345', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', '10.0.0.50', NOW() + INTERVAL '7 days', NOW() - INTERVAL '1 hour'),
('cm0session000000000000003', 'cm0user000000000000000001', 'refresh_user1_token_mno345pqr678901', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', '203.0.113.10', NOW() + INTERVAL '7 days', NOW() - INTERVAL '30 minutes'),
('cm0session000000000000004', 'cm0user000000000000000002', 'refresh_user2_token_stu234vwx567890', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0', '198.51.100.20', NOW() + INTERVAL '5 days', NOW() - INTERVAL '4 hours'),
('cm0session000000000000005', 'cm0user000000000000000004', 'refresh_user4_token_yza890bcd123456', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15', '45.33.32.10', NOW() + INTERVAL '3 days', NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Summary Output
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Seed Data Inserted Successfully!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Users: 22 (20 miners + 1 admin + 1 demo)';
    RAISE NOTICE 'Workers: 26';
    RAISE NOTICE 'Blocks: 20 (15 confirmed + 4 pending + 1 orphan)';
    RAISE NOTICE 'Payouts: 16 (8 completed + 2 processing + 3 pending + 2 failed + 1 cancelled)';
    RAISE NOTICE 'Pool Stats: 168 (7 days hourly)';
    RAISE NOTICE 'Shares: 500 sample shares';
    RAISE NOTICE 'Sessions: 5 active sessions';
    RAISE NOTICE '============================================';
END $$;
