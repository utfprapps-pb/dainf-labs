INSERT INTO loan (user_id, loan_date, deadline, status) VALUES (2, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days', 'ONGOING');
INSERT INTO loan_item (loan_id, item_id, quantity, return) VALUES ((SELECT max(id) FROM loan), 1, 10, true);
INSERT INTO loan_item (loan_id, item_id, quantity, return) VALUES ((SELECT max(id) FROM loan), 2, 5, true);

INSERT INTO loan (user_id, loan_date, deadline, status) VALUES (3, NOW() - INTERVAL '10 days', NOW() - INTERVAL '1 days', 'OVERDUE');
INSERT INTO loan_item (loan_id, item_id, quantity, return) VALUES ((SELECT max(id) FROM loan), 3, 2, true);

INSERT INTO loan (user_id, loan_date, deadline, status) VALUES (4, NOW() - INTERVAL '5 days', NOW() + INTERVAL '2 days', 'ONGOING');
INSERT INTO loan_item (loan_id, item_id, quantity, return) VALUES ((SELECT max(id) FROM loan), 4, 1, true);
INSERT INTO loan_item (loan_id, item_id, quantity, return) VALUES ((SELECT max(id) FROM loan), 5, 3, true);
