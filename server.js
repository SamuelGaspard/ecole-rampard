const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const path = require("path");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "accueil")));

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "ecole_rampard",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/inscriptions", async (req, res) => {
  try {
    const {
      nom,
      prenom,
      email,
      telephone,
      dateNaissance,
      lieuNaissance,
      adresse,
      ville,
      formation,
      niveau,
      anneeEtude,
      modalite,
      motivation,
      newsletter,
    } = req.body;

    if (!nom || !prenom || !email || !telephone || !adresse || !ville || !formation || !niveau) {
      return res.status(400).json({ ok: false, error: "Champs obligatoires manquants" });
    }

    await pool.query(
      `INSERT INTO inscriptions (
        nom,
        prenom,
        email,
        telephone,
        date_naissance,
        lieu_naissance,
        adresse,
        ville,
        formation,
        niveau,
        annee_etude,
        modalite,
        motivation,
        newsletter
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14
      )`,
      [
        nom,
        prenom,
        email,
        telephone,
        dateNaissance || null,
        lieuNaissance || null,
        adresse,
        ville,
        formation,
        niveau,
        anneeEtude || null,
        modalite || null,
        motivation || null,
        Boolean(newsletter),
      ]
    );

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.post("/api/contact", async (req, res) => {
  try {
    const { nom, email, telephone, sujet, message } = req.body;

    if (!nom || !email || !sujet || !message) {
      return res.status(400).json({ ok: false, error: "Champs obligatoires manquants" });
    }

    await pool.query(
      `INSERT INTO messages_contact (nom, email, telephone, sujet, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [nom, email, telephone || null, sujet, message]
    );

    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.get("/api/inscriptions", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM inscriptions ORDER BY created_at DESC"
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.get("/api/messages", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM messages_contact ORDER BY created_at DESC"
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.listen(port, () => {
  console.log(`API en ligne sur http://localhost:${port}`);
  console.log(`Admin panel: http://localhost:${port}/admin.html`);
});
