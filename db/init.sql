CREATE TABLE IF NOT EXISTS inscriptions (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  telephone VARCHAR(40) NOT NULL,
  date_naissance DATE,
  lieu_naissance VARCHAR(120),
  adresse TEXT NOT NULL,
  ville VARCHAR(120) NOT NULL,
  formation VARCHAR(120) NOT NULL,
  niveau VARCHAR(120) NOT NULL,
  annee_etude VARCHAR(20),
  modalite VARCHAR(40),
  motivation TEXT,
  newsletter BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages_contact (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  telephone VARCHAR(40),
  sujet VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
