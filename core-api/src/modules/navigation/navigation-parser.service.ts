import { Injectable } from '@nestjs/common';

@Injectable()
export class NavigationParserService {
  /**
   * Traduit les manœuvres OSRM en français
   */
  private readonly translations = {
    turn: 'Tournez',
    'new name': 'Continuez sur',
    depart: 'Départ de',
    arrive: 'Arrivée à',
    merge: 'Rejoignez',
    ramp: 'Prenez la rampe',
    'on ramp': 'Prenez la bretelle',
    'off ramp': 'Sortez de la bretelle',
    fork: 'Au carrefour, prenez',
    roundabout: 'Au rond-point, prenez',
    'exit roundabout': 'Sortez du rond-point',
    'slight right': 'légèrement à droite',
    right: 'à droite',
    'sharp right': 'complètement à droite',
    'slight left': 'légèrement à gauche',
    left: 'à gauche',
    'sharp left': 'complètement à gauche',
    straight: 'tout droit',
    uturn: 'faites demi-tour',
  };

  /**
   * Parse la réponse brute d'OSRM pour extraire des instructions lisibles
   * Amélioré avec des étapes textuelles précises incluant les noms de rues
   */
  parseInstructions(osrmData: any): any[] {
    if (!osrmData.routes || osrmData.routes.length === 0) return [];

    const instructions: any[] = [];
    const route = osrmData.routes[0];

    route.legs.forEach((leg) => {
      leg.steps.forEach((step, index) => {
        const distance = this.formatDistance(step.distance);
        const maneuverType = step.maneuver.type;
        const modifier = step.maneuver.modifier;
        const streetName = step.name || 'Rue inconnue';
        const nextStreetName = leg.steps[index + 1]?.name || '';

        let text = '';

        // Construction de la phrase de guidage améliorée
        if (maneuverType === 'depart') {
          text = `Départ de ${streetName}`;
        } else if (maneuverType === 'arrive') {
          text = `Arrivée à ${streetName}`;
        } else {
          const action = this.translations[maneuverType] || maneuverType;
          const direction = this.translations[modifier] || modifier || '';
          
          // Instructions plus précises avec nom de rue de destination
          if (nextStreetName && nextStreetName !== streetName) {
            text = `Dans ${distance}, ${action} ${direction} vers ${nextStreetName}`;
          } else {
            text = `Dans ${distance}, ${action} ${direction} sur ${streetName}`;
          }
        }

        instructions.push({
          text,
          distance: step.distance,
          duration: step.duration,
          location: step.maneuver.location,
          type: maneuverType,
          streetName: streetName,
          instructionIndex: index,
        });
      });
    });

    return instructions;
  }

  /**
   * Formate la distance de mètres en km si nécessaire
   */
  private formatDistance(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  }
}
