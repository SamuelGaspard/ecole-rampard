const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });
const port = Number(process.env.PORT || 3000);
const directorPassword = process.env.DIRECTOR_PASSWORD || "rampard-directeur";
const directorTokens = new Set();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "accueil")));

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || "ecole_rampard",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "postgres",
      }
);

pool.on("error", (error) => {
  console.error("Erreur PostgreSQL inattendue :", error.message);
});

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "db", "init.sql"), "utf8");
  await pool.query(schema);
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

function isDirectorAuthenticated(req) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ") && directorTokens.has(authorization.slice(7));
}

function isSocketDirectorAuthenticated(socket) {
  return directorTokens.has(socket.handshake.auth?.directorToken);
}

app.post("/api/director/login", (req, res) => {
  if (req.body?.password !== directorPassword) {
    return res.status(401).json({ ok: false, error: "Mot de passe incorrect" });
  }
  const token = crypto.randomBytes(32).toString("hex");
  directorTokens.add(token);
  return res.json({ ok: true, token });
});

app.get("/api/eleves", async (req, res) => {
  try {
    const { nom } = req.query;
    if (!nom) {
      return res.status(400).json({ ok: false, error: "Nom de l'élève requis" });
    }
    const result = await pool.query(
      `SELECT id, nom, prenom FROM inscriptions
       WHERE LOWER(nom) = LOWER($1)
       LIMIT 1`,
      [String(nom).trim()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Élève introuvable" });
    }
    return res.json({ ok: true, eleve: result.rows[0] });
  } catch (error) {
    console.error("Erreur lors de la recherche de l'élève :", error.message);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.get("/api/conversations/:eleveId/messages", async (req, res) => {
  try {
    if (!isDirectorAuthenticated(req)) {
      return res.status(401).json({ ok: false, error: "Connexion direction requise" });
    }
    const result = await pool.query(
      `SELECT cm.id, cm.sender, cm.message, cm.created_at
       FROM conversation_messages cm
       JOIN conversations c ON c.id = cm.conversation_id
       WHERE c.inscription_id = $1
       ORDER BY cm.created_at ASC`,
      [req.params.eleveId]
    );
    return res.json({ ok: true, messages: result.rows });
  } catch (error) {
    console.error("Erreur lors du chargement de la conversation :", error.message);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.get("/api/conversations", async (req, res) => {
  try {
    if (!isDirectorAuthenticated(req)) {
      return res.status(401).json({ ok: false, error: "Connexion direction requise" });
    }
    const result = await pool.query(
      `SELECT c.id, i.id AS eleve_id, i.nom, i.prenom,
              COUNT(cm.id)::int AS message_count, MAX(cm.created_at) AS last_message
       FROM conversations c
       JOIN inscriptions i ON i.id = c.inscription_id
       LEFT JOIN conversation_messages cm ON cm.conversation_id = c.id
       GROUP BY c.id, i.id, i.nom, i.prenom
       ORDER BY last_message DESC NULLS LAST`
    );
    return res.json({ ok: true, conversations: result.rows });
  } catch (error) {
    console.error("Erreur lors du chargement des conversations :", error.message);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    if (!isDirectorAuthenticated(req)) {
      return res.status(401).json({ ok: false, error: "Connexion direction requise" });
    }
    const [inscriptions, contacts, conversations] = await Promise.all([
      pool.query(`SELECT created_at::date AS day, COUNT(*)::int AS total
                  FROM inscriptions GROUP BY day ORDER BY day`),
      pool.query(`SELECT created_at::date AS day, COUNT(*)::int AS total
                  FROM messages_contact GROUP BY day ORDER BY day`),
      pool.query(`SELECT created_at::date AS day, COUNT(*)::int AS total
                  FROM conversation_messages GROUP BY day ORDER BY day`),
    ]);
    return res.json({
      ok: true,
      inscriptions: inscriptions.rows,
      contacts: contacts.rows,
      conversations: conversations.rows,
    });
  } catch (error) {
    console.error("Erreur lors du chargement des statistiques :", error.message);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

async function saveMessage(eleveId, sender, message) {
  const conversation = await pool.query(
    `INSERT INTO conversations (inscription_id) VALUES ($1)
     ON CONFLICT (inscription_id) DO UPDATE SET inscription_id = EXCLUDED.inscription_id
     RETURNING id`,
    [eleveId]
  );
  const result = await pool.query(
    `INSERT INTO conversation_messages (conversation_id, sender, message)
     VALUES ($1, $2, $3) RETURNING id, sender, message, created_at`,
    [conversation.rows[0].id, sender, message.trim()]
  );
  return { conversationId: conversation.rows[0].id, message: result.rows[0] };
}

io.on("connection", (socket) => {
  if (isSocketDirectorAuthenticated(socket)) {
    socket.join("directors");
  }

  socket.on("conversation:join", (eleveId) => {
    const room = isSocketDirectorAuthenticated(socket)
      ? `eleve:${eleveId}`
      : `parent:${eleveId}`;
    socket.join(room);
  });

  socket.on("conversation:message", async ({ eleveId, message }) => {
    try {
      if (!eleveId || !message?.trim()) return;
      const sender = isSocketDirectorAuthenticated(socket) ? "direction" : "parent";
      const saved = await saveMessage(eleveId, sender, message);
      if (sender === "direction") {
        io.to(`parent:${eleveId}`).emit("conversation:message", saved.message);
        socket.emit("conversation:message", saved.message);
      } else {
        socket.emit("conversation:message", saved.message);
        io.to("directors").emit("conversation:message", {
          ...saved.message,
          eleveId,
        });
      }
    } catch (error) {
      socket.emit("conversation:error", "Message non enregistré");
      console.error("Erreur lors de l'enregistrement du message privé :", error.message);
    }
  });
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
    console.error("Erreur lors de l'enregistrement de l'inscription :", error.message);
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
    console.error("Erreur lors de l'enregistrement du message :", error.message);
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

app.get("/api/inscriptions", async (req, res) => {
  try {
    if (!isDirectorAuthenticated(req)) {
      return res.status(401).json({ ok: false, error: "Connexion direction requise" });
    }
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
    if (!isDirectorAuthenticated(req)) {
      return res.status(401).json({ ok: false, error: "Connexion direction requise" });
    }
    const result = await pool.query(
      "SELECT * FROM messages_contact ORDER BY created_at DESC"
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ ok: false, error: "Erreur serveur" });
  }
});

initializeDatabase()
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`API en ligne sur http://localhost:${port}`);
      console.log(`Admin panel: http://localhost:${port}/admin.html`);
    });
  })
  .catch((error) => {
    const details = [error.code, error.message, error.detail]
      .filter(Boolean)
      .join(" - ");
    console.error(
      "Impossible d'initialiser la base de données :",
      details || error
    );
    process.exitCode = 1;
  });
