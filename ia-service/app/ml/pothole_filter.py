import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import h5py
import os


class PotholeFilter:
    def __init__(self):
        self.scaler = StandardScaler()
        self.model = RandomForestClassifier(n_estimators=100, random_state=42)
        self.accuracy = None

        dataset_path = os.path.join(os.path.dirname(__file__), 'pothole_depth.hdf5')

        if os.path.exists(dataset_path):
            print("Dataset réel trouvé — entraînement avec données réelles...")
            self._train_with_real_data(dataset_path)
        else:
            print("Dataset non trouvé — entraînement avec données simulées...")
            self._train_with_simulated_data()

    def _extract_features(self, acc_x, acc_y, acc_z, speed):
        """
        Extrait 5 features statistiques depuis les séries temporelles accéléromètre.
        On résume chaque série par ses caractéristiques clés.
        """
        return [
            float(np.max(np.abs(acc_z))),          # pic vertical max (nid-de-poule = fort)
            float(np.max(np.abs(acc_x))),          # pic latéral max (virage/freinage = fort)
            float(np.max(np.abs(acc_y))),          # pic avant/arrière max
            float(len(acc_z)),                     # durée de l'événement (nb échantillons)
            float(speed),                          # vitesse au moment de l'événement
        ]

    def _train_with_real_data(self, path):
        X, y = [], []

        with h5py.File(path, 'r') as f:
            for sample_id in f['samples'].keys():
                sample = f[f'samples/{sample_id}']
                event_type = sample.attrs.get('type', '')
                speed = float(sample.attrs.get('speed', 30))

                acc_x = np.array(sample['acc_x'])
                acc_y = np.array(sample['acc_y'])
                acc_z = np.array(sample['acc_z'])

                features = self._extract_features(acc_x, acc_y, acc_z, speed)

                # Pothole = 1, tout le reste = 0 (fausse alerte)
                label = 1 if event_type == 'Pothole' else 0

                X.append(features)
                y.append(label)

        X = np.array(X)
        y = np.array(y)

        print(f"Dataset chargé: {len(y)} échantillons | Potholes: {sum(y)} | Fausses alertes: {len(y)-sum(y)}")

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        self.model.fit(X_train_scaled, y_train)
        self.accuracy = round(self.model.score(X_test_scaled, y_test) * 100, 2)
        print(f"Précision du modèle: {self.accuracy}%")

    def _generate_simulated_data(self):
        np.random.seed(42)
        n_samples = 500

        real_potholes = np.column_stack([
            np.random.normal(2.5, 0.5, n_samples),  # pic acc_z fort
            np.random.normal(0.2, 0.1, n_samples),  # pic acc_x faible
            np.random.normal(0.2, 0.1, n_samples),  # pic acc_y faible
            np.random.normal(120, 20, n_samples),   # durée courte
            np.random.normal(40, 10, n_samples),    # vitesse normale
        ])

        false_alerts = np.column_stack([
            np.random.normal(1.0, 0.4, n_samples),  # pic acc_z modéré
            np.random.normal(1.0, 0.3, n_samples),  # pic acc_x fort
            np.random.normal(1.0, 0.3, n_samples),  # pic acc_y fort
            np.random.normal(300, 50, n_samples),   # durée longue
            np.random.normal(20, 5, n_samples),     # vitesse faible
        ])

        X = np.vstack([real_potholes, false_alerts])
        y = np.array([1] * n_samples + [0] * n_samples)
        return X, y

    def _train_with_simulated_data(self):
        X, y = self._generate_simulated_data()
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)

    def predict(self, axe_x, axe_y, axe_z, duree, vitesse_kmh):
        """
        Prédit si un événement est un vrai nid-de-poule.
        axe_x, axe_y, axe_z : valeurs pic de l'accéléromètre (m/s²)
        duree               : durée de l'événement en nb d'échantillons
        vitesse_kmh         : vitesse du véhicule en km/h
        """
        vitesse_ms = vitesse_kmh / 3.6
        features = np.array([[axe_z, axe_x, axe_y, duree, vitesse_ms]])
        features_scaled = self.scaler.transform(features)
        prediction = self.model.predict(features_scaled)[0]
        confiance = self.model.predict_proba(features_scaled)[0][prediction]

        return {
            "est_vrai_nid_de_poule": bool(prediction),
            "confiance": round(float(confiance), 2),
            "modele": "real_data" if self.accuracy else "simulated_data",
            "precision_modele": self.accuracy
        }


pothole_filter = PotholeFilter()