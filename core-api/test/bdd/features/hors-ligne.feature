Feature: Hors-ligne
  En tant qu'utilisateur de KayyDrive
  Je veux mettre en cache les donnees de la carte
  Afin d'utiliser l'application sans internet

  Scenario: TF-OFF-01 — Mise en cache des tuiles
    Given un utilisateur authentifie
    When il demande le telechargement des tuiles pour la zone definie
    Then l'API retourne les donnees de tuiles
    And la reponse a un statut 200 ou 201
