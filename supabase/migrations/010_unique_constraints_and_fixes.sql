-- C1: Prevent duplicate CPF/CNPJ via race condition
ALTER TABLE profiles ADD CONSTRAINT profiles_document_unique UNIQUE (document);

-- C2: Prevent duplicate business slugs via race condition
ALTER TABLE businesses ADD CONSTRAINT businesses_slug_unique UNIQUE (slug);
