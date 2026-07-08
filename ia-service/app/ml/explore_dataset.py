import h5py
import numpy as np

with h5py.File('pothole_depth.hdf5', 'r') as f:
    print("=== TYPES D'ÉVÉNEMENTS ===")
    for t in f['idx/type'].keys():
        events = list(f[f'idx/type/{t}'].keys())
        print(f"{t}: {len(events)} événements")

    print("\n=== EXEMPLE POTHOLE ===")
    # Les données sont dans 'samples', pas dans idx/type
    samples = list(f['samples'].keys())
    print(f"Nombre total de samples: {len(samples)}")
    print(f"Premier sample: {samples[0]}")

    first = samples[0]
    print(f"Contenu: {list(f[f'samples/{first}'].keys())}")

    # Afficher les données
    sample = f[f'samples/{first}']
    for key in sample.keys():
        print(f"{key}: {np.array(sample[key])[:3]}")

    # Afficher les attributs (label, type...)
    print("\nAttributs:")
    for attr in sample.attrs:
        print(f"  {attr}: {sample.attrs[attr]}")