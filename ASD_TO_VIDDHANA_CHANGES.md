# ASD → VIDDHANA Rebranding Summary

## Date: December 2, 2025

### Changes Applied

Toàn bộ references từ "ASD" đã được thay thế bằng "VIDDHANA" trong:

#### Backend Code (TypeScript)
- ✅ `backend/src/services/blockchain.ts` - Function `transferAsd` → `transferViddhana`
- ✅ `backend/src/services/withdrawalService.ts` - Import và sử dụng `transferViddhana`
- ✅ `backend/src/services/blockRewardService.ts` - Comments và logs
- ✅ `backend/src/services/blockchain.test.ts` - Test cases
- ✅ `backend/src/services/rewardEngine.test.ts` - Test descriptions
- ✅ `backend/src/services/adminMetricsService.ts` - `asd_distributed` → `viddhana_distributed`
- ✅ `backend/src/services/authService.ts` - Message prefix "ASD Miner" → "VIDDHANA Miner"
- ✅ `backend/src/fundRewards.ts` - Console log outputs

#### Frontend Code (React/TypeScript)
- ✅ `web/src/App.tsx` - All UI text, balance displays, chart labels
- ✅ `admin/src/App.tsx` - Admin dashboard labels, config units, metrics

#### Documentation & Scripts
- ✅ All `*.md` files - Project reports, guides, technical specs
- ✅ All `*.sh` files - Shell scripts, tunnel setup
- ✅ All `*.txt` files - Quick setup guides, credentials
- ✅ All `*.html` files - Mining guide HTML
- ✅ All `*.js` files - Test scripts, transaction generators

### Preserved References

Giữ nguyên các references infrastructure (không thay đổi):
- ❌ `asdchain.io` domain names (deployed infrastructure)
- ❌ `asdminer` database name
- ❌ `asd-miner` tunnel names
- ❌ `asd-web`, `asd-admin`, `asd-backend` port forwarding names

### Key Changes Summary

| Category | Old Value | New Value |
|----------|-----------|-----------|
| **Coin Name** | ASD | VIDDHANA |
| **Brand Name** | ASD Miner | VIDDHANA Miner |
| **Chain Name** | ASD Private Network / ASD Chain | VIDDHANA Private Network / VIDDHANA Chain |
| **Function Names** | transferAsd, transferBtcd | transferViddhana, transferBtcd |
| **API Response** | asd_distributed | viddhana_distributed |
| **UI Display** | "X.XXXX ASD" | "X.XXXX VIDDHANA" |
| **Config Units** | "ASD", "ASD/day" | "VIDDHANA", "VIDDHANA/day" |
| **Block Reward** | 2 ASD per block | 2 VIDDHANA per block |
| **Reward Rate** | 24 ASD/minute | 24 VIDDHANA/minute |

### Files Changed: ~80+ files

Including but not limited to:
- Backend services and tests
- Frontend UI components
- Admin dashboard
- Documentation (PROJECT_REPORT.md, TECH_SPEC.md, etc.)
- Setup scripts and guides
- Test files and load test scripts
- HTML mining guide
- Network setup configurations

### Verification

✅ No "ASD" references found in code/docs (excluding infrastructure names)
✅ Backend type check: Existing errors unrelated to rebranding
✅ Frontend type check: Existing errors unrelated to rebranding
✅ All coin references updated to VIDDHANA
✅ All brand references updated to VIDDHANA Miner

### Note

Đồng coin sử dụng là **BTCD** (BTC Diamond) trên blockchain, nhưng trong UI/documentation hiện tại vẫn hiển thị **VIDDHANA** theo yêu cầu rebranding. Nếu cần sync tên coin giữa blockchain và UI, có thể:
1. Giữ nguyên: BTCD on-chain, VIDDHANA in UI
2. Hoặc đổi UI về BTCD để match với blockchain

