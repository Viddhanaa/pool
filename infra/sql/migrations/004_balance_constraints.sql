-- Ensure balances cannot go negative
ALTER TABLE miners
  ADD CONSTRAINT pending_balance_non_negative CHECK (pending_balance >= 0),
  ADD CONSTRAINT total_earned_non_negative CHECK (total_earned >= 0);
