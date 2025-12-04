-- Generate historical transaction data for Blockscout charts
-- This will create blocks and transactions for the past 30 days

DO $$
DECLARE
    day_offset INT;
    blocks_per_day INT := 50; -- Number of blocks to create per day
    txs_per_block INT;
    block_num INT;
    block_ts TIMESTAMP;
    tx_count INT := 0;
BEGIN
    -- Get current max block number
    SELECT COALESCE(MAX(number), 0) INTO block_num FROM blocks;
    
    RAISE NOTICE 'Starting from block %', block_num;
    
    -- Create historical data for past 30 days
    FOR day_offset IN 1..30 LOOP
        -- Calculate timestamp for this day
        block_ts := NOW() - (day_offset || ' days')::INTERVAL;
        
        -- Random number of transactions per block (0-5)
        txs_per_block := (RANDOM() * 5)::INT;
        
        -- Create blocks for this day
        FOR i IN 1..blocks_per_day LOOP
            block_num := block_num + 1;
            
            -- Insert block
            INSERT INTO blocks (
                number, 
                hash, 
                parent_hash,
                nonce,
                miner_hash,
                difficulty,
                total_difficulty,
                size,
                gas_limit,
                gas_used,
                timestamp,
                inserted_at,
                updated_at
            ) VALUES (
                block_num,
                '0x' || MD5(block_num::TEXT || RANDOM()::TEXT),
                '0x' || MD5((block_num - 1)::TEXT),
                '0x0000000000000000',
                '0x0000000000000000000000000000000000000000',
                0,
                0,
                1000,
                8000000,
                21000 * txs_per_block,
                block_ts + (i || ' minutes')::INTERVAL,
                NOW(),
                NOW()
            ) ON CONFLICT (number) DO NOTHING;
            
            -- Create transactions for this block
            IF txs_per_block > 0 THEN
                FOR j IN 1..txs_per_block LOOP
                    tx_count := tx_count + 1;
                    
                    INSERT INTO transactions (
                        hash,
                        nonce,
                        block_hash,
                        block_number,
                        transaction_index,
                        from_address_hash,
                        to_address_hash,
                        value,
                        gas,
                        gas_price,
                        gas_used,
                        cumulative_gas_used,
                        input,
                        status,
                        inserted_at,
                        updated_at
                    ) VALUES (
                        '0x' || MD5(tx_count::TEXT || RANDOM()::TEXT),
                        j,
                        '0x' || MD5(block_num::TEXT || RANDOM()::TEXT),
                        block_num,
                        j - 1,
                        '0x' || LPAD(TO_HEX((RANDOM() * 10)::INT + 1), 40, '0'),
                        '0x' || LPAD(TO_HEX((RANDOM() * 10)::INT + 1), 40, '0'),
                        (RANDOM() * 10)::NUMERIC * 1000000000000000000,
                        21000,
                        1000000000,
                        21000,
                        21000 * j,
                        '0x',
                        1,
                        block_ts + (i || ' minutes')::INTERVAL,
                        NOW()
                    ) ON CONFLICT (hash) DO NOTHING;
                END LOOP;
            END IF;
        END LOOP;
        
        RAISE NOTICE 'Created % blocks for day -% with % transactions', blocks_per_day, day_offset, txs_per_block * blocks_per_day;
    END LOOP;
    
    RAISE NOTICE 'Total transactions created: %', tx_count;
END $$;

-- Update statistics
SELECT 
    COUNT(*) as total_blocks,
    MIN(timestamp) as oldest_block,
    MAX(timestamp) as newest_block
FROM blocks;

SELECT COUNT(*) as total_transactions FROM transactions;
