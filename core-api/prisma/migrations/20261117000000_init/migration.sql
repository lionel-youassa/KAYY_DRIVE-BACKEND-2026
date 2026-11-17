-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "NiveauRisque" AS ENUM ('SUR', 'MODERE', 'RISQUE_INONDATION', 'ROUTE_DEGRADEE');

-- CreateEnum
CREATE TYPE "TypeIncident" AS ENUM ('INONDATION', 'QUALITE_ROUTE', 'TRAFIC', 'ROUTE_ENDOMMAGEE');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "pseudo" TEXT NOT NULL,
    "prenom" TEXT DEFAULT '',
    "email" TEXT NOT NULL,
    "pendingEmail" TEXT,
    "passwordHash" TEXT,
    "telephone" TEXT,
    "photoUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "scoreReputation" INTEGER NOT NULL DEFAULT 0,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "googleId" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT true,
    "emailVerificationCodeHash" TEXT,
    "emailVerificationExpiresAt" TIMESTAMP(3),
    "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailVerificationLastSentAt" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorCodeHash" TEXT,
    "twoFactorExpiresAt" TIMESTAMP(3),
    "twoFactorAttempts" INTEGER NOT NULL DEFAULT 0,
    "twoFactorLastSentAt" TIMESTAMP(3),
    "passwordResetCodeHash" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
    "passwordResetLastSentAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferencesUtilisateur" (
    "id" TEXT NOT NULL,
    "eviterPeages" BOOLEAN NOT NULL DEFAULT false,
    "prioriserRoutesSecu" BOOLEAN NOT NULL DEFAULT true,
    "eviterZonesInondables" BOOLEAN NOT NULL DEFAULT true,
    "modeHorsLigneActif" BOOLEAN NOT NULL DEFAULT false,
    "utilisateurId" TEXT NOT NULL,

    CONSTRAINT "PreferencesUtilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionNavigation" (
    "id" TEXT NOT NULL,
    "heureDebut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vitesseActuelle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,

    CONSTRAINT "SessionNavigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Itineraire" (
    "id" TEXT NOT NULL,
    "distanceTotale" DOUBLE PRECISION NOT NULL,
    "dureeEstimee" INTEGER NOT NULL,
    "niveauRisque" "NiveauRisque" NOT NULL DEFAULT 'SUR',
    "estHorsLigne" BOOLEAN NOT NULL DEFAULT false,
    "sessionId" TEXT NOT NULL,
    "depart" geometry(Point, 4326) NOT NULL,
    "arrivee" geometry(Point, 4326) NOT NULL,

    CONSTRAINT "Itineraire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentRoute" (
    "id" TEXT NOT NULL,
    "vitesseMoyenne" INTEGER NOT NULL,
    "estOfficiel" BOOLEAN NOT NULL DEFAULT true,
    "estInonde" BOOLEAN NOT NULL DEFAULT false,
    "scoreQualite" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "dateDerniereMaj" TIMESTAMP(3) NOT NULL,
    "path" geometry(LineString, 4326) NOT NULL,

    CONSTRAINT "SegmentRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "type" "TypeIncident" NOT NULL,
    "description" TEXT,
    "horodatage" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nombreConfirmations" INTEGER NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'non_confirme',
    "idRapporteur" TEXT NOT NULL,
    "segmentId" TEXT,
    "niveauEau" INTEGER,
    "estPraticable" BOOLEAN,
    "niveauVibration" DOUBLE PRECISION,
    "tailleNidPoule" TEXT,
    "detecteAuto" BOOLEAN,
    "dateExpiration" TIMESTAMP(3),
    "confirmePar" TEXT[],
    "id_utilisateur_createur" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "quartier" TEXT,
    "ville" TEXT,
    "region" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publicite" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publicite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recompense" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "imageUrl" TEXT,
    "participationMin" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recompense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaccourciCommunautaire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pointDepartLat" DOUBLE PRECISION NOT NULL,
    "pointDepartLng" DOUBLE PRECISION NOT NULL,
    "pointArriveeLat" DOUBLE PRECISION NOT NULL,
    "pointArriveeLng" DOUBLE PRECISION NOT NULL,
    "trace" JSONB NOT NULL,
    "idUtilisateurCreateur" TEXT NOT NULL,
    "votesPositifs" INTEGER NOT NULL DEFAULT 0,
    "votesNegatifs" INTEGER NOT NULL DEFAULT 0,
    "scoreFiabilite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "statut" TEXT NOT NULL DEFAULT 'propose',
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaccourciCommunautaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteRaccourci" (
    "id" TEXT NOT NULL,
    "raccourciId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "dateVote" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteRaccourci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositionUtilisateur" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "derniereMiseAJour" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionUtilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "corps" TEXT NOT NULL,
    "data" JSONB,
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "icone" TEXT NOT NULL,
    "couleur" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdresseFavorite" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "categorieId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdresseFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleveTrafic" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "vitesseMoyenne" DOUBLE PRECISION NOT NULL,
    "niveau" TEXT NOT NULL,
    "id_utilisateur" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleveTrafic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecousseData" (
    "id" TEXT NOT NULL,
    "id_utilisateur" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "intensite" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "traite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SecousseData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenHash" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ItineraireToSegmentRoute" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_pendingEmail_key" ON "Utilisateur"("pendingEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_googleId_key" ON "Utilisateur"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferencesUtilisateur_utilisateurId_key" ON "PreferencesUtilisateur"("utilisateurId");

-- CreateIndex
CREATE INDEX "SegmentRoute_path_idx" ON "SegmentRoute" USING GIST ("path");

-- CreateIndex
CREATE INDEX "RaccourciCommunautaire_statut_idx" ON "RaccourciCommunautaire"("statut");

-- CreateIndex
CREATE UNIQUE INDEX "VoteRaccourci_raccourciId_utilisateurId_key" ON "VoteRaccourci"("raccourciId", "utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "PositionUtilisateur_utilisateurId_key" ON "PositionUtilisateur"("utilisateurId");

-- CreateIndex
CREATE INDEX "Categorie_ordre_idx" ON "Categorie"("ordre");

-- CreateIndex
CREATE INDEX "ReleveTrafic_latitude_longitude_idx" ON "ReleveTrafic"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "ReleveTrafic_timestamp_idx" ON "ReleveTrafic"("timestamp");

-- CreateIndex
CREATE INDEX "SecousseData_timestamp_idx" ON "SecousseData"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_utilisateurId_idx" ON "RefreshToken"("utilisateurId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "_ItineraireToSegmentRoute_AB_unique" ON "_ItineraireToSegmentRoute"("A", "B");

-- CreateIndex
CREATE INDEX "_ItineraireToSegmentRoute_B_index" ON "_ItineraireToSegmentRoute"("B");

-- AddForeignKey
ALTER TABLE "PreferencesUtilisateur" ADD CONSTRAINT "PreferencesUtilisateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionNavigation" ADD CONSTRAINT "SessionNavigation_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Itineraire" ADD CONSTRAINT "Itineraire_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SessionNavigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_idRapporteur_fkey" FOREIGN KEY ("idRapporteur") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "SegmentRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaccourciCommunautaire" ADD CONSTRAINT "RaccourciCommunautaire_idUtilisateurCreateur_fkey" FOREIGN KEY ("idUtilisateurCreateur") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRaccourci" ADD CONSTRAINT "VoteRaccourci_raccourciId_fkey" FOREIGN KEY ("raccourciId") REFERENCES "RaccourciCommunautaire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRaccourci" ADD CONSTRAINT "VoteRaccourci_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionUtilisateur" ADD CONSTRAINT "PositionUtilisateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdresseFavorite" ADD CONSTRAINT "AdresseFavorite_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdresseFavorite" ADD CONSTRAINT "AdresseFavorite_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleveTrafic" ADD CONSTRAINT "ReleveTrafic_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecousseData" ADD CONSTRAINT "SecousseData_id_utilisateur_fkey" FOREIGN KEY ("id_utilisateur") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItineraireToSegmentRoute" ADD CONSTRAINT "_ItineraireToSegmentRoute_A_fkey" FOREIGN KEY ("A") REFERENCES "Itineraire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ItineraireToSegmentRoute" ADD CONSTRAINT "_ItineraireToSegmentRoute_B_fkey" FOREIGN KEY ("B") REFERENCES "SegmentRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
