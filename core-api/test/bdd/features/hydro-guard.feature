Feature: Hydro-Guard
  En tant qu'utilisateur de KayyDrive
  Je veux voir les zones inondables
  Afin d'eviter les routes dangereuses

  Scenario: TF-HYD-01 — Visualisation zones a risque
    Given un utilisateur authentifie
    When il demande les incidents de type "inondation"
    Then l'API retourne une liste d'incidents
    And chaque incident contient des coordonnees GPS
    And chaque incident a un type "inondation"
