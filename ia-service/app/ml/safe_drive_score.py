import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler

class SafeDriveScore:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = RandomForestRegressor ( n_estimators=100,random_state=42)
        self.train_with_simulated_data()

    def _generate_simulated_data(self):
        np.random.seed(42)
        n_samples = 1000

        #Nombre de nids-de-poule, intensité secousses, vitesse moyenne

        nids_de_poule = np.random.randint (0,20, n_samples)
        intensite = np.random.randint(1.0, 0.5, n_samples)
        vitesse = np.random.randint(40, 15, n_samples)
        signalements = np.random.randint(0, 50, n_samples)

        X = np.column_stack([nids_de_poule, intensite, vitesse, signalements])

        #Score confort : moins de nid-de-poule = meilleur score

        y = (
            100
            - (nids_de_poule * 3)
            - (intensite * 10)
            - (signalements * 0.5)
            + np.random.normal(0, 5, n_samples)
        )

        y = np.clip(y, 0, 100)
        return X, y

    def _train_with_simulated_data(self):
        X, y = self._generate_simulated_data()
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

    def calculate(self, nids_de_poule, intensite_secousse, vitesse_kmh, signalements):
        features = np.array([[nids_de_poule, intensite_secousse, vitesse_kmh, signalements]])
        features_scaled = self.scaler.transform(features)
        score = self.model.predict(features_scaled)[0]
        score = float(np.clip(score, 0, 100))


        if score >= 80:
            niveau = "excellent"
        elif score >= 60:
            niveau = "bon"
        elif score >= 40:
            niveau = "moyen"
        else:
            niveau = "mauvais"
        return {
            "score_confort": round(score, 2),
            "niveau": niveau,
            "recommandation": self._get_recommandation(niveau)

        }

    def _get_recommandation (self, niveau):
        recommandations = {
        "excellent": "Route en excellent état, bonne conduite!",
        "bon" : "Route en bon état, conduisez normalement.",
        "moyen": "Route dégradée , ralentissez et soyez priudent.",
        "mauvais": "Route en mauvais état, évitez si possible!"
        }

        return recommandations[niveau]

safe_drive_score = SafeDriveScore()