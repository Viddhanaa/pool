import { Router } from 'express';
import { getKycStatus, setKycStatus } from '../services/kycStore';

const router = Router();

const isAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr);

router.get('/kyc/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    if (!isAddress(address)) {
      return res.status(400).json({ error: 'Invalid address' });
    }
    const status = await getKycStatus(address);
    return res.json(status);
  } catch (err) {
    next(err);
  }
});

router.post('/kyc', async (req, res, next) => {
  try {
    const { address, kyc, provider, level, meta } = req.body ?? {};
    if (!address || !isAddress(address)) {
      return res.status(400).json({ error: 'address is required and must be a valid hex address' });
    }
    const record = await setKycStatus({ address, kyc, provider, level, meta });
    return res.json(record);
  } catch (err) {
    next(err);
  }
});

export default router;
