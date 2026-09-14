// Phase 19: versioned public API — mounted at /api/v1/public/* (see app.ts).
// Every route here authenticates with an API key (requireApiKey), not the
// cookie session requireAuth uses elsewhere.
import { Router } from "express";
import quotesRouter from "./quotes.js";
import clientsRouter from "./clients.js";
import jobsRouter from "./jobs.js";
import invoicesRouter from "./invoices.js";

const router = Router();

router.use(quotesRouter);
router.use(clientsRouter);
router.use(jobsRouter);
router.use(invoicesRouter);

export default router;
