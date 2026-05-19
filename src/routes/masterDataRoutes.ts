import { Router } from "express";
import {
  allMasterDataController,
  pincodeLookupController,
} from "../controllers/masterDataController";

const router = Router();

// Master data is non-sensitive reference data — public so the frontend
// can render dropdowns even on a pre-login screen.
router.get("/", allMasterDataController);
router.get("/pincode/:pincode", pincodeLookupController);

export default router;
