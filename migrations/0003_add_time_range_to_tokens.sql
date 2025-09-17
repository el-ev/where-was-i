-- Migration number: 0003 	 2025-09-17T07:35:00.000Z

ALTER TABLE tokens ADD COLUMN available_start_time INTEGER;
ALTER TABLE tokens ADD COLUMN available_end_time INTEGER;