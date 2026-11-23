-- Item lifecycle (inativação de itens, issue #69).
-- Idempotente: pode ser executado mais de uma vez sem sobrescrever itens já inativados.

ALTER TABLE item ADD COLUMN IF NOT EXISTS active boolean;
UPDATE item SET active = true WHERE active IS NULL;
ALTER TABLE item ALTER COLUMN active SET DEFAULT true;
ALTER TABLE item ALTER COLUMN active SET NOT NULL;

-- Tabela de auditoria (Envers): registros antigos são tratados como ativos, sem modificação do campo.
ALTER TABLE item_aud ADD COLUMN IF NOT EXISTS active boolean;
ALTER TABLE item_aud ADD COLUMN IF NOT EXISTS active_mod boolean;
UPDATE item_aud SET active = true WHERE active IS NULL;
UPDATE item_aud SET active_mod = false WHERE active_mod IS NULL;
