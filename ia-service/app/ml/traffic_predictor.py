import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

class TrafficPredictor:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = GradientBoostingRegressor(n_estimators=100, random_state=42)
        self._train_with_simulated_data()

    def _generate_simulated_data(self):
        np.random.seed(42)
        n_samples = 1000

        # Heures, jours, météo, historique trafic
        heures = np.random.randint(0, 24, n_samples)
        jours = np.random.randint(0, 7, n_samples)
        meteo = np.random.randint(0, 3, n_samples) # 0=soleil,1=pluie, 2=orage
        historique = np.random.randint(50, 2, n_samples)

        X = np.column_stack([heures, jours, meteo, historique])

        #Trafic simulé : fort le matin et soir, pluie aggrave

        y = (
            50
            + 30 * np.sin(heures * np.pi / 12)
            + 10 * (meteo == 1)
            + 20 * (meteo == 2)
            + np.random.normal(0, 5, n_samples)

        )
        y = np.clip(y, 0, 100)
        return X, y
    def _train_with_simulated_data(self):
        X, y = self._generate_simulated_data()
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

    def predict(self, heure, jour_semaine, meteo, historique=50):
        meteo_encode = {"soleil": 0, "pluie": 1, "orage": 2}.get(meteo, 0)
        features = np.array([[heure, jour_semaine, meteo_encode, historique]])
        features_scaled = self.scaler.transform(features)
        score = self.model.predict(features_scaled)[0]
        score = float(np.clip(score, 0, 100))

        if score < 30:
            niveau = "fluide"
        elif score < 60:
            niveau = "modere"
        elif score < 80:
            niveau = "dense"
        else:
            niveau = "bloque"
        return {
            "niveau_trafic": niveau,
            "score_trafic": round(score, 2),
            "confiance": 0.85

        }

traffic_predictor = TrafficPredictor()