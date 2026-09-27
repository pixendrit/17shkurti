-- Orders can be put in the trash (and restored) before being deleted for good.
ALTER TABLE orders ADD COLUMN deleted_at INTEGER;
