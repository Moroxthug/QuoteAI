-- Phase 71: Québec's combined rate is 14.975 % (GST 5 + QST 9.975). numeric(5,2)
-- rounded it to 14.98, so every QC quote's tax was off by a few cents and the
-- statutory split could not be reproduced. Three decimals, same for variants.
ALTER TABLE quotes ALTER COLUMN iva_percentuale TYPE numeric(6, 3);
ALTER TABLE quote_variants ALTER COLUMN iva_percentuale TYPE numeric(6, 3);
ALTER TABLE quote_variants ALTER COLUMN iva_percentuale SET DEFAULT 0;
