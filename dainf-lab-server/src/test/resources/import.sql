INSERT INTO app_user (documento, email, email_verificado, foto_url, nome, "password", telefone, role, enabled) VALUES('0000001', 'test@test.com', false, NULL, 'Test User', '$2a$10$PAT0Rh1KBwjnqaWvGKQgou5Mkjz1iIFJoasd1R9O.V546opfKmXrm', '00000000000', 'ROLE_ADMIN', true);
INSERT INTO category (description, icon, parent_id) VALUES('Ferramentas', 'pi pi-cog', NULL);
INSERT INTO item (name, description, price, category_id, type) VALUES('Item Teste', 'Item para testes', 10.00, 1, 'CONSUMABLE');
INSERT INTO inventory (quantity, item_id) VALUES(1000.00, 1);
