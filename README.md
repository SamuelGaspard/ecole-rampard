# ecole-rampard

## Lancer l'application

1. Installez Node.js et PostgreSQL.
2. Copiez `.env.example` vers `.env` et adaptez les identifiants PostgreSQL.
3. Lancez `npm install`, puis `npm start`.

Le serveur initialise automatiquement les tables définies dans `db/init.sql`. Si le démarrage échoue, consultez le message `Impossible d'initialiser la base de données` dans la console : il indique la cause réelle (identifiants incorrects, PostgreSQL arrêté ou base inexistante).
