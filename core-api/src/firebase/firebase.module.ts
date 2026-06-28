import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

// @Global() : permet d'injecter FirebaseService dans n'importe quel module
// sans avoir à réimporter FirebaseModule à chaque fois.

@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
