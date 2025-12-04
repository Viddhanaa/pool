-- Create Test Miners Directly in Database
-- For load testing purposes

-- Create 100 test miners
DO $$
DECLARE
    i INTEGER;
    wallet TEXT;
BEGIN
    FOR i IN 1..100 LOOP
        wallet := '0x1111111111111111111111111111111111' || LPAD(i::TEXT, 6, '0');
        
        INSERT INTO miners (wallet_address, device_type, first_seen, last_seen, balance)
        VALUES (wallet, 'load-test', NOW(), NOW(), 10.0)
        ON CONFLICT (wallet_address) DO NOTHING;
    END LOOP;
    
    RAISE NOTICE 'Created 100 test miners';
END $$;

-- Verify creation
SELECT COUNT(*) as test_miners_count FROM miners WHERE device_type = 'load-test';

-- Show sample
SELECT id, wallet_address, balance, device_type 
FROM miners 
WHERE device_type = 'load-test' 
ORDER BY id 
LIMIT 10;
