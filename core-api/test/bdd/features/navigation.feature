Feature: Navigation
  En tant qu'utilisateur de KayyDrive
  Je veux utiliser les fonctionnalites de navigation
  Afin de me deplacer en securite

  Scenario: TF-NAV-01 — Affichage de la carte
    Given un utilisateur authentifie
    When il demande sa position actuelle via l'API geocoding
    Then l'API retourne des coordonnees GPS valides
    And la reponse contient une latitude et une longitude

  Scenario: TF-NAV-02 — Recherche destination
    Given un utilisateur authentifie
    When il recherche la destination "Dakar Plateau"
    Then l'API retourne une liste de resultats
    And chaque resultat contient des coordonnees GPS
    And le premier resultat contient "Dakar"
