-- PostgreSQL baseline schema. The FastAPI service uses SQLAlchemy metadata for
-- local bootstrap; run this migration before pointing DATABASE_URL at a
-- managed PostgreSQL instance.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS nutrition_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age integer NOT NULL CHECK (age BETWEEN 13 AND 100),
  sex varchar(20) NOT NULL,
  height_cm numeric NOT NULL CHECK (height_cm BETWEEN 100 AND 240),
  weight_kg numeric NOT NULL CHECK (weight_kg BETWEEN 30 AND 250),
  activity_level numeric NOT NULL,
  calorie_target integer NOT NULL,
  calculation_version varchar(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  barcode varchar(32) UNIQUE,
  category varchar(80) NOT NULL,
  description text NOT NULL,
  price_inr integer NOT NULL CHECK (price_inr >= 0),
  calories numeric NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fibre_g numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS foods_name_idx ON foods(name);
CREATE INDEX IF NOT EXISTS foods_category_idx ON foods(category);
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_id uuid NOT NULL REFERENCES foods(id),
  quantity integer NOT NULL CHECK (quantity > 0)
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  status varchar(40) NOT NULL,
  total_inr integer NOT NULL CHECK (total_inr >= 0),
  demo_payment boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(40) NOT NULL DEFAULT 'Home',
  line1 varchar(200) NOT NULL,
  city varchar(80) NOT NULL,
  state varchar(80) NOT NULL,
  postal_code varchar(12) NOT NULL,
  is_default boolean NOT NULL DEFAULT false
);
