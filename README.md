# ecole-rampard

## Lancer l'application

1. Installez Node.js et PostgreSQL.
2. Copiez `.env.example` vers `.env` et adaptez les identifiants PostgreSQL.
3. Lancez `npm install`, puis `npm start`.

Le serveur initialise automatiquement les tables définies dans `db/init.sql`. Si le démarrage échoue, consultez le message `Impossible d'initialiser la base de données` dans la console : il indique la cause réelle (identifiants incorrects, PostgreSQL arrêté ou base inexistante).

## Suivi et conversations

- Tableau de bord : `http://localhost:3000/admin.html`
- Messagerie parent-direction : `http://localhost:3000/conversation.html`
- Le parent recherche l'élève avec le nom et le prénom enregistrés dans une inscription.
- Les messages sont conservés dans PostgreSQL et transmis en temps réel avec Socket.IO.

La sélection du rôle « Direction » est prévue pour les tests locaux. Avant une mise en ligne, il faut ajouter une authentification pour réserver le tableau de bord et les réponses de la direction aux personnes autorisées.
