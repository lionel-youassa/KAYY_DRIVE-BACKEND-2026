import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

class PotholeFilter:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.train_with_simulated_data()

    def _generate_simulated_data(selfself):
        np.random.seed(42)
        n_samples = 500

        # Vrais nids-de-poule : secousse verticale forte et courte
        real_potholes = np.column_stack([
            np.random.normal(0.2, 0.1, n_samples),  # axe_x faible
            np.random.normal(0.2, 0.1, n_samples),  # axe_y faible
            np.random.normal(2.5, 0.5, n_samples),  # axe_z fort
            np.random.normal(0.1, 0.05, n_samples), # duree courte
            np.random.normal(40, 10, n_samples),    # vitesse normale
        ])

        # Fausses alertes : dos d'ane, freinage, virage

        false_alerts = np.column_stack([
            np.random.normal(1.0, 0.3, n_samples),  # axe_x fort
            np.random.normal(1.0, 0.3, n_samples),  # axe_y fort
            np.random.normal(1.0, 0.4, n_samples),  # axe_z modere
            np.random.normal(0.5, 0.2, n_samples),  # duree longue
            np.random.normal(20, 5, n_samples),  # vitesse faible
        ])

        X = np.vstack([real_potholes, false_alerts])
        y = np.array([1] * n_samples + [0] * n_samples)
        return X, y

    def _train_with_simulated_data(self):
        X, y = self._generate_simulated_data()
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

    def predict (self, axe_x, axe_y, axe_z, duree, vitesse_kmh):
        features = np.array([[axe_x, axe_y, axe_z, duree, vitesse_kmh]])
        features_scaled = self.scaler.transform(features)
        prediction = self.model.predict(features_scaled)[0]
        confiance = self.model.predict_proba(features_scaled)[0][prediction]
        return {
            "est_vrai_nid_de_poule": bool(prediction),
            "confiance": round(float(confiance), 2)
        }
pothole_filter = PotholeFilter()