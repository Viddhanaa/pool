-- Create 10 test miners directly in database
DO $$
DECLARE
    i INT;
    wallet TEXT;
BEGIN
    FOR i IN 2..11 LOOP
        wallet := '0x' || LPAD(TO_HEX(i), 40, '0');
        
        INSERT INTO miners (wallet_address, pending_balance, hashrate, status)
        VALUES (wallet, 0, 1000000, 'online')
        ON CONFLICT (wallet_address) DO NOTHING;
        
        RAISE NOTICE 'Created miner % with wallet %', i, wallet;
    END LOOP;
END $$;

-- Verify miners
SELECT miner_id, wallet_address, status, hashrate FROM miners ORDER BY miner_id;
