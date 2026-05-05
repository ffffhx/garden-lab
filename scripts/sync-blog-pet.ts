import { writeBlogPetSnapshot } from "../lib/content/blog-pet-snapshot";

const snapshot = writeBlogPetSnapshot();

console.log(
  `Synced blog pet: level=${snapshot.pet.level}, xp=${snapshot.pet.xp}, meals=${snapshot.pet.totalMeals}, evolution=${snapshot.pet.evolution.label}`
);
